# read_db.py
import psycopg2
import psycopg2.extras
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.environ.get("DATABASE_URL")

_cached_recent = None
_cache_time = None
from datetime import datetime, timedelta

def get_conn():
    return psycopg2.connect(DATABASE_URL)

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


# Get all internships ordered by date
def recent_internships():
    global _cached_recent, _cache_time
    if _cached_recent is not None and _cache_time is not None:
        if datetime.now() - _cache_time < timedelta(hours=1):
            return _cached_recent

    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM internships ORDER BY date")
        rows = cur.fetchall()
    conn.close()
    
    _cached_recent = [dict(row) for row in rows]
    _cache_time = datetime.now()
    return _cached_recent

def invalidate_cache():
    global _cached_recent, _cache_time
    _cached_recent = None
    _cache_time = None


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