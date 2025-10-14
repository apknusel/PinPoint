import os
from flask import Flask, render_template, redirect, url_for, current_app, session, request, jsonify
from authlib.integrations.flask_client import OAuth
from urllib.parse import quote_plus, urlencode
from dotenv import load_dotenv
import uuid
import db

load_dotenv()

oauth = None

def setup():
    global oauth
    app.secret_key = os.environ.get("APP_SECRET_KEY")
    current_app.config["GOOGLE_MAPS_API_KEY"] = os.environ.get("GOOGLE_MAPS_API_KEY")
    current_app.config["DB_POOL"] = db.init_pool(os.environ.get("DATABASE_URL"))
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
    print(userinfo)
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
    ensure_logged_in_user()
    return redirect(url_for("index"))

@app.route("/api/posts")
def get_posts():
    pool = current_app.config["DB_POOL"]
    return jsonify(db.fetch_posts(pool))

@app.route("/api/posts/<username>")
def get_posts_by_username(username):
    pool = current_app.config["DB_POOL"]
    return jsonify(db.fetch_posts_by_username(pool, username))

@app.route("/api/<post_id>/comment", methods=["POST"])
def add_comment(post_id):
    if not session.get("userinfo"):
        return redirect(url_for("login"))
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
    return render_template("post.html", post=post, comments=comments, recommended_posts=recommended_posts)

@app.route("/create/post", methods=["GET", "POST"])
def create_post():
    if not session.get("userinfo"):
        return redirect(url_for("login"))
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
    file_bytes = file.read()
    file_name = file.filename
    pool = current_app.config["DB_POOL"]
    db.insert_post_with_media(pool, post_id, caption, user_id, lng_f, lat_f, media_id, file_name, file_bytes)
    return redirect(url_for("post", post_id=post_id))

@app.route("/profile")
def profile_root():
    if not session.get("userinfo"):
        return redirect(url_for("login"))
    userinfo = session["userinfo"]
    return redirect(url_for("profile", username=userinfo.get("nickname")))

@app.route("/profile/<username>")
def profile(username):
    pool = current_app.config["DB_POOL"]
    profile_picture = db.fetch_user_profile_image(pool, username)
    posts = db.fetch_users_post_images(pool, username)
    return render_template("profile.html", username=username, profile_picture=profile_picture, posts=posts)

@app.route("/profile/<username>/map")
def profile_map(username):
    return render_template("profile_map.html", username=username)

# TODO: Make sure this route has authentication and authorization setup so you can only access your own user settings
@app.route("/profile/<username>/settings")
def profile_settings(username):
    return render_template("profile_settings.html", username=username)

@app.route("/api/search_users")
def search():
    print(os.environ.get("DATABASE_UR"))
    name = request.args.get('name')
    pool = current_app.config["DB_POOL"]
    matching_users = db.fetch_users(pool, name)
    return jsonify(matching_users)

