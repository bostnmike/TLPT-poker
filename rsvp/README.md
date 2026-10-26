# TLPT RSVP

A buildless, responsive browser app hosted by the account-owned `tlpt-rsvp`
Cloudflare Worker with **its own** `tlpt-rsvp` D1 database. No subscriptions,
payment method, SMS, native app, or Cloudflare Access enrollment is needed.

Player entry: https://tlpt-rsvp.tlpt-bostnmike.workers.dev/
Commish entry: https://tlpt-rsvp.tlpt-bostnmike.workers.dev/?commish=1
The player entry is one shared link: choose a canonical roster name, then tap In,
Maybe or Out. The browser remembers the selected name locally. The root URL always opens this
player flow, including for a signed-in Commish; `?commish=1` opens private controls. No player sign-in
or private link is required. Anyone with the URL can update a selected player's
RSVP; this is the league's explicitly requested trust-based flow. The main
website's RSVP buttons point to the relevant event in this app. Commish controls
and backups still require the separate private Commish session.

## TLPT visual identity

The RSVP app uses TLPT.org’s Arial typography, navy palette, `#ffb81c` gold,
league wordmark/tagline, Bruins Centennial poker chip and Friday purple /
Saturday green / MTT blue event accents. The local 16/32 pixel favicons,
original Apple touch icon and chip image are exact copies of the canonical
`images/site/` assets. Refresh these copies deliberately when those originals
change. The app keeps its own stylesheet rather than importing the full site
shell into the authenticated forms. Its theme is self-contained on workers.dev.

## Installation on players’ phones

The root page offers **Add to Home Screen**, with an **Installation** link in
both player and Commish footers. The manifest launches the public root as
**TLPT RSVP** in a standalone window. The 180/192/512 pixel app icons are scaled
from the existing canonical T-100 chip, with a navy background. No QR credentials
or event-specific URL enter the manifest.

On eligible Chromium browsers the button uses a captured, single-use native
install prompt after the player's click. Otherwise it opens device-specific
instructions; players can choose iPhone/iPad, Android or Computer. iPhone uses
Safari Share → Add to Home Screen and Open as Web App when offered. Android uses
Chrome's install/home-screen menu. Every phone owner confirms installation.
An accepted browser prompt alone is not reported as installed; `appinstalled`
or an actual standalone launch hides installation controls.

The service worker does **not** cache pages, assets, feeds, sessions, private
links or responses. Every navigation uses the network, and API requests bypass
it. A failed navigation gets a clear offline page with a Retry link. There is
no offline RSVP queue or background replay; live lineups and saving still need
an internet connection. This preserves the app's existing no-store behavior.

Platform references checked October 25, 2026:
- https://web.dev/articles/install-criteria
- https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios
- https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en

## Authority and event identities

D1 owns all live upcoming event metadata, capacities, open/closed state, queue
order and answers. `data/events.json` is the initial import and compatibility
snapshot, not an ongoing writable RSVP source. Do not edit its answers expecting
live changes. The website fetches `/api/public/events` on load and every minute
on home/schedule. Home selects the next game per event type; the full schedule and RSVP app list all upcoming games. On failure it shows schedule reference metadata with live
counts unavailable. It never silently substitutes obsolete static confirmations.

Each event has a stable ID independent of its date. Commish can correct an
existing date while retaining responses and ID; game type remains fixed and a
duplicate live slot/date is rejected. Create a new event each week. Initial IDs include their
original date; new IDs are UUIDs. The undated Next MTT remains `Date TBD`, closed,
and has its own placeholder ID. Once its date is known, set its date and deliberately open RSVPs. Never invent a date to make an event payable.

Cashier retains its existing audited `data/events.json` and financial feed for
payment-event selection, receipt windows, prices and cleanup. A separate
`live_rsvp_state` cache overlays attendance for **exact slot + date matches**.
Attendance changes never invoke payment cleanup, schedule normalization or event
rollover. A live-only event is not automatically a payable event: the existing
site/financial configuration must publish that date through the ordinary reviewed
workflow before Cashier offers it. This is a deliberate financial safety limit.
The Commish can create/manage RSVP events without assigning financial policy.
Cancelled/deleted/archived/missing live events show no current confirmed lineup for a retained
payment event; they do not delete its payments. Refresh failure retains only the
last verified runtime lineup, labels it stale and displays its check time. With
no cached runtime lineup, the checklist says unavailable and shows no confirmed
seats. Cashier's minute refresh remains unchanged.

`rsvps.yes` means a confirmed seat. Waitlisted In requests are represented as
`maybe` for older read consumers plus an explicit ordered `waitlist` and
`requestedIn`. New consumers must use the waitlist separately. The website removes
these players from the Maybe forecast; Cashier excludes them from its checklist.
RSVP does not imply payment, attendance, a result, or official seating. Existing
manual preview positions stay in `data/events.json`; the website overlays only
those positions by exact type/date while live answers remain authoritative.
Editing preview positions remains in the established site workflow. Tournament Director owns official seating.

