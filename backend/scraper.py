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

SIMPLIFY_SOURCES = [
    {
        "url": "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md",
        "type": "internship",
        "season": "2026",
    },
    {
        "url": "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README.md",
        "type": "internship",
        "season": "2027",
    },
    {
        "url": "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README-Off-Season.md",
        "type": "internship",
        "season": "offseason",
    },
    {
        "url": "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/README.md",
        "type": "newgrad",
        "season": "2026",
    },
]

SEARCHTERN_LISTINGS_URL = "https://raw.githubusercontent.com/KSaifStack/SearchTern-Listings/main/pages/listings.json"


def clean_text(text):
    text = text.replace("\u21b3", "")
    text = re.sub(r'[^\x00-\x7F]+', "", text)
    return text.strip()


def sort_date(date: str):
    date = date.strip(" '\"")
    if date.startswith(("202", "203")):
        try:
            return str(max(0, (datetime.now(datetime.fromisoformat(date).tzinfo) - datetime.fromisoformat(date)).days))
        except ValueError:
            return "999"
    match = re.match(r"(\d+)([a-z]+)", date.lower())
    if match:
        val, unit = int(match.group(1)), match.group(2)
        return str(val * 30 if "m" in unit else val)
    return date


US_STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
    "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
    "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
    "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
    "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
    "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
    "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
    "DC": "District of Columbia",
}
US_STATE_NAMES = {name.lower(): abbr for abbr, name in US_STATES.items()}
US_STATE_ABBR = set(US_STATES.keys())

CITY_TO_STATE = {
    "nyc": "NY", "new york": "NY", "sf": "CA", "san francisco": "CA", "la": "CA",
    "los angeles": "CA", "philly": "PA", "washington dc": "DC", "washington d.c.": "DC",
    "st louis": "MO", "new orleans": "LA", "silicon valley": "CA",
}

NON_US_COUNTRIES = [
    ("United Kingdom", ["united kingdom", "uk", "england", "scotland", "wales", "britain", "london", "edinburgh", "manchester", "birmingham"]),
    ("Canada", ["canada", "toronto", "vancouver", "montreal", "ottawa", "calgary", "ontario", "quebec"]),
    ("Germany", ["germany", "berlin", "munich", "hamburg", "stuttgart"]),
    ("India", ["india", "bangalore", "bengaluru", "hyderabad", "mumbai", "pune", "chennai", "gurgaon"]),
    ("Singapore", ["singapore"]),
    ("France", ["france", "paris"]),
    ("Netherlands", ["netherlands", "amsterdam"]),
    ("Switzerland", ["switzerland", "zurich", "geneva"]),
    ("Ireland", ["ireland", "dublin"]),
    ("Australia", ["australia", "sydney", "melbourne", "canberra", "perth"]),
    ("Japan", ["japan", "tokyo", "osaka"]),
    ("Mexico", ["mexico", "mexico city"]),
    ("China", ["china", "hong kong", "shanghai", "beijing", "shenzhen"]),
    ("UAE", ["uae", "dubai", "abu dhabi"]),
    ("Brazil", ["brazil", "sao paulo", "são paulo"]),
    ("Spain", ["spain", "madrid", "barcelona"]),
    ("Italy", ["italy", "milan", "rome"]),
    ("Poland", ["poland", "warsaw", "krakow"]),
    ("Sweden", ["sweden", "stockholm"]),
    ("South Korea", ["south korea", "seoul"]),
    ("Israel", ["israel", "tel aviv"]),
]

US_MARKERS = ["united states", "usa", "u.s.a.", "america", "states"]


def is_us_only(location: str) -> bool:
    lower = (location or "").strip().lower()
    if not lower:
        return True

    for _, keywords in NON_US_COUNTRIES:
        for kw in keywords:
            if re.search(rf"\b{re.escape(kw)}\b", lower):
                return False

    for marker in US_MARKERS:
        if re.search(rf"\b{re.escape(marker)}\b", lower):
            return True

    tokens = re.split(r"[;,\n/\-]", lower)
    for token in tokens:
        token = token.strip()
        if token.upper() in US_STATE_ABBR or token in US_STATE_NAMES or token in CITY_TO_STATE:
            return True

    return True


