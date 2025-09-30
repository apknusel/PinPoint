import os
import psycopg2
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import DictCursor
from flask import Flask, render_template, request, redirect, url_for, current_app, g
from contextlib import contextmanager
from auth import require_login

pool = None

def setup():
    global pool
    DATABASE_URL = os.environ['DATABASE_URL']
    current_app.logger.info(f"creating db connection pool")
    pool = ThreadedConnectionPool(1, 100, dsn=DATABASE_URL, sslmode='require')


@contextmanager
def get_db_connection():
    connection = None
    try:
        connection = pool.getconn()
        yield connection
    finally:
        if connection:
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

app = Flask(__name__)

with app.app_context():
    setup()
    
@app.route("/")
def index():
    return "Hello, World!"