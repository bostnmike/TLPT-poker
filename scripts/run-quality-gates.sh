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

echo "🔗 Testing rebuild and quality-gate coordination..."
"$PYTHON_BIN" scripts/test-quality-coordination.py

echo "💵 Testing event currency precision..."
"$PYTHON_BIN" scripts/test-event-currency.py

echo "🏷️ Testing optional rebuy bounties and historical financial parity..."
"$PYTHON_BIN" scripts/test-optional-bounties.py

echo "🧹 Auditing code hygiene..."
"$PYTHON_BIN" scripts/audit-code-hygiene.py

echo "🧭 Testing shared shell image fallbacks..."
node scripts/test-site-shell.mjs
node scripts/test-mtt-guide.mjs

echo "♠ Testing hidden player registration..."
node scripts/test-register-page.mjs

echo "🛟 Testing app data-load recovery..."
node scripts/test-app-load-failure.mjs

echo "📰 Testing Felt Whispers story layout..."
node scripts/test-news-layout.mjs

echo "🏒 Testing the Marchand Puck Vault..."
node scripts/test-marchand-page.mjs
node scripts/test-marchand-source-record.mjs
node scripts/test-marchand-database-schema.mjs
node scripts/test-marchand-authentication-links.mjs
node scripts/test-marchand-photo-manifest.mjs
node scripts/audit-marchand-media.mjs
node scripts/test-marchand-game-photos.mjs
node scripts/test-marchand-stories.mjs
node scripts/test-marchand-game-stats.mjs
node scripts/test-marchand-vault.mjs
node scripts/test-marchand-filters.mjs
node scripts/test-marchand-merge59.mjs
node scripts/test-marchand-numbering-gaps.mjs
node scripts/test-marchand-centennial342.mjs
node scripts/test-marchand-centennial343.mjs
"$PYTHON_BIN" scripts/test-marchand-sync.py

echo "🧪 Validating generated site data..."
"$PYTHON_BIN" scripts/validate-site-data.py

echo "🔎 Auditing source-to-page integrity..."
"$PYTHON_BIN" scripts/audit-site-integrity.py

echo "🧮 Auditing rendered page calculations..."
node scripts/audit-page-calculations.mjs

echo "🌿 Validating the standalone Lily microsite..."
"$PYTHON_BIN" lily-site/check_site.py

echo "✅ TLPT quality gates passed."
