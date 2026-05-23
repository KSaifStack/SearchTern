# SearchTern

**Find and track internships without the chaos.**

![Python](https://img.shields.io/badge/Python-3.8+-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-TypeScript-61DAFB?style=flat&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-2d7a4f?style=flat)


---
# Live Link

 [https://searchtern.vercel.app/](https://searchtern.vercel.app/)
 
---

# Screenshot of the website

![App Screenshot](search_tern.png)

 

## What it does

Most CS students end up sending 500+ applications across a dozen job boards with no real system for tracking any of it. SearchTern pulls the latest internships automatically every hour and gives you a single place to browse, search, and manage your pipeline.

---

## How it works

1. **Scraper** — APScheduler pulls from the [Simplify ](https://github.com/SimplifyJobs/Summer2026-Internships) repo hourly and stores results in a PostgreSQL database
2. **Backend** — FastAPI serves the data with rate limiting and input validation
3. **Frontend** — React/TypeScript dashboard with live search, sorting, and a drag-and-drop Kanban tracker

---

## Features

<table>
  <tr>
    <td><strong>Job Board</strong></td>
    <td>Hundreds of internships, refreshed hourly</td>
  </tr>
  <tr>
    <td><strong>Search & Filter</strong></td>
    <td>Filter by company, role, or location</td>
  </tr>
  <tr>
    <td><strong>Application Tracker</strong></td>
    <td>Drag-and-drop Kanban across Saved → Applied → Interview → Offer → Rejected</td>
  </tr>
  <tr>
    <td><strong>Analytics</strong></td>
    <td>Reply rate, offer count, rejection breakdown</td>
  </tr>
  <tr>
    <td><strong>Saved Jobs</strong></td>
    <td>Bookmark from the board, sync to your tracker</td>
  </tr>
  <tr>
    <td><strong>CSV Export</strong></td>
    <td>Export your full pipeline, Excel-compatible</td>
  </tr>
</table>

> **Coming soon:** AI resume grader, resource hub, user accounts and more 

---

## Tech Stack

<table>
  <tr>
    <td><strong>Scraper</strong></td>
    <td>Python, BeautifulSoup4, APScheduler</td>
  </tr>
  <tr>
    <td><strong>Database</strong></td>
    <td>PostgreSQL</td>
  </tr>
  <tr>
    <td><strong>Backend</strong></td>
    <td>FastAPI, Uvicorn, SlowAPI</td>
  </tr>
  <tr>
    <td><strong>Frontend</strong></td>
    <td>React, TypeScript, Vite, Mantine UI, @dnd-kit</td>
  </tr>
</table>

---

## Quickstart

Requires Python 3.8+, Node.js 16+, and a running PostgreSQL database.

**1. Clone the repo**

```bash
git clone <https://github.com/KSaifStack/SearchTernBase.git>
cd SearchTernBase
```

**2. Set up environment variables**

Create `backend/.env`:
```env
API_KEY=your_secure_random_string_here
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/searchtern
```

Create `frontend/.env.local`:
```env
VITE_API_KEY=your_secure_random_string_here
```

**3. Start the app**

```bash
# Mac/Linux
./start.sh

# Windows
.\start.bat
```

**4. Open it**

| | |
|---|---|
| Frontend | http://localhost:5173 |
| API docs | http://localhost:8000/docs |