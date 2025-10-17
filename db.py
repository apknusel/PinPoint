from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import DictCursor
import base64

def init_pool(dsn, minconn=1, maxconn=100):
    return ThreadedConnectionPool(minconn, maxconn, dsn=dsn, sslmode="require")

def upsert_user(pool, user_id, nickname, email, picture):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                INSERT INTO Users (user_id, nickname, email, picture)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE
                  SET nickname = EXCLUDED.nickname,
                      email = EXCLUDED.email
                """,
                (user_id, nickname, email, picture),
            )
        conn.commit()
    finally:
        pool.putconn(conn)

def check_profile_complete(pool, nickname):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                "SELECT display_name, public FROM Users WHERE nickname = %s",
                (nickname,)
            )
            result = cur.fetchone()
            if result and result['display_name']:
                return {
                    'profile_complete': True,
                    'display_name': result['display_name'],
                    'public': result['public']
                }
            else:
                return {
                    'profile_complete': False
                }
    finally:
        pool.putconn(conn)

def fetch_posts(pool):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT 
                    p.post_id,
                    p.caption,
                    p.user_id,
                    u.nickname,
                    ST_X(p.location) AS longitude,
                    ST_Y(p.location) AS latitude
                FROM Posts p
                JOIN Users u ON p.user_id = u.user_id
                WHERE p.location IS NOT NULL
                """
            )
            rows = cur.fetchall()
        return [
            {
                "post_id": r["post_id"],
                "caption": r["caption"],
                "user_id": r["user_id"],
                "nickname": r["nickname"],
                "latitude": r["latitude"],
                "longitude": r["longitude"],
            }
            for r in rows
        ]
    finally:
        pool.putconn(conn)

def fetch_posts_by_username(pool, username):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT 
                    p.post_id,
                    p.caption,
                    p.user_id,
                    u.nickname,
                    ST_X(p.location) AS longitude,
                    ST_Y(p.location) AS latitude
                FROM Posts p
                JOIN Users u ON p.user_id = u.user_id
                WHERE p.location IS NOT NULL AND u.nickname = %s
                """,
                (username,)
            )
            rows = cur.fetchall()
        return [
            {
                "post_id": r["post_id"],
                "caption": r["caption"],
                "user_id": r["user_id"],
                "nickname": r["nickname"],
                "latitude": r["latitude"],
                "longitude": r["longitude"],
            }
            for r in rows
        ]
    finally:
        pool.putconn(conn)

def insert_post_with_media(pool, post_id, caption, user_id, lng, lat, media_id, file_name, file_bytes):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                INSERT INTO Posts (post_id, caption, user_id, location)
                VALUES (%s, %s, %s, ST_SetSRID(ST_MakePoint(%s,%s),4326))
                """,
                (post_id, caption, user_id, lng, lat),
            )
            cur.execute(
                """
                INSERT INTO Media (media_id, file_name, file_data, post_id)
                VALUES (%s, %s, %s, %s)
                """,
                (media_id, file_name, file_bytes, post_id),
            )
        conn.commit()
    finally:
        pool.putconn(conn)

def fetch_single_post(pool, post_id):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT p.post_id,
                       p.caption,
                       p.user_id,
                       u.nickname,
                       u.display_name,
                       u.picture,
                       ST_X(p.location) AS longitude,
                       ST_Y(p.location) AS latitude,
                       m.file_name,
                       m.file_data
                FROM Posts p
                JOIN Users u ON p.user_id = u.user_id
                LEFT JOIN Media m ON m.post_id = p.post_id
                WHERE p.post_id = %s
                """,
                (post_id,)
            )
            row = cur.fetchone()
            if not row:
                return None
            return {
                "post_id": row["post_id"],
                "caption": row["caption"],
                "user_id": row["user_id"],
                "nickname": row["nickname"],
                "display_name": row["display_name"],
                "picture": row["picture"],
                "latitude": row["latitude"],
                "longitude": row["longitude"],
                "image_data": base64.b64encode(row["file_data"]).decode("utf-8")
            }
    finally:
        pool.putconn(conn)

def fetch_user_profile_image(pool, nickname):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT u.picture
                FROM Users u
                WHERE u.nickname = %s
                """,
                (nickname,)
            )
            row = cur.fetchone()
            if not row:
                return None
            return { "picture": row["picture"] }
    finally:
        pool.putconn(conn)

def fetch_users_post_images(pool, nickname):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT p.post_id,
                       p.user_id,
                       u.nickname,
                       m.file_data
                FROM Users u
                JOIN Posts p ON p.user_id = u.user_id
                LEFT JOIN Media m ON m.post_id = p.post_id
                WHERE u.nickname = %s
                ORDER BY p.created_at DESC
                """,
                (nickname,)
            )
            rows = cur.fetchall()
        return [
                {
                "post_id": r["post_id"],
                "image_data": base64.b64encode(r["file_data"]).decode("utf-8")
            }
            for r in rows
        ]
    finally:
        pool.putconn(conn)

def insert_comment(pool, comment_id, comment, post_id, user_id):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                INSERT INTO Comments (comment_id, comment, post_id, user_id)
                VALUES (%s, %s, %s, %s)
                """,
                (comment_id, comment, post_id, user_id),
            )
        conn.commit()
    finally:
        pool.putconn(conn)

