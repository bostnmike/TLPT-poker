#!/usr/bin/env bash
set -euo pipefail

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "ERROR: Python is required to run TLPT quality gates." >&2
  exit 127
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is required to run TLPT quality gates." >&2
  exit 127
fi

echo "🧭 Verifying maintenance baseline..."
"$PYTHON_BIN" scripts/verify-maintenance-baseline.py

echo "🧹 Auditing code hygiene..."
"$PYTHON_BIN" scripts/audit-code-hygiene.py

echo "🧭 Testing shared shell image fallbacks..."
node scripts/test-site-shell.mjs

echo "🛟 Testing app data-load recovery..."
node scripts/test-app-load-failure.mjs

echo "🧪 Validating generated site data..."
"$PYTHON_BIN" scripts/validate-site-data.py

echo "🔎 Auditing source-to-page integrity..."
"$PYTHON_BIN" scripts/audit-site-integrity.py

echo "🧮 Auditing rendered page calculations..."
node scripts/audit-page-calculations.mjs

echo "✅ TLPT quality gates passed."
