# TLPT Maintenance Runbook

This file owns the operating procedure for TLPT's gated artifact releases.

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
5. Build compact classified statistical event data.
6. Assemble app/style source sections, then generate shared navigation/footer
   markup and content-based asset versions.

Do not copy those commands into another workflow or script.

### Statistical event filters

Keep bounty labels shared across pages: All Events / With Bounties / Without Bounties.
Dashboard must not rename the shared options. Mobile introductions use
`mobile-density.css` on six primary pages; desktop copy is retained and Trophy
Room's full explanation remains in “How cards work” on phones. Mobile nemesis
matchups stay horizontal with visible names, without removing active players or
alumni. Run `scripts/test-mobile-density-browser.cjs` for responsive regressions.

For every newly imported result, add its event ID to `data/event-formats.json`:
`single` for a single-table / Sit & Go event (both 40K and 500K), or `mtt` for a
multi-table event. Classification is explicit, never inferred from entry counts
or the current schedule. Bounty status comes from audited financial rules and is
checked against the parsed event summary. This does not affect RSVP edits.

`stats-scope.js` shares two filters across Dashboard, Standings, player statistics,
Knockout Central, Form Lab, Streak Tracker and Heater Meter. Every page load starts
with All Formats + All Events; selections are page-local and are not restored
from browser storage. Reset to All restores combined results. Aggregate factual totals and rates from
selected event records. Include opted-out players in bounty-enabled events. Never
filter or reissue career ratings, tiers, archetypes, cards, awards or milestones.
Profile career snapshots remain explicitly career-wide; event-result tiles and
knockout relationships follow the filters. Form Lab applies its last-N window
after filtering. `scripts/test-stat-scopes.mjs` checks every filter combination,
financial/knockout parity and preservation of all career fields.

Streak Tracker replays only matching appearances; skipped or excluded events
neither break nor extend a filtered streak. Only tournament cashes count, not
bounty returns. Keep the minimum two matching appearances and two-event runs.
Heater Meter filters before its six-appearance window and retains its minimum
four matching appearances. Reset ranking-comparison state between scopes; filter
changes must not look like new career movement. Keep descriptive empty states
for samples below these thresholds, and preserve all career recognition.

After the build, run:

`bash scripts/run-quality-gates.sh`

The weekly runner and GitHub data pipeline already call both authoritative runners.

## Quality gates

### Rebuild coordination

Main-branch site, data and media changes enter through **TLPT Data Pipeline**:

1. Check out the exact source commit; build data and the gallery manifest once.
2. Run the complete static/data quality suite once.
3. Package only public files and test that exact package in the browser.
4. Commit any changed generated outputs with a normal fast-forward push.
5. Upload the tested package, deploy it through GitHub Pages Actions, and verify
   the public `release.json` source revision.

GitHub Pages must use **GitHub Actions**, not “Deploy from a branch.” A source
push is not a deployment. The deployment job requires the successful build job;
failed data, browser, push or artifact steps cannot publish. The previous good
site remains live. A new commit arriving during the build makes that build
obsolete; it is explicitly not published. A second head check protects the
deployment step. Do not force-push/rebase generated outputs or reset a checked
release onto a moving branch. If a newer unrelated commit supersedes a run
without triggering a replacement, manually run TLPT Data Pipeline on main.

There is no competing gallery writer or standalone site-quality push trigger.
The manual gallery workflow is a read-only diagnostic that fails if the
manifest is stale. PR/manual Site Quality runs build, validate, package and
browser-test without publishing. Generated-only commits do not cause loops.
`generatedAt` records the last content change, so no-op rebuilds do not create
timestamp-only commits. The single release concurrency group preserves order.

Browser tooling is pinned in `package.json` / `pnpm-lock.yaml`. Run
`pnpm install --frozen-lockfile --ignore-scripts`, then
`pnpm exec playwright install chromium`. After building and validating, use
`python scripts/package-site.py` and `CI=true node scripts/run-browser-gates.cjs`.
The required suite covers 1440/820/390/320-pixel layouts, dropdown anchoring and
occlusion, filters/reset, empty states, keyboard focus, mobile density, and
Norm's inline audio/help interactions (including short landscape screens).
The preview binds only to localhost and closes when the tests finish.

