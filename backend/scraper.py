import requests
from bs4 import BeautifulSoup
import re
import sqlite3
import os

data = {}    
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database.db")

def clean_text(text):
    text = text.replace("↳", "")                        
    text = re.sub(r'[^\x00-\x7F]+', '', text)           
    text = text.strip()                                 
    return text


def target(datatable):
    # Take the repo you want to scrape it to and format from
    # https://github.com/SimplifyJobs/Summer2026-Internships/blob/dev/README.md 
    # to 
    # https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md 
    # Notice how the '/blob' and github -> raw.githubusercontent
    # Where all the data for the jobs are stored
    Simplify2026 = requests.get("https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md")

    if(Simplify2026.status_code==200):
        print("No Errors!")
    else:
        print("Error with pulling information look up status code for more")

    # -----
    lines = Simplify2026.text
    Start = lines.find("<table>")
    End = lines.rfind("</table>") + len("</table>")
    Table = lines[Start:End]
    # -----
    soup = BeautifulSoup(Table, "html.parser")
    rows = soup.find_all("tr")
    last_company = ""
    # -----
    id=0
    for row in rows:
        cells = row.find_all("td")
        if cells:
            id+=1
            company  = clean_text(cells[0].get_text(strip=True))
            role     = clean_text(cells[1].get_text(strip=True))
            location = clean_text(cells[2].get_text(separator=", ", strip=True))
            date     = clean_text(cells[-1].get_text(strip=True))
            link_tag = cells[-2].find("a")  
            link = link_tag["href"] if link_tag else "N/A"
            if(company==""):
                company = last_company
            else:
                last_company=company
            datatable[id] = [company,role,location,date,link] 


def update_database():
    print("Running scraper for Simplify-2026...")
    target(data)
    
    conn = sqlite3.connect(DB_PATH)

    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS internships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company TEXT,
            role TEXT,
            location TEXT,
            date TEXT,
            link TEXT
        )
    """)
    
    cursor.execute("DELETE FROM internships")
    try:
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='internships'")
    except sqlite3.OperationalError:
        pass
    
    
    for id, info in data.items():
        cursor.execute("INSERT INTO internships (company, role, location, date, link) VALUES (?,?,?,?,?)", info)        
    conn.commit()
    conn.close()
    return(f"Done! {len(data)} internships saved.")

def search_location(x):
    conn = sqlite3.connect("database.db")
    rows = conn.execute(
        "SELECT * FROM internships WHERE location LIKE ?",
        [f"%{x}%"]
    ).fetchall()
    return rows


#Tests
# target(data)
update_database()


