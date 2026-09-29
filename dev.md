# Development & Build Instructions

## Quickstart

Requires Python 3.8+, Node.js 16+, and a running PostgreSQL database.

**1. Clone the repo**

```bash
git clone https://github.com/KSaifStack/SearchTern.git
cd SearchTern
```

**2. Set up environment variables and database**

Make sure PostgreSQL is running locally, and create a database named `searchtern`:
```sql
CREATE DATABASE searchtern;
```

Create `backend/.env` (you can copy `backend/.env.template`):
```env
API_KEY=your_secure_random_string_here
DATABASE_URL=postgresql://postgres:password@localhost:5432/searchtern

# Optional — the AI Agent bridge. Lets agents READ the user's tracker
# (tracked_jobs table) and synced resume, and enforces the signed-in gate
# for key management. Without these, agent reads return an empty list+note
# and the signed-in gate is a documented no-op (local dev only).
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Create `frontend/.env.local` (you can copy `frontend/.env.local.template`):
```env
VITE_API_KEY=your_secure_random_string_here
VITE_API_URL=http://localhost:8000

# Optional — enables sign-in and the AI Agent Hub. Without these you browse
# as a guest and the agent features are hidden.
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
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
