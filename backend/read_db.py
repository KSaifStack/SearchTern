# read_db.py
import psycopg2
import psycopg2.extras
import json
import hashlib
import secrets
import os
from time import time
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.environ.get("DATABASE_URL")

_cache: list | None = None
_cache_time: float = 0
_CACHE_TTL = 3300  # 55 minutes (refresh before the hourly scrape)

def now():
    return datetime.now(timezone.utc)

def get_conn():
    return psycopg2.connect(DATABASE_URL)


def invalidate_cache():
    global _cache, _cache_time
    _cache = None
    _cache_time = 0


# Get all internships ordered by date (cached in memory)
def recent_internships():
    global _cache, _cache_time
    now = time()
    if _cache is not None and now - _cache_time < _CACHE_TTL:
        return _cache
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM internships ORDER BY date")
        rows = cur.fetchall()
    conn.close()
    _cache = [dict(row) for row in rows]
    _cache_time = now
    return _cache


# Search by location
def search_location(x):
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT * FROM internships WHERE location ILIKE %s ORDER BY date",
            (f"%{x}%",)
        )
        rows = cur.fetchall()
    conn.close()
    return [dict(row) for row in rows]


# Search by role keywords
def find_keywords(x):
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT * FROM internships WHERE role ILIKE %s ORDER BY date",
            (f"%{x}%",)
        )
        rows = cur.fetchall()
    conn.close()
    return [dict(row) for row in rows]


# ── Agent approval bridge ─────────────────────────────────────────────────────
# Agents never mutate the tracker directly. They POST proposals that a human
# reviews in the SearchTern UI and approves/rejects before anything executes.

AGENT_STATUSES = ("pending", "approved", "rejected", "cancelled")
AGENT_TOOLS = ("add_to_tracker", "update_status", "apply")

# An agent key is considered "connected" if it was seen within this window.
# Beyond that it's "disconnected"; if never seen it's "not connected".
AGENT_CONNECTED_SECONDS = 90

def ensure_agent_tables():
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS agent_proposals (
                id BIGSERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                tool TEXT NOT NULL,
                payload JSONB NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                note TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                decided_at TIMESTAMPTZ
            )
        """)
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_agent_proposals_user ON agent_proposals (user_id, status)"
        )
        cur.execute("""
            CREATE TABLE IF NOT EXISTS agent_keys (
                id BIGSERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL DEFAULT 'default',
                key_sha256 TEXT NOT NULL UNIQUE,
                key_prefix TEXT NOT NULL,
                active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                last_used_at TIMESTAMPTZ
            )
        """)
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_agent_keys_user ON agent_keys (user_id)"
        )
        cur.execute("""
            CREATE TABLE IF NOT EXISTS agent_settings (
                user_id TEXT PRIMARY KEY,
                enabled BOOLEAN NOT NULL DEFAULT true,
                show_tracker_tab BOOLEAN NOT NULL DEFAULT false,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)
        cur.execute(
            "ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS show_tracker_tab BOOLEAN NOT NULL DEFAULT false"
        )
        cur.execute("""
            CREATE TABLE IF NOT EXISTS agent_policies (
                id BIGSERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                tool TEXT NOT NULL,
                action TEXT NOT NULL,
                match JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_agent_policies_user ON agent_policies (user_id)"
        )
        cur.execute("""
            CREATE TABLE IF NOT EXISTS agent_health (
                user_id TEXT PRIMARY KEY,
                last_seen_at TIMESTAMPTZ,
                last_action TEXT,
                last_search_at TIMESTAMPTZ,
                last_search_count INT,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)
        # Agent data is managed exclusively by the backend through its DB
        # connection (the table owner, which bypasses RLS unless FORCE is set).
        # The browser never reads/writes these tables directly, so we enable RLS
        # with no policies: anon/authenticated (PostgREST) are denied entirely.
        # IMPORTANT: this runs on every agent request, so the checks below must
        # stay lock-free (plain SELECTs). ALTER TABLE takes ACCESS EXCLUSIVE
        # locks and would deadlock under the frontend's parallel agent calls,
        # so it only runs while RLS is actually off.
        for t in ("agent_proposals", "agent_keys", "agent_settings", "agent_policies", "agent_health"):
            cur.execute(
                "SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
                "WHERE n.nspname = 'public' AND c.relname = %s",
                (t,),
            )
            if not cur.fetchone()[0]:
                cur.execute(f"ALTER TABLE {t} ENABLE ROW LEVEL SECURITY")
        # Defense in depth: drop any direct grants to Supabase roles so PostgREST
        # does not even expose these tables. No-op on non-Supabase databases.
        # Guarded by a privilege check so it also stops locking once done.
        cur.execute("""
            DO $$
            DECLARE r text;
            BEGIN
                FOREACH r IN ARRAY ARRAY['anon', 'authenticated']
                LOOP
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r)
                       AND EXISTS (
                           SELECT 1 FROM information_schema.role_table_grants
                           WHERE grantee = r
                             AND table_name IN ('agent_proposals','agent_keys','agent_settings','agent_policies','agent_health')
                       ) THEN
                        EXECUTE format(
                            'REVOKE ALL PRIVILEGES ON agent_proposals, agent_keys, agent_settings, agent_policies, agent_health FROM %I',
                            r
                        );
                    END IF;
                END LOOP;
            END $$;
        """)
    conn.commit()
    conn.close()


def create_agent_proposal(user_id, tool, payload, note=None, status="pending"):
    ensure_agent_tables()
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO agent_proposals (user_id, tool, payload, note, status, decided_at) "
            "VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
            (user_id, tool, json.dumps(payload), note, status, now() if status != "pending" else None),
        )
        proposal_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return proposal_id


