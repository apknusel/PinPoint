import os
import db
import uuid
import io
from flask import Flask, render_template, redirect, url_for, current_app, session, request, jsonify
from authlib.integrations.flask_client import OAuth
from urllib.parse import quote_plus, urlencode, unquote_plus
from dotenv import load_dotenv
from functools import wraps
from PIL import Image, ImageOps

load_dotenv()

oauth = None


def requires_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("userinfo"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated

def setup():
    global oauth
    app.secret_key = os.environ.get("APP_SECRET_KEY")
    current_app.config["GOOGLE_MAPS_API_KEY"] = os.environ.get(
        "GOOGLE_MAPS_API_KEY")
    current_app.config["MAPBOX_ACCESS_TOKEN"] = os.environ.get(
        "MAPBOX_ACCESS_TOKEN")
    current_app.config["DB_POOL"] = db.init_pool(
        os.environ.get("DATABASE_URL"))
    oauth = OAuth(app)
    oauth.register(
        "auth0",
        client_id=os.environ.get("AUTH0_CLIENT_ID"),
        client_secret=os.environ.get("AUTH0_CLIENT_SECRET"),
        client_kwargs={
            "scope": "openid profile email",
        },
        server_metadata_url=f'https://{os.environ.get("AUTH0_DOMAIN")}/.well-known/openid-configuration'
    )


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
CLIENT_DIR = os.path.join(BASE_DIR, "client")

app = Flask(
    __name__,
    template_folder=os.path.join(CLIENT_DIR, "templates"),
    static_folder=os.path.join(CLIENT_DIR, "static"),
)


def ensure_logged_in_user():
    userinfo = session.get("userinfo")
    if not userinfo:
        return None
    pool = current_app.config["DB_POOL"]
    user_id = userinfo.get("sub")
    nickname = userinfo.get("nickname") or None
    email = userinfo.get("email") or None
    picture = userinfo.get("picture") or None    
    db.upsert_user(pool, user_id, nickname, email, picture)
    return user_id


with app.app_context():
    setup()


@app.context_processor
def inject_google_maps_key():
    return {"google_maps_api_key": current_app.config.get("GOOGLE_MAPS_API_KEY")}

@app.context_processor
def inject_mapbox_access_token():
    return {"mapbox_access_token": current_app.config.get("MAPBOX_ACCESS_TOKEN")}


@app.route("/login")
def login():
    return oauth.auth0.authorize_redirect(
        redirect_uri=url_for("callback", _external=True)
    )


@app.route("/logout")
def logout():
    if not session:
        return redirect("/")
    session.clear()
    domain = os.environ.get("AUTH0_DOMAIN")
    client_id = os.environ.get("AUTH0_CLIENT_ID")
    return_to = url_for("index", _external=True)
    params = urlencode(
        {
            "returnTo": return_to,
            "client_id": client_id,
        },
        quote_via=quote_plus,
    )

    logout_url = f"https://{domain}/v2/logout?{params}"
    return redirect(logout_url)


@app.route("/callback", methods=["GET", "POST"])
def callback():
    token = oauth.auth0.authorize_access_token()
    try:
        userinfo = oauth.auth0.userinfo()
        session["userinfo"] = userinfo
    except Exception:
        session["userinfo"] = None
    session["user"] = token
    
    pool = current_app.config["DB_POOL"]
    nickname = userinfo.get("nickname")
    profile_data = db.check_profile_complete(pool, nickname)

    session.update(profile_data)

    ensure_logged_in_user()
    return redirect(url_for("index"))

@app.route("/api/check-profile-status")
def get_profile_status():
    logged_in = session.get("user") is not None
    profile_complete = session.get('profile_complete', False)
    return jsonify({
        'logged_in': logged_in,
        'profile_complete': profile_complete
    })

# TODO: This needs 
@app.route("/complete_profile", methods=["GET", "POST"])
@requires_auth
def complete_profile():
    if request.method == 'POST':
        userinfo = session.get("userinfo")
        pool = current_app.config["DB_POOL"]
        user_id = userinfo.get("sub")
        display_name = request.form.get('display_name')
        privacy_settings = (request.form.get('privacy_settings') == "public")
        
        db.update_profile_settings(pool, user_id, display_name, privacy_settings)
        
        session['profile_complete'] = True
        session['display_name'] = display_name
        session['public'] = privacy_settings
        
        return redirect(url_for("index"))
    return render_template("complete_profile.html")

@app.route("/api/posts")
def get_posts():
    pool = current_app.config["DB_POOL"]
    return jsonify(db.fetch_posts(pool))

@app.route("/api/posts/<username>")
def get_posts_by_username(username):
    pool = current_app.config["DB_POOL"]
    return jsonify(db.fetch_posts_by_username(pool, username))

@app.route("/api/posts/by-user/<user_id>")
def get_posts_by_user_id(user_id):
    pool = current_app.config["DB_POOL"]
    return jsonify(db.fetch_posts_by_user_id(pool, user_id))

@app.route("/api/<post_id>/comment", methods=["POST"])
@requires_auth
def add_comment(post_id):
    user_id = ensure_logged_in_user()
    comment = request.form.get("comment", "").strip()
    # comment is empty
    if not comment:
        return redirect(url_for("post", post_id=post_id))
    pool = current_app.config["DB_POOL"]
    comment_id = str(uuid.uuid4())
    db.insert_comment(pool, comment_id, comment, post_id, user_id)
    return redirect(url_for("post", post_id=post_id))


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/post/<post_id>")
def post(post_id):
    pool = current_app.config["DB_POOL"]
    post = db.fetch_single_post(pool, post_id)
    comments = db.fetch_comments(pool, post_id)
    recommended_posts = db.fetch_nearest_posts(pool, post_id, k=5)

    userinfo = session.get("userinfo")
    is_self = False
    if (userinfo and post) and (post["user_id"] == userinfo["sub"]):
        is_self = True
    
    return render_template("post.html", post=post, comments=comments, recommended_posts=recommended_posts, is_self=is_self)


def optimize_image(file_storage, quality=80):
    file_storage.stream.seek(0)
    img = Image.open(file_storage.stream)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    img.thumbnail(img.size, Image.Resampling.LANCZOS)
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=quality, optimize=True, progressive=True)
    return out.getvalue()

