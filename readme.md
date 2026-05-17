# SearchTern

> **The all-in-one platform for college students to find, track, and land internships.**

![Python](https://img.shields.io/badge/Python-3.8+-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-TypeScript-61DAFB?style=flat&logo=react&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat&logo=sqlite&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-2d7a4f?style=flat)

---

## The Problem

In today's tech market, finding an internship has never been harder. Students frequently send out **500–1000+ applications** just to land a single offer. The process is exhausting, unorganized, and overwhelming — requiring students to check multiple GitHub repos and job boards daily just to keep up.

**SearchTern breaks this cycle.** It's an automated aggregation platform and personal dashboard that does the heavy lifting for you — automatically finding the latest internships, letting you filter and sort them, and giving you the tools to manage your entire application pipeline in one place.

---

## How It Works

1. **Automated Scraping** — The Python backend uses APScheduler to automatically pull the latest internships from the [SimplifyJobs Summer 2026 Internships](https://github.com/SimplifyJobs/Summer2026-Internships) repository every hour. No manual triggers needed.

2. **Local Database** — Scraped jobs are cleaned, formatted, and stored in a local SQLite database, enabling instant search and filtering without hitting third-party APIs on every request.

3. **Live Dashboard** — The React/TypeScript frontend provides a clean, responsive UI to browse, search (by keyword, location, or company), sort, and track the most recent listings — updating automatically after each scrape.

---

## Features

### Currently Implemented

| Feature | Description |
|---|---|
| **Live Job Board** | Hundreds of internships automatically scraped and refreshed every hour |
| **Smart Search & Filter** | Instantly filter jobs by company, role, or location |
| **Pagination & Sorting** | Sort by newest or oldest listings for easy browsing |
| **Application Tracker** | A highly modular, drag-and-drop Kanban board (`Saved` → `Applied` → `Interview` → `Offer` → `Rejected`) |
| **Performance Dashboard** | Real-time analytics visualizer (Total, Applied, Reply Rate, Offers, Rejections) using segmented HSL progress rings |
| **Input Validation & Safety** | Block-level validation ensuring company names and roles are fully populated before saving, with clear error feedback |
| **Saved Jobs** | Bookmark listings from the job board and sync them directly to your tracker |
| **High-Fidelity CSV Export** | Safe export of your full application pipeline (including UTF-8 BOM encoding for seamless Excel parsing and character-safety) |

### Coming Soon

| Feature | Description |
|---|---|
| **AI Resume Grader** | Instant STAR-method feedback on your resume, scored 1–10 |
| **Resource Hub** | Curated CS practice sites, interview prep, and market trend insights |

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Scraper** | Python, BeautifulSoup4, Requests, APScheduler |
| **Database** | SQLite → PostgreSQL *(planned for production)* |
| **Backend** | FastAPI, Uvicorn, SlowAPI (Rate Limiting) |
| **Frontend** | React, TypeScript, Vite, Mantine UI, @dnd-kit |
| **Planned** | JWT Auth, AI Integration |

---

## Quickstart

**Prerequisites:** Python 3.8+, Node.js 16+

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd SearchTernBase
```

### 2. Set up environment variables

**Backend** (`backend/.env`):
```env
API_KEY=your_secure_random_string_here
```

**Frontend** (`frontend/.env.local`):
```env
VITE_API_KEY=your_secure_random_string_here
```

### 3. Start the application

SearchTern includes automated startup scripts that install all dependencies and launch both servers simultaneously.

**Windows:**
```bat
.\start.bat
```

**Mac / Linux:**
```bash
chmod +x start.sh
./start.sh
```

### 4. Access the app

| Service | URL |
|---|---|
| Frontend (UI) | http://localhost:5173 |
| Backend (API Docs) | http://localhost:8000/docs |
