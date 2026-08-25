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

echo "🧹 Auditing code hygiene..."
python3 scripts/audit-code-hygiene.py

echo "🧭 Testing shared shell image fallbacks..."
node scripts/test-site-shell.mjs

echo "🛟 Testing app data-load recovery..."
node scripts/test-app-load-failure.mjs

echo "🔎 Auditing source-to-page integrity..."
python3 scripts/audit-site-integrity.py

echo "🧮 Auditing rendered page calculations..."
node scripts/audit-page-calculations.mjs

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
echo " - data/generated/integrity-report.json"
