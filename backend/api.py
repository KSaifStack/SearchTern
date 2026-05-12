from fastapi import FastAPI
import backend.scraper
import backend.read_db
import os
# This connects the backend to the frontend using FastAPI
# http://localhost:8000/ by default
# to run/test the server run uvicorn backend.api:app --reload
app = FastAPI()

#Test
@app.get("/test")
def read_root():
    return {"message": "Testing frontend to backend"}

#Update DataBase
@app.get("/update")
def update_base():
    return {"result": backend.scraper.update_database()}

#Search recent internships
@app.get("/recent")
def pull_recent():
    return {"result": backend.read_db.recent_internships()}

#Search location
@app.get("/location")
def location_base(searchterm:str):
    return {"result": backend.read_db.search_location(searchterm)}

#Search internships
@app.get("/keywords")
def keyword_base(searchterm:str):
    return{"result":backend.read_db.find_keywords(searchterm)}

