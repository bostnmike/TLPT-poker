#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "🔄 TLPT Weekly Update (HTML Pipeline)"
echo "------------------------------------"

echo "🏗️ Running authoritative TLPT data build..."
bash scripts/run-data-build.sh

echo "✅ Running complete TLPT quality gates..."
bash scripts/run-quality-gates.sh

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
