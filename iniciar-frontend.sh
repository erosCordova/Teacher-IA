#!/usr/bin/env bash
cd "$(dirname "$0")/frontend"
npm run dev -- --host 127.0.0.1 --port 5173
