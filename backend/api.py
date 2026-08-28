from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException, Request, Header, Response
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
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import scraper
import read_db
import os

# Checks for api key
load_dotenv()
API_KEY = os.environ.get("API_KEY")
if not API_KEY:
    raise RuntimeError("API_KEY not set in environment")

def verify_key(x_api_key: str = Header(...)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")

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
