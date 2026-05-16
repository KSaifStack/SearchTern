# read_db.py
import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database.db")

# Get only Charlotte internships
def search_location(x):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  
    rows = conn.execute(
        "SELECT rowid as id, * FROM internships WHERE location LIKE ?",
        [f"%{x}%"]
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]



# Get only recent ones
def recent_internships():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT rowid as id, * FROM internships ORDER BY date").fetchall()
    conn.close()
    return [dict(row) for row in rows]



# Search by role keywords
def find_keywords(x):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  
    rows = conn.execute(
        "SELECT rowid as id, * FROM internships WHERE role LIKE ?",
        [f"%{x}%"]
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]

print(recent_internships())