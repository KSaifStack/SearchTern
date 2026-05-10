# read_db.py
import sqlite3

conn = sqlite3.connect("database.db")

for row in conn.execute("SELECT * FROM internships"):
    print(row)


# Get only Charlotte internships
for row in conn.execute("SELECT * FROM internships WHERE location LIKE '%Charlotte%'"):
    print(row)

# Get only recent ones
for row in conn.execute("SELECT * FROM internships WHERE date = '0d'"):
    print(row)

# Search by role keyword
for row in conn.execute("SELECT * FROM internships WHERE role LIKE '%AI%'"):
    print(row)