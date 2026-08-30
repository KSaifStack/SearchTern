# SearchTern

**Find and track internships without the chaos.** → [searchtern.ksaif.dev](https://searchtern.ksaif.dev)

![Python](https://img.shields.io/badge/Python-3.8+-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-TypeScript-61DAFB?style=flat&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-2d7a4f?style=flat)

---

<img width="1917" height="991" alt="image" src="https://github.com/user-attachments/assets/f5299847-5ad8-458d-8c85-9e1a52c79356" />

## What it does

Most CS students end up sending 500+ applications across a dozen job boards with no real system for tracking any of it. SearchTern pulls the latest internships automatically every hour and gives you a single place to browse, search, and manage your pipeline.

---

## How it works

1. **Scraper** — APScheduler pulls from the [Simplify](https://github.com/SimplifyJobs/Summer2026-Internships) repo and additional sources hourly, using bulk upserts to keep the database fresh without downtime
2. **Backend** — FastAPI serves the data with rate limiting and input validation, hosted on Railway
3. **Frontend** — React/TypeScript dashboard with live search, sorting, and a drag-and-drop Kanban tracker
4. **AI Agents** — Claude Code, opencode, or Hermes authenticate with a per-user key generated under Settings → AI Agents. Agents can search internships, read your synced resume and tracker, and propose tracker changes you approve in the overlay
5. **Infrastructure** — Backend hosted on Railway, frontend on Vercel, database on Supabase PostgreSQL, with Supabase Auth + Storage for user accounts and resume cloud sync

---

## Features

<table>
<tr>
<td><strong>Job Board</strong></td>
<td>Thousands of internships, refreshed hourly</td>
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
<tr>
<td><strong>User Accounts</strong></td>
<td>Sign in with Supabase; agent keys and cloud-synced resumes are tied to your account</td>
</tr>
<tr>
<td><strong>AI Agents</strong></td>
<td>Per-user keys for CLI agents — search, read your tracker + resume, propose tracker edits you approve</td>
</tr>
<tr>
<td><strong>Resume Cloud Sync</strong></td>
<td>Keep your resume in your account so your agents can reference it</td>
</tr>
</table>

> **Coming soon:** AI resume grader, resource hub

---

## Tech Stack

<table>
<tr>
<td><strong>Scraper</strong></td>
<td>Python, BeautifulSoup4, APScheduler, psycopg2</td>
</tr>
<tr>
<td><strong>Database</strong></td>
<td>PostgreSQL (Supabase)</td>
</tr>
<tr>
<td><strong>Backend</strong></td>
<td>FastAPI, Uvicorn, SlowAPI</td>
</tr>
<tr>
<td><strong>Frontend</strong></td>
<td>React, TypeScript, Vite, Mantine UI, @dnd-kit</td>
</tr>
<tr>
<td><strong>Auth & Storage</strong></td>
<td>Supabase Auth (accounts), Supabase Storage (resume sync), RLS-protected tracker</td>
</tr>
<tr>
<td><strong>Agent Bridge</strong></td>
<td>FastAPI `/agent/*` endpoints, per-user agent keys, proposal review</td>
</tr>
<tr>
<td><strong>Infrastructure</strong></td>
<td>Railway (backend), Vercel (frontend), Supabase (database), Cloudflare (DNS)</td>
</tr>
</table>

---

> **Developers:** For setup, build, and local development instructions, please see [dev.md](dev.md).