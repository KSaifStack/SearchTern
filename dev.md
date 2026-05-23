# Development & Build Instructions

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
DATABASE_URL=postgresql://user:password@localhost:5432/searchtern
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