def list_agent_proposals(user_id, status=None, limit=50):
    ensure_agent_tables()
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        if status:
            cur.execute(
                "SELECT * FROM agent_proposals WHERE user_id = %s AND status = %s ORDER BY created_at DESC LIMIT %s",
                (user_id, status, limit),
            )
        else:
            cur.execute(
                "SELECT * FROM agent_proposals WHERE user_id = %s ORDER BY created_at DESC LIMIT %s",
                (user_id, limit),
            )
        rows = cur.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_agent_proposal(proposal_id):
    ensure_agent_tables()
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM agent_proposals WHERE id = %s", (proposal_id,))
        row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def decide_agent_proposal(proposal_id, status):
    if status not in AGENT_STATUSES:
        raise ValueError(f"invalid status: {status}")
    ensure_agent_tables()
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE agent_proposals SET status = %s, decided_at = now() WHERE id = %s RETURNING id",
            (status, proposal_id),
        )
        updated = cur.fetchone()
    conn.commit()
    conn.close()
    return updated is not None


# ── Per-user agent keys ────────────────────────────────────────────────────────
# Users generate their own agent API key from Settings. Only the SHA-256 of the
# key is stored; the raw key is shown to the user exactly once at creation.

def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()

def generate_agent_key(user_id, name="agent"):
    ensure_agent_tables()
    raw = "st_" + secrets.token_urlsafe(32)
    digest = _hash_key(raw)
    prefix = raw[:9]
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO agent_keys (user_id, name, key_sha256, key_prefix) VALUES (%s, %s, %s, %s) RETURNING id",
            (user_id, name or "agent", digest, prefix),
        )
        key_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return {"id": key_id, "user_id": user_id, "name": name or "agent", "key": raw, "key_prefix": prefix}


def list_agent_keys(user_id):
    ensure_agent_tables()
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT id, name, key_prefix, active, created_at, last_used_at FROM agent_keys "
            "WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,),
        )
        rows = cur.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_active_agent_key(raw_authorization):
    """Resolve a Bearer token to its owner. Returns row or None. Never leaks the raw key."""
    if not raw_authorization or not raw_authorization.startswith("Bearer "):
        return None
    digest = _hash_key(raw_authorization[len("Bearer "):])
    ensure_agent_tables()
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT id, user_id, name FROM agent_keys WHERE key_sha256 = %s AND active = true",
            (digest,),
        )
        row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def touch_agent_key(key_id):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("UPDATE agent_keys SET last_used_at = now() WHERE id = %s", (key_id,))
    conn.commit()
    conn.close()


def revoke_agent_key(user_id, key_id):
    ensure_agent_tables()
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE agent_keys SET active = false WHERE id = %s AND user_id = %s AND active = true RETURNING id",
            (key_id, user_id),
        )
        updated = cur.fetchone()
    conn.commit()
    conn.close()
    return updated is not None


def get_agent_settings(user_id):
    ensure_agent_tables()
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT enabled, show_tracker_tab FROM agent_settings WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
    conn.close()
    if row:
        return {"enabled": bool(row[0]), "show_tracker_tab": bool(row[1])}
    return {"enabled": True, "show_tracker_tab": False}


# ── Agent health / liveness ──────────────────────────────────────────────────
# Every call made with a user's agent key bumps last_seen_at. This lets the UI
# show whether an agent is connected, disconnected, or never connected, plus
# the last thing it did (e.g. an active search).

