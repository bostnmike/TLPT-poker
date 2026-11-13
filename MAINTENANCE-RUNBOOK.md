# TLPT Maintenance Runbook

This file owns the operating procedure for TLPT's gated artifact releases.

## Marchand puck photo intake

Follow [the puck photo workflow](images/pucks/README.md#required-front-photo--deep-dive-policy) for every new artifact upload. Register its Front photo in `data/marchand-photos.json`; the site uses it for both the photo gallery and Artifact Hall Deep Dive button. Preserve the standard Deep Dive button for missing, loading, or failed images. Never put photo mappings into generated statistics files.

The Pages package omits the tracked image bodies under `images/pucks/` and
`images/marchand-games/` after checking every file against
`scripts/marchand-external-media.json`. The source checkout retains those
files for the existing Museum audits. Public requests for those two paths
redirect to `media.tlpt.org` with the same path and query. The existing
Marchand image-library host continues to serve its registered files.

For a new or replaced image in these directories, upload the exact bytes to
the dedicated media bucket at its existing relative path before publishing.
Verify the direct media URL and the legacy URL against the local byte count,
SHA-256 and image content type. Register the verified bytes in the external
media inventory in the same change as the source file. For replacements,
refresh the cached URL and verify the new bytes before publishing.

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

Financial Dashboard metrics include every actual participant with a finite numeric
result, including $0, 0% ROI and first appearances. Never infer zero from missing
data or hide a participant because their financial result is zero. Check rendered
membership against selected event participants, independently of the production
eligibility helper. Bounty profit/loss additionally requires an appearance in a
bounty-enabled event within the selected scope, even when the result is $0.
Use event participation, not bounty purchases: opted-out players still qualify.
Without Bounties has no eligible bounty results, rather than artificial $0 cards.
Nonfinancial ranking thresholds and career Standings qualification remain separate.

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

1. Shallow-check out the exact source commit (`fetch-depth: 1`); build data and the gallery manifest once.
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
release onto a moving branch. If a newer commit supersedes a run, the narrow
replacement job dispatches current main through the complete original gates.
It cannot rerun a failed assertion or deploy an obsolete artifact. Only that
job has Actions-write permission; the publisher retains its existing permissions.

The publisher does not need historical branches or tags. Before committing tested
outputs, `git ls-remote` reads only main's current commit ID, without downloading
history again. A mismatch skips publication. Normal fast-forward push protection
still rejects a concurrent update, and the deployment job independently checks
the tested head. Checkout size changes do not alter any data, browser or visual gate.

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
The shared-footer visual case requires three captures in independent Chromium
processes at each viewport, all against the same reviewed reference. Preserve
the isolated, breakable `.site-footer-gap` separator; its independent shaping
prevents the preceding text from changing the link's subpixel position. Every capture must pass, without
retrying assertions or relaxing the comparison limits.

General browser checks use the reviewed public RSVP fixture from
`scripts/browser-rsvp-fixture.cjs`, shared with the visual gate. This keeps remote
RSVP latency out of unrelated layout, profile and audio checks. Dedicated Sunday
and seat-preview cases override that route to test changing feeds, live refresh,
closed games and service outages. Production endpoint/privacy checks stay in the
RSVP release verifier. The existing assertions and bounded browser timeouts remain
required.

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
app code, credentials, local/untracked files, and the separately hosted
Marchand image bodies described above. TLPT, Lily and Marchand public pages
and site data share one Pages deployment. Their designs and source ownership
remain separate.

### Optional rebuy bounty intake

Follow [the paired-export intake and accounting contract](docs/optional-rebuy-bounties.md)
for optional rebuy bounties. The detailed history and explicit regular prize schedule
are mandatory. Forfeitures are winner-only prize money, never collected bounties.
The shared quality runner exercises production regressions and locks all 55
preexisting event financial results. Practice fixtures must never enter live history.

If an export omitted actual bounty charges, follow the fingerprinted
host-confirmation contract in that same document. November 7, 2026 is the
production example: retain original evidence, confirm every final receipt,
and record corrections in that event's configuration. Never infer missing
charges from the Tournament Director fee profile or copy exceptions to other events.

The shared-site validation suite is owned only by:

`bash scripts/run-quality-gates.sh`

Do not duplicate its individual commands in other workflows.

It verifies the maintenance baseline, code hygiene, shared-shell recovery, app data-load recovery, generated data, source-to-page integrity, rendered page calculations, and the complete Marchand puck suite.

Registration, Cashier and RSVP have independent quality workflows because they have separate hosting and dependency contracts:

- Registration → `.github/workflows/registration-checks.yml`
- Cashier → `.github/workflows/cashier-checks.yml`
- RSVP → `.github/workflows/rsvp-checks.yml`

The maintenance baseline verifies source/test path coverage and required commands.
The cheap **TLPT quality gate wiring** workflow reports on every PR, including
app-only/workflow-only changes. Public screenshot checks watch site-owned
workflows; changing an app workflow alone no longer launches the full site suite.
Cashier and Registration push checks run on main, avoiding duplicate feature
push + PR runs. RSVP and shared contract jobs have explicit ten-minute limits.

**Shared app contracts** (`app-compatibility.yml`) is a read-only reusable job
called by RSVP and Cashier checks. The root static runner tests the same actual
producer against both public consumers without invoking the private app runtime. It tests the actual RSVP model output
against the production site and Cashier consumers, then runs actual named
RSVP→Cashier RPC with two disposable local D1 databases. Cashier publication
requires both its independent suite and this joint job. Cashier also watches
RSVP backend, schema, tooling and harness inputs; its release guard includes
those inputs. Cosmetic RSVP UI changes keep their own suite. New cross-product
imports must update this path matrix and the maintenance baseline together.

Root, Cashier and RSVP CI block high/critical dependency advisories, including
development/build dependencies. Fix reviewed pinned versions and exercise actual
Worker/D1/RPC plus deployment dry runs; do not add blanket dev-dependency ignores.
The isolated money tests use deterministic public-feed fixtures. The separately
labelled Cashier live-source smoke is read-only and permits a valid empty future
schedule; an unavailable/malformed feed still fails explicitly.

The public-artifact browser runner also requires stat scope, Crew map/roster and
Film Room guide regressions. Tests follow the approved consolidated controls and
hidden-at-default Reset behavior. They use the same local RSVP fixture and pinned
CI Chromium; screenshot references and comparison limits remain unchanged.

Registration changes on `main` also trigger the dedicated `tlpt-registration`
publisher after validation. Its repository-scoped deploy key is stored as the
main repository's `REGISTRATION_PUBLISH_SSH_KEY` Actions secret. The registration
workflow is complete only when the expected content is verified at both
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
Empty seats on Home and Schedule share the approved Empty Chair commercial art:
`images/site/tlpt-poker-chair-256.webp` (transparent, lossless, 256px). Both ordinary
open spots and manual blank positions use it inside the existing seat geometry.
Keep the seat's accessible label; the nested image is decorative. Never replace
occupied avatars or change RSVP data when updating this artwork. Responsive checks
cover single/two-table previews, image loading and unchanged seat positions.
The page-calculation suite covers 640 status/layout combinations, single- and
two-table resets, over-capacity attendance, malformed input, and deliberate
renderer regressions. Warnings appear in both the page and integrity reports.

## Optional Sunday games on the public website

The live RSVP feed is the only game visibility authority. Home and Schedule
require boolean `rsvpOpen === true`; absent, closed,
cancelled or unavailable games stay hidden. Never seed a Sunday in events.json
or add a second website activation switch. A closed Sunday may remain in the
schemaVersion:1 feed without invalidating Friday, Saturday or MTT games.

Sunday uses `slot:sunday`, `day:Sunday`, `tables:1`, `startingStack:50000`,
`blindStructure:40k`, `format:50K Format`, and capacity 1–9. It has a red card,
day label, carousel button and RSVP CTA, with one capacity-limited seat preview.
The schedule sorts open dates chronologically (undated MTT last); Home selects
the next open date per slot in that same order. Existing player identities,
manual preview matching, waitlists and historical results are unchanged.

Sunday's red Structures button is always visible, independent of live games
or feed availability. Its reference sheet uses Friday's exact blinds, antes, breaks and
20-minute levels, with effective BB recalculated from 50,000. This is NOT the
two-table 50K MTT. The owner selected the existing MTT 50K starting chip set:
16 green, 16 black, 16 purple, 15 yellow, 5 white (50,000 total).
Chip images/counts are shared by reference; MTT blinds, payouts and bounty
policies are not imported into Sunday, and financial projections are not inferred.
Closing a game does not remove its reference structure. The MTT PDF restores
the user's selected structure when closed. Home and Schedule refresh from the
existing live feed every minute while visible; Structures needs no polling.
Optional Sunday never generates routine “NO GAME THIS SUNDAY” notices.

`scripts/test-sunday-games-browser.cjs` is in the required artifact browser gate:
mocked absent/closed/open/closed, capacity, red theme, one table, ISO day labels,
chronology, structure selection/PDF restoration, outages and recovery at
1440/820/390/320 pixels. The page-calculation audit checks every Sunday ladder
row against Friday and preserves all existing financial/statistical checks.
No production game is created or opened to test this feature.

## Public RSVP App guide

`rsvp-app.html` is the public, shareable setup guide linked from Home and Schedule,
and from the shared Schedule navigation dropdown. Schedule itself remains a direct
link to upcoming games; RSVP App is its child, with matching desktop, keyboard and
mobile navigation behavior. Isolated Lily and Marchand navigation stays separate.
The retired homepage teaser row remains removed. Film Room and Rebuy Hard
retain their own pages and navigation links. Film links clear the sticky
navigation and never start playback automatically.
The guide uses the standard TLPT header, hero, yellow chip, buttons and footer;
its scoped layout places the QR and portrait video side by side above 700px.

The guide uses the approved `KUArnlk48KQ` YouTube upload, also shown in the Film
Room. The local portrait poster remains; the embedded player is created only
after activation and supports inline/fullscreen playback. A direct YouTube
link and written setup instructions remain available. The install MP4 and seven
older Film Room MP4s are no longer published or tracked in the current tree.
The reviewed install master remains in `output/video/tlpt-rsvp-install/paced/`
outside the site repository; the retired files remain recoverable from Git history.

`images/site/tlpt-rsvp-qr.png` was decoded to
`https://tlpt-rsvp.tlpt-bostnmike.workers.dev/`. The QR, direct buttons and written
instructions must use the public player root, never a Commish or event-specific link.
The guide is not itself the installable app. Installation remains optional, and live
lineups and saving replies require internet. Changes here do not deploy the RSVP Worker.
`scripts/test-rsvp-guide.mjs` locks the approved embed, retained media, QR, caption timing and link placement;
`scripts/test-rsvp-guide-browser.cjs` checks click-to-load, keyboard access and responsive layout.

The owner removed “The Many Faces of Norm” from the homepage on 2026-10-31.
The games section follows the hero directly, without an empty banner wrapper
or the retired three-teaser row. Film Room remains available through navigation;
its videos and all Norm Narrates portraits/audio are unchanged. Retain the approved
banner artwork, especially the original shared narration-portrait source.
The asset-preservation and six-width homepage checks live in the RSVP-guide tests.

Schedule's “Put the Yellow Chip on Your Phone” campaign uses news-anchor Norm
from the two-handed Nightly News artwork: `images/site/norm-news-anchor-source.jpg`.
The original 1280 x 720 thumbnail is preserved byte-for-byte; Schedule CSS frames
only the 360px square at (740, 0), keeping his face and burgundy tie inside the
existing 96/80/64px gold circle. Campaign copy, setup link, spacing and all other
Norm portraits stay unchanged. The six-width RSVP-guide test verifies this crop.

The Film Room has forty-one RSVP YouTube embeds, plus its nine original embedded/link
films. Its cards show only the emoji/title and thumbnail/player, with no subtitle,
description or duration line. The four additions supplied on 2026-10-29 are
The Game’s Afoot, Bad Beat Hotline, Weather Forecast and No Empty Chairs.
Their matching production thumbnails and optional captions remain in
`media/rsvp-film-room/`; keep the originals outside the public package. The approved hockey Norm
commercial “Day to Day” uses YouTube `rzKNK2yiu-I` (owner-corrected upload; do not
restore superseded `ltIT_DGiEEs`) and the exact approved landscape
`day-to-day-thumbnail.jpg`, handed off from the `clean-patch-tooth-preview`
production folder on 2026-10-29. Keep its card title-only, click-to-play, and
captions optional. The 28-second source video remains in its production folder;
do not add a duplicate native player or publish the production notes.
“Friday’s Comeback Falls Short” is the TLPT Sports Desk segment using
`_QEYzoGj0j0` and `media.html#sports-desk-friday-no-go`. Its approved landscape
and portrait covers come from
`output/video/tlpt-sports-desk-friday-no-go/updated-vo-v3/`, which also
holds the 65-second production master.

“Going Once…” uses YouTube `liEHKJxCHV0` and anchor
`media.html#going-once`. The approved 16.8-second Cougar-and-gavel master stays
in `output/video/tlpt-going-once/cougar-gavel-v4/`. The Film Room and Norm Wing
use the approved landscape and portrait files from its `release-art/` folder.

“Now Serving DeCaf” uses YouTube `WFy0mP9u0Bw` and anchor
`media.html#now-serving-decaf`. Add it alongside the original coffee commercial.
Its exact approved landscape cover, portrait PNG and optional SRT/VTT captions
come from `output/video/tlpt-coffee-preorders/decaf-regular-v2/`.
The matching portrait appears in the Norm Gallery. Keep the 48.4-second master
outside the repository and public package. Use the existing click-to-play embed
and direct YouTube fallback link.

“Coffee Pre-orders — How d’ya like them lattes?” uses YouTube `JKbeghbGcAM`
and anchor `media.html#coffee-preorders`. Its exact landscape cover, portrait
PNG and optional SRT/VTT captions come from
`output/video/tlpt-coffee-preorders/production-v1/` outside the repository.
The portrait also remains in the Norm Gallery. The 47-second 9:16 master
stays in production. Use the existing click-to-play embed and the direct
YouTube fallback link. This is a separate film from “Two Seats Remain”.

“Two Seats Remain” uses YouTube `XS62fWZR_FM` and anchor
`media.html#two-seats-remain`. Its exact 1920×1080 landscape cover and optional
SRT/VTT captions come from
`output/video/tlpt-two-seats-barista/clean-proportions-v3/` outside the repository.
The approved 31-second 1080×1920/60fps master stays in that production folder.
Keep the title-only, click-to-play card and uncropped portrait YouTube playback.

The approved Patriots Norm football commercial “Call Your Play” uses YouTube
`GY4uQaUwsbU` and the exact `call-your-play-thumbnail.jpg` landscape artwork from
`output/video/tlpt-football-commercial/commish-playbook-preview/` outside the repo.
Its matching 1080 x 1920 portrait poster is used on YouTube, not as the website
cover. The final 30.5-second MP4 stays in production; no duplicate native player
is added. Keep the title-only card, click-to-play and optional captions.
The approved “The Kids — Still Loading” commercial uses YouTube `AYTCCtyBTqQ`
and the exact `the-kids-thumbnail.jpg` landscape cover from
`output/video/tlpt-kids-commercial/individual-slides-preview/` outside the repo.
Its approved 36.4-second portrait MP4 (SHA-256
`95f7ca408650132d80ce6818ab5b71b4df4cb7e508a998dde0e41fe8f67a729e`)
stays in production. Preserve the five solo avatar slides and aimed projector
revision; do not substitute an earlier preview or add a native duplicate.
The website title follows the approved handoff; the owner's YouTube title was
“Ask Your Dad” at intake and is not changed by this website-only addition.
The approved “The RSVP Main Event” commercial uses YouTube `inTd_p7otyE`
and the exact `rsvp-main-event-thumbnail.jpg` landscape cover from
`output/video/tlpt-lon-norm-main-event-commercial/hiro-white-chip-v5/` outside
the repo. Its approved 33.5-second portrait master (SHA-256
`4bbe7aea5e9d30be72aaa933190f1f6da2c4bc0a8ab3f548bad29d8b693c8ef6`)
stays in production. Preserve the Hiro/white-chip microphones/piano-music revision,
the title-only card, optional captions and uncropped YouTube playback. No duplicate
native player is added. The owner's YouTube title was “History” at intake and is
not changed by this website-only addition.
“Final Boarding Call” uses YouTube `elGvMvI4z98` and the exact landscape
`final-boarding-call-thumbnail.jpg` from
`output/video/tlpt-final-boarding-call-commercial/wild-bill-clean-v2/` outside the
repo. Preserve the approved 30-second Wild Bill / CB-mouthpiece revision (master
SHA-256 `3d256d2e8810db3fad781752c2796c80c0c0fee6a5e94e2c87f69a793b841010`).
The master has no embedded subtitle track or rolling lower dialogue captions;
separate caption files remain optional production assets. The site must never
force captions on. Keep its title-only landscape card and uncropped portrait
YouTube playback; no duplicate native player or production files are published.
Source hashes are locked in
the RSVP-guide static test. The corresponding production folders under
`output/video/` are `tlpt-missing-persons-commercial`, the Bad Beat Hotline
`studio-redesign-preview`, Weather `no-live-preview`, and Empty Chair
`desperate-plea-preview`. These exact final cuts—not earlier previews—match the
owner's files. The approved Calling the Clock handoff uses the exact white-dinner-
jacket/red-ALL-IN-plaque cut from `tlpt-calling-the-clock-commercial/all-in-plaque-preview`;
do not substitute its earlier exports. On 2026-10-29 the owner uploaded the eight
films to YouTube; the exact card-to-video IDs are locked in the RSVP-guide tests.
YouTube uses the matching approved portrait production posters to avoid Shorts
cropping; the site retains the approved landscape covers via each iframe's
versioned `data-thumbnail`. Older films retain their YouTube-provided cover fallback.
YouTube settings are
Unlisted, not made for kids, no age restriction, AI disclosure enabled, embedding
allowed, and subscription-feed/notification announcements disabled.
The site uses the same lazy, landscape iframe treatment as its older YouTube films.
Do not enable autoplay or force captions with `cc_load_policy=1`; CC remains optional
(YouTube may honor a viewer's own saved caption preference).
The standalone RSVP App guide and download remain unchanged and self-hosted.
The eight November 1 additions match the owner's numbered exports 16–23 by
SHA-256, not filename similarity. They retain the exact production 1280×720 covers:
Nightly News — Friday Canceled (`uSNlM_E_zck`, `friday-canceled-v3`),
Amazing Norm — Friday Canceled (`6dKAxotRBXI`, magician Friday),
Nightly News — A Heavy Heart (`VrliccRY5ZE`, `breaking-two-hands-v2`),
Amazing Norm — Saturday Canceled (`PjiZafNM4Xs`, `hat-polish-v2`),
Now Showing (`i17yME1Az2o`, Box Office `notification-border-v3`),
Sunday Special Bulletin (`HweZPs_q85U`, `orange-mic-jacket-avatar-v6`),
Who Wants to Make a Decision? (`Ij45B2zhMY4`, game show `production-v1`),
and RSVP Roadshow (revised November 4 to `MvwsaPIq9-8`, `pokerstars-phone-v3`).
The revised Roadshow shows Ahmed holding the PokerStars phone. Replace its film
in place: keep the existing card position/title and use that revision's exact
`thumbnail-1280x720.jpg` for the Film Room and `thumbnail-portrait.jpg` for the
Norm Gallery. Update both checksum/version references and the Gallery video ID;
do not retain the superseded upload in public embeds or add a duplicate card.
The two cancellation styles are separate films, not duplicate versions to replace.
The owner's file labeled Saturday cancellation v1 is the generic A Heavy Heart
news export; preserve that actual title/artwork rather than inventing a Saturday
headline. Production MP4s remain outside the repo; only landscape covers are
copied to Film Room assets. Approved portrait posters are also copied, unchanged,
to the separate Norm Gallery wing described below. Keep all prior films.

The approved November 4 Film Room addition “Where’s the Youth Movement?” uses
YouTube `nvJYKCcRwA8` and anchor `media.html#youth-movement`. Its 36-second,
1080×1920 master stays outside the repository in
`output/video/tlpt-youth-movement-commercial/recessed-deckmate-v3/` (SHA-256
`a7ceb76d8d2fadff8990c11d9533e173410ad65edbce7a7d006fac4325306f89`).
The 1280×720 cover uses that final version’s existing `build.py` preview layout,
rendered to `output/verification/youth-movement-cover-v3/` without changing its
approved master or poster. Preserve the recessed DeckMate on the side table
behind BostnMike; do not substitute the earlier `integrated-room-v2` thumbnail.
The website cover hash is locked in the RSVP guide test. Keep the title-only,
click-to-play card, uncropped portrait playback and optional captions. The owner
also requested the matching Gallery entry: copy the approved `poster.jpg`
byte-for-byte, preserving its 1080×1920 composition, standard gold frame/title
plaque and link to the same Film Room card. Do not publish a duplicate native MP4.

The approved November 5 evergreen GAME ON announcements are “Clocking Out”
(Friday, YouTube `FuEu6XnbLvk`, anchor `media.html#clocking-out`) and “Mission
Control” (Saturday, YouTube `rVnC_ctqRn0`, anchor `media.html#mission-control`).
Both 29-second, 1080×1920/60fps masters remain outside the repository in their
respective `output/video/tlpt-friday-game-on/production-v1/` and
`output/video/tlpt-saturday-game-on/production-v1/` folders. Their master SHA-256s
are `02f4f03223aa5e2cf2a1ae1b58c92a5c4ca558014ef09d8a3a2023f03fc971ca`
and `09cded987d6aec60d9ff33a8d5da2912df6762bc3ee96218da56c7bde4fcf582`.
Copy the exact approved `thumbnail-1280x720.jpg` files to their matching Film
Room covers and the approved portrait posters to the Norm Gallery, without
cropping or regeneration. Static tests lock all four artwork hashes. Keep these
as reusable Film Room announcements, not live game-status or schedule claims;
their in-video app lineups are explicitly demonstrations. No MP4/caption
duplicates, home promos, schedule changes or YouTube setting changes are added.

The approved final baseball “Doubleheader — Friday + Saturday” completes the
GAME ON set: YouTube `hyIBSyjWgvU`, anchor `media.html#doubleheader`. Its exact
26-second, 1080×1920/60fps master stays in
`output/video/tlpt-doubleheader-game-on/family-map-v2/` (SHA-256
`5daa3851bd8e137a2cba4f9f79d772384b9c08b8a9b2dafd5debf030f100efbd`).
Use that folder's approved landscape thumbnail and portrait poster unchanged,
not an earlier cut. Preserve the “or one DeckMate” aside, labeled example lineup
and illustrated Find Norm / The Caahhd Room family-map gag. Like the other two,
this is an evergreen Film Room commercial, not an instruction to open live games.
No MP4, captions, Home/Schedule content or YouTube settings are changed.

The five approved group-message Shorts use the exact uploads in the TLPT
playlist and the unmodified landscape and portrait artwork in
`output/video/tlpt-group-messages/`: “One Seat Available” (`ep08DkRP3gw`),
“The Courtesy Fold” (`45e1e-1290I`), “Earlier Start” (`ervb9fx_0oc`),
“Public Hearing” (`Va-Q7PHbMDI`) and “Rookie Orientation” (`cCInbuQ0_QI`).
They are evergreen films; their RSVP screens use example data. The site embeds
YouTube and does not host additional MP4s or add schedule/registration controls.

### The Many Faces of Norm Gallery wing

`gallery.html#norm` opens the opt-in Norm collection. The normal entry remains
Event Posters, preserving the dated archive, year filter, progressive loading,
winner badges and their full-size JPG/PNG viewer. Neither this wing nor its banner
is added to the homepage. No YouTube media is loaded by the Gallery itself.

`data/gallery-norm.json` owns the approved 9:16 portrait covers in
`images/norm-gallery/`. The original wide group image was removed from this wing
on November 7. The five rotating Family Portraits remain above the poster grid.
“Two Seats Remain” uses the exact approved portrait PNG from
`output/video/tlpt-two-seats-barista/clean-proportions-v3/thumbnail-portrait.png`
and links to `media.html#two-seats-remain`.
All portrait artwork retains its original
1080×1920 dimensions, the existing gold poster frames and title plaques. A click
opens the full artwork; the separate Film Room link points to its existing card.
The viewer stays within the selected wing, supports keyboard navigation and
returns focus to the triggering image. Load failures have a retry control.

`docs/norm-gallery-sources.json` records exact production source provenance and
SHA-256 hashes. Do not use auto-selected video frames or guess the newest export.
When adding a Norm film to the Film Room, include its approved portrait cover in
the Norm Wing in the same release. Copy the original portrait bytes, add the
title, Film Room anchor, YouTube ID and hash to the gallery manifest, and record
the source in the provenance file. The shared static and browser
runners include `test-norm-gallery.mjs` and `test-norm-gallery-browser.cjs`:
all cover hashes, complete Film Room coverage, correct film IDs, uncropped aspect ratios,
seven desktop/tablet/mobile/short-screen viewports, all viewer captions, wing switching, focus, viewer
bounds, direct links, lazy loading and failure recovery. Do not regenerate visual
baselines just to clear a failure.

Browser checks cover embed identity, responsive bounds and home deep links at six
widths, using a deterministic YouTube frame response; they do not claim to test
YouTube service availability/playback. Check real YouTube playback and thumbnails
in a signed-in browser before publication, and on the live page after deployment.

The RSVP Referee was added from the approved 2026-10-29 handoff, using the
owner-configured YouTube upload `sPBNdswB3Xw` and the exact landscape cover from
`output/video/tlpt-referee-commercial/revised-script-preview/`. Its approved
25.5-second MP4 backup remains in that production folder (SHA-256
`b9577a98e8e60ff5be2074463bbe339a07e9119e1a193e0d05a86bc2dca203b2`).
Do not replace it with an earlier voiceover/VAR revision or add a duplicate card.
The site keeps the title-only treatment; its YouTube settings are owner-managed.

“The Elusive RSVP” uses the owner's corrected YouTube upload `iYLibq-VvcQ` and the exact
1280×720 landscape cover from `output/video/tlpt-wildlife-commercial/unbroken-scan-preview/`.
Its approved 42-second portrait MP4 remains in that production folder (SHA-256
`f879afb9efde9055ad51ad1cdc593df228276a78325b0ff6d3800f8674b1c143`).
Keep the website's title-only, click-to-load landscape card, not a Shorts-shaped
crop or a duplicate self-hosted video. The cover deliberately does not reveal
the donkey ending. The site-owned thumbnail is checksum-locked in the guide test.
The owner replaced the incorrect YouTube upload on 2026-10-29; do not restore
the superseded `WnWQ9UaJ4LY` ID. YouTube uses the matching approved portrait cover
`youtube-cover-1080x1920.jpg` from that production folder; the site retains its
separate 16:9 landscape cover. Changing the upload must preserve both treatments.

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
  Narration portraits use CSS-framed characters from the approved 1983×793
  `images/site/norm-many-faces.jpg`; the original photographic headshot remains
  available for unrelated uses. Crop coordinates live in `stats-help.js` and
  each guide explicitly selects a stable character with its `portrait` key.
  Results uses the referee, Knockouts the approved V2 hockey headshot in
  `images/site/norm-hockey-headshot.webp`, Bankroll the hotline operator, Rates/Standings
  classic Norm, DNA/Form Lab the detective, Heater Meter the weather presenter,
  Streaks the clock host, Crew/Bounty Hunters the explorer, and Profiles the
  microphone host. Update the portrait with the view, never on a timer or at
  random. Keep faces undistorted and the 96/80px circular frames unchanged.
  The original nine-character image stays unchanged as the shared portrait
  source; homepage banner updates must not move those crop coordinates. Hockey
  has its own 512px source and framing; switching back from Bounty Hunters must
  restore both its source dimensions and crop. This image does not authorize
  changes to the separately approved hockey commercial or its supplied cover.
  Dashboard retains its view-specific metric definitions.
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

## NASA Al avatar

NASA Al (`nasa-al`) uses the approved November 7 PNG at
`images/players/nasa-al-415effa3f03e46f5.png`. Its original bytes come from
`output/avatars/nasa-al/nasa-al-v3-young-1960s-orr.png` outside the repository,
with SHA-256 `415effa3f03e46f5d059738a47840c352e34eb2dbc89631b33a8c358e23d5b15`.
The content-based filename refreshes returning visitors' image caches through
the shared player metadata, generated player data and story avatar references.
`images/players/nasa-al.jpg` remains a full-size, high-quality JPEG derivative
for legacy consumers. Keep the approved round portrait and navy rim, including
the younger, short-haired Bobby Orr. Use the shared data build for derived player
records. Historical poster/video artwork and name tents have separate ownership.

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


## Quality-gate assessment — 2026-11-08

The footer failure was independently reproduced in the pinned browser: the
breakable separator space changed advance, not application state. Its shared
span fix passed 120 fresh-process footer captures and the 168-case full rehearsal
before production release. The earlier RSVP Linux ENOENT was a harness portability
bug (`/private/tmp`); `os.tmpdir()` fixed it. No evidence attributes either to
Cashier/RSVP feature behavior. An older isolated coffee503 lacks enough retained
response/runtime evidence to assign a product root cause; strict assertions stay,
with bounded diagnostics added by the app owner.

Registration's satellite hourly recovery can publish a descendant of a pending
request after an unrelated app commit. Verification accepts that marker only if
GitHub proves the expected SHA is its merge base with zero commits behind. Both
registration pages, the root form and both shared form assets still match the
expected bytes (only the previously reviewed root email-marker variant allowed).
Older, divergent, malformed or unproven markers fail closed; changed content
cannot pass by advancing the marker. Publication remains serialized.

Main has a tested generated-output writer. Do not enable path-filtered required
checks or a generic PR-only rule that strands unrelated PRs or blocks this writer.
Repository branch-protection enforcement needs stable always-reported product
readiness contexts and a tested, narrowly scoped bot exception before activation.
Current production workflows independently enforce all deployment prerequisites;
this assessment does not claim that repository-wide PR enforcement is enabled.

Backup policy: weekly Monday 05:00 America/New_York. Private tooling/state and
ciphertext remain outside Git/public packages. App Wrangler updates must retain
D1 info/export/read-only query JSON compatibility used by private backup tooling;
never use a production restore or extra close-out as a gate rehearsal.


The approved November 8 ICM commercial “Good Will Chopping” uses YouTube
`0ioNSdNGmME` and anchor `media.html#good-will-chopping`. Add it once in the
Film Room with its exact production-v3 1920×1080 landscape cover; maintain the
current title-only, click-to-play layout and direct YouTube fallback. The owner's
YouTube upload is titled “ICM Chop”; the approved site title is “Good Will
Chopping”. Production-v1/v2 are superseded. The 50-second portrait master,
portrait poster, narration and QC remain outside the public repository under
`output/video/tlpt-icm-good-will-chopping/production-v3/`; do not add a hosted MP4,
force captions or alter unrelated films. Approved description for reference:
“Norm brings Good Will Hunting and Rounders together for a tour of TLPT’s ICM
chop calculator. No Harvard or MIT degree required.” No Gallery placement was
requested in this handoff.
