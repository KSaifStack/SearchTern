import requests
from bs4 import BeautifulSoup
import ctypes
import gc
import ijson
import re
import psycopg2
from psycopg2.extras import execute_values
import os
from dotenv import load_dotenv
from datetime import datetime, timezone
from threading import Lock

# The fingerprint normaliser is shared with the read path so /jobs/lookup can
# match what we store here, and the snapshot writer refreshes the file /recent
# serves. read_db's pool is lazy, so importing it opens no connection.
from read_db import job_fingerprint, write_snapshot

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
    {
        "name": "SimplifyJobs — New Grad 2027",
        "url": "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/README.md",
        "type": "newgrad",
        "season": "2027",
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
        "name": "speedyapply — 2027 SWE College Jobs (Internships)",
        "url": "https://raw.githubusercontent.com/speedyapply/2027-SWE-College-Jobs/main/README.md",
        "type": "internship",
        "season": "2027",
    },
    {
        "name": "speedyapply — 2027 SWE New Grad USA",
        "url": "https://raw.githubusercontent.com/speedyapply/2027-SWE-College-Jobs/main/NEW_GRAD_USA.md",
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
_update_lock = Lock()
_SCRAPE_ADVISORY_LOCK_ID = 742031

# Rows are flushed to Postgres in batches of this size rather than accumulating
# the whole run in memory. The dedup set is shared across sources, so a row seen
# by an earlier source is still dropped when a later one repeats it.
_UPSERT_BATCH = 2000


def _rss_mb():
    """Current resident set size. The scrape runs inside the request-serving
    process, so this is the number that decides whether Render's cgroup kills
    the whole site."""
    try:
        with open("/proc/self/status") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return round(int(line.split()[1]) / 1024, 1)
    except (OSError, ValueError, IndexError):
        pass
    return None


def _release_memory():
    """Dropping Python references does not lower RSS — glibc keeps freed arenas
    mapped, so the process holds its high-water mark and the next allocation
    competes with memory that is free but still counted against the 512MB
    limit. Freeing the object and returning the arena are separate operations."""
    gc.collect()
    try:
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except (OSError, AttributeError):
        pass


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

#: Cheap ATS guess from the apply URL, so agent feeds know the adapter without
#: resolving the link again. Mirrors the agent's applier/detect.py URL patterns.
ATS_URL_PATTERNS = (
    ("greenhouse", r"greenhouse\.io|gh_jid="),
    ("lever", r"jobs\.lever\.co"),
    ("ashby", r"jobs\.ashbyhq\.com"),
    ("workday", r"myworkdayjobs|workday\.com"),
    ("workable", r"apply\.workable\.com"),
    ("icims", r"icims\.com"),
    ("smartrecruiters", r"smartrecruiters\.com"),
    ("recruitee", r"recruitee\.com"),
    ("teamtailor", r"teamtailor\.com"),
    ("bamboohr", r"bamboohr\.com"),
    ("successfactors", r"successfactors|sap\.cloud"),
    ("avature", r"avature\.net"),
    ("tal", r"tal\.net"),
)


def ats_of(url):
    for ats_id, pat in ATS_URL_PATTERNS:
        if re.search(pat, url, re.I):
            return ats_id
    return ""


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
    response = requests.get(url, timeout=30)
    if response.status_code != 200:
        raise RuntimeError(f"HTTP {response.status_code} while fetching {url}")

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
                "ats":      ats_of(cells[-2].find("a")["href"]) if cells[-2].find("a") else "",
            })

    if not jobs:
        raise RuntimeError(f"No rows found in {url}")
    print(f"  {len(jobs)} rows from {job_type} ({season})")
    return jobs


