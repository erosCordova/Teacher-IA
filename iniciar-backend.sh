#!/usr/bin/env bash
cd "$(dirname "$0")/backend"
if [ -f .venv/Scripts/python.exe ]; then
  .venv/Scripts/python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
elif [ -f .venv/bin/python ]; then
  .venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
else
  echo "Falta configurar Python."
fi
