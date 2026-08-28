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
        "name": "SimplifyJobs — Summer 2027 Internships",
        "url": "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README.md",
        "type": "internship",
        "season": "2027",
    },
    {
        "name": "SimplifyJobs — Off-Season",
        "url": "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README-Off-Season.md",
        "type": "internship",
        "season": "offseason",
    },
]

MARKDOWN_SOURCES = [
    {
        "name": "vanshb03 — Summer 2027 Internships",
        "url": "https://raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/README.md",
        "type": "internship",
        "season": "2027",
    },
    {
        "name": "vanshb03 — Off-Season",
        "url": "https://raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/OFFSEASON_README.md",
        "type": "internship",
        "season": "offseason",
    },
    {
        "name": "vanshb03 — New Grad 2027",
        "url": "https://raw.githubusercontent.com/vanshb03/New-Grad-2027/dev/README.md",
        "type": "newgrad",
        "season": "2027",
    },
]

SEARCHTERN_LISTINGS_URL = "https://raw.githubusercontent.com/KSaifStack/SearchTern-Listings/main/pages/listings.json"

SEARCHTERN_SOURCE = {
    "name": "SearchTern-Listings",
    "url": SEARCHTERN_LISTINGS_URL,
    "type": "internship/newgrad",
    "season": "searchtern",
}

# All sources the scraper pulls from, in scrape order. Used by the
# /sources endpoint and the frontend "Data Sources" panel.
ALL_SOURCES = [
    *SIMPLIFY_SOURCES,
    *MARKDOWN_SOURCES,
    SEARCHTERN_SOURCE,
]

# Listings older than this many days are dropped on every scrape run.
# Tune via SCRAPER_MAX_AGE_DAYS env var; defaults to 90 days.
MAX_AGE_DAYS = int(os.environ.get("SCRAPER_MAX_AGE_DAYS", "90"))


def clean_text(text):
    text = text.replace("\u21b3", "")
    text = re.sub(r"\*+|`+|~+", "", text)
    text = re.sub(r'[^\x00-\x7F]+', "", text)
    return re.sub(r"\s+", " ", text).strip()


MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def sort_date(date: str) -> str:
    """Normalize any source date into 'days ago' as a string, or '999' when unknown."""
    date = str(date).strip(" '\"").strip()
    if not date:
        return "999"

    # Already a plain day count
    if date.isdigit():
        return date

    # ISO dates/timestamps e.g. 2026-07-31T00:00:00+00:00 / ...Z / 2026-07-31
    if re.match(r"^\d{4}-\d{2}-\d{2}", date):
        try:
            dt = datetime.fromisoformat(date.replace("Z", "+00:00"))
            now = datetime.now(dt.tzinfo) if dt.tzinfo else datetime.now()
            return str(max(0, (now - dt).days))
        except ValueError:
            pass

    # Relative ages e.g. 3d, 21d, 7mo, 2w
    match = re.fullmatch(r"(\d+)\s*([a-z]+)", date.lower())
    if match:
        val, unit = int(match.group(1)), match.group(2)
        if unit.startswith("d"):
            return str(val)
        if unit.startswith("w"):
            return str(val * 7)
        if unit.startswith("m"):
            return str(val * 30)
        if unit.startswith("h"):
            return "0"
        return "999"

    # Month-day without year e.g. Jul 24 / Sept 03 — infer the year.
    # If it lands more than a week in the future it belongs to last year's cycle.
    match = re.fullmatch(r"([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})", date)
    if match:
        month = MONTHS.get(match.group(1).lower())
        day = int(match.group(2))
        if month:
            try:
                today = datetime.now()
                dt = datetime(today.year, month, day)
                if (dt - today).days > 7:
                    dt = datetime(today.year - 1, month, day)
                return str(max(0, (today - dt).days))
            except ValueError:
                pass

    return "999"


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