CI browser runs use `scripts/browser-ci.py` and the immutable official Playwright
image in `tests/visual/environment.json`. The image matches the locked package and
contains its browsers/fonts/OS libraries; no per-run Ubuntu installation is needed.
Only image downloads receive bounded retries. Failed assertions are never retried
automatically, screenshot references never self-update, and both environment and
site failures continue to block publication. Job summaries distinguish those two
failure categories. The existing package/Python caches remain lock-keyed.
Use the manual Site Quality input `visual_repeats=3` for a three-pass stability
rehearsal on the same source revision before merging release-process changes.

The package excludes raw event imports, scripts, dependency folders, private
app code, credentials and local/untracked files. It retains TLPT, Lily and
Marchand public routes and assets, because these static pages still share
one Pages deployment. Their designs and source ownership remain separate.

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

Registration, Cashier and RSVP have independent quality workflows because they have separate hosting and dependency contracts:

- Registration → `.github/workflows/registration-checks.yml`
- Cashier → `.github/workflows/cashier-checks.yml`
- RSVP → `.github/workflows/rsvp-checks.yml`

The maintenance baseline verifies that all three workflows watch their source and test files, and that their required test, build, integration, and deployment-validation commands remain wired. Run each affected product's suite when a change crosses component boundaries.

Registration changes on `main` also trigger the dedicated `tlpt-registration`
publisher after validation. Its repository-scoped deploy key is stored as the
main repository's `REGISTRATION_PUBLISH_SSH_KEY` Actions secret. The registration
workflow is complete only when the exact source is verified at both
`tlpt.org/register.html` and `register.tlpt.org`, including shared form CSS/JS.
See `registration-domain/README.md` for recovery and key rotation. Cashier's
workflow validates, builds, publishes and verifies its own tested Cloudflare
artifact using the existing scoped CI credentials. It does not run unrelated
TLPT/Lily/Marchand suites. See `cashier/DEPLOYMENT.md`; keep the existing
production Worker, databases, secrets, gateway and Google reader unchanged.

RSVP has its own `rsvp/package.json`, lockfile, Wrangler installation and date
parser. It must not depend on `cashier/node_modules` or Cashier source modules.
Its CI remains validation-only; its existing guarded manual release procedure
is in `rsvp/README.md`. No unattended RSVP credentials were added.

### Product ownership and change boundaries

| Product | Canonical source/data | Validation and publishing |
| --- | --- | --- |
| TLPT public site | Root public assets; raw reports plus explicit financial/format metadata | TLPT Data Pipeline → tested Pages artifact |
| Registration | Root register assets + registration-domain | Dedicated registration checks and dual-domain verification |
| Cashier | cashier; existing private production D1 | Cashier checks, local integration/recovery, scoped Cloudflare release |
| Live RSVP | rsvp; its separate private D1 | RSVP checks/local integration; guarded manual Worker release |
| Lily | lily-site and lily.html | Isolated Lily validator; static assets retained in Pages bundle |
| Marchand | marchand assets and data/marchand-* | Isolated Marchand tests; static assets retained in Pages bundle |

Shared hosting is not shared ownership: never redesign or migrate Lily/Marchand
as part of ordinary TLPT maintenance. Static package checks intentionally retain
both products so an artifact release cannot erase their routes. Do not merge
Cashier, RSVP or registration databases or seed live state from events.json.

### Recovery rehearsal and incident procedure

`python scripts/test-recovery.py` creates disposable local SQLite databases,
applies every committed Cashier/RSVP migration, inserts **synthetic** records,
exports SQL, restores into fresh databases and compares every table, row,
index and trigger. It also checks payment-link totals, cleared-event write
protection, revision updates and rejection of incomplete payment-link data.
Use `--product cashier` or `--product rsvp` for one product.

