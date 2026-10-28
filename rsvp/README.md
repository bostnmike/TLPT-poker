# TLPT RSVP

A buildless, responsive browser app hosted by the account-owned `tlpt-rsvp`
Cloudflare Worker with **its own** `tlpt-rsvp` D1 database. No paid subscriptions,
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
both player and Commish footers. The Player manifest launches the public root.
The Commish entry serves a distinct manifest identity and start URL at
`/?commish=1`, so installing that page launches Commish view. Both are named
**TLPT RSVP** and use the yellow T-1000 chip on a navy background. No private
key or event-specific URL enters either manifest.

An installed app may have a separate session from the browser. If it shows
**Unlock Commish**, copy the complete private link from the password or website
field of **TLPT RSVP — Commish** in Bitwarden, paste it into the form, and unlock.
The form accepts only this origin's full private Commish link, clears the input,
and uses the existing same-origin exchange endpoint. Only a validated admin
session opens controls. The private link is never saved in web storage or the
manifest. Existing seven-day sessions and revocation rules are unchanged.
Old Home Screen icons installed with the Player manifest should be replaced by
adding the updated Commish entry. The old app's footer can also open Commish view
and its unlock form immediately.

On eligible Chromium browsers the button uses a captured, single-use native
install prompt after the player's click. Otherwise it opens device-specific
instructions; players can choose iPhone/iPad, Android or Computer. The guides use
the web browser's Share or install/home-screen menu, with supported browsers
listed as fallback help. Every phone owner confirms installation.
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

## Optional player notifications

After choosing their name, players can tap **Enable notifications**, then approve
one native permission prompt. There are only two automatic alerts: a newly
created/opened/reopened game, and a player's actual waitlist-to-confirmed-seat
transition (including a capacity increase or Commish priority change). Routine
metadata edits, ordinary In responses, closed games and past dates produce no
alerts. Enabling notifications does not send a backlog or alter an RSVP.
On iOS/iPadOS 16.4+, enable from the installed Home Screen app. Unsupported or
blocked browsers get plain instructions; RSVP remains usable without permission.
The yellow TLPT chip identifies notifications; tapping opens that event in Player
view, preserving any separate Commish window.

Each browser/device opts in separately. A random, local device management token
controls its private subscription; the server stores only its hash. Switching
player names pauses that device's previous alerts and requires explicit opt-in
for the next name. **Turn off notifications** deletes the subscription and its
pending jobs. The existing shared-name trust model remains: this does not verify
any player's identity. No contact details are collected and there is no SMS. Notification setup has a
separate rate allowance so shared Wi-Fi setup cannot exhaust RSVP saves.
Push endpoints/keys are private delivery data, excluded from feeds and the
Commish JSON RSVP backup. Full D1 exports include both new tables.

`0002_notifications.sql` adds `push_subscriptions` and `push_jobs` without
changing existing state or sessions. Apply RSVP D1 migrations before deploying
this release. Run `node rsvp/scripts/setup-notifications.mjs` once to provision
only the Worker secret `VAPID_PRIVATE_JWK`; it preserves an existing secret and
never prints/writes its value. Keep this secret during future releases/restores;
rotating it requires every browser to subscribe again. The public key is served
by `/api/notifications/config`. Delivery uses native Web Crypto (RFC 8291/8292)
and browser-owned push services, with no added package or paid service.

The state compare-and-swap and notification outbox INSERT run in one D1 batch
transaction. Recipients are captured at the transition, with per-device binding
versions so an old job cannot follow a changed name. Small leased batches send
immediately after a save; a five-minute cron drains remaining/retry jobs. The
browser push service may deliver after the app closes. Transient failures retry
(up to five attempts within one hour); 404/410 expires a subscription. A delayed
seat alert is dropped if the player no longer has a seat or the game is closed.
Delivery is best-effort, subject to connectivity, permissions and phone settings;
it is not guaranteed or instant. Notification tags collapse possible retries.
Existing games are not broadcast merely because this release is deployed.

Validation includes recipient-side payload decryption/signature verification,
real local D1 outbox transactions, stale-save/rollback protection, retry/expiry,
name switching/opt-out and service-worker click routing. Final phone delivery
must also be confirmed on a player's opted-in physical device; desktop tests
cannot establish iOS/Android notification settings or delivery.

