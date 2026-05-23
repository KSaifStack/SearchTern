import requests
from bs4 import BeautifulSoup
import re
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.environ.get("DATABASE_URL")

data = {}

# Removes arrows, non-ASCII characters, and whitespace
def clean_text(text):
    text = text.replace("↳", "")
    text = re.sub(r'[^\x00-\x7F]+', '', text)
    text = text.strip()
    return text

def sort_date(date: str):
    match = re.match(r'(\d+)([a-z]+)', date)
    if not match:
        return date
    day = int(match.group(1))
    type = match.group(2).lower()
    if type == "mo":
        day = day * 30
        return str(day)
    return str(day)

def target(datatable):
    # Scrapes SimplifyJobs Summer 2026 Internships from GitHub
    Simplify2026 = requests.get("https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md")

    if Simplify2026.status_code == 200:
        print("No Errors!")
    else:
        print("Error with pulling information — check status code for more details")

    lines = Simplify2026.text
    Start = lines.find("<table>")
    End = lines.rfind("</table>") + len("</table>")
    Table = lines[Start:End]

    soup = BeautifulSoup(Table, "html.parser")
    rows = soup.find_all("tr")
    last_company = ""

    id = 0
    for row in rows:
        cells = row.find_all("td")
        if cells:
            id += 1
            company  = clean_text(cells[0].get_text(strip=True))
            role     = clean_text(cells[1].get_text(strip=True))
            location = clean_text(cells[2].get_text(separator=", ", strip=True))
            date     = clean_text(cells[-1].get_text(strip=True))
            link_tag = cells[-2].find("a")
            link = link_tag["href"] if link_tag else "N/A"
            if company == "":
                company = last_company
            else:
                last_company = company
            date = sort_date(date)
            datatable[id] = [company, role, location, date, link]


def update_database():
    print("Running scraper for Simplify-2026...")
    target(data)

    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()

    # Create table if it doesn't exist (auto-runs on Thinkpad first boot too)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS internships (
            id SERIAL PRIMARY KEY,
            company TEXT,
            role TEXT,
            location TEXT,
            date TEXT,
            link TEXT
        )
    """)

    # Clear old data and repopulate
    cursor.execute("DELETE FROM internships")
    cursor.execute("ALTER SEQUENCE internships_id_seq RESTART WITH 1")

    for id, info in data.items():
        cursor.execute(
            "INSERT INTO internships (company, role, location, date, link) VALUES (%s, %s, %s, %s, %s)",
            info
        )

    conn.commit()
    conn.close()
    return f"Done! {len(data)} internships saved."


if __name__ == "__main__":
    target(data)
    print(data)
    update_database()