def scrape_markdown_readme(url, job_type, season):
    """Parser for repos that use pure Markdown pipe tables (e.g. vanshb03)."""
    response = requests.get(url, timeout=30)
    if response.status_code != 200:
        raise RuntimeError(f"HTTP {response.status_code} while fetching {url}")

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

        # Link — extract href from the last anchor cell (column order varies
        # across sources: vanshb03 = ...|Apply|Date, speedyapply = ...|Salary|Posting|Age)
        link = ""
        for cell in reversed(cells):
            link_match = re.search(r'href="([^"]+)"', cell)
            if link_match:
                link = link_match.group(1)
                break
        if not link:
            # Closed listing (🔒) or no link — skip
            continue

        # Date — last cell, strip HTML
        raw_date = re.sub(r"<[^>]+>", "", cells[-1]).strip()
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
            "ats":      ats_of(link),
        })

    if not jobs:
        raise RuntimeError(f"No rows found in {url}")
    print(f"  {len(jobs)} rows from {job_type} ({season}) [markdown]")
    return jobs


def scrape_searchtern_listings(url):
    """Yields rows from the SearchTern feed, one at a time.

    response.json() is not an option on an 18MB feed: the raw bytes and the
    fully built object graph must coexist for the duration of the parse, which
    made this the single largest allocation in the scrape (+84MB measured).
    ijson keeps one row live at a time, so the peak stops growing with the feed.

    decode_content is required, not optional — urllib3 does not decompress on
    raw.read(), and raw.githubusercontent.com always answers Content-Encoding:
    gzip. Without it ijson raises IncompleteJSONError on every single fetch,
    which per-source error handling would then swallow, leaving the feed
    contributing zero rows forever while looking like a successful run.
    """
    response = requests.get(url, timeout=30, stream=True)
    if response.status_code != 200:
        response.close()
        raise RuntimeError(f"HTTP {response.status_code} while fetching {url}")
    response.raw.decode_content = True

    count = 0
    try:
        for job in ijson.items(response.raw, "item"):
            jt = job.get("job_type", "internship")
            if jt in ("new_grad", "new-grad"):
                jt = "newgrad"
            link = job.get("link")
            if not link or not str(link).startswith(("http://", "https://")):
                continue
            description = job.get("description")
            count += 1
            yield {
                "company":  clean_text(str(job.get("company", ""))),
                "role":     clean_text(str(job.get("role", ""))),
                "location": clean_text(str(job.get("location", ""))),
                "date":     str(job.get("date", "")).strip(),
                "link":     link,
                "type":     jt if jt in ("internship", "newgrad") else "internship",
                "season":   "searchtern",
                "ats":      ats_of(link),
                "description": clean_text(str(description)) if description else None,
            }
    finally:
        response.close()

    if not count:
        raise RuntimeError(f"No rows found in {url}")
    print(f"  {count} rows from SearchTern-Listings")


def update_database():
    if not _update_lock.acquire(blocking=False):
        return None
    lock_conn = None
    try:
        lock_conn = psycopg2.connect(DATABASE_URL, connect_timeout=30)
        lock_cursor = lock_conn.cursor()
        lock_cursor.execute("SELECT pg_try_advisory_lock(%s)", (_SCRAPE_ADVISORY_LOCK_ID,))
        if not lock_cursor.fetchone()[0]:
            return None
        lock_conn.commit()
        try:
            return _update_database()
        except MemoryError:
            # The scrape runs inside the request-serving process, so there is no
            # second process to die in — an uncaught MemoryError takes the whole
            # site down rather than just the scrape. Skipping the run costs one
            # stale hour and keeps the endpoint serving.
            print("  ! scrape ran out of memory; skipping this cycle", flush=True)
            return None
    finally:
        try:
            if lock_conn is not None:
                lock_conn.close()
        finally:
            _update_lock.release()


_UPSERT_SQL = """
    INSERT INTO internships (company, role, location, date, link, type, season, ats, description, fingerprint, last_seen_at)
    VALUES %s
    ON CONFLICT (company, role, location, link)
    DO UPDATE SET
        date = EXCLUDED.date,
        type = EXCLUDED.type,
        season = EXCLUDED.season,
        ats = EXCLUDED.ats,
        description = EXCLUDED.description,
        fingerprint = EXCLUDED.fingerprint,
        last_seen_at = EXCLUDED.last_seen_at
"""


def _iter_source(fetch, entry):
    """One source's rows, lazily. The feed streams; the README parsers return a
    list, and yielding from one costs nothing."""
    url, job_type, season = entry
    if job_type is None:
        yield from fetch(url)
    else:
        yield from fetch(url, job_type, season)


