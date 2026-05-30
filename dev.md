# Development & Build Instructions

## Quickstart

Requires Python 3.8+, Node.js 16+, and a running PostgreSQL database.

**1. Clone the repo**

```bash
git clone <https://github.com/KSaifStack/SearchTernBase.git>
cd SearchTernBase
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
```

Create `frontend/.env.local` (you can copy `frontend/.env.local.template`):
```env
VITE_API_KEY=your_secure_random_string_here
# Note: If VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not specified,
# the frontend will automatically fall back to querying your local FastAPI backend.
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