def touch_agent_health(user_id, action=None, search_at=None, search_count=None):
    ensure_agent_tables()
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO agent_health (user_id, last_seen_at, last_action, last_search_at, last_search_count, updated_at) "
            "VALUES (%s, now(), %s, %s, %s, now()) "
            "ON CONFLICT (user_id) DO UPDATE SET "
            "  last_seen_at = now(), "
            "  last_action = COALESCE(EXCLUDED.last_action, agent_health.last_action), "
            "  last_search_at = COALESCE(EXCLUDED.last_search_at, agent_health.last_search_at), "
            "  last_search_count = COALESCE(EXCLUDED.last_search_count, agent_health.last_search_count), "
            "  updated_at = now()",
            (user_id, action, search_at, search_count),
        )
    conn.commit()
    conn.close()


def get_agent_health(user_id):
    ensure_agent_tables()
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT last_seen_at, last_action, last_search_at, last_search_count FROM agent_health WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def set_agent_settings(user_id, enabled=None, show_tracker_tab=None):
    """Partial update; None leaves a field unchanged. Returns the saved settings."""
    ensure_agent_tables()
    prev = get_agent_settings(user_id)
    new_enabled = bool(enabled) if enabled is not None else prev["enabled"]
    new_show = bool(show_tracker_tab) if show_tracker_tab is not None else prev["show_tracker_tab"]
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO agent_settings (user_id, enabled, show_tracker_tab) "
            "VALUES (%s, %s, %s) "
            "ON CONFLICT (user_id) DO UPDATE SET "
            "enabled = excluded.enabled, "
            "show_tracker_tab = excluded.show_tracker_tab, "
            "updated_at = now()",
            (user_id, new_enabled, new_show),
        )
    conn.commit()
    conn.close()
    return get_agent_settings(user_id)


# ── Agent policies ────────────────────────────────────────────────────────────
# Policies decide what an agent may do BEFORE its action is even offered for
# approval. Actions are 'ask' (default: unknown), 'allow' (auto-approve), or
# 'block'. They are enforced server-side at /agent/propose, so they hold for any
# agent client. An empty match applies to every proposal of that tool.

AGENT_POLICY_ACTIONS = ("allow", "ask", "block")


def list_agent_policies(user_id):
    ensure_agent_tables()
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT id, tool, action, match FROM agent_policies "
            "WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,),
        )
        rows = cur.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def upsert_agent_policy(user_id, tool, action, match=None):
    """Create or update a policy for exactly this (tool, match) pair.
    'ask' means "no policy" so it removes any existing empty-match rule."""
    if action not in AGENT_POLICY_ACTIONS:
        raise ValueError(f"action must be one of {AGENT_POLICY_ACTIONS}")
    match = match or {}
    ensure_agent_tables()
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        if action == "ask" and not match:
            cur.execute(
                "DELETE FROM agent_policies WHERE user_id = %s AND tool = %s AND match = '{}'::jsonb RETURNING id",
                (user_id, tool),
            )
            deleted = cur.fetchone()
            conn.commit()
            conn.close()
            return {"id": deleted["id"] if deleted else None, "tool": tool, "action": "ask", "match": {}}
        cur.execute(
            "SELECT * FROM agent_policies WHERE user_id = %s AND tool = %s AND match = %s::jsonb",
            (user_id, tool, json.dumps(match)),
        )
        existing = cur.fetchone()
        if existing:
            cur.execute(
                "UPDATE agent_policies SET action = %s WHERE id = %s RETURNING id, tool, action, match",
                (action, existing["id"]),
            )
        else:
            cur.execute(
                "INSERT INTO agent_policies (user_id, tool, action, match) VALUES (%s, %s, %s, %s::jsonb) "
                "RETURNING id, tool, action, match",
                (user_id, tool, action, json.dumps(match)),
            )
        row = cur.fetchone()
    conn.commit()
    conn.close()
    return dict(row)


def delete_agent_policy(policy_id, user_id):
    ensure_agent_tables()
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM agent_policies WHERE id = %s AND user_id = %s RETURNING id",
            (policy_id, user_id),
        )
        deleted = cur.fetchone()
    conn.commit()
    conn.close()
    return deleted is not None


def _policy_matches(match, payload):
    match = match or {}
    if not match:
        return True
    location = (payload.get("location") or "").lower()
    role = (payload.get("role") or "").lower()
    company = (payload.get("company") or "").lower()
    if "location_contains" in match and match["location_contains"] not in location:
        return False
    if "role_contains" in match and match["role_contains"] not in role:
        return False
    if "company_eq" in match and match["company_eq"] != company:
        return False
    return True


def evaluate_agent_proposal(user_id, tool, payload):
    """block beats allow beats ask. Returns (action, policy_or_None)."""
    policies = list_agent_policies(user_id)
    for p in policies:
        if p["tool"] == tool and _policy_matches(p["match"], payload):
            if p["action"] == "block":
                return "block", p
    for p in policies:
        if p["tool"] == tool and _policy_matches(p["match"], payload):
            if p["action"] == "allow":
                return "allow", p
    return "ask", None