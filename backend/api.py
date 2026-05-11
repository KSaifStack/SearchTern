from fastapi import FastAPI
import Scrapers.data
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
    return {"result": Scrapers.data.update_database()}

#Search DataBase
#