# foryou.py — "For You" daily match email.
#
# The frontend stores the full onboarding profile in Supabase user_metadata and
# only sends the matching fields here (roles, job types, metros, remote, work
# auth, daily count). Once a day, each opted-in user gets their top unsent
# matches — 1 to 5, chosen by the user, 5 by default.
#
# ROLE_OPTIONS / METROS / score_job mirror frontend/src/utils/forYou.ts.
# Keep them in sync so the email picks what the For You page ranks first.
import html
import logging
import os
import re
import secrets
import smtplib
from email.message import EmailMessage
from threading import Lock
from time import time

import psycopg2.extras

import read_db

logger = logging.getLogger(__name__)

SMTP_HOST = os.environ.get("SMTP_HOST")
SMTP_PORT = int(os.environ.get("SMTP_PORT") or 587)
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
DIGEST_FROM = os.environ.get("DIGEST_FROM") or SMTP_USER
SITE_URL = (os.environ.get("PUBLIC_SITE_URL") or "https://searchtern.net").rstrip("/")
API_URL = (os.environ.get("PUBLIC_API_URL") or "https://api.searchtern.net").rstrip("/")

# A user is due again once this long has passed, so a slow run or a restart
# near the scheduled time never produces two emails in one day.
_RESEND_AFTER = "20 hours"

# Matches per daily email. The user picks a number in this range; the profile
# stores it, and it is re-clamped here because the value comes from the browser.
DAILY_MIN = 1
DAILY_MAX = 5
DAILY_DEFAULT = 5

ROLE_OPTIONS = {
    "swe": (["Software Engineering"], r"\b(software|swe|developer|full[- ]?stack|front[- ]?end|back[- ]?end|mobile|ios|android|web)\b"),
    "ai": (["Data/ML/AI"], r"\b(machine learning|ml|ai|artificial intelligence|deep learning|llm|nlp|computer vision)\b"),
    "data": (["Data/ML/AI", "Business/Analytics"], r"\b(data|analytics|analyst|business intelligence|bi)\b"),
    "security": (["Cybersecurity"], r"\b(security|cyber|infosec|soc)\b"),
    "devops": (["DevOps/SRE"], r"\b(devops|sre|site reliability|cloud|infrastructure|platform)\b"),
    "hardware": (["Hardware/Embedded"], r"\b(hardware|embedded|firmware|electrical|fpga|asic|robotics)\b"),
    "product": (["Product/Design"], r"\b(product|ux|ui|designer|design)\b"),
    "quant": (["Finance/Quant", "Accounting"], r"\b(quant|quantitative|trading|finance|financial|investment)\b"),
    "research": (["Research/Science"], r"\b(research|scientist|r&d)\b"),
    "business": (["Operations/Supply", "Sales/Business Dev", "Marketing/Comms"], r"\b(operations|business|marketing|sales|consult)\b"),
}
ROLE_RE = {k: re.compile(v[1], re.I) for k, v in ROLE_OPTIONS.items()}

JOB_TYPES = ("summer", "fall", "spring", "winter", "coop", "newgrad")
SEASON_RE = {
    "summer": re.compile(r"\bsummer\b", re.I),
    "fall": re.compile(r"\b(fall|autumn)\b", re.I),
    "spring": re.compile(r"\bspring\b", re.I),
    "winter": re.compile(r"\bwinter\b", re.I),
    "coop": re.compile(r"\bco-?op\b", re.I),
}
SPONSOR_AUTH = {"f1_opt", "h1b", "other_sponsor"}
WORK_AUTH = {"citizen", "permanent_resident"} | SPONSOR_AUTH