def scrape_simplify_readme(url, job_type, season):
    response = requests.get(url)
    if response.status_code != 200:
        print(f"  Error {response.status_code} — {url}")
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    jobs = []
    last_company = ""

    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cells = row.find_all("td")
            if not cells:
                continue
            company = clean_text(cells[0].get_text(strip=True))
            if company == "":
                company = last_company
            else:
                last_company = company

            jobs.append({
                "company":  company,
                "role":     clean_text(cells[1].get_text(strip=True)),
                "location": clean_text(cells[2].get_text(separator=", ", strip=True)),
                "date":     clean_text(cells[-1].get_text(strip=True)),
                "link":     cells[-2].find("a")["href"] if cells[-2].find("a") else "N/A",
                "type":     job_type,
                "season":   season,
            })

    print(f"  {len(jobs)} rows from {job_type} ({season})")
    return jobs


def scrape_searchtern_listings(url):
    response = requests.get(url, timeout=30)
    if response.status_code != 200:
        print(f"  Error {response.status_code} — {url}")
        return []

    listings = response.json()
    jobs = []
    for job in listings:
        jt = job.get("job_type", "internship")
        jobs.append({
            "company":  job.get("company", ""),
            "role":     job.get("role", ""),
            "location": job.get("location", ""),
            "date":     job.get("date", ""),
            "link":     job.get("link", "N/A"),
            "type":     jt if jt in ("internship", "newgrad") else "internship",
            "season":   "searchtern",
        })

    print(f"  {len(jobs)} rows from SearchTern-Listings")
    return jobs


def update_database():
    all_jobs = []

    print("Scraping SimplifyJobs READMEs...")
    for source in SIMPLIFY_SOURCES:
        all_jobs.extend(scrape_simplify_readme(source["url"], source["type"], source["season"]))

    print("Scraping SearchTern-Listings...")
    all_jobs.extend(scrape_searchtern_listings(SEARCHTERN_LISTINGS_URL))

    seen = set()
    deduped = []
    for job in all_jobs:
        key = (job["company"].lower(), job["role"].lower(), job["location"].lower(), job["link"].lower())
        if key in seen:
            continue
        seen.add(key)
        job["date"] = sort_date(job["date"])
        deduped.append(job)

    print(f"Total after dedup: {len(deduped)}")

    us_jobs = [job for job in deduped if is_us_only(job["location"])]
    filtered = len(deduped) - len(us_jobs)
    if filtered:
        print(f"Removed {filtered} non-US listings")
    print(f"US-only listings: {len(us_jobs)}")

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
            type TEXT,
            season TEXT,
            last_seen_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT internships_unique_job UNIQUE (company, role, location, link)
        )
    """)

    cursor.execute("ALTER TABLE internships ADD COLUMN IF NOT EXISTS type TEXT")
    cursor.execute("ALTER TABLE internships ADD COLUMN IF NOT EXISTS season TEXT")
    cursor.execute("ALTER TABLE internships ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW()")

    cursor.execute("SELECT 1 FROM pg_constraint WHERE conname = 'internships_unique_job'")
    if cursor.fetchone() is None:
        cursor.execute("""
            DELETE FROM internships a
            USING internships b
            WHERE a.id > b.id
              AND a.company = b.company AND a.role = b.role
              AND a.location = b.location AND a.link = b.link
        """)
        cursor.execute("""
            ALTER TABLE internships
            ADD CONSTRAINT internships_unique_job UNIQUE (company, role, location, link)
        """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_last_seen ON internships(last_seen_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_internships_date ON internships(date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_internships_role ON internships(role)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_internships_location ON internships(location)")

    records = [
        (job["company"], job["role"], job["location"], job["date"], job["link"], job["type"], job["season"], current_run_time)
        for job in us_jobs
    ]

    upsert_query = """
        INSERT INTO internships (company, role, location, date, link, type, season, last_seen_at)
        VALUES %s
        ON CONFLICT (company, role, location, link)
        DO UPDATE SET
            date = EXCLUDED.date,
            type = EXCLUDED.type,
            season = EXCLUDED.season,
            last_seen_at = EXCLUDED.last_seen_at
    """
    execute_values(cursor, upsert_query, records, page_size=1000)

    cursor.execute("""
        DELETE FROM internships
        WHERE last_seen_at < %s
    """, (current_run_time,))

    conn.commit()
    conn.close()
    return f"Done! {len(us_jobs)} listings upserted."


if __name__ == "__main__":
    print(update_database())