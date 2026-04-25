#!/usr/bin/env bash
set -euo pipefail

CSV_PATH="${1:-}"

if [ -z "$CSV_PATH" ]; then
  echo "Usage: bash scripts/run-weekly-update.sh data/raw/<file>.csv"
  exit 1
fi

python scripts/build-site-data.py "$CSV_PATH"
python scripts/validate-site-data.py "$CSV_PATH"

echo ""
echo "Weekly update complete."
echo "Generated file: data/generated/site-data.json"
echo "Validation file: data/generated/validation-report.json"
