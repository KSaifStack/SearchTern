#!/bin/bash

# Make this script a process group leader
set -m

cleanup() {
    echo "Cleaning up..."
    # Kill the entire process group (including children)
    kill -- -$$ 2>/dev/null
}
trap cleanup EXIT INT TERM

# Start services
pkill -f uvicorn
uvicorn backend.api:app --reload &
cd frontend && npm run dev &
wait