Rehearsed on 2026-10-26: Cashier **14 tables / 15 synthetic rows**, RSVP
**3 tables / 3 synthetic rows**, all checks passed. No production database,
credential, customer record or billing setting was read or changed.
This proves the recovery method against current schemas; it does **not** prove
that a current private production export exists or that Cloudflare Time Travel
has been restored. A real production restore remains a separately authorized
incident operation.

For an incident:

1. Stop the affected writer/importer; preserve the currently served release.
2. Record the source revision from `release.json` (or that app's version endpoint).
3. Code-only rollback: revert the faulty source commit and let normal checks
   deploy it. Never restore a database to roll back frontend code.
4. Data incident: obtain the affected app's complete private D1 export/Time
   Travel point. Keep it outside Git and outside any public artifact.
5. Restore to an isolated database first. Reconcile table counts, payment totals,
   receipt links, batches, audit history, cleared-event markers and RSVP state.
   The legacy seven-table Cashier backup is not a full current-schema backup.
6. Obtain explicit approval before any production replacement. Preserve secrets,
   sessions/credential policy and Google reader configuration. Verify read-only
   totals and access denials before resuming writes.

Retained Pages artifacts last seven days; Git retains source and generated
history. The artifact's `release.json` includes the source revision, file count
and a content digest. Source raw reports and financial overrides remain the
authority for rebuilding statistics; live Cashier/RSVP D1 remains the authority
for operational state.

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

## Public RSVP App guide

`rsvp-app.html` is the public, shareable setup guide linked from Home and Schedule,
and from the shared Schedule navigation dropdown. Schedule itself remains a direct
link to upcoming games; RSVP App is its child, with matching desktop, keyboard and
mobile navigation behavior. Isolated Lily and Marchand navigation stays separate.
The homepage promo pair keeps the RSVP app first (left on desktop, above on phones)
and the existing Norm poem second. Both reuse the same owned home-card styling.
The guide uses the standard TLPT header, hero, yellow chip, buttons and footer;
its scoped layout places the QR and portrait video side by side above 700px.

Approved media lives in `media/rsvp-app/`: the exact reviewed 83.75-second MP4,
poster and WebVTT captions converted from the final paced narration SRT. Originals
remain in `output/video/tlpt-rsvp-install/paced/` outside the site repository.
Do not substitute older cuts. Playback is user-initiated with `preload="none"`,
native controls and inline/fullscreen support; captions and an MP4 download are available.

`images/site/tlpt-rsvp-qr.png` was decoded to
`https://tlpt-rsvp.tlpt-bostnmike.workers.dev/`. The QR, direct buttons and written
instructions must use the public player root, never a Commish or event-specific link.
The guide is not itself the installable app. Installation remains optional, and live
lineups and saving replies require internet. Changes here do not deploy the RSVP Worker.
`scripts/test-rsvp-guide.mjs` locks approved media, QR, caption timing and link placement;
`scripts/test-rsvp-guide-browser.cjs` checks playback and responsive layout.

## Player membership: Active and Alumni

### Player display renames

Tony's current label is **ButtonMan**. Keep his permanent slug
`li-fo`, avatar `images/players/li-fo.jpg`, source report names, financial
keys and RSVP identities unchanged. Metadata retains Li-Fo / LiFo / Li Fo /
Tony and ButtonMan as aliases so old URLs, imports and payment records resolve
to the same player. Generated statistics publish those aliases for profile links.
`rankingName: "Li-Fo"` preserves historical tie-breaks: changing a display name
must never transfer an already-earned award.

Cashier's fallback directory mirrors these aliases; its legal Venmo payer name
is still Tony Kosturi. RSVP projects the new display name without rewriting
responses, private links or its database. Written site stories use the current
label. Original audio, verbatim transcripts, poster artwork and raw reports are
historical sources, not targets for text substitution. Browser regression tests
cover legacy profile links and the existing portrait at four screen sizes.

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

### Crew cards and optional map

The Crew page defaults to Cards with all established active players. Compact tier
counts cover the full selected membership/search roster, including developing
players hidden by progressive disclosure. Selecting a tier reveals its full list.
Desktop counts sit beside controls; on phones they are expandable.

`crew-map.js` and `crew-map.css` provide an optional replacement view, not another
block above the cards. Coordinates use the existing career and Last Five card OVR;
five recorded appearances are required. Bubble area represents appearances up to
60, avatar borders retain career tier colors, and collision leader lines preserve exact ratings.
Bubble portraits use each player's canonical avatar, with the shared chip fallback
if an image cannot load; accessible button labels retain player names and ratings.
Median reference lines use the full established league, including alumni, regardless
of display filters. Quadrant names are descriptive only: no rating, award, or
qualification rules change. Developing players remain available in Cards.

The calculation audit tests rating parity, roster coverage, target bounds and
collision spacing. `node scripts/test-crew-browser.cjs <base URL>` (with Playwright
available) verifies desktop, tablet and phone controls, shared dropdown behavior,
keyboard selection, search, and data immutability.

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

## Application and stylesheet source sections

`app.js` and `style.css` are generated delivery bundles. Edit the files in
`site-src/app/` and `site-src/styles/`; their explicit order is owned by
`site-src/manifest.json`. Read `site-src/README.md` for the responsibility map.
The initial split is byte-identical to release `2591dc23`; original hashes are
recorded in `site-src/migration-baseline.json` as historical migration evidence.

Run `python3 scripts/build-site-shell.py` to assemble both bundles and then
update HTML versions. `scripts/run-data-build.sh` already invokes that command.
Assembly adds no imports, wrappers, whitespace, minification or network requests.
Script globals/startup timing, CSS rule order and root-relative asset resolution
are preserved. Do not sort rules, deduplicate selectors or reorganize overriding
media queries as part of a maintenance-only edit.

The quality gate checks source inventory, syntax/complete CSS blocks, exact
concatenation, no-op determinism and stale outputs. Packaging independently
refuses stale bundles. The one gated publisher commits only tested `app.js`,
`style.css`, generated HTML and data. New source sections require an explicit
manifest entry; unlisted files fail instead of silently being ignored.

Registration's read-only renderer derives shared asset hashes from the source
sections, even before the generated bundles have been committed by the main
publisher. Source/manifest changes trigger both site and registration workflows.
Lily/Marchand files and Cashier/RSVP source are not included in these bundles.

## Shared navigation and automatic asset versions

The 22 main TLPT pages use `templates/site/navigation.json`, `header.html`, and
`footer.html`. Edit the menu once in the JSON; edit shared brand/footer markup
in its template. The page's file name determines its active link and parent.
`404.html` retains root-relative links so nested missing URLs work. Registration
remains unlisted. No browser fetch or framework is required for navigation.

Run `python3 scripts/build-site-shell.py` after changes (the canonical build
already does this). Root HTML remains directly previewable and its generated
regions are marked; do not manually edit inside those regions. Page-specific
content outside them remains authored in its existing HTML file.

The same build replaces local script/stylesheet `v` parameters with the first
16 hexadecimal characters of SHA-256 of the referenced file's bytes. No date
strings, manual increments, timestamps, or release-wide cache flushes. Unchanged
assets retain their versions; changed assets update every consuming TLPT page.
Other query parameters and fragments survive. Missing assets fail the build.

`python3 scripts/build-site-shell.py --check` detects stale generated regions or
versions without writing. Quality gates and packaging require it to pass. The
single main publisher commits the exact tested generated HTML alongside data;
there is no second cache-rotation writer. The old rotation script delegates to
this build; its manual `--version` option is retired. The old workflow is now
a read-only **Verify Automatic Asset Versions** diagnostic.

Lily, Marchand, Cashier, the RSVP app, vendor files and downloads are excluded
from this generator. Their own markup/version contracts are unchanged. The
registration satellite renders the same canonical page from templates and file
hashes, preserving its separate return URL and private/no-index form behavior.

Tests cover idempotence, stale/missing assets, menu propagation, page indicators,
absolute 404 links, no-JavaScript navigation, mobile menu/keyboard behavior, and
product isolation. For visual maintenance checks, `test-shared-shell-browser.cjs`
supports `BASE_URL capture SNAPSHOT_DIR` / `BASE_URL compare SNAPSHOT_DIR` across
all 22 pages at 1440, 820, 390 and 320 pixels. Keep CSS and rendering logic
unchanged during shell-only maintenance; review any screenshot differences.

## Permanent visual checks and bounded setup

The PR and main release workflows also run `pnpm test:visual` on the tested
public package. See `tests/visual/README.md` for coverage, fixed public fixtures
and the reviewed-reference procedure. Missing/changed screenshots block
publication; CI never updates baselines. Inspect the retained failure report
before approving any reference change. Functional browser checks remain intact.

Both build jobs pin Ubuntu 24.04 to avoid OS/font changes silently replacing the
visual environment. Python downloads and lock-keyed pnpm package downloads are
cached; installs remain frozen. Browser setup installs only the headless Chromium
shell used by CI, plus required OS libraries. Setup steps have explicit time
limits, as do functional and visual tests. A timeout fails the release; it never
publishes unchecked output. Do not cache rendered assets or test results.

Only disposable local OS/Python/package caches are ignored. The untracked
`design-assets/` artwork is intentionally left untouched and visible, not
deleted, moved, published or silently added to source control.

## Code hygiene audit

The authoritative implementation is:

`python scripts/audit-code-hygiene.py`

The root command remains supported:

`python audit-code-hygiene.py`

The root file is only a compatibility launcher. Do not add audit logic to it.

## What must remain single-source

- Generated-data build sequence → `scripts/run-data-build.sh`
- App/style source order → `site-src/manifest.json`
- Generated app/style assembly → `scripts/source_bundles.py`
- Shared-site validation suite → `scripts/run-quality-gates.sh`
- Registration validation suite → `.github/workflows/registration-checks.yml`
- Cashier validation suite → `.github/workflows/cashier-checks.yml`
- Hygiene audit logic → `scripts/audit-code-hygiene.py`
- Shared markup and asset versions → `scripts/site_components.py` / `templates/site/`
- Maintenance contract → `maintenance-baseline.json`

## Before deploying a maintenance change

1. Make the smallest targeted change.
2. Run `python3 scripts/build-site-shell.py` to regenerate markup and asset versions.
3. Run `bash scripts/run-quality-gates.sh`.
4. Confirm zero validation errors.
5. For generated-data work, confirm the rebuild changes only expected generated fields.
6. Deploy only the intended replacement files.

## Consolidated TLPT controls

The 12 filter/view pages use one `.tlpt-control-deck` surface and
`control-deck.css`. Keep event scope and page view controls together; retain
context-specific tools (for example, individual streak lookup) beside their results.
Do not load this stylesheet in Lily, Marchand, registration, Cashier, or the RSVP app.

- Format and Bounties always start at All / All. Reset event filters changes only
  those two fields; it does not reset the chosen ranking or player.
- Career ratings, awards, cards and eligibility calculations are unchanged.
- Details disclosures hold explanations and advanced Form Lab axes/options, not
  the main player/preset/window choices.
- Select menus retain the shared below-field overlay behavior. Never put menus
  inside clipped card containers.
- Trophy Room's reset restores edition, search, player, year and sort together.
- Dashboard's lighter variant uses `dashboard-controls.css` and
  `dashboard-controls.js`: view tabs first, then rank/format/bounties; below 700px,
  event scope collapses behind a summary that retains the current selection.
  Reset is visible only for an active event filter. These are presentation-only
  overrides; do not move calculations out of the shared statistical scope.
  Player DNA hides event controls without clearing their selections; returning to
  an event-results tab restores them. The Dashboard shows one live ranking sentence
  based on the actual ranked players and selected event count, not duplicate counters.
  The “How to use this view” modal is defined in `dashboard-help.js`. It uses the
  live metric names and calculation definitions from `app.js`; keep explanatory
  copy aligned with those rules. Modal tests cover all four views, Escape, focus
  containment/return, backdrop dismissal, and narrow screens.
  “Norm Narrates” uses the user-supplied MP3s in `media/norm-narrates/`, one per
  Dashboard view. Keep recordings unchanged, use `preload="none"`, never autoplay,
  and keep the player on the actual page, not inside the written guide. Switching
  views stops/resets the old recording; opening the read-me pauses playback without
  losing position, and closing it never auto-resumes. Written help remains available
  when audio fails. Run `scripts/test-norm-narration-browser.cjs` to check playback,
  view-to-file mapping, pause/resume behavior, and mobile layout.
  Future scripts may include occasional player-specific barbs grounded in league
  write-ups or user direction; spread them around and do not force the joke.
  The supplied Player DNA recording includes the user's Cougar/loud-raises jab.
  Shared inline players and read-me links live in `stats-help.js/css`. Portraits
  are 96px on desktop/tablet and 80px on phones, with the read-me link immediately
  beside the audio player on the same row. Do not add a separate help footer.
  The supplied, unchanged headshot is `images/site/norm-headshot.png`; crop only
  through CSS. Dashboard retains its view-specific metric definitions.
  `stats-help-content.js` adds eight written guides across Standings, Form Lab,
  Heater Meter, Streak Tracker, Knockouts/Bounty Hunters, Crew and player profiles.
  An `audio: null` guide must show written help and an honest coming-soon label,
  never a broken player or a request for a nonexistent recording.
  Reviewed batch-two scripts and the exact MP3 filename mapping are in
  `docs/norm-narrates-batch-2/`. On receiving recordings, add the matching assets,
  set each guide's audio path and rebuild the automatic asset versions.
  Run `scripts/test-stats-guides-browser.cjs` for all guide dialogs, portraits,
  focus/close behavior, narrow layouts and view-change audio teardown. All eight batch-two
  recordings are enabled.
  The supplied file named norm-form-lab.mp3 was identified by its spoken content
  as Bounty Hunters and copied unchanged under norm-bounty-hunters.mp3.
  The replacement norm-form-lab2.mp3 is copied unchanged as norm-form-lab.mp3.
  The browser checks validate each file mapping and duration, no eager audio
  loading, dismissal during playback, reopening, and both Knockout Central views.
- Run `scripts/test-control-deck-browser.cjs` with the Playwright runtime against
  the local preview, and again against production after deployment. It covers all
  12 pages at 1440, 820, 390 and 320 pixels, checks loaded data, search/reset,
  category changes, dropdown bounds/occlusion, and page overflow.

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

## Live private-link RSVP service

The new RSVP service and its website/cashier integration are documented in
[rsvp/README.md](rsvp/README.md). D1 is the one live RSVP authority after cutover;
`data/events.json` remains the seed/reference and audited Cashier payment-schedule
input. Changing its RSVP answers is not a live update. The Commish manages event
metadata, capacity, open state, player links and queue overrides in the private
browser app. New payable dates still require the existing financial workflow.

Home/schedule and manual seating previews consume only runtime confirmed seats;
explicit waitlists are separate. Runtime failure shows unavailable/stale labels,
never a silent return to obsolete static confirmations. Cashier's independent
attendance cache cannot invoke ledger selection/cleanup. Keep its private database,
password, session key, receipt reader and payment history completely separate.
Alumni retain their canonical slugs and RSVP access. Nothing in the RSVP app
records payment, actual attendance, results, or official Tournament Director seats.

Use the documented loopback owner-link recovery, credential-free backup download,
separate database, free-plan guard and validation/release procedure. Do not send
player links automatically or put any private link in Git, chat, logs or screenshots.
