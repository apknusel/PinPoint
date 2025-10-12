from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import DictCursor
import base64

def init_pool(dsn, minconn = 1, maxconn = 100):
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
                       u.nickname,
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
                    "nickname": r["nickname"],
                    "picture": r["picture"],
                    "user_id": r["user_id"],
                }
                for r in rows
            ]
    finally:
        pool.putconn(conn)

def fetch_users(pool, name):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
            """
            SELECT user_id, nickname, picture
            FROM users WHERE nickname ILIKE %s
            """,
            (f"%{name}%",)
        )
            rows = cur.fetchall()
            return [dict(row) for row in rows]
    finally:
        pool.putconn(conn)