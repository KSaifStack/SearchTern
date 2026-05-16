#!/bin/bash

# Make this script a process group leader
set -m

cleanup() {
    echo "Cleaning up..."
    # Kill the entire process group (including children)
    kill -- -$$ 2>/dev/null
}
trap cleanup EXIT INT TERM

# Kill any existing uvicorn process
pkill -f uvicorn 2>/dev/null

echo "Starting SearchTern..."

# Install backend deps and start
(cd "$(dirname "$0")/backend" && pip install -r requirements.txt && python -m uvicorn api:app --reload) &

# Install frontend deps and start
(cd "$(dirname "$0")/frontend" && npm install && npm run dev) &

echo "Backend running at http://localhost:8000"
echo "Frontend running at http://localhost:5173"

wait