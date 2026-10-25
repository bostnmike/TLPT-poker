# TLPT RSVP

A buildless, responsive browser app hosted by the account-owned `tlpt-rsvp`
Cloudflare Worker with **its own** `tlpt-rsvp` D1 database. No subscriptions,
payment method, SMS, native app, or Cloudflare Access enrollment is needed.

Player entry: https://tlpt-rsvp.tlpt-bostnmike.workers.dev/
Commish entry: https://tlpt-rsvp.tlpt-bostnmike.workers.dev/?commish=1
The entry URL alone cannot sign anyone in. The Commish gives each player a
private link; no player chooser grants write access. The main website's RSVP
buttons point to the relevant event in this app.

## Authority and event identities

D1 owns all live upcoming event metadata, capacities, open/closed state, queue
order and answers. `data/events.json` is the initial import and compatibility
snapshot, not an ongoing writable RSVP source. Do not edit its answers expecting
live changes. The website fetches `/api/public/events` on load and every minute
on home/schedule. Home selects the next game per event type; the full schedule and RSVP app list all unarchived games. On failure it shows schedule reference metadata with live
counts unavailable. It never silently substitutes obsolete static confirmations.

Each event has a stable ID independent of its slot; dates/types of existing
events cannot change. Create a new event each week. Initial IDs include their
original date; new IDs are UUIDs. The undated Next MTT remains `Date TBD`, closed,
and has its own placeholder ID. Once its date is known, archive the placeholder
and create a new dated event. Never invent a date to make an event payable.

Cashier retains its existing audited `data/events.json` and financial feed for
payment-event selection, receipt windows, prices and cleanup. A separate
`live_rsvp_state` cache overlays attendance for **exact slot + date matches**.
Attendance changes never invoke payment cleanup, schedule normalization or event
rollover. A live-only event is not automatically a payable event: the existing
site/financial configuration must publish that date through the ordinary reviewed
workflow before Cashier offers it. This is a deliberate financial safety limit.
The Commish can create/manage RSVP events without assigning financial policy.
Archived/missing live events show no current confirmed lineup for a retained
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

First In gets first priority. Atomic revision-checked saves serialize competing
requests for the last seat. Repeating In preserves priority; leaving In releases
it, automatically promoting the first waiting player. Returning In joins the end.
Maybe/Out do not hold seats. Capacity changes apply the same queue immediately;
reducing capacity moves the last confirmed players to the waitlist. Commish
**Move In to front** overrides priority and can displace the last confirmed player
when full; the UI explains this before saving. Closed events reject all player
changes; Commish can correct answers. Archive retains answers and hides the event.
Restore leaves it closed. These defaults are event-specific via capacity, open
state and Commish queue control; they are not a new financial or league policy.

## Access and recovery

32 random bytes identify each player link. Only SHA-256 hashes are durably stored.
The browser strips the URL fragment, exchanges it for a secure HttpOnly,
SameSite=Strict cookie, and never puts link material into a query string, referrer,
public feed, source repository or audit. Sessions last seven days; reopen the
private link on another device or after expiry. Link revocation/replacement
invalidates all that player's sessions, checked on every request. Links cover
all that player's upcoming games. Alumni use their original canonical identities.

The separate Commish link grants admin access. It never reuses Cashier credentials.
Create or recover it locally with `node rsvp/scripts/owner-link.mjs --remote`.
The command rotates only the RSVP admin hash/generation and opens a loopback-only
15-minute setup page at http://127.0.0.1:8795/setup. Save the link in a private
password manager/bookmark. Do not paste it into chat, screenshots, shell arguments,
Git, logs or Actions secrets. Anyone possessing it can act as Commish.

Commish **Create / replace private link** returns a fresh link for the selected
canonical player, immediately revoking the previous link and sessions. Copy it
before dismissing the dialog; clear text is not recoverable later. To share again,
replace it and copy the new link. Clipboard failure on Safari/Android falls back
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
issue new Commish/player links. No automatic restore endpoint is exposed.

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
