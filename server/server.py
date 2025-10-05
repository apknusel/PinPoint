import os
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import DictCursor
from flask import Flask, render_template, redirect, url_for, current_app, session, request
from contextlib import contextmanager
from authlib.integrations.flask_client import OAuth
from urllib.parse import quote_plus, urlencode
import uuid

pool = None
oauth = None

def setup():
    global pool, oauth
    app.secret_key = os.environ.get("APP_SECRET_KEY")
    DATABASE_URL = os.environ.get("DATABASE_URL")
    GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY")
    current_app.config["GOOGLE_MAPS_API_KEY"] = GOOGLE_MAPS_API_KEY
    current_app.logger.info(f"creating db connection pool")
    pool = ThreadedConnectionPool(1, 100, dsn=DATABASE_URL, sslmode='require')
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

@contextmanager
def get_db_connection():
    connection = None
    try:
        connection = pool.getconn()
        yield connection
    finally:
        pool.putconn(connection)


@contextmanager
def get_db_cursor(commit=False):
    with get_db_connection() as connection:
        cursor = connection.cursor(cursor_factory=DictCursor)
        try:
            yield cursor
            if commit:
                connection.commit()
        finally:
            cursor.close()
            
# App creation

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
CLIENT_DIR = os.path.join(BASE_DIR, "..", "client")

app = Flask(
    __name__,
    template_folder=os.path.join(CLIENT_DIR, "templates"),
    static_folder=os.path.join(CLIENT_DIR, "static"),
)

with app.app_context():
    setup()

@app.context_processor
def inject_google_maps_key():
    return {"google_maps_api_key": current_app.config.get("GOOGLE_MAPS_API_KEY")}

# Auth0 routes

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
    print(session)
    print(session["userinfo"])
    # Upsert user record
    ensure_logged_in_user()
    return redirect(url_for("index"))

def ensure_logged_in_user():
    """
    Ensure the current Auth0 user exists (upsert) in Users table.
    Returns the user_id or None.
    """
    userinfo = session.get("userinfo")
    if not userinfo:
        return None
    user_id = userinfo.get("sub")
    nickname = userinfo.get("nickname") or None
    email = userinfo.get("email") or None
    with get_db_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO Users (user_id, nickname, email)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id) DO UPDATE
              SET nickname = EXCLUDED.nickname,
                  email = EXCLUDED.email
            """,
            (user_id, nickname, email),
        )
    return user_id

# General routes
    
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/post/<post_id>")
def post(post_id):
    return render_template("post.html", post_id=post_id)

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
    print(file, caption, lat, lng, user_id)
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

    with get_db_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO Posts (post_id, caption, user_id, location)
            VALUES (%s, %s, %s, ST_SetSRID(ST_MakePoint(%s,%s),4326))
            """,
            (post_id, caption, user_id, lng_f, lat_f),
        )
        cur.execute(
            """
            INSERT INTO Media (media_id, file_name, file_data, post_id)
            VALUES (%s, %s, %s, %s)
            """,
            (media_id, file_name, file_bytes, post_id),
        )
    return redirect(url_for("post", post_id=post_id))

@app.route("/profile")
def profile_root():
    if not session.get("userinfo"):
        return redirect(url_for("login"))
    userinfo = session["userinfo"]
    return redirect(url_for("profile", username=userinfo.get("nickname")))
        

@app.route("/profile/<username>")
def profile(username):
    return render_template("profile.html", username=username)

@app.route("/profile/<username>/map")
def profile_map(username):
    return render_template("profile_map.html", username=username)

# TODO: Make sure this route has authentication and authorization setup so you can only access your own user settings
@app.route("/profile/<username>/settings")
def profile_settings(username):
    return render_template("profile_settings.html", username=username)