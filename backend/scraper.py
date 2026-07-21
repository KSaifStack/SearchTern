import requests
from bs4 import BeautifulSoup
import re
import psycopg2
from psycopg2.extras import execute_values
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

def is_duplicate(seen: set, company: str, role: str, location: str, link: str) -> bool:
    key = (company.lower(), role.lower(), location.lower(), link.lower())
    if key in seen:
        return True
    seen.add(key)
    return False

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
                "company":  company,
                "role":     clean_text(cells[1].get_text(strip=True)),
                "location": clean_text(cells[2].get_text(separator=", ", strip=True)),
                "date":     clean_text(cells[-1].get_text(strip=True)),
                "link":     cells[-2].find("a")["href"] if cells[-2].find("a") else "N/A"
            }
            all_jobs.append(job)

    listings = SearchTern.json()
    for job in listings:
        all_jobs.append({
            "company":  job.get("company", "").lower(),
            "role":     job.get("role", "").lower(),
            "location": job.get("location", "").lower(),
            "date":     job.get("date", ""),
            "link":     job.get("link", "N/A")
        })

    seen_rows = set()
    for job in all_jobs:
        if is_duplicate(seen_rows, job["company"], job["role"], job["location"], job["link"]):
            continue
        job["date"] = sort_date(job["date"])
        datatable[(job["company"], job["role"], job["location"], job["link"])] = job


def update_database():
    print("Running scraper...")
    target(data)

    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()

    current_run_time = datetime.now(timezone.utc)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS internships (
            id SERIAL PRIMARY KEY,
            company TEXT,
            role TEXT,
            location TEXT,
            date TEXT,
            link TEXT,
            last_seen_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT internships_unique_job UNIQUE (company, role, location, link)
        );
        CREATE INDEX IF NOT EXISTS idx_last_seen ON internships(last_seen_at);
        CREATE INDEX IF NOT EXISTS idx_internships_date ON internships(date);
        CREATE INDEX IF NOT EXISTS idx_internships_role ON internships(role);
        CREATE INDEX IF NOT EXISTS idx_internships_location ON internships(location);
    """)

    records = [
        (job["company"], job["role"], job["location"], job["date"], job["link"], current_run_time)
        for job in data.values()
    ]

    upsert_query = """
        INSERT INTO internships (company, role, location, date, link, last_seen_at)
        VALUES %s
        ON CONFLICT (company, role, location, link)
        DO UPDATE SET
            date = EXCLUDED.date,
            last_seen_at = EXCLUDED.last_seen_at
    """
    execute_values(cursor, upsert_query, records, page_size=1000)

    cursor.execute("""
        DELETE FROM internships
        WHERE last_seen_at < %s
    """, (current_run_time,))

    conn.commit()
    conn.close()
    return f"Done! {len(data)} internships upserted."


if __name__ == "__main__":
    update_database()