from fastapi import Depends, FastAPI, HTTPException, Request,Header
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import scraper
import read_db
import os

#Checks for api key
load_dotenv()
API_KEY = os.environ.get("API_KEY")
if not API_KEY:
    raise RuntimeError("API_KEY not set in environment")

def verify_key(x_api_key: str = Header(...)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")

# This connects the backend to the frontend using FastAPI
# http://localhost:8000/ by default
# to run/test the server run uvicorn backend.api:app --reload
limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

#Allows backend to work with vite 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

#Test
@app.get("/test")
def read_root():
    return {"message": "Testing frontend to backend"}

#Checks health 
@app.get("/health")
def health():
    return {"status": "ok"}

#Update DataBase
@app.post("/update")
@limiter.limit("5/minute")
def update_base(request: Request,verified=Depends(verify_key)):
    return {"result": scraper.update_database()}

#Search recent internships
@app.get("/recent")
@limiter.limit("10/minute")
def pull_recent(request: Request):
    return {"result": read_db.recent_internships()}

#Search location
@app.get("/location")
@limiter.limit("10/minute")
def location_base(request: Request,searchterm:str):
    return {"result": read_db.search_location(searchterm)}

#Search internships
@app.get("/keywords")
@limiter.limit("10/minute")
def keyword_base(request: Request,searchterm:str):
    return{"result":read_db.find_keywords(searchterm)}

