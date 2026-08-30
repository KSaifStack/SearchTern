from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException, Request, Header, Response, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from dotenv import load_dotenv
import threading
import sys
import logging
import hashlib
import json
import re
import base64
import requests
from pathlib import Path
from urllib.parse import quote_plus, quote

sys.path.insert(0, str(Path(__file__).parent))
import scraper
import read_db
import os

# Checks for api key
load_dotenv()
API_KEY = os.environ.get("API_KEY")
if not API_KEY:
    raise RuntimeError("API_KEY not set in environment")

# Optional — lets agents READ the user's tracker via Supabase (tracked_jobs table).
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

RESUME_BUCKET = "resumes"
_SAFE_PATH_RE = re.compile(r"^[A-Za-z0-9 ._\-'()&+,]+$")

def _supabase_configured():
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)

def _storage_headers():
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }

def enforce_signin(request: Request, user_id: str):
    """Signed-in gate for agent management.

    When Supabase is configured we require the caller to present a valid
    Supabase session token whose sub matches the claimed user_id. Without
    Supabase (local dev only) this is a no-op so the app keeps working.
    This stops someone with the public SDK key from minting agent keys for
    arbitrary user_ids in production."""
    if not _supabase_configured():
        return
    token = (request.headers.get("X-Supabase-Token") or "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Sign in required to manage agents.")
    url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/user"
    try:
        resp = requests.get(
            url,
            headers={"apikey": SUPABASE_SERVICE_ROLE_KEY, "Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except requests.RequestException:
        raise HTTPException(status_code=401, detail="Could not verify your session.")
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail=f"Session invalid (HTTP {resp.status_code}).")
    sub = (resp.json() or {}).get("id")
    if not sub or str(sub) != str(user_id):
        raise HTTPException(status_code=403, detail="Session does not match this user.")

def agent_resume_list(user_id):
    """List files in resumes/{user_id}/. Returns (rows, note)."""
    url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/list/{RESUME_BUCKET}"
    try:
        resp = requests.post(
            url,
            json={"prefix": user_id, "limit": 100, "offset": 0, "sortBy": {"column": "name", "order": "asc"}},
            headers=_storage_headers(),
            timeout=15,
        )
    except requests.RequestException as e:
        return [], f"Resume list failed: {e}"
    if resp.status_code != 200:
        return [], f"Resume list failed: HTTP {resp.status_code}"
    return [r for r in resp.json() if r.get("name")], ""

def agent_resume_fetch(user_id, name):
    """Download resumes/{user_id}/{name}. Returns (bytes, content_type) or (None, note)."""
    path = quote(f"{user_id}/{name}", safe="/")
    url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/{RESUME_BUCKET}/{path}"
    try:
        resp = requests.get(url, headers=_storage_headers(), timeout=30)
    except requests.RequestException as e:
        return None, f"Resume fetch failed: {e}"
    if resp.status_code != 200:
        return None, f"Resume fetch failed: HTTP {resp.status_code}"
    return resp.content, resp.headers.get("content-type", "application/octet-stream")

def verify_key(x_api_key: str = Header(...)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")

def get_agent_identity(authorization: str = Header(None)):
    """Resolve a user's personal agent key (Bearer token) to their user_id."""
    row = read_db.get_active_agent_key(authorization)
    if not row:
        raise HTTPException(status_code=401, detail="Invalid or revoked agent key.")
    read_db.touch_agent_key(row["id"])
    read_db.touch_agent_health(row["user_id"])
    return row["user_id"]

logger = logging.getLogger(__name__)

def scheduled_scrape():
    try:
        result = scraper.update_database()
        logger.info(f"Scheduler: {result}")
    except Exception as e:
        logger.error(f"Scheduler: scrape failed — {e}")

scheduler = BackgroundScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(scheduled_scrape, CronTrigger(minute=0))
    scheduler.start()
    threading.Thread(target=scheduled_scrape, daemon=True).start()
    yield
    scheduler.shutdown()

# This connects the backend to the frontend using FastAPI
# http://localhost:8000/ by default
# to run/test the server run uvicorn backend.api:app --reload
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

#Allows backend to work with vite 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

#Checks health 
@app.get("/health")
@app.head("/health")
def health():
    next_run = scheduler.get_jobs()[0].next_run_time if scheduler.get_jobs() else None
    return {
        "status": "Active",
        "next_scrape": str(next_run) if next_run else "unknown"
    }

#Lists the data sources the scraper pulls from
@app.get("/sources")
@limiter.limit("60/minute")
def sources(request: Request):
    return {
        "count": len(scraper.ALL_SOURCES),
        "sources": [
            {
                "name": s["name"],
                "url": s["url"],
                "type": s["type"],
                "season": s["season"],
            }
            for s in scraper.ALL_SOURCES
        ],
    }

#Update DataBase
@app.post("/update")
@limiter.limit("5/minute")
def update_base(request: Request, verified=Depends(verify_key)):
    read_db.invalidate_cache()
    scraper.update_database()
    return {"result": read_db.recent_internships()}

#Search recent internships
@app.get("/recent")
@limiter.limit("30/minute")
def pull_recent(request: Request, response: Response):
    data = read_db.recent_internships()
    body = json.dumps({"result": data}, default=str).encode()
    etag = '"' + hashlib.md5(body).hexdigest() + '"'
    headers = {
        "ETag": etag,
        "Cache-Control": "public, max-age=300, must-revalidate",
    }
    if request.headers.get("If-None-Match") == etag:
        return Response(status_code=304, headers=headers)
    return Response(content=body, media_type="application/json", headers=headers)

#Search location
@app.get("/location")
@limiter.limit("10/minute")
def location_base(request: Request, searchterm: str):
    return {"result": read_db.search_location(searchterm)}

#Search internships
@app.get("/keywords")
@limiter.limit("10/minute")
def keyword_base(request: Request, searchterm: str):
    return {"result": read_db.find_keywords(searchterm)}


# ── Agent bridge (Hermes / Claude Code / opencode) ────────────────────────────
# Agents authenticate with the user's PERSONAL key, generated in SearchTern
# Settings:  Authorization: Bearer <user-agent-key>
# The key maps to a user_id server-side, so an agent can never act as another
# user. The agent can READ (search, tracker) and PROPOSE mutations. Every
# mutation becomes a `pending` proposal the user approves in the SearchTern
# overlay before anything touches the tracker.

def resolve_actor(request: Request, user_id_query: str = ""):
    """user_id for /agent/* reads: prefer the agent's key identity, fall back
    to the app key (X-API-Key) with an explicit user_id (the review overlay)."""
    auth_row = read_db.get_active_agent_key(request.headers.get("Authorization"))
    if auth_row:
        read_db.touch_agent_key(auth_row["id"])
        read_db.touch_agent_health(auth_row["user_id"])
        return auth_row["user_id"]
    if request.headers.get("X-API-Key") == API_KEY and user_id_query.strip():
        return user_id_query.strip()
    raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/agent/search")
@limiter.limit("60/minute")
def agent_search(
    request: Request,
    q: str = "",
    location: str = "",
    limit: int = 25,
    user_id: str = Depends(get_agent_identity),
):
    limit = max(1, min(limit, 100))
    if q.strip():
        jobs = read_db.find_keywords(q.strip())
    elif location.strip():
        jobs = read_db.search_location(location.strip())
    else:
        jobs = read_db.recent_internships()
    read_db.touch_agent_health(user_id, action="search", search_at=read_db.now(), search_count=len(jobs))
    return {
        "query": {"q": q, "location": location},
        "count": min(len(jobs), limit),
        "total": len(jobs),
        "result": jobs[:limit],
    }


@app.get("/agent/health")
@limiter.limit("60/minute")
def agent_health_get(request: Request, user_id: str = ""):
    """Liveness for a user's agent(s): connected / disconnected / never."""
    actor = resolve_actor(request, user_id)
    health = read_db.get_agent_health(actor)
    settings = read_db.get_agent_settings(actor)
    status = "never"
    seconds_since = None
    if health and health.get("last_seen_at"):
        seconds_since = int((read_db.now() - health["last_seen_at"]).total_seconds())
        status = "connected" if seconds_since <= read_db.AGENT_CONNECTED_SECONDS else "disconnected"
    return {
        "user_id": actor,
        "status": status,
        "enabled": settings["enabled"],
        "seconds_since_last_seen": seconds_since,
        "last_seen_at": health["last_seen_at"] if health else None,
        "last_action": health["last_action"] if health else None,
        "last_search_at": health["last_search_at"] if health else None,
        "last_search_count": health["last_search_count"] if health else None,
    }


@app.get("/agent/tracker")
@limiter.limit("30/minute")
def agent_tracker(
    request: Request,
    user_id: str = Depends(get_agent_identity),
):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return {
            "jobs": [],
            "note": "Tracker reads require SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in backend/.env.",
        }
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/tracked_jobs?user_id=eq.{quote_plus(user_id)}&select=*&order=date_added.desc"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code != 200:
            return {"jobs": [], "note": f"Tracker read failed: HTTP {resp.status_code}"}
        return {"jobs": resp.json(), "note": ""}
    except requests.RequestException as e:
        return {"jobs": [], "note": f"Tracker read failed: {e}"}


@app.get("/agent/resume")
@limiter.limit("30/minute")
def agent_resume_get(request: Request, name: str = "", user_id: str = Depends(get_agent_identity)):
    """Agents can read the user's current resume (mirrors what the UI uploads).

    Without ?name it lists the user's synced resumes. With ?name=file.pdf it
    returns the file's bytes (base64) plus decoded text when it is textual.
    Only reads resumes stored in the `resumes` bucket under {user_id}/."""
    if not _supabase_configured():
        return {
            "resumes": [],
            "resume": None,
            "note": "Resume access requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in backend/.env, and a resume synced to your account.",
        }
    name = name.strip()
    if name:
        if not _SAFE_PATH_RE.fullmatch(name) or name in (".", ".."):
            raise HTTPException(status_code=400, detail="Invalid resume name.")
        data, ct = agent_resume_fetch(user_id, name)
        if data is None:
            return {"resumes": [], "resume": None, "note": ct}
        text = None
        if ("text" in ct or ct in ("application/json",)) and len(data) < 2_000_000:
            text = data.decode("utf-8", errors="replace")
        return {
            "resumes": [],
            "resume": {
                "name": name,
                "content_type": ct,
                "size": len(data),
                "content_base64": base64.b64encode(data).decode(),
                "content_text": text,
            },
            "note": "",
        }
    rows, note = agent_resume_list(user_id)
    return {"resumes": rows, "resume": None, "note": note}


@app.post("/agent/propose")
@limiter.limit("30/minute")
def agent_propose(
    request: Request,
    payload: dict = Body(...),
    user_id: str = Depends(get_agent_identity),
):
    if not read_db.get_agent_settings(user_id)["enabled"]:
        raise HTTPException(status_code=403, detail="Agent actions are disabled for this account. Enable them in SearchTern → Settings → AI Agents.")
    tool = str(payload.get("tool") or "").strip()
    body = payload.get("payload")
    if tool not in read_db.AGENT_TOOLS:
        raise HTTPException(status_code=400, detail=f"tool must be one of {read_db.AGENT_TOOLS}.")
    if not isinstance(body, dict) or not body.get("company") or not body.get("role"):
        raise HTTPException(status_code=400, detail="payload must include company and role.")
    if tool == "update_status" and body.get("status") not in ("Saved", "Applied", "Interview", "Offer", "Rejected"):
        raise HTTPException(status_code=400, detail="payload.status must be one of Saved/Applied/Interview/Offer/Rejected.")

    policy_action, policy = read_db.evaluate_agent_proposal(user_id, tool, body)
    if policy_action == "block":
        raise HTTPException(status_code=403, detail="This agent action is blocked by your policy.")
    status = "approved" if policy_action == "allow" else "pending"
    proposal_id = read_db.create_agent_proposal(user_id, tool, body, note=payload.get("note"), status=status)
    return {
        "proposal_id": proposal_id,
        "status": status,
        "tool": tool,
        "user_id": user_id,
        "policy": policy_action,
        "policy_id": policy["id"] if policy else None,
    }


@app.get("/agent/proposals")
@limiter.limit("60/minute")
def agent_proposals_list(
    request: Request,
    status: str = "",
    user_id: str = "",
):
    actor = resolve_actor(request, user_id)
    status = status.strip() or None
    return {
        "result": read_db.list_agent_proposals(actor, status=status),
    }


@app.post("/agent/proposals/{proposal_id}/decision")
@limiter.limit("30/minute")
def agent_proposal_decision(
    request: Request,
    proposal_id: int,
    payload: dict = Body(...),
    verified=Depends(verify_key),
):
    user_id = str(payload.get("user_id") or "").strip()
    enforce_signin(request, user_id)
    decision = str(payload.get("decision") or "").strip()
    if decision not in ("approved", "rejected", "cancelled"):
        raise HTTPException(status_code=400, detail="decision must be approved, rejected, or cancelled.")
    proposal = read_db.get_agent_proposal(proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    if str(payload.get("user_id") or "") != proposal["user_id"]:
        raise HTTPException(status_code=403, detail="Proposal does not belong to this user.")
    if proposal["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"Proposal already {proposal['status']}.")
    read_db.decide_agent_proposal(proposal_id, decision)
    return {"proposal_id": proposal_id, "status": decision, "user_id": proposal["user_id"]}


# ── Per-user agent keys & settings (managed from SearchTern) ─────────────────〃

@app.get("/agent/keys")
@limiter.limit("30/minute")
def agent_keys_list(request: Request, user_id: str, verified=Depends(verify_key)):
    enforce_signin(request, user_id)
    return {"result": read_db.list_agent_keys(user_id)}


@app.post("/agent/keys")
@limiter.limit("10/minute")
def agent_keys_create(request: Request, payload: dict = Body(...), verified=Depends(verify_key)):
    user_id = str(payload.get("user_id") or "").strip()
    name = str(payload.get("name") or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required.")
    enforce_signin(request, user_id)
    record = read_db.generate_agent_key(user_id, name=name or "agent")
    return {
        "result": {
            "id": record["id"],
            "name": record["name"],
            "key": record["key"],
            "key_prefix": record["key_prefix"],
        }
    }


@app.post("/agent/keys/{key_id}/revoke")
@limiter.limit("30/minute")
def agent_keys_revoke(request: Request, key_id: int, payload: dict = Body(...), verified=Depends(verify_key)):
    user_id = str(payload.get("user_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required.")
    enforce_signin(request, user_id)
    if not read_db.revoke_agent_key(user_id, key_id):
        raise HTTPException(status_code=404, detail="Key not found or already revoked.")
    return {"key_id": key_id, "active": False}


@app.get("/agent/settings")
@limiter.limit("30/minute")
def agent_settings_get(request: Request, user_id: str, verified=Depends(verify_key)):
    enforce_signin(request, user_id)
    return {"user_id": user_id, **read_db.get_agent_settings(user_id)}


@app.post("/agent/settings")
@limiter.limit("30/minute")
def agent_settings_set(request: Request, payload: dict = Body(...), verified=Depends(verify_key)):
    user_id = str(payload.get("user_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required.")
    enforce_signin(request, user_id)
    saved = read_db.set_agent_settings(
        user_id,
        enabled=payload.get("enabled") if "enabled" in payload else None,
        show_tracker_tab=payload.get("show_tracker_tab") if "show_tracker_tab" in payload else None,
    )
    return {"user_id": user_id, **saved}


# ── Agent policies (managed from SearchTern) ──────────────────────────────────

@app.get("/agent/policies")
@limiter.limit("30/minute")
def agent_policies_list(request: Request, user_id: str, verified=Depends(verify_key)):
    enforce_signin(request, user_id)
    return {"result": read_db.list_agent_policies(user_id)}


@app.post("/agent/policies")
@limiter.limit("30/minute")
def agent_policies_upsert(request: Request, payload: dict = Body(...), verified=Depends(verify_key)):
    user_id = str(payload.get("user_id") or "").strip()
    tool = str(payload.get("tool") or "").strip()
    action = str(payload.get("action") or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required.")
    enforce_signin(request, user_id)
    if tool not in read_db.AGENT_TOOLS:
        raise HTTPException(status_code=400, detail=f"tool must be one of {read_db.AGENT_TOOLS}.")
    if action not in read_db.AGENT_POLICY_ACTIONS:
        raise HTTPException(status_code=400, detail="action must be one of allow/ask/block.")
    match = payload.get("match")
    if match is not None and not isinstance(match, dict):
        raise HTTPException(status_code=400, detail="match must be an object.")
    policy = read_db.upsert_agent_policy(user_id, tool, action, match or {})
    return {"result": policy}


@app.delete("/agent/policies/{policy_id}")
@limiter.limit("30/minute")
def agent_policies_delete(request: Request, policy_id: int, payload: dict = Body(...), verified=Depends(verify_key)):
    user_id = str(payload.get("user_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required.")
    enforce_signin(request, user_id)
    if not read_db.delete_agent_policy(policy_id, user_id):
        raise HTTPException(status_code=404, detail="Policy not found.")
    return {"policy_id": policy_id, "deleted": True}