## Authority and event identities

D1 owns all live upcoming event metadata, capacities, open/closed state, queue
order and answers. `data/events.json` is the initial import and compatibility
snapshot, not an ongoing writable RSVP source. Do not edit its answers expecting
live changes. The website fetches `/api/public/events` on load and every minute
on home/schedule. Home selects the next open game per event type; the full public
schedule and Player app list all games open for RSVPs. On failure the website
hides unverified event cards until the connection returns. It never silently
substitutes obsolete static confirmations.

**Open RSVPs** is the public event on/off switch. A closed game is hidden from
the Player app, Commish's Player preview, and TLPT.org home/schedule. It remains
in Commish management and lineups so it can be edited or reopened with the same
ID and saved responses. A direct player link to a closed game shows a notice
without displaying its card. The website hides unverified fallback cards when
the live feed is unavailable. The feed retains closed games for existing lineup
consumers, including Cashier; closing a game does not erase its saved lineup or
alter financial records. After changing the checkbox, save the event.

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

Home, Schedule and the RSVP app show dated **NO GAME THIS FRIDAY/SATURDAY**
notices when no scheduled game exists on that upcoming weekend day. The live
feed calculates these using America/New_York dates; all formats count, including
closed-RSVP games. Cancelled/removed games do not count. Elapsed notices clear at
Eastern midnight; Sunday starts the next weekend. Feed failure hides the notices
rather than claiming a cancellation from missing data. This is display-only: no
fake event, RSVP, payment or history entry is created. Shared notice styling is
mirrored in `schedule-notices.css` and `rsvp/public/schedule-notices.css`, with a
parity test. Notice refresh must not depend only on the event-data revision.

BostnMike always holds the first confirmed host seat: **No Bostn, No Party**.
This is enforced on reads for legacy events and persisted on every successful
save; even Commish cannot set the host to Maybe, Out or unanswered.
Other In requests get first-come priority. Atomic revision-checked saves serialize competing
requests for the last seat. Repeating In preserves priority; leaving In releases
it, automatically promoting the first waiting player. Returning In joins the end.
Maybe/Out do not hold seats. Capacity changes apply the same queue immediately;
reducing capacity moves the last confirmed players to the waitlist. Commish
**Move to front of line** overrides priority after the host and can displace the last confirmed player
when full; the UI explains this before saving. Closed events reject all player
changes. At capacity, each event card shows a separate Waitlist panel, including
an empty state before anyone is waiting. The Commish response panel shows the
same queue for its selected event. Player order comes directly from the saved
queue. Once the table has free seats and no waiting players, the panel is hidden.
Commish can correct answers. Cancel closes and removes a game from the live schedule; a direct link explains
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
before dismissing the dialog; clear text is not recoverable later. On October 26,
2026, the 36 individual player items were moved to Bitwarden Trash and replaced
by **TLPT RSVP — Player**, containing the shared public root URL. The private
**TLPT RSVP — Commish** item retains the verified admin link in both its website
and password fields. Vault cleanup did not revoke existing legacy player links.
Clipboard failure on Safari/Android falls back
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
cd rsvp
pnpm install --frozen-lockfile --ignore-scripts
cd ..
node --test rsvp/tests/*.test.mjs
node rsvp/scripts/test-integration.mjs
```

RSVP owns its pinned Wrangler installation and date parser. No Cashier
installation is needed. The offline recovery rehearsal is
`python scripts/test-recovery.py --product rsvp`; it uses synthetic local data,
never a production connection.

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
and verified. Follow TLPT Data Pipeline → data/static/browser checks →
tested Pages artifact, and the independent Cashier production workflow. Verify the same actual
RSVP lineup through the site feed and Cashier source integration. Authenticated
Cashier inspection needs the owner's existing session; never create test payments
or rotate credentials to perform verification.

Rollback Worker code with the same D1 binding and credential data. Reverting
site integration restores prior behavior only after explicit reconciliation;
do not silently make the obsolete static RSVP snapshot authoritative again.
