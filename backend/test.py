# read_db.py
import sqlite3

conn = sqlite3.connect("database.db")



# Get only Charlotte internships
def search_location(x):
    conn = sqlite3.connect("database.db")
    rows = conn.execute(
        "SELECT * FROM internships WHERE location LIKE ?",
        [f"%{x}%"]
    ).fetchall()
    return rows

print(search_location("Charlotte"))

# Get only recent ones
def recent_internships():
    conn = sqlite3.connect("database.db")
    rows = conn.execute("SELECT * FROM internships WHERE date = '0d'").fetchall()
    return rows


# Search by role keywords
def find_keywords(x):
    conn = sqlite3.connect("database.db")
    rows = conn.execute(
        "SELECT * FROM internships WHERE role LIKE ?",
        [f"%{x}%"]).fetchall()
    return rows

#Test
print(search_location("Charlotte"))
print(recent_internships())
print(find_keywords("AI"))


