from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import DictCursor

def init_pool(dsn, minconn = 1, maxconn = 100):
    return ThreadedConnectionPool(minconn, maxconn, dsn=dsn, sslmode="require")

def upsert_user(pool, user_id, nickname, email):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
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