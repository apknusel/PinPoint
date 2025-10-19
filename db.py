from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import DictCursor
import base64

def init_pool(dsn, minconn=1, maxconn=100):
    return ThreadedConnectionPool(minconn, maxconn, dsn=dsn, sslmode="require")

def upsert_user(pool, user_id, email, picture):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                INSERT INTO Users (user_id, email, picture)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE
                  SET email = EXCLUDED.email
                """,
                (user_id, email, picture),
            )
        conn.commit()
    finally:
        pool.putconn(conn)

def check_profile_complete(pool, user_id):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                "SELECT display_name, public FROM Users WHERE user_id = %s",
                (user_id,)
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

def fetch_posts(pool, viewer_id=None):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT 
                    p.post_id,
                    p.caption,
                    p.user_id,
                    u.display_name,
                    ST_X(p.location) AS longitude,
                    ST_Y(p.location) AS latitude,
                    encode(ST_AsEWKB(p.location), 'hex') AS location_key,
                    m.thumbnail_data
                FROM Posts p
                JOIN Users u ON p.user_id = u.user_id
                LEFT JOIN Media m ON m.post_id = p.post_id
                WHERE p.location IS NOT NULL
                  AND (
                        u.public = TRUE
                        OR %s = p.user_id
                        OR EXISTS (
                            SELECT 1
                            FROM Followers f
                            WHERE f.followee_id = p.user_id
                              AND f.follower_id = %s
                              AND f.is_accepted = TRUE
                        )
                  )
                """,
                (viewer_id, viewer_id),
            )
            rows = cur.fetchall()
        return [
            {
                "post_id": r["post_id"],
                "caption": r["caption"],
                "user_id": r["user_id"],
                "display_name": r["display_name"],
                "latitude": r["latitude"],
                "longitude": r["longitude"],
                "location_key": r["location_key"],
                "thumbnail": base64.b64encode(r["thumbnail_data"]).decode("utf-8") if r["thumbnail_data"] else None,
            }
            for r in rows
        ]
    finally:
        pool.putconn(conn)

def fetch_posts_by_username(pool, username, viewer_id=None):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT 
                    p.post_id,
                    p.caption,
                    p.user_id,
                    u.display_name,
                    ST_X(p.location) AS longitude,
                    ST_Y(p.location) AS latitude
                FROM Posts p
                JOIN Users u ON p.user_id = u.user_id
                WHERE p.location IS NOT NULL 
                  AND u.display_name = %s
                  AND (
                        u.public = TRUE
                        OR %s = p.user_id
                        OR EXISTS (
                            SELECT 1
                            FROM Followers f
                            WHERE f.followee_id = p.user_id
                              AND f.follower_id = %s
                              AND f.is_accepted = TRUE
                        )
                  )
                """,
                (username, viewer_id, viewer_id),
            )
            rows = cur.fetchall()
        return [
            {
                "post_id": r["post_id"],
                "caption": r["caption"],
                "user_id": r["user_id"],
                "display_name": r["display_name"],
                "latitude": r["latitude"],
                "longitude": r["longitude"],
            }
            for r in rows
        ]
    finally:
        pool.putconn(conn)

def insert_post_with_media(pool, post_id, caption, user_id, lng, lat, media_id, file_name, file_bytes, thumbnail_bytes):
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
                INSERT INTO Media (media_id, file_name, file_data, thumbnail_data, post_id)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (media_id, file_name, file_bytes, thumbnail_bytes, post_id),
            )
        conn.commit()
    finally:
        pool.putconn(conn)

def fetch_single_post(pool, post_id, viewer_id=None):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT p.post_id,
                       p.caption,
                       p.user_id,
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
                  AND (
                        u.public = TRUE
                        OR %s = p.user_id
                        OR EXISTS (
                            SELECT 1
                            FROM Followers f
                            WHERE f.followee_id = p.user_id
                              AND f.follower_id = %s
                              AND f.is_accepted = TRUE
                        )
                  )
                """,
                (post_id, viewer_id, viewer_id),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {
                "post_id": row["post_id"],
                "caption": row["caption"],
                "user_id": row["user_id"],
                "display_name": row["display_name"],
                "picture": row["picture"],
                "latitude": row["latitude"],
                "longitude": row["longitude"],
                "image_data": base64.b64encode(row["file_data"]).decode("utf-8")
            }
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

