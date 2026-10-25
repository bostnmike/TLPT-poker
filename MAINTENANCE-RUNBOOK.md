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

### Rebuild coordination

Main-branch site and data changes enter through **TLPT Data Pipeline**. Its
serialized build retains both existing full quality checks before publishing
generated data. Only after that job succeeds does its **TLPT Site Quality Gate**
job call `site-quality.yml`, passing the exact published commit SHA. The final gate
checks that immutable revision, not whichever commit happens to be on main later.
Build, validation, or push failures block the final gate; they are not ignored.

There is no separate site-quality push trigger to race the data rebuild. Its PR
and manual runs first rebuild their own checked-out revision, then run the same
full suite without publishing. Data-pipeline publication is restricted to main.
Generated-only commits are excluded from the pipeline's trigger paths to avoid
rebuild loops. The registration and cashier workflows remain independent.

### Optional rebuy bounty intake

Follow [the paired-export intake and accounting contract](docs/optional-rebuy-bounties.md)
for optional rebuy bounties. The detailed history and explicit regular prize schedule
are mandatory. Forfeitures are winner-only prize money, never collected bounties.
The shared quality runner exercises production regressions and locks all 55
preexisting event financial results. Practice fixtures must never enter live history.

The shared-site validation suite is owned only by:

`bash scripts/run-quality-gates.sh`

Do not duplicate its individual commands in other workflows.

It verifies the maintenance baseline, code hygiene, shared-shell recovery, app data-load recovery, generated data, source-to-page integrity, rendered page calculations, and the complete Marchand puck suite.

Registration and the cashier have independent quality workflows because they have separate hosting and dependency contracts:

- Registration → `.github/workflows/registration-checks.yml`
- Cashier → `.github/workflows/cashier-checks.yml`

The maintenance baseline verifies that both workflows watch every relevant source and test file, and that their required test, build, integration, and deployment-validation commands remain wired. Run the shared-site, registration, and cashier suites when a change crosses component boundaries.

Registration changes on `main` also trigger the dedicated `tlpt-registration`
publisher after validation. Its repository-scoped deploy key is stored as the
main repository's `REGISTRATION_PUBLISH_SSH_KEY` Actions secret. The registration
workflow is complete only when the exact source is verified at both
`tlpt.org/register.html` and `register.tlpt.org`, including shared form CSS/JS.
See `registration-domain/README.md` for recovery and key rotation. Cashier's
workflow remains validation-only; its Cloudflare deployment is separate.

Python packages used by the shared-site gates are pinned in `requirements-quality.txt`; both the site-quality workflow and automated data pipeline install that file before invoking the runner. Add a dependency there whenever a new gate imports a package that is not part of Python itself.

## Editing event RSVPs and manual previews

For an unscheduled next MTT, use title `Next MTT | 18-Max` and date `Date TBD`
(`TBD` is also accepted). Clear the old invite URL; preserve or reset RSVPs and
manual preview positions as desired. The placeholder does not require a dated
financial rule and never changes the completed MTT's results or financial rule.
Once a complete date is assigned, supply that new date's event-financial rule.
Incomplete dates such as `Saturday, 2026` fail with one explicit date error,
not a cascade of unrelated money errors. All existing financial configurations
remain validated even while the schedule is TBD.

Edit `data/events.json`; the data pipeline rebuilds the published copy. RSVP
answers are `yes`, `no`, `maybe`, or `tbd`, case-insensitive. A blank or null
answer is treated as TBD. Missing player entries are allowed. Use existing roster
slugs for player IDs; capitalization is accepted, but surrounding whitespace and
misspelled IDs/statuses are not supported and receive field-specific errors.

JSON key order is a maintenance preference, not a deployment requirement: the
display always sorts BostnMike first, then active/alumni alphabetically. Unsorted
keys produce only a warning. These checks do not rewrite the source file.

Manual `seatAssignments` may be omitted, null, empty, or partial. `""` holds an
empty preview position and never counts as a player or gets auto-filled. Only
confirmed players are displayed; no/maybe/TBD entries do not reserve a chair.
For duplicate assignments, the first eligible position wins; a warning identifies
the duplicate without blocking the update. Extra tables/positions beyond the
configured preview are ignored with warnings. Confirmations beyond available
preview positions stay counted and are listed below the tables. Unknown player
IDs, malformed arrays, invalid statuses, and duplicate RSVP keys differing only
by case are errors because they could hide a player or double-count attendance.

`scripts/audit-rsvp.mjs` validates this contract against the production renderer.
The page-calculation suite covers 640 status/layout combinations, single- and
two-table resets, over-capacity attendance, malformed input, and deliberate
renderer regressions. Warnings appear in both the page and integrity reports.

## Player membership: Active and Alumni

`data/player-metadata.json` owns the optional `rosterStatus` field (`active` or
`alumni`; omitted means active). Change this field to restore a regular player.
Membership filters only the Crew page display; never remove alumni from metadata,
generated players, event imports, RSVP identity resolution, or the cashier roster.
Career ratings, tier benchmarks, records, collections, and all historical results
continue to use the complete league. A guest appearance updates the same player
identity and does not automatically change their membership status.

The initial alumni are Brad R, Gilmore, Hayden D, Yann, Big Tim, Fabian, and Bob
(slug `rob-f`). After the October 24 MTT was finalized, Mike explicitly approved
moving Red to Alumni. His existing identity, history, cards and RSVP eligibility
remain intact. Never infer other membership changes from dates or RSVP answers.

Mixed player lists use `roster-display.js` and `roster-display.css`: active players
first, then a labeled Alumni subsection. Preserve the original sort order and
league-wide rank inside each membership group; do not recalculate metrics or
qualification pools. Crew All Players consolidates alumni after the active tiers.
Player selectors use Active/Alumni optgroups, also rendered in the custom menus.
Trophy pagination partitions before slicing so active cards stay together.
Event finish orders, historical stories, matchup pairs, and seating previews keep
their meaningful order; RSVP forecasts and player/opponent directories are grouped.
Do not apply public membership presentation rules to cashier eligibility or imports.

## Prize and bounty accounting

Event prize pools and `winners[].payout` contain tournament prize money only.
Tournament Director receipt lines may include bounty returns; event financial rules
separate them during parsing. Keep those receipt lines intact rather than subtracting
bounties from the source and then subtracting them again downstream.

`totalWinnings` is overall take-home: tournament prize money + `bountyCollected` +
`bountyRetained` + explicitly confirmed `settlementAdjustment` (normally zero).
Settlement adjustments never become bounty wins, tournament prizes, or cashes.
`totalCost` includes tournament entries and `bountyPaid`; `profit`
and ROI use those combined totals. `tournamentWinnings`, `tournamentCost`, and
`tournamentProfit` expose the prize-only breakdown. Retaining your own bounty offsets
its original purchase cost. Bounty-only receipts never count as tournament cashes.
The same accounting applies to career, recent-form, standings, and profile statistics.
Power Index keeps its formula and uses the corrected overall ROI/profit inputs.

October 17, 2026 started at 7:21 p.m. per Mike's correction; the raw summary and
start action both use 7:21:00 p.m. because seconds were not provided.

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
