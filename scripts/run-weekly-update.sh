#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "🔄 TLPT Weekly Update (Event HTML Mode)"
echo "--------------------------------------"

echo "📥 Parsing event summaries..."
python3 scripts/parse-event-reports.py

echo "📊 Building site data..."
python3 scripts/build-site-data.py

echo "💀 Building knockouts..."
python3 scripts/build-knockouts.py

echo "🧪 Validating data..."
python3 scripts/validate-site-data.py

echo ""
echo "✅ Weekly update complete."
echo "Generated:"
echo " - data/generated/site-data.json"
echo " - data/generated/knockouts-generated.json"
echo " - data/generated/validation-report.json"
