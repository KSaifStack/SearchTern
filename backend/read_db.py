# read_db.py
import psycopg2
import psycopg2.extras
import os
from time import time
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.environ.get("DATABASE_URL")

_cache: list | None = None
_cache_time: float = 0
_CACHE_TTL = 3300  # 55 minutes (refresh before the hourly scrape)

def get_conn():
    return psycopg2.connect(DATABASE_URL)


def invalidate_cache():
    global _cache, _cache_time
    _cache = None
    _cache_time = 0


# Get all internships ordered by date (cached in memory)
def recent_internships():
    global _cache, _cache_time
    now = time()
    if _cache is not None and now - _cache_time < _CACHE_TTL:
        return _cache
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM internships ORDER BY date")
        rows = cur.fetchall()
    conn.close()
    _cache = [dict(row) for row in rows]
    _cache_time = now
    return _cache


# Search by location
def search_location(x):
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT * FROM internships WHERE location ILIKE %s ORDER BY date",
            (f"%{x}%",)
        )
        rows = cur.fetchall()
    conn.close()
    return [dict(row) for row in rows]


# Search by role keywords
def find_keywords(x):
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT * FROM internships WHERE role ILIKE %s ORDER BY date",
            (f"%{x}%",)
        )
        rows = cur.fetchall()
    conn.close()
    return [dict(row) for row in rows]