def create_thumbnail(file_storage, max_size=320, quality=70):
    file_storage.stream.seek(0)
    img = Image.open(file_storage.stream)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=quality, optimize=True, progressive=True)
    return out.getvalue()

@app.route("/create/post", methods=["GET", "POST"])
@requires_auth
def create_post():
    if request.method == "GET":
        return render_template("create_post.html", google_maps_api_key=os.environ.get("GOOGLE_MAPS_API_KEY"))
    user_id = ensure_logged_in_user()
    if not user_id:
        return redirect(url_for("login"))
    file = request.files.get("image")
    caption = request.form.get("caption", "").strip()
    lat = request.form.get("latitude")
    lng = request.form.get("longitude")
    if not file or not caption or not lat or not lng:
        return "Missing required fields", 400
    try:
        lat_f = float(lat)
        lng_f = float(lng)
    except ValueError:
        return "Invalid coordinates", 400
    post_id = str(uuid.uuid4())
    media_id = str(uuid.uuid4())
    file_bytes = optimize_image(file, quality=80)
    thumb_bytes = create_thumbnail(file, max_size=320, quality=70)
    base, _ = os.path.splitext(file.filename or "upload")
    file_name = f"{base}.jpg"
    pool = current_app.config["DB_POOL"]
    db.insert_post_with_media(
        pool, post_id, caption, user_id, lng_f, lat_f, media_id, file_name, file_bytes, thumb_bytes)
    return redirect(url_for("post", post_id=post_id))


