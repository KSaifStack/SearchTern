#!/bin/bash
source /home/kankroid/.zshrc
uvicorn backend.api:app --reload &
cd frontend && npm run dev