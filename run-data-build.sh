#!/usr/bin/env bash
set -euo pipefail

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "ERROR: Python is required to build TLPT data." >&2
  exit 127
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is required to build TLPT data." >&2
  exit 127
fi

echo "📥 Parsing event summaries..."
"$PYTHON_BIN" scripts/parse-event-reports.py

echo "🔥 Generating parsed event index..."
node scripts/generate-event-index.js

echo "📊 Building site data..."
"$PYTHON_BIN" scripts/build-site-data.py

echo "💀 Building knockout data..."
"$PYTHON_BIN" scripts/build-knockouts.py

echo "✅ TLPT data build complete."