def scrape_markdown_readme(url, job_type, season):
    """Parser for repos that use pure Markdown pipe tables (e.g. vanshb03)."""
    response = requests.get(url, timeout=30)
    if response.status_code != 200:
        print(f"  Error {response.status_code} — {url}")
        return []

    jobs = []
    last_company = ""
    in_table = False

    for line in response.text.splitlines():
        stripped = line.strip()

        # Detect table boundaries
        if not stripped.startswith("|"):
            in_table = False
            continue

        # Skip header and separator rows
        if re.match(r"^\|\s*[-:]+\s*\|", stripped) or re.match(r"^\|\s*Company\s*\|", stripped, re.IGNORECASE):
            in_table = True
            continue

        if not in_table and "|" in stripped:
            in_table = True

        cells = [c.strip() for c in stripped.split("|")[1:-1]]
        if len(cells) < 5:
            continue

        # Company — strip HTML tags and emoji flags
        raw_company = re.sub(r"<[^>]+>", "", cells[0]).strip()
        company = clean_text(raw_company)
        if not company or company == "" :
            company = last_company
        else:
            last_company = company

        # Role — strip HTML and sponsorship emoji
        raw_role = re.sub(r"<[^>]+>", "", cells[1]).strip()
        role = clean_text(raw_role)

        # Location — normalize <br>/<br/>/</br> variants to ", " first, then drop
        # <details><summary>**N locations**</summary> chips, strip remaining HTML/markdown
        raw_location = re.sub(r"(?i)</?\s*br\s*/?>", ", ", cells[2])
        raw_location = re.sub(r"(?is)<summary>.*?</summary>", "", raw_location)
        raw_location = re.sub(r"<[^>]+>", "", raw_location)
        # Collapse leftover newlines that survived tag stripping
        raw_location = re.sub(r"\s*\n\s*", ", ", raw_location)
        location = clean_text(raw_location)
        location = re.sub(r"\s*,\s*(,\s*)+", ", ", location).strip(" ,")

        # Link — extract href from the anchor in cell 3
        link_match = re.search(r'href="([^"]+)"', cells[3])
        if link_match:
            link = link_match.group(1)
        else:
            # Closed listing (🔒) or no link — skip
            continue

        # Date — cell 4, strip HTML
        raw_date = re.sub(r"<[^>]+>", "", cells[4]).strip()
        date = clean_text(raw_date)

        if not company or not role:
            continue

        jobs.append({
            "company":  company,
            "role":     role,
            "location": location,
            "date":     date,
            "link":     link,
            "type":     job_type,
            "season":   season,
        })

    print(f"  {len(jobs)} rows from {job_type} ({season}) [markdown]")
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
            "company":  clean_text(str(job.get("company", ""))),
            "role":     clean_text(str(job.get("role", ""))),
            "location": clean_text(str(job.get("location", ""))),
            "date":     str(job.get("date", "")).strip(),
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

    print("Scraping Markdown READMEs...")
    for source in MARKDOWN_SOURCES:
        all_jobs.extend(scrape_markdown_readme(source["url"], source["type"], source["season"]))

    print("Scraping SearchTern-Listings...")
    all_jobs.extend(scrape_searchtern_listings(SEARCHTERN_LISTINGS_URL))

    seen = set()
    deduped = []
    for job in all_jobs:
        key = (job["company"].lower(), job["role"].lower(), job["location"].lower())
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

    in_range = []
    too_old = 0
    for job in us_jobs:
        try:
            days = float(job["date"])
        except (TypeError, ValueError):
            days = -1  # unknown date -> keep
        if days >= 0 and days > MAX_AGE_DAYS:
            too_old += 1
        else:
            in_range.append(job)
    if too_old:
        print(f"Removed {too_old} listings older than {MAX_AGE_DAYS} days")
    print(f"Listings within {MAX_AGE_DAYS} days: {len(in_range)}")

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
            CONSTRAINT internships_unique_job UNIQUE (company, role, link)
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
        for job in in_range
    ]

    # Purge existing rows older than the age cap (numeric dates only)
    cursor.execute(
        r"DELETE FROM internships WHERE date ~ '^[0-9]+(\.[0-9]+)?$' AND date::numeric > %s",
        (MAX_AGE_DAYS,),
    )

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
    return f"Done! {len(in_range)} listings upserted."


if __name__ == "__main__":
    print(update_database())