def fetch_comments(pool, post_id):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT c.comment_id,
                       c.comment,
                       c.created_at,
                       u.display_name,
                       u.picture,
                       c.user_id
                FROM Comments c
                JOIN Users u ON u.user_id = c.user_id
                WHERE c.post_id = %s
                ORDER BY c.created_at ASC
                """,
                (post_id,)
            )
            rows = cur.fetchall()
            return [
                {
                    "comment_id": r["comment_id"],
                    "comment": r["comment"],
                    "display_name": r["display_name"],
                    "picture": r["picture"],
                    "user_id": r["user_id"],
                }
                for r in rows
            ]
    finally:
        pool.putconn(conn)

def fetch_users(pool, name, exact_match=False, search_for="nickname"):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            if (exact_match):
                cur.execute(
                    f"""
                SELECT user_id, nickname, display_name, picture 
                FROM users WHERE LOWER({search_for}) = LOWER(%s)
                """,
                    (name,)
                )
            else:
                cur.execute(
                    f"""
                SELECT user_id, nickname, display_name, picture
                FROM users WHERE {search_for} ILIKE %s
                """,
                    (f"%{name}%",)
                )

            rows = cur.fetchall()
            return [dict(row) for row in rows]
    finally:
        pool.putconn(conn)

def fetch_user_settings(pool, user_id):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT u.display_name, u.public
                FROM Users u
                WHERE u.user_id = %s
                """,
                (user_id,)
            )
            row = cur.fetchone()
            if not row:
                return None
            return { 
                "display_name": row["display_name"],
                "public": row["public"],
            }
    finally:
        pool.putconn(conn)
    
def update_profile_settings(pool, user_id, display_name, privacy_settings):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                UPDATE Users
                SET display_name = %s, public = %s
                WHERE user_id = %s
                """,
                (display_name, privacy_settings, user_id),
            )
        conn.commit()
    finally:
        pool.putconn(conn)

def fetch_nearest_posts(pool, post_id, k=5):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT 
                    p2.post_id,
                    p2.caption,
                    u.display_name,
                    m.file_data
                FROM Posts p1
                JOIN Posts p2 ON p2.post_id <> p1.post_id
                JOIN Users u ON u.user_id = p2.user_id
                LEFT JOIN Media m ON m.post_id = p2.post_id
                WHERE p1.post_id = %s
                  AND p1.location IS NOT NULL
                  AND p2.location IS NOT NULL
                ORDER BY p2.location <-> p1.location
                LIMIT %s
                """,
                (post_id, k),
            )
            rows = cur.fetchall()
            return [
                {
                    "post_id": r["post_id"],
                    "caption": r["caption"],
                    "display_name": r["display_name"],
                    "image_data": base64.b64encode(r["file_data"]).decode("utf-8") if r["file_data"] else None,
                }
                for r in rows
            ]
    finally:
        pool.putconn(conn)

def follow_request(pool, follower_id, followee_id):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
            """
            INSERT INTO followers (follower_id, followee_id, is_accepted)
            VALUES (%s, %s, FALSE) ON CONFLICT (follower_id, followee_id) DO NOTHING
            """,
                (follower_id, followee_id)
            )
        conn.commit()
    finally:
        pool.putconn(conn)

def fetch_followers(pool, user_id):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT 
                f.follower_id,
                u1.nickname AS follower_name,
                u1.picture  AS follower_picture,
                u1.email AS follower_email,
                f.followee_id,
                u2.nickname AS followee_name,
                f.is_accepted,
                f.created_at
                FROM followers f
                LEFT JOIN users u1 ON f.follower_id = u1.user_id
                LEFT JOIN users u2 ON f.followee_id = u2.user_id
                WHERE %s IN (f.followee_id, f.follower_id)
                """,
                (user_id,)
            )
            rows = cur.fetchall()

        result = {
            "following_to": [],
            "followed_by": [],
        }
        for row in rows:
            if row['follower_id'] == user_id:
                result["following_to"].append({
                    "followee_id": row['followee_id'],
                    "followee_name": row['followee_name'],
                    "is_accepted": row['is_accepted'],
                    "created_at": row['created_at'].strftime("%b %d, %Y")
                })
            elif row['followee_id'] == user_id:
                 result["followed_by"].append({
                    "follower_picture": row['follower_picture'],
                    "follower_email": row['follower_email'],
                    "follower_id": row['follower_id'],
                    "follower_name": row['follower_name'],
                    "is_accepted": row['is_accepted'],
                    "created_at": row['created_at'].strftime("%b %d, %Y")
                })
        return result
    finally:
        pool.putconn(conn)

def handle_follow_request(pool, follower_id , followee_id, accept=False):
    conn = pool.getconn()
    print(accept)
    print("folower:" , follower_id)
    print("folowee:", followee_id)
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            if accept == True:
                cur.execute(
                    """
                    UPDATE followers
                    SET is_accepted = TRUE
                    WHERE follower_id = %s AND followee_id = %s
                    """,
                    (follower_id, followee_id)
                )
            elif accept == False:
                cur.execute(
                """
                DELETE FROM followers
                WHERE follower_id = %s AND followee_id = %s
                """,
                (follower_id, followee_id)
                )
            conn.commit()
    finally:
        pool.putconn(conn)