@app.route("/profile")
@requires_auth
def profile_root():
    userinfo = session["userinfo"]
    return redirect(url_for("profile", user_id=userinfo.get("sub")))


@app.route("/profile/<user_id>")
def profile(user_id):
    pool = current_app.config["DB_POOL"]
    userinfo = session.get("userinfo")

    profile_user = db.fetch_user_by_id(pool, user_id)
    if not profile_user:
        return redirect(url_for("index"))

    followers_data = db.fetch_followers(pool, user_id)
    display_name = profile_user.get('display_name')
    profile_picture = db.fetch_user_profile_image_by_user_id(pool, user_id)
    posts = db.fetch_users_post_images_by_user_id(pool, user_id)
    relation = None
    is_self = False
    current_user = False

    if userinfo:
        for follower_by in followers_data['followed_by']:
            if follower_by['follower_id'] == userinfo['sub']:
                relation = "pending" if not follower_by['is_accepted'] else "following"
                break
        current_user = userinfo.get('nickname')
        is_self = (userinfo.get('sub') == user_id)

    return render_template("profile.html",
                           username=user_id,
                           display_name=display_name,
                           is_self=is_self,
                           current_user=current_user,
                           followers_data=followers_data,
                           relation=relation,
                           profile_picture=profile_picture,
                           posts=posts)

@app.route("/settings")
@requires_auth
def settings_root():
    userinfo = session["userinfo"]
    return redirect(url_for("profile_settings", user_id=userinfo.get("sub")))

@app.route("/profile/settings/<user_id>")
@requires_auth
def profile_settings(user_id):
    pool = current_app.config["DB_POOL"]
    userinfo = session["userinfo"]
    user_id = userinfo.get("sub")
    current_settings = db.fetch_user_settings(pool, user_id)
    return render_template("profile_settings.html", 
                           display_name=current_settings["display_name"],
                           public=current_settings["public"])

@app.route("/update_profile_settings", methods=["POST"])
def handle_update_profile_settings():
    pool = current_app.config["DB_POOL"]
    userinfo = session["userinfo"]
    user_id = userinfo.get("sub")
    print(user_id)
    display_name = request.form.get('display_name')
    privacy_settings = (request.form.get('privacy_settings') == "public")
    db.update_profile_settings(pool, user_id, display_name, privacy_settings)
    session['display_name'] = display_name
    session['public'] = privacy_settings
    return redirect(url_for("profile_root"))

@app.route("/api/search_users")
def search():
    name = request.args.get('name')
    pool = current_app.config["DB_POOL"]
    matching_users = db.fetch_users(pool, name, search_for="display_name")
    return jsonify(matching_users)

@app.route("/follower_request_create", methods=['POST'])
def follower_request_creation():
    followee = unquote_plus(request.args.get('followee', ''))
    info = get_request_info(followee)
    if info['followee_id'] is None:
        return jsonify({"success": False, "error": "User not found"}), 404
    
    db.follow_request(info['pool'], info['follower_id'], info["followee_id"])
    return jsonify({"success": True})
   
@app.route("/follower_request_handler", methods=["POST"])
def follower_request_handler():
    data = request.get_json()
    follower = data.get('follower', '')
    followee = data.get('followee', '')
    action = data.get('action', '')
    info = get_request_info(followee,follower)
    db.handle_follow_request(info['pool'], info['follower_id'], info['followee_id'], action)
    return jsonify({"success": True})

def get_request_info(followee, follower=None):
    followee = (followee or "").strip()
    pool = current_app.config["DB_POOL"]
    userinfo = session.get("userinfo")

    result = {
        "follower_id": None,
        "followee_id": None,
        "pool": pool
    }

    if follower:
        result["follower_id"] = follower.strip()
    elif userinfo:
        result["follower_id"] = userinfo.get("sub")

    if followee:
        result["followee_id"] = followee

    return result