METROS = {
    "New York City, NY": ["new york", "nyc", "brooklyn", "manhattan", "jersey city", "hoboken", "newark", "stamford"],
    "San Francisco Bay Area, CA": ["san francisco", "san jose", "palo alto", "mountain view", "sunnyvale", "menlo park", "santa clara", "cupertino", "redwood city", "oakland", "fremont", "san mateo", "foster city", "milpitas", "berkeley", "south san francisco"],
    "Seattle, WA": ["seattle", "bellevue", "redmond", "kirkland", "tacoma", "bothell"],
    "Los Angeles, CA": ["los angeles", "santa monica", "irvine", "pasadena", "culver city", "el segundo", "long beach", "burbank", "torrance", "hawthorne"],
    "San Diego, CA": ["san diego", "la jolla", "carlsbad"],
    "Boston, MA": ["boston", "cambridge", "waltham", "somerville", "burlington, ma", "lexington, ma"],
    "Chicago, IL": ["chicago", "evanston", "naperville", "schaumburg"],
    "Austin, TX": ["austin", "round rock"],
    "Dallas-Fort Worth, TX": ["dallas", "fort worth", "plano", "irving", "richardson", "frisco", "arlington, tx"],
    "Houston, TX": ["houston", "the woodlands", "sugar land"],
    "Washington, DC Metro": ["washington, dc", "washington dc", "washington, d.c.", "arlington, va", "mclean", "reston", "herndon", "tysons", "alexandria", "bethesda", "rockville", "chantilly", "fairfax"],
    "Atlanta, GA": ["atlanta", "alpharetta", "marietta"],
    "Denver / Boulder, CO": ["denver", "boulder", "englewood", "aurora, co", "colorado springs"],
    "Philadelphia, PA": ["philadelphia", "king of prussia", "conshohocken"],
    "Pittsburgh, PA": ["pittsburgh"],
    "Raleigh-Durham, NC": ["raleigh", "durham", "chapel hill", "cary", "morrisville", "research triangle"],
    "Charlotte, NC": ["charlotte"],
    "Miami, FL": ["miami", "fort lauderdale", "boca raton"],
    "Orlando / Tampa, FL": ["orlando", "tampa", "st. petersburg"],
    "Phoenix, AZ": ["phoenix", "tempe", "scottsdale", "chandler", "mesa"],
    "Salt Lake City, UT": ["salt lake city", "lehi", "provo", "draper", "south jordan"],
    "Portland, OR": ["portland, or", "hillsboro", "beaverton"],
    "Minneapolis-St. Paul, MN": ["minneapolis", "st. paul", "saint paul", "eden prairie"],
    "Detroit / Ann Arbor, MI": ["detroit", "ann arbor", "dearborn", "troy, mi"],
    "Columbus, OH": ["columbus"],
    "Nashville, TN": ["nashville", "franklin, tn"],
    "St. Louis, MO": ["st. louis", "st louis", "saint louis"],
    "Kansas City, MO": ["kansas city", "overland park"],
    "Baltimore, MD": ["baltimore", "columbia, md", "annapolis", "laurel, md"],
    "Huntsville, AL": ["huntsville"],
}
ROLE_LABELS = {
    "swe": "Software Development", "ai": "AI / Machine Learning", "data": "Data Analysis / Science",
    "security": "Cybersecurity", "devops": "DevOps / Cloud / SRE", "hardware": "Hardware / Embedded",
    "product": "Product / Design", "quant": "Quant / Finance", "research": "Research / Science",
    "business": "Business / Operations",
}
TYPE_LABELS = {
    "summer": "Summer internship", "fall": "Fall internship", "spring": "Spring internship",
    "winter": "Winter internship", "coop": "Co-op", "newgrad": "New grad (full-time)",
}


def sanitize_prefs(raw):
    """Keep only known values; the body comes from the browser."""
    raw = raw if isinstance(raw, dict) else {}

    def pick(key, allowed):
        vals = raw.get(key)
        return [v for v in dict.fromkeys(vals) if v in allowed] if isinstance(vals, list) else []

    auth = raw.get("workAuth")
    try:
        daily = int(raw.get("dailyCount"))
    except (TypeError, ValueError):
        daily = DAILY_DEFAULT
    return {
        "roles": pick("roles", ROLE_OPTIONS),
        "jobTypes": pick("jobTypes", JOB_TYPES),
        "metros": pick("metros", METROS),
        "remoteOk": raw.get("remoteOk") is not False,
        "workAuth": auth if auth in WORK_AUTH else "",
        "dailyCount": max(DAILY_MIN, min(daily, DAILY_MAX)),
    }


def score_job(job, p):
    """(score, reasons) or None when the job is excluded by a preference."""
    reasons = []
    score = 0
    role_text = job.get("role") or ""

    if p["roles"]:
        hit = next(
            (k for k in p["roles"]
             if job.get("category") in ROLE_OPTIONS[k][0] or ROLE_RE[k].search(role_text)),
            None,
        )
        if not hit:
            return None
        score += 3
        reasons.append(ROLE_LABELS[hit])

    types = p["jobTypes"]
    if types:
        if job.get("type") == "newgrad":
            if "newgrad" not in types:
                return None
            score += 2
            reasons.append("New grad")
        else:
            intern = [t for t in types if t != "newgrad"]
            if not intern:
                return None
            explicit = [k for k, rx in SEASON_RE.items() if rx.search(role_text)]
            if re.fullmatch(r"\d{4}", job.get("season") or "") and not explicit:
                explicit.append("summer")
            if explicit:
                hit = next((k for k in explicit if k in intern), None)
                if not hit:
                    return None
                score += 2
                reasons.append(TYPE_LABELS[hit])

    loc = (job.get("location") or "").lower()
    metro = next((m for m in p["metros"] if any(c in loc for c in METROS[m])), None)
    if metro:
        score += 2
        reasons.append(metro.split(",")[0])
    elif p["remoteOk"] and re.search(r"\bremote\b", loc):
        score += 1
        reasons.append("Remote")
    elif p["metros"]:
        return None

    if p["workAuth"] in SPONSOR_AUTH and job.get("visa_sponsor") is True:
        score += 2
        reasons.append("Sponsors H-1B")

    try:
        days = float(job.get("date"))
    except (TypeError, ValueError):
        days = None
    if days is not None:
        if days <= 1:
            score += 2
            reasons.append("New today")
        elif days <= 7:
            score += 1
            reasons.append("This week")
    return score, reasons


