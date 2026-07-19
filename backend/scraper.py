import requests
from bs4 import BeautifulSoup
import re
import psycopg2
import os
from dotenv import load_dotenv
from datetime import datetime, timezone

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
    date = date.strip(" '\"")
    if date.startswith(("202", "203")): 
        try:
            return str(max(0, (datetime.now(datetime.fromisoformat(date).tzinfo) - datetime.fromisoformat(date)).days))
        except ValueError:
            return "999"
    match = re.match(r'(\d+)([a-z]+)', date.lower())
    if match:
        val, unit = int(match.group(1)), match.group(2)
        return str(val * 30 if "m" in unit else val)
    return date


def target(datatable):
    # Scrapes SimplifyJobs Summer 2026 Internships from GitHub
    Simplify2026 = requests.get("https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md")
    # Scrapes SearchTern-Listings 
    SearchTern = requests.get("https://raw.githubusercontent.com/KSaifStack/SearchTern-Listings/main/pages/listings.json", timeout=30)

    
    if Simplify2026.status_code == 200 and SearchTern.status_code == 200: 
        print("No Errors!")
    else:
        print("Error with pulling information — check status code for more details")

    all_jobs = []

    # Simplify 
    lines = Simplify2026.text
    Start = lines.find("<table>")
    End = lines.rfind("</table>") + len("</table>")
    Table = lines[Start:End]

    soup = BeautifulSoup(Table, "html.parser")
    rows = soup.find_all("tr")
    last_company = ""

    for row in rows:
        cells = row.find_all("td")
        if cells:
            company = clean_text(cells[0].get_text(strip=True))
            if company == "":
                company = last_company
            else:
                last_company = company

            job = {
                "company"  : company,
                "role"    : clean_text(cells[1].get_text(strip=True)),
                "location" : clean_text(cells[2].get_text(separator=", ", strip=True)),
                "date"     : clean_text(cells[-1].get_text(strip=True)),
                "link": cells[-2].find("a")["href"] if cells[-2].find("a") else "N/A"
            }
            all_jobs.append(job)
    
    listings = SearchTern.json()
    for job in listings: 
        all_jobs.append({
                "company": job.get("company"),
                "role": job.get("role"),
                "location": job.get("location"),
                "date": job.get("date"),
                "link": job.get("link")
            })
    seen_rows = set()
    current_id = max(datatable.keys()) if datatable else 0
    for job in all_jobs:
        row_tuple = (job["company"].lower(), job["role"].lower(), job["location"].lower())
        if row_tuple in seen_rows:
            continue
        seen_rows.add(row_tuple)
        current_id+=1
        job_date=sort_date(job["date"])
        datatable[current_id] = [job["company"], job["role"], job["location"], job_date, job["link"]]


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
    update_database()
