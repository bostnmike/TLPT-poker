# TLPT Maintenance Runbook

This file is the operational closeout for the Phase 3 maintenance hardening work.

## Marchand puck photo intake

Follow [the puck photo workflow](images/pucks/README.md#required-front-photo--deep-dive-policy) for every new artifact upload. Register its Front photo in `data/marchand-photos.json`; the site uses it for both the photo gallery and Artifact Hall Deep Dive button. Preserve the standard Deep Dive button for missing, loading, or failed images. Never put photo mappings into generated statistics files.

## Normal weekly data update

Use the established weekly/update workflow. The authoritative generated-data build sequence lives only in:

`bash scripts/run-data-build.sh`

That runner performs, in order:

1. Parse all Tournament Director event reports.
2. Generate the parsed-event index.
3. Build generated site data.
4. Build knockout data.

Do not copy those four commands into another workflow or script.

After the build, run:

`bash scripts/run-quality-gates.sh`

The weekly runner and GitHub data pipeline already call both authoritative runners.

## Quality gates

The shared-site validation suite is owned only by:

`bash scripts/run-quality-gates.sh`

Do not duplicate its individual commands in other workflows.

It verifies the maintenance baseline, code hygiene, shared-shell recovery, app data-load recovery, generated data, source-to-page integrity, rendered page calculations, and the complete Marchand puck suite.

Registration and the cashier have independent quality workflows because they have separate hosting and dependency contracts:

- Registration → `.github/workflows/registration-checks.yml`
- Cashier → `.github/workflows/cashier-checks.yml`

The maintenance baseline verifies that both workflows watch every relevant source and test file, and that their required test, build, integration, and deployment-validation commands remain wired. Run the shared-site, registration, and cashier suites when a change crosses component boundaries.

Python packages used by the shared-site gates are pinned in `requirements-quality.txt`; both the site-quality workflow and automated data pipeline install that file before invoking the runner. Add a dependency there whenever a new gate imports a package that is not part of Python itself.

## Shared CSS changes

For changes to `site-tail.css`, rotate the cache key with the **Rotate Shared CSS Cache** GitHub Action rather than manually editing all public HTML pages.

The underlying helper is:

`python scripts/rotate-shared-css-cache.py --version <NEW_VERSION>`

It refuses partial page coverage and verifies all public pages use one cache key.

## Code hygiene audit

The authoritative implementation is:

`python scripts/audit-code-hygiene.py`

The root command remains supported:

`python audit-code-hygiene.py`

The root file is only a compatibility launcher. Do not add audit logic to it.

## What must remain single-source

- Generated-data build sequence → `scripts/run-data-build.sh`
- Shared-site validation suite → `scripts/run-quality-gates.sh`
- Registration validation suite → `.github/workflows/registration-checks.yml`
- Cashier validation suite → `.github/workflows/cashier-checks.yml`
- Hygiene audit logic → `scripts/audit-code-hygiene.py`
- Shared CSS cache rotation → `scripts/rotate-shared-css-cache.py`
- Maintenance contract → `maintenance-baseline.json`

## Before deploying a maintenance change

1. Make the smallest targeted change.
2. If shared CSS changed, rotate its cache key.
3. Run `bash scripts/run-quality-gates.sh`.
4. Confirm zero validation errors.
5. For generated-data work, confirm the rebuild changes only expected generated fields.
6. Deploy only the intended replacement files.

## Locked behavior

Routine maintenance must not casually alter:

- Event/RSVP data structures or invite behavior.
- Analytics formulas or generated stat semantics.
- Player image/metadata mapping.
- URL behavior or interaction contracts.
- Responsive behavior unless the change explicitly targets responsiveness.
- Page-specific custom behavior merely for cleanup convenience.

## Baseline drift

`maintenance-baseline.json` is machine checked by `scripts/verify-maintenance-baseline.py`.

If a maintenance path, authoritative runner, page count, shared cache key, or required quality gate drifts from that contract, validation must fail before deployment.

This is intentional: change the baseline only when the maintenance architecture itself is deliberately changed.