## Queue rules

BostnMike always holds the first confirmed host seat: **No Bostn, No Party**.
This is enforced on reads for legacy events and persisted on every successful
save; even Commish cannot set the host to Maybe, Out or unanswered.
Other In requests get first-come priority. Atomic revision-checked saves serialize competing
requests for the last seat. Repeating In preserves priority; leaving In releases
it, automatically promoting the first waiting player. Returning In joins the end.
Maybe/Out do not hold seats. Capacity changes apply the same queue immediately;
reducing capacity moves the last confirmed players to the waitlist. Commish
**Move In to front** overrides priority after the host and can displace the last confirmed player
when full; the UI explains this before saving. Closed events reject all player
changes; Commish can correct answers. Cancel closes and removes a game from the live schedule; a direct link explains
that it was cancelled. Delete moves the event to the private removed list
(soft deletion). Both retain answers, identity and Cashier payment history.
Restore rejects duplicate slot/date identities and leaves RSVPs closed.
Legacy archived events are also restorable. These defaults are event-specific via capacity, open
state and Commish queue control; they are not a new financial or league policy.

## Commish controls and gallery

The Commish can toggle **Player view** to preview the hero, posters, lineups and
response controls, with a **Preview as** player selector. Preview replies are
disabled and the action handler rejects preview writes. The existing Commish
session and unsaved event form are retained; switching back restores controls.
The toggle is only offered to authenticated Commish users and does not exchange
or replace player credentials.

Dated events are listed by date and Eastern start time in both player and
Commish lists. An undated MTT stays last; assigning its date puts it into the
normal chronological sequence. An event-specific URL does not reorder the list.

Manage a response is the first Commish panel. Player selectors and lineups list
active players before alumni, with BostnMike first. Waitlists retain queue order.
New events use a native calendar date picker, with a Date TBD option that keeps
RSVPs closed. Game day presets copy the existing Friday, Saturday or MTT format,
structure, times and capacity; these can be adjusted before saving. Selecting a
Friday/Saturday calendar date also selects its matching game preset, unless MTT
was explicitly chosen. Dates can be corrected; slot remains locked. Changing an RSVP date does not
rewrite Cashier schedule configuration or move any payment. Old payment events
remain retained; attendance overlays only the exact corrected slot/date and new
payable dates still require the existing financial setup.

Posters match `fwYY-MM-DD.jpg` in the existing TLPT Art Gallery automatically.
The Commish can select a different gallery date or No poster. The public gallery
catalog endpoint only returns validated filenames from the canonical manifest;
no arbitrary image URL or upload is accepted. Thumbnails open the original art
in a modal. Missing art falls back to the original, then hides the thumbnail;
an undated game has no automatic poster. Gallery failure never blocks RSVP.

## Shared player entry and private Commish access

`POST /api/respond` accepts only a canonical roster slug, existing event ID, and
In/Maybe/Out answer. It ignores caller-supplied operation types, role and event
settings. Same-origin JSON, rate limits, atomic queue saves, closed/removed-event
checks and the host lock apply. Successful audit entries use `shared:<slug>` to
distinguish this unverified name selection from private-session actions. Expired
rate-limit rows are cleaned during writes, without requiring player sign-ins.
Private `/api/action`, `/api/me` and `/api/backup` retain their auth boundaries.

### Legacy private player links and recovery

32 random bytes identify each player link. Only SHA-256 hashes are durably stored.
The browser strips the URL fragment, exchanges it for a secure HttpOnly,
SameSite=Strict cookie, and never puts link material into a query string, referrer,
public feed, source repository or audit. Sessions last seven days; reopen the
private link on another device or after expiry. Link revocation/replacement
invalidates all that player's sessions, checked on every request. Links cover
all that player's upcoming games. Alumni use their original canonical identities. These legacy links remain valid,
but are no longer needed to RSVP. Revoking a legacy link does not remove access
to the shared-name flow.

The separate Commish link grants admin access. It never reuses Cashier credentials.
Create or recover it locally with `node rsvp/scripts/owner-link.mjs --remote`.
The command rotates only the RSVP admin hash/generation and opens a loopback-only
15-minute setup page at http://127.0.0.1:8795/setup. Save the link in a private
password manager/bookmark. Do not paste it into chat, screenshots, shell arguments,
Git, logs or Actions secrets. Anyone possessing it can act as Commish.