def _keep(job):
    """None to keep the row, or the name of the filter that dropped it. Same
    three filters as the pre-batch pipeline, in the same order: a real apply
    link, US-only, inside the age cap. An unparseable date is kept, as before."""
    link = str(job.get("link") or "").strip()
    if not link or re.match(r"^n/?a$", link, re.I):
        return "bad-link"
    if not is_us_only(job["location"]):
        return "non-us"
    try:
        days = float(job["date"])
    except (TypeError, ValueError):
        return None  # unknown date -> keep
    return None if days <= MAX_AGE_DAYS else "too-old"


def _flush(cursor, batch, run_time):
    if not batch:
        return 0
    execute_values(
        cursor,
        _UPSERT_SQL,
        (
            (j["company"], j["role"], j["location"], j["date"], j["link"],
             j["type"], j["season"], j.get("ats", ""), j.get("description"),
             job_fingerprint(j["company"], j["role"], j["location"]), run_time)
            for j in batch
        ),
        page_size=1000,
    )
    return len(batch)


def _backfill_fingerprints(cursor):
    """Fill fingerprint on rows written before the column existed.

    In Python rather than SQL, deliberately. The value has to come out of the
    exact same normaliser the upsert uses, and a SQL translation of those
    regexes would quietly diverge from it — per-field .strip() versus a
    single btrim over the joined string, for one. A mismatched fingerprint is
    not a crash; it is a 404 on every tracked job until that row is re-scraped,
    which is the worst possible failure for the feature that motivated this.
    Idempotent: a no-op once every row is populated.
    """
    cursor.execute(
        "SELECT id, company, role, location FROM internships WHERE fingerprint IS NULL"
    )
    rows = cursor.fetchall()
    if not rows:
        return 0
    execute_values(
        cursor,
        "UPDATE internships AS i SET fingerprint = v.fp "
        "FROM (VALUES %s) AS v(id, fp) WHERE i.id = v.id",
        ((r[0], job_fingerprint(r[1], r[2], r[3])) for r in rows),
        page_size=1000,
    )
    return len(rows)