def fingerprint(job):
    def norm(s):
        s = re.sub(r"[^a-z0-9\s]", "", (s or "").lower())
        return re.sub(r"\s+", " ", s).strip()
    return f"{norm(job.get('company'))}|{norm(job.get('role'))}|{norm(job.get('location'))}"


def best_matches(jobs, prefs, exclude=frozenset(), limit=DAILY_DEFAULT):
    """Up to `limit` unsent matches, best first — the drawer's order.

    Ranked by score then by how recently the listing was posted, and deduped by
    fingerprint so the same job never fills two places in one email.
    """
    ranked = []
    seen = set(exclude)
    for job in jobs:
        scored = score_job(job, prefs)
        if not scored:
            continue
        fp = fingerprint(job)
        if fp in seen:
            continue
        seen.add(fp)
        ranked.append(((scored[0], -_days(job)), job, scored[1]))
    ranked.sort(key=lambda row: row[0], reverse=True)
    return [(job, reasons) for _, job, reasons in ranked[:limit]]


def _days(job):
    try:
        return float(job.get("date"))
    except (TypeError, ValueError):
        return 9999.0


# ── Storage ──────────────────────────────────────────────────────────────────

_tables_ready = False
_tables_lock = Lock()
_tables_checked_at = 0.0


def ensure_tables():
    global _tables_ready, _tables_checked_at
    if _tables_ready and time() - _tables_checked_at < 600:
        return
    with _tables_lock:
        if _tables_ready and time() - _tables_checked_at < 600:
            return
        conn = read_db.get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS foryou_profiles (
                        user_id TEXT PRIMARY KEY,
                        email TEXT NOT NULL,
                        prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
                        opt_in BOOLEAN NOT NULL DEFAULT false,
                        unsubscribe_token TEXT NOT NULL UNIQUE,
                        last_sent_at TIMESTAMPTZ,
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS foryou_sent (
                        user_id TEXT NOT NULL,
                        fingerprint TEXT NOT NULL,
                        sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                        PRIMARY KEY (user_id, fingerprint)
                    )
                """)
                # Backend-only tables: RLS on with no policies keeps PostgREST
                # (anon/authenticated) out, same as the agent tables.
                for t in ("foryou_profiles", "foryou_sent"):
                    cur.execute(
                        "SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
                        "WHERE n.nspname = 'public' AND c.relname = %s",
                        (t,),
                    )
                    row = cur.fetchone()
                    if row and not row[0]:
                        cur.execute(f"ALTER TABLE {t} ENABLE ROW LEVEL SECURITY")
            conn.commit()
            _tables_ready = True
            _tables_checked_at = time()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def upsert_profile(user_id, email, prefs, opt_in):
    ensure_tables()
    conn = read_db.get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO foryou_profiles (user_id, email, prefs, opt_in, unsubscribe_token)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE SET
                    email = EXCLUDED.email, prefs = EXCLUDED.prefs,
                    opt_in = EXCLUDED.opt_in, updated_at = now()
                """,
                (user_id, email, psycopg2.extras.Json(prefs), bool(opt_in), secrets.token_urlsafe(24)),
            )
        conn.commit()
    finally:
        conn.close()


def unsubscribe(token):
    ensure_tables()
    conn = read_db.get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE foryou_profiles SET opt_in = false, updated_at = now() WHERE unsubscribe_token = %s",
                (token,),
            )
            hit = cur.rowcount > 0
        conn.commit()
        return hit
    finally:
        conn.close()


# ── Sending ──────────────────────────────────────────────────────────────────

def smtp_configured():
    return bool(SMTP_HOST and DIGEST_FROM)


def _job_url(job):
    return f"{SITE_URL}/jobs/{job.get('id')}" if job.get("id") else job.get("link")


