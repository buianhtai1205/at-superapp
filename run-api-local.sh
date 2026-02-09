#!/bin/bash
# Local testing script - runs FastAPI directly with uvicorn

echo "🚀 Starting FastAPI server for local testing..."
echo "API will be available at: http://localhost:8000/stock-options?symbol=RKLB"
echo ""

cd "$(dirname "$0")"
source venv/bin/activate
cd api
uvicorn stock-options:app --reload --host 0.0.0.0 --port 8000