def _update_database():
    # ORDER IS LOAD-BEARING. Dedup is first-source-wins on
    # (company, role, location), and only the SearchTern feed carries a
    # description — the two README parsers don't emit that key at all. Moving
    # the feed earlier would hand its synthesised boilerplate descriptions to
    # ~4,100 rows that currently resolve to null, and change which apply link
    # survives for each colliding key. It is tempting because the feed is the
    # biggest allocation in the run; it is not free. Leave the order alone.
    sources = [
        ("SimplifyJobs", [(s["url"], s["type"], s["season"]) for s in SIMPLIFY_SOURCES], scrape_simplify_readme),
        ("Markdown", [(s["url"], s["type"], s["season"]) for s in MARKDOWN_SOURCES], scrape_markdown_readme),
        ("SearchTern-Listings", [(SEARCHTERN_LISTINGS_URL, None, None)], scrape_searchtern_listings),
    ]

    conn = psycopg2.connect(DATABASE_URL, connect_timeout=30)
    try:
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
                ats TEXT,
                description TEXT,
                last_seen_at TIMESTAMPTZ DEFAULT NOW(),
                CONSTRAINT internships_unique_job UNIQUE (company, role, location, link)
            )
        """)

        cursor.execute("ALTER TABLE internships ADD COLUMN IF NOT EXISTS type TEXT")
        cursor.execute("ALTER TABLE internships ADD COLUMN IF NOT EXISTS season TEXT")
        cursor.execute("ALTER TABLE internships ADD COLUMN IF NOT EXISTS ats TEXT")
        cursor.execute("ALTER TABLE internships ADD COLUMN IF NOT EXISTS description TEXT")
        cursor.execute("ALTER TABLE internships ADD COLUMN IF NOT EXISTS fingerprint TEXT")
        cursor.execute("ALTER TABLE internships ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW()")

        cursor.execute("""
            SELECT pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conname = %s AND conrelid = 'internships'::regclass
        """, ("internships_unique_job",))
        constraint = cursor.fetchone()
        constraint_sql = re.sub(r"\s+", "", (constraint[0] if constraint else "")).lower()
        if constraint_sql != "unique(company,role,location,link)":
            if constraint:
                cursor.execute("ALTER TABLE internships DROP CONSTRAINT internships_unique_job")
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
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_internships_fingerprint ON internships(fingerprint)")

        backfilled = _backfill_fingerprints(cursor)
        if backfilled:
            print(f"  backfilled fingerprint on {backfilled} pre-existing rows", flush=True)

        # Age purge is safe to run first: it keys off the stored date, not off
        # anything a source told us this cycle.
        cursor.execute(
            r"DELETE FROM internships WHERE date ~ '^[0-9]+(\.[0-9]+)?$' AND date::numeric > %s",
            (MAX_AGE_DAYS,),
        )

        # One source at a time, flushed as we go. The previous shape built the
        # whole run in memory and then four intermediate lists on top of it.
        seen = set()  # shared across sources, so cross-source dedup is unchanged
        failures = []
        dropped = {}
        written = 0

        print(f"Scraping (RSS {(_rss_mb() or 0):.1f} MB at start)...", flush=True)
        for group_name, entries, fetch in sources:
            for url, job_type, season in entries:
                label = f"{group_name} {season or ''}".strip()
                batch = []
                writing = False
                try:
                    for job in _iter_source(fetch, (url, job_type, season)):
                        key = (job["company"].lower(), job["role"].lower(), job["location"].lower())
                        if key in seen:
                            continue
                        seen.add(key)
                        job["date"] = sort_date(job["date"])
                        reason = _keep(job)
                        if reason:
                            dropped[reason] = dropped.get(reason, 0) + 1
                            continue
                        batch.append(job)
                        if len(batch) >= _UPSERT_BATCH:
                            writing = True
                            written += _flush(cursor, batch, current_run_time)
                            writing = False
                            batch.clear()
                            _release_memory()
                    writing = True
                    written += _flush(cursor, batch, current_run_time)
                    writing = False
                except MemoryError:
                    raise
                except Exception as e:
                    if writing:
                        # A failed write is not a failed source. Recording it and
                        # carrying on would report a successful run over a
                        # half-written table, and the purge would run.
                        raise
                    # One 429 or one empty source must not abort the run — that
                    # skips the upsert for every other source too. Recorded and
                    # logged so a source that stops contributing is visible.
                    failures.append(f"{label}: {e}")
                    print(f"  ! {label} failed: {e}", flush=True)
                batch.clear()
                _release_memory()
                print(f"  [rss] after {label}: {_rss_mb()} MB", flush=True)

        print(f"Upserted {written} listings; {len(seen)} unique after dedup")
        if dropped:
            print("Dropped: " + ", ".join(f"{v} {k}" for k, v in sorted(dropped.items())))

        if failures:
            # Correctness, not memory: a source we could not read may own rows
            # that are genuinely still open. Purging on their last_seen_at would
            # delete live listings.
            print(f"Skipping stale-row purge — {len(failures)} source(s) failed:")
            for f in failures:
                print(f"    {f}")
        else:
            cursor.execute("DELETE FROM internships WHERE last_seen_at < %s", (current_run_time,))

        conn.commit()

        # Snapshot refresh. In-process (SCRAPE_IN_PROCESS=1) it keeps this API's
        # /recent current without a Postgres read on the request path; standalone
        # (GitHub Actions) it produces the file the workflow uploads to R2, so
        # the CDN — not the API — serves the list. One ~4.2MB read per scrape
        # either way.
        try:
            write_snapshot()
            print("  rewrote job snapshot", flush=True)
        except Exception as e:
            # The API rebuilds it on demand; a scrape must not fail over this.
            print(f"  ! snapshot refresh failed (API will rebuild on demand): {e}", flush=True)

        return f"Done! {written} listings upserted." + (f" ({len(failures)} source failures.)" if failures else "")
    finally:
        conn.close()


if __name__ == "__main__":
    print(update_database())