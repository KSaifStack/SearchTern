@echo off
title SearchTern

echo Starting SearchTern...
echo.

:: Kill any existing uvicorn process
taskkill /f /im uvicorn.exe >nul 2>&1

:: Start backend (installs deps first if needed)
start "SearchTern Backend" cmd /k "cd /d %~dp0backend && pip install -r requirements.txt && python -m uvicorn api:app --reload"

:: Start frontend (installs deps first if needed)
start "SearchTern Frontend" cmd /k "cd /d %~dp0frontend && npm install && npm run dev"

echo Backend running at http://localhost:8000
echo Frontend running at http://localhost:5173
echo.
echo Press any key to exit.
pause
