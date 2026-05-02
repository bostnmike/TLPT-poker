#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "🔄 TLPT Weekly Update (HTML Pipeline)"
echo "------------------------------------"

echo "📥 Parsing event summaries..."
python3 scripts/parse-event-reports.py

echo "🔥 Generating parsed event index..."
node scripts/generate-event-index.js

echo "📊 Building site data..."
python3 scripts/build-site-data.py

echo "💀 Building knockouts..."
python3 scripts/build-knockouts.py

echo "🧪 Validating data..."
python3 scripts/validate-site-data.py

echo ""
echo "✅ Weekly update complete."
echo "Generated files:"
echo " - data/parsed/events/index.json"
echo " - data/generated/site-data.json"
echo " - data/generated/knockouts-generated.json"
echo " - data/generated/knockouts.json"
echo " - knockouts.json"
echo " - knockout-events-full.json"
echo " - knockout-name-map-full.json"
echo " - data/generated/validation-report.json"