def render_email(matches, unsubscribe_token):
    """One email listing every match the user asked for, best first."""
    e = html.escape
    unsub_url = f"{API_URL}/foryou/unsubscribe?token={unsubscribe_token}"
    count = len(matches)
    subject = (
        f"Your SearchTern match today: {matches[0][0].get('company')}"
        if count == 1
        else f"{count} new SearchTern matches for you"
    )
    intro = (
        "Here's today's best match for you:"
        if count == 1
        else f"Here are your top {count} matches today:"
    )
    text_parts = [intro, ""]
    cards = []
    for job, reasons in matches:
        why = " · ".join(reasons)
        job_url = _job_url(job)
        text_parts += [
            f"{job.get('company')}: {job.get('role')}",
            f"{job.get('location') or ''}",
            f"Why: {why}",
            f"View & apply: {job_url}",
            "",
        ]
        cards.append(f"""\
  <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:12px">
    <div style="font-weight:700;font-size:16px">{e(job.get('company') or '')}</div>
    <div>{e(job.get('role') or '')}</div>
    <div style="color:#5e6c84;font-size:13px">{e(job.get('location') or '')}</div>
    <div style="color:#2d7a4f;font-size:13px;margin-top:6px">Why: {e(why)}</div>
    <a href="{e(job_url or '')}" style="display:inline-block;margin-top:12px;padding:8px 14px;border-radius:6px;background:#3aa76d;color:#fff;text-decoration:none;font-weight:600">View &amp; apply</a>
  </div>""")
    text = "\n".join(text_parts + [
        f"Change preferences: {SITE_URL}/for-you",
        f"Unsubscribe: {unsub_url}",
    ])
    body = f"""\
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#172b4d">
  <div style="font-weight:800;font-size:20px;margin:16px 0">Search<span style="color:#2d7a4f">Tern</span></div>
  <p>{intro}</p>
{chr(10).join(cards)}
  <p style="font-size:12px;color:#5e6c84;margin-top:20px">
    You're getting this because you turned on daily matches.
    <a href="{e(SITE_URL)}/for-you" style="color:#2d7a4f">Change preferences</a> ·
    <a href="{e(unsub_url)}" style="color:#2d7a4f">Unsubscribe</a>
  </p>
</div>"""
    return subject, text, body, unsub_url


def _send(to, subject, text, body, unsub_url):
    msg = EmailMessage()
    msg["From"] = DIGEST_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg["List-Unsubscribe"] = f"<{unsub_url}>"
    msg.set_content(text)
    msg.add_alternative(body, subtype="html")
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as s:
        s.starttls()
        if SMTP_USER:
            s.login(SMTP_USER, SMTP_PASSWORD or "")
        s.send_message(msg)


_run_lock = Lock()


def send_daily_digests():
    """Email each due, opted-in user their top unsent matches. Returns a summary."""
    if not smtp_configured():
        logger.info("For You digest: SMTP not configured, skipping")
        return {"skipped": "smtp not configured"}
    if not _run_lock.acquire(blocking=False):
        return {"skipped": "already running"}
    try:
        ensure_tables()
        conn = read_db.get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT user_id, email, prefs, unsubscribe_token FROM foryou_profiles "
                    "WHERE opt_in AND (last_sent_at IS NULL OR last_sent_at < now() - %s::interval)",
                    (_RESEND_AFTER,),
                )
                due = cur.fetchall()
        finally:
            conn.close()

        jobs = read_db.recent_internships()
        sent = no_match = failed = 0
        for row in due:
            conn = read_db.get_conn()
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT fingerprint FROM foryou_sent WHERE user_id = %s", (row["user_id"],))
                    already = {r[0] for r in cur.fetchall()}
                prefs = sanitize_prefs(row["prefs"])
                matches = best_matches(jobs, prefs, already, prefs["dailyCount"])
                if not matches:
                    no_match += 1
                    continue
                try:
                    _send(row["email"], *render_email(matches, row["unsubscribe_token"]))
                except Exception as e:
                    failed += 1
                    logger.error(f"For You digest: send to user {row['user_id']} failed: {e}")
                    continue
                with conn.cursor() as cur:
                    cur.executemany(
                        "INSERT INTO foryou_sent (user_id, fingerprint) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                        [(row["user_id"], fingerprint(job)) for job, _ in matches],
                    )
                    cur.execute("UPDATE foryou_profiles SET last_sent_at = now() WHERE user_id = %s", (row["user_id"],))
                conn.commit()
                sent += 1
            finally:
                conn.close()
        summary = {"due": len(due), "sent": sent, "no_match": no_match, "failed": failed}
        logger.info(f"For You digest: {summary}")
        return summary
    finally:
        _run_lock.release()