def fetch_users(pool, name, exact_match=False):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            if (exact_match):
                cur.execute(
                    """
                    SELECT user_id, display_name, picture 
                    FROM users WHERE LOWER(display_name) = LOWER(%s)
                    """,
                    (name,)
                )
            else:
                cur.execute(
                    """
                    SELECT user_id, display_name, picture
                    FROM users WHERE display_name ILIKE %s
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

def fetch_nearest_posts(pool, post_id, viewer_id=None, k=5):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT 
                    p2.post_id,
                    p2.caption,
                    u.display_name,
                    m.thumbnail_data
                FROM Posts p1
                JOIN Posts p2 ON p2.post_id <> p1.post_id
                JOIN Users u ON u.user_id = p2.user_id
                LEFT JOIN Media m ON m.post_id = p2.post_id
                WHERE p1.post_id = %s
                  AND p1.location IS NOT NULL
                  AND p2.location IS NOT NULL
                  AND (
                        u.public = TRUE
                        OR %s = p2.user_id
                        OR EXISTS (
                            SELECT 1
                            FROM Followers f
                            WHERE f.followee_id = p2.user_id
                              AND f.follower_id = %s
                              AND f.is_accepted = TRUE
                        )
                  )
                ORDER BY p2.location <-> p1.location
                LIMIT %s
                """,
                (post_id, viewer_id, viewer_id, k),
            )
            rows = cur.fetchall()
            return [
                {
                    "post_id": r["post_id"],
                    "caption": r["caption"],
                    "display_name": r["display_name"],
                    "image_data": base64.b64encode(r["thumbnail_data"]).decode("utf-8") if r["thumbnail_data"] else None,
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
                u1.display_name AS follower_name,
                u1.picture  AS follower_picture,
                u1.email AS follower_email,
                f.followee_id,
                u2.display_name AS followee_name,
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

def fetch_posts_by_user_id(pool, user_id, viewer_id=None):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT 
                    p.post_id,
                    p.caption,
                    p.user_id,
                    u.display_name,
                    ST_X(p.location) AS longitude,
                    ST_Y(p.location) AS latitude
                FROM Posts p
                JOIN Users u ON p.user_id = u.user_id
                WHERE p.location IS NOT NULL 
                  AND u.user_id = %s
                  AND (
                        u.public = TRUE
                        OR %s = u.user_id
                        OR EXISTS (
                            SELECT 1
                            FROM Followers f
                            WHERE f.followee_id = u.user_id
                              AND f.follower_id = %s
                              AND f.is_accepted = TRUE
                        )
                  )
                """,
                (user_id, viewer_id, viewer_id),
            )
            rows = cur.fetchall()
        return [
            {
                "post_id": r["post_id"],
                "caption": r["caption"],
                "user_id": r["user_id"],
                "display_name": r["display_name"],
                "latitude": r["latitude"],
                "longitude": r["longitude"],
            }
            for r in rows
        ]
    finally:
        pool.putconn(conn)

def fetch_user_by_id(pool, user_id):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT user_id, email, picture, display_name, public
                FROM users
                WHERE user_id = %s
                """,
                (user_id,)
            )
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        pool.putconn(conn)

def fetch_user_profile_image_by_user_id(pool, user_id):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT picture
                FROM Users
                WHERE user_id = %s
                """,
                (user_id,)
            )
            row = cur.fetchone()
            if not row:
                return None
            return {"picture": row["picture"]}
    finally:
        pool.putconn(conn)

def fetch_users_post_images_by_user_id(pool, user_id, viewer_id=None):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT p.post_id,
                       m.thumbnail_data
                FROM Users u
                JOIN Posts p ON p.user_id = u.user_id
                LEFT JOIN Media m ON m.post_id = p.post_id
                WHERE u.user_id = %s
                  AND (
                        u.public = TRUE
                        OR %s = u.user_id
                        OR EXISTS (
                            SELECT 1
                            FROM Followers f
                            WHERE f.followee_id = u.user_id
                              AND f.follower_id = %s
                              AND f.is_accepted = TRUE
                        )
                  )
                ORDER BY p.created_at DESC
                """,
                (user_id, viewer_id, viewer_id),
            )
            rows = cur.fetchall()
        return [
            {
                "post_id": r["post_id"],
                "image_data": base64.b64encode(r["thumbnail_data"]).decode("utf-8")
            }
            for r in rows
        ]
    finally:
        pool.putconn(conn)
        
def update_post(pool, post_id, caption, lng, lat):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                UPDATE Posts
                SET caption = %s,
                    location = ST_SetSRID(ST_MakePoint(%s, %s), 4326)
                WHERE post_id = %s
                """,
                (caption, lng, lat, post_id),
            )
        conn.commit()
    finally:
        pool.putconn(conn)

def delete_post(pool, post_id):
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM Posts
                WHERE post_id = %s
                """,
                (post_id,),
            )
        conn.commit()
    finally:
        pool.putconn(conn)

def can_view_user(pool, target_user_id, viewer_id):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT 
                    (u.public = TRUE)
                    OR (%s = u.user_id)
                    OR EXISTS (
                        SELECT 1
                        FROM Followers f
                        WHERE f.followee_id = u.user_id
                          AND f.follower_id = %s
                          AND f.is_accepted = TRUE
                    ) AS allowed
                FROM Users u
                WHERE u.user_id = %s
                """,
                (viewer_id, viewer_id, target_user_id),
            )
            row = cur.fetchone()
            if row:
                return bool(row["allowed"])
            else:
                return False
    finally:
        pool.putconn(conn)
