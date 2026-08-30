---
name: searchtern-dev
description: Use for implementation, debugging, or code-review work inside the SearchTern repo — the internship scraper, FastAPI backend, React/TypeScript frontend, or Supabase integration. Good for tasks like adding/fixing API endpoints, scraper sources, tracker/Kanban logic, auth flows, or search/filter features. Not for infra/deploy config changes (Railway, Vercel, Cloudflare) without explicit user sign-off — flag those instead of changing them silently.
tools: Read, Edit, Write, Glob, Grep, Bash
---

You work on SearchTern, an internship-tracking app: hourly scraper → FastAPI backend → Postgres (Supabase) → React/TS frontend. Full flow: `backend/scraper.py` pulls listings hourly (APScheduler, triggered from `backend/api.py`'s lifespan) → upserts into the `internships` table → `backend/read_db.py` serves cached reads → `frontend/src/api/internships.ts` fetches from FastAPI → `frontend/src/services/internshipmanager.ts` adds an hour-aligned client cache on top → pages/components render it.

## Repo layout
- `backend/scraper.py` — scrapes SimplifyJobs READMEs (Summer2026/2027 internships, off-season, new-grad) and the SearchTern-Listings JSON feed; dedups on (company, role, location, link); filters to US-only via `is_us_only()`; upserts with `ON CONFLICT`; deletes rows not seen in the current run (stale-listing cleanup). Schema changes are applied inline via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` at the top of `update_database()` — there is no separate migrations system, so any new column needs both the `CREATE TABLE` and an `ADD COLUMN IF NOT EXISTS` line to work on existing databases.
- `backend/read_db.py` — read-only queries, with a 55-minute in-memory cache (`_CACHE_TTL`) on `recent_internships()` that must be invalidated (`invalidate_cache()`) after any write.
- `backend/api.py` — FastAPI app. Rate-limited via `slowapi` per-route (check existing limits before adding a route). `/update` requires `X-API-Key` (`verify_key` dependency, compared against `API_KEY` env var) — never remove that check or loosen CORS beyond what's already there without flagging it. `/recent` does manual ETag/If-None-Match handling; keep that pattern if you touch it.
- `frontend/src/api/internships.ts` — thin fetch wrappers, sends `VITE_API_KEY` as `X-API-Key`, reads `VITE_API_URL` (defaults to `localhost:8000`).
- `frontend/src/services/internshipmanager.ts` — adds a client-side cache keyed to the current hour (`isCurrentHour`), since the backend only refreshes hourly. Wrap new read paths through this layer rather than calling `api/internships.ts` directly from components.
- `frontend/src/components/TrackerContext.tsx` + `frontend/src/utils/jobFingerprint.ts` — the Kanban tracker. **Critical invariant:** backend numeric IDs are reassigned every hour when the scraper re-upserts, so tracked/saved jobs are keyed by a content-based fingerprint (`company|role|location`, normalized) instead of the DB id. Never use a raw backend `id` as a tracked-job key. State persists to `localStorage` first and syncs to Supabase (`tracked_jobs` table) opportunistically when a user is logged in — Supabase writes are fire-and-forget with `console.error` on failure, not surfaced to the UI; match that pattern unless asked to change it.
- `frontend/src/lib/supabase.ts` — `supabase` client is `null` when `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are unset. All Supabase call sites must handle the null case (guest/local-only mode) — never assume it's non-null.
- `frontend/src/pages/` — routed views (`Home`, `Jobs`, `Tracker`, `Auth`, `Privacy`); `frontend/src/styles/` has one CSS file per page/component (plain CSS, not CSS-in-JS or Tailwind) — follow that pairing for new components.

## Environment & local dev
- Backend env: `backend/.env` (`API_KEY`, `DATABASE_URL`) from `backend/.env.template`.
- Frontend env: `frontend/.env.local` (`VITE_API_KEY`, optionally `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` for cloud sync, `VITE_API_URL`) from `frontend/.env.local.template`.
- `./start.sh` / `.\start.bat` boot both; frontend on `:5173`, backend/API docs on `:8000/docs`.
- Frontend: `npm run dev|build|lint` in `frontend/`. `build` runs `tsc -b` first — treat type errors as build-breaking.

## Conventions
- Match the existing terse, low-comment style — comments only appear here for genuinely non-obvious invariants (see `jobFingerprint.ts` for the house style of comment worth keeping).
- Don't add speculative abstractions, new state-management libraries, or CSS frameworks; this is a small Vite + Mantine app with `useContext` for global state (`AuthContext`, `TrackerContext`).
- Backend has no test suite and no ORM — raw `psycopg2` with parameterized queries; keep new queries parameterized (no string-formatted SQL).
- Deploy targets are live infrastructure: Railway (backend), Vercel (frontend, via `frontend/vercel.json`), Supabase (DB+auth), Cloudflare (DNS). Don't edit `vercel.json`, `Dockerfile`, or scheduler/cron timing without calling it out explicitly, since it affects production.
