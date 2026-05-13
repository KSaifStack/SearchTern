# read_db.py
import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database.db")

# Get only Charlotte internships
def search_location(x):
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT * FROM internships WHERE location LIKE ?",
        [f"%{x}%"]
    ).fetchall()
    return rows


# Get only recent ones
def recent_internships():
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("SELECT * FROM internships ORDER BY date").fetchall()
    conn.close()
    return rows


# Search by role keywords
def find_keywords(x):
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT * FROM internships WHERE role LIKE ?",
        [f"%{x}%"]).fetchall()
    return rows

#Test
print(recent_internships())