Commish **Create / replace private link** returns a fresh link for the selected
canonical player, immediately revoking the previous link and sessions. Copy it
before dismissing the dialog; clear text is not recoverable later. All 36 player links issued on October 25, 2026 are saved in the personal
Bitwarden folder **TLPT RSVP — Players**. Each item’s password field contains the
complete private URL for individual sharing. Reuse that saved link; only replace
it if lost or compromised, and update Bitwarden after replacing it. Clipboard failure on Safari/Android falls back
to a selected input for manual copying. The app never messages players.

Origin checks, JSON/size limits, host-bound cookies, indexed session lookup and
per-IP minute write limits protect private endpoints. UI and public feed use
explicit public allowlists: no contact data, hashes, sessions or admin audit.
Never enable request-body logging or analytics that capture private fragments.
Audit retains the most recent 500 successful actions; it contains actor/type/IDs,
not keys or contact/payment data.

## Backups and bounded free operation

Download the authenticated RSVP backup after event creation and significant
Commish changes, and before releases. It includes response queues/event metadata
and the last 500 audit entries, excluding all access credentials. Store it
privately. For exact disaster recovery, use a private D1 export or available D1
Time Travel; these contain authentication hashes/session records and must never
enter Git or chat. Time Travel on Free is limited; consult current Cloudflare docs.
Restore requires reconciling responses received after the snapshot. Never restore
a database as an automatic code rollback. After a sanitized backup restore,
recover Commish access and replace any legacy private links still in use. Shared
player RSVP does not require credential recovery. No automatic restore endpoint is exposed.

The model is intentionally bounded to 100 event records and 500 audit entries.
Archiving hides events but retains them; when 100 total events are reached,
new-event creation stops with an explicit limit message. Export/review and a
separate maintenance change are needed for retention rather than silent deletion.

Workers Free currently includes 100,000 requests/day account-wide, with 10 ms
CPU per invocation; D1 Free includes 5 million rows read/day, 100,000 rows
written/day and 5 GB account storage (500 MB per database). These allowances are
shared with other account apps. Static app assets use Workers Static Assets.
No paid fallback is configured. Exhaustion yields explicit unavailable/unsaved
states; it never upgrades a plan. Keep the account on Workers Free.

Pricing references:
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/

## Checks and release

Run from the repository root with Node 24 for the SQLite unit test adapter:

```
node --test rsvp/tests/*.test.mjs
node rsvp/scripts/test-integration.mjs
```

The latter creates only disposable local Worker/D1 resources. Browser preview
uses `wrangler dev --local` and a separate `.wrangler/preview` state. Test keys
must only enter that disposable local database. Do not seed production from
preview exports. Node's SQLite adapter is a test dependency only; the Worker
uses Cloudflare D1.

For cross-component releases, run the authoritative `bash scripts/run-data-build.sh`
and `bash scripts/run-quality-gates.sh`, Cashier `pnpm check`, `pnpm test:integration`
and both deployment dry runs. Do not duplicate the main runners' component list.
Cashier changes require PR checks, merge, normal account-token CI deployment and
exact production verification per `cashier/DEPLOYMENT.md`.

Verified on October 25, 2026 in the account dashboard: **Workers Free, $0, Current plan**. The separate RSVP database is `79de1ed8-302a-4d25-b7f1-5f423e6ea321`.

Before future provisioning, verify **actual Workers Free in the account dashboard**.
Never treat `workers/standard` or `default_usage_model: standard` as proof of Free;
those identify a usage model shared by multiple plans. No upgrade/checkout is
permitted. Create only the separate `tlpt-rsvp` D1 and update its ID in
`wrangler.jsonc`; it must never equal Cashier's DB ID. Apply `0001_rsvp.sql`, then
seed **once** using `node rsvp/scripts/seed.mjs` (hash-only SQL, no private links).
`ON CONFLICT DO NOTHING` prevents reseeding from overwriting live responses.
Generate the Commish link through the local recovery command after publication.

Deploy tested source through the account owner's existing Wrangler access:
`node rsvp/scripts/deploy.mjs` with `RSVP_FREE_PLAN_CONFIRMED=1` after the dashboard
check. This script requires a real separate DB ID, pins the account, runs RSVP
unit tests and verifies the public version/feed/privacy and anonymous denials.
It has no command to change plans, DNS, Cashier, registration or other apps.
Do not copy personal OAuth credentials into GitHub. Future unattended RSVP
publication requires a separately approved account-owned scoped token; the
RSVP CI workflow is validation-only.

Main website/cashier integration must not merge until the RSVP feed is published
and verified. Follow TLPT Data Pipeline → exact revision Site Quality Gate →
Pages, and the independent Cashier production workflow. Verify the same actual
RSVP lineup through the site feed and Cashier source integration. Authenticated
Cashier inspection needs the owner's existing session; never create test payments
or rotate credentials to perform verification.

Rollback Worker code with the same D1 binding and credential data. Reverting
site integration restores prior behavior only after explicit reconciliation;
do not silently make the obsolete static RSVP snapshot authoritative again.
