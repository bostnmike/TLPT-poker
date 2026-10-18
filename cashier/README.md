# TLPT Cashier — Cloudflare migration

The cashier's interface, payment rules, database migrations, Gmail reader, and
tests live with TLPT. `https://tlpt.org/cashier.html` opens the Cloudflare
cashier at `https://cashier.tlpt.org`. The previous owner-private Sites app
remains available for fallback.

The branded address forwards internally to the already-tested production Worker at
`https://tlpt-cashier-staging.tlpt-bostnmike.workers.dev`. The historical Worker
name is retained so the owner's existing password, signed-in session, and import
secret continue working. Its environment is now `production`, and it binds only
the reconciled `tlpt-cashier` production database. The old test database is kept
separately and is not the live ledger. Future staging deployments use the distinct
Worker name `tlpt-cashier-test` and the separate staging database; they cannot
overwrite this production Worker through the normal staging command.

The owner approved cutover before the first real Venmo receipts, expected during
the October 16–17 games. Genuine receipt format verification remains pending;
synthetic tests and the successful real mailbox connection do not replace it.

## Architecture

- React/Vite supplies the existing iPad interface as static assets.
- A small Cloudflare Worker handles the register API and imports.
- A private D1 database stores payments, audit history, source IDs that prevent
  deleted receipts from returning, format overrides, and private payer matches.
- A private cashier password replaces ChatGPT sign-in. Only a salted PBKDF2
  verifier is stored in Cloudflare secrets. Signed, host-bound, secure cookies
  last 12 hours. D1 limits login attempts; password rotation invalidates sessions.
  Cloudflare Access remains an optional alternative, disabled by default.
- Google Apps Script keeps read-only Gmail access and sends authenticated
  receipt batches. No Venmo API subscription or merchant service is introduced.
- TLPT's existing published event, financial, RSVP, and player feeds remain the
  source for the three current event tabs and central Venmo identities.

## Free-only operation

Use **Workers Free**, **D1 on Workers Free**, and the built-in private password.
Confirm Workers Free in the account before deploying; do not upgrade a plan,
add a payment method, enroll in Access, or enable paid add-ons. Deployment commands never alter billing.
If the account is already on Workers Paid, use a free account for this app rather
than changing a plan used by other applications.

Verified against Cloudflare's documentation on October 15, 2026:

| Resource | Free allowance |
| --- | --- |
| Worker requests | 100,000 per day; 10 ms CPU per invocation |
| Static assets | Free and unlimited requests |
| D1 reads | 5 million rows per day |
| D1 writes | 100,000 rows per day |
| D1 storage | 5 GB across the account |
| Cashier sign-in | Built into the Worker; no separate subscription |

An iPad polling every three seconds for 24 hours makes 28,800 register requests.
The reader adds roughly 2,880 requests daily plus receipt batches. ETags and a
database revision avoid rereading the full ledger on unchanged polls. Indexed
event queries and the existing event-replacement cleanup limit database work.
Background iPads pause polling. These are estimates, not reserved capacity:
other account applications share quotas, and large ledgers or more terminals
can use more. **Free quotas stop requests/queries when exhausted; this migration
does not enable an automatic paid fallback for Workers or D1.**

**Access is not used by this deployment:** on October 15, 2026, this
account's Zero Trust Free checkout required a payment method, agreement to
terms, and authorization for excess-usage charges. Do not complete that
checkout under a free-only/no-billing-authorization instruction. The existing
cashier remains live while password-protected staging is tested. Cloudflare also
[documents the payment-details requirement](https://developers.cloudflare.com/learning-paths/clientless-access/initial-setup/create-zero-trust-org/).

Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[D1 pricing and quota behavior](https://developers.cloudflare.com/d1/platform/pricing/),
[Access plans](https://www.cloudflare.com/sase/products/access/).

## Automatic production publication

Requested Cashier changes include publication after checks pass on main.
See [DEPLOYMENT.md](DEPLOYMENT.md) for the workflow, narrowly scoped environment
credentials, live verification, failure handling and rollback. Staging remains
separate, and ordinary releases retain the existing database, password, sessions
and Gmail reader connection.

## Local development and checks

Node 22.13+ and Python 3 are required. Use the pinned package manager:

```sh
cd cashier
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
pnpm test:integration
pnpm exec wrangler deploy --dry-run --env="" --outdir .wrangler/dry-run
pnpm dev
```

Open `http://127.0.0.1:8788`. The launcher creates a separate local database,
applies migrations, and watches UI builds. Reload after an interface edit.
The loopback-only development identity requires `CASHIER_ENV=local`; neither
staging nor production accepts it. Do not use a remote development tunnel.
Local import credentials are disposable test values, never real secrets.

The integration check creates and removes its own database. It exercises real
Worker/D1 requests for allocations, duplicates, receipt-format dry runs,
manual/email linking, confirmation, voiding, deletion, ETags, and auth failures.
Synthetic receipt tests do not establish that a genuine Venmo email format has
been verified. Run the Google dry-run check with a genuine receipt before
relying on automated import.

## Provision a separate staging app

1. Sign into the selected Cloudflare account and verify Workers Free. The
   official Wrangler connection needs account/user read, Workers write, and D1
   write permissions. No DNS/zone, route, Access, or billing permissions are
   required for the initial `workers.dev` test.
2. Create a separate D1 database named `tlpt-cashier-staging`. Record its actual
   ID. Never bind staging to production or a Sites-managed database.
3. Build, then deploy with the actual account and database IDs:

   ```sh
   CLOUDFLARE_ACCOUNT_ID=<actual-account-id>
   CASHIER_DATABASE_ID=<actual-staging-database-id>
   CASHIER_AUTH_MODE=password
   CASHIER_FREE_PLAN_CONFIRMED=1
   pnpm deploy:staging
   ```

   Export these variables in the shell or CI environment. The manual helper
   creates an ignored config and applies the database migrations. No password
   exists yet, so the deployed register stays closed.
4. Run `node scripts/set-password.mjs wrangler.deploy.local.json`. Open its
   loopback-only setup page on this computer and enter the new password yourself.
   Use 16–128 characters, preferably four unrelated words, and save it in a
   password manager. Never paste it into chat. The helper sends only a salted
   100,000-iteration PBKDF2-SHA256 verifier and a random 256-bit session key to
   Cloudflare's encrypted secrets through hidden stdin. It logs no credentials,
   writes none to disk, checks the form origin and CSRF token, and keeps the success page available until its 20-minute setup window ends. Re-running it rotates the password and invalidates existing sessions.
5. Run `node scripts/initialize-import.mjs wrangler.deploy.local.json` to create
   a distinct random 256-bit reader secret. This refuses to replace an existing
   import secret and logs no credential values. After owner sign-in, the reader
   setup page offers Copy buttons for the private Google Script Properties. It
   does not render the secret text; the API is owner-authenticated and no-store.
   Do not put credentials in source, URLs, issues, screenshots, or chat.
6. Test owner sign-in on the iPad, secure-cookie behavior, sign-out, anonymous
   and forged-cookie rejection, receipt dry runs, and unchanged payment totals.
   Login permits five attempts per source IP and thirty account-wide per
   fifteen-minute window. IP keys are keyed hashes, and stale limit records are
   removed. Hosting quotas remain shared across the account; excessive traffic
   can interrupt service rather than create a bill on Workers Free.

Password sign-in requires no Cloudflare Access enrollment or login exception for
`/api/import`. That endpoint independently requires its strong import secret.
All browser ledger routes independently validate the session. The password
setup helper must run separately for distinct staging and production Workers;
their secrets and databases must remain separate. Promoting the already-tested
Worker retains that Worker's own encrypted secrets while changing its database
binding to production; it does not copy credentials between Workers. Browser sessions last 12 hours and use a
`__Host-` cookie with Secure, HttpOnly, and SameSite=Strict. Logout clears that
browser's cookie; password rotation invalidates all prior sessions.

For an explicitly approved Access deployment instead, set
`CASHIER_AUTH_MODE=access`, `CF_ACCESS_TEAM_DOMAIN`, and `CF_ACCESS_AUD` after
setting up an owner-only Access application. Protect the hostname, with a
separate exact `/api/import` application bypassing only the Access login; the
Worker import secret remains required. Access JWT issuer, signature, audience,
expiration, and exact owner email are checked independently. Do not enable this
alternative under the current no-billing-authorization instruction.

Account plan verification, deployed sign-in, and a genuine receipt are external
checks. Passing local tests alone does not establish successful cloud operation
or that the live Google reader has been switched.

## Parallel Gmail check without changing the live target

`bridge/Code.gs` preserves the existing Sites destination when
`REGISTER_ORIGIN` is absent. Existing `IMPORT_TOKEN` and `SITES_ACCESS_TOKEN`
properties continue to work with that destination.

Only after staging is deployed, update the reader code and add private
`SHADOW_REGISTER_ORIGIN` and `SHADOW_IMPORT_TOKEN` properties for the new staging
app. Run `checkShadowConnection` and `verifyShadowReceiptFormat`. Keep the
existing primary properties. Optional secondary failures never block primary
acknowledgments or change which original messages are marked processed.

The existing minute timer remains one timer. Normal new batches can reach both
separate databases while testing. Historical messages already acknowledged by
the primary are not replayed automatically; the full snapshot below preserves
them at production cutover. The real reader is not changed by this repository
commit or its CI checks.

## Preserve the complete ledger at cutover

Use a new production D1 database, never staging's test database. A transaction
CSV is insufficient: audit history, source IDs, deleted-source suppression,
frozen allocations, and private name mappings must survive too.

1. Install `migration/sites-export-route.ts` temporarily at
   `app/api/migration-export/route.ts` in the existing owner-private Sites source
   using its normal source/deployment workflow. This GET route reads all seven
   original tables, requires the authenticated owner's email, exports no
   connection keys, and does not change the working UI or records.
2. For a browser-mediated backup, also install `migration/sites-backup-page.tsx`
   at `app/migration-backup/page.tsx` in the existing Sites app. Open that page
   through the owner's signed-in browser. Save the complete JSON text in
   `#ledger-snapshot` to ignored `private/sites-snapshot.json`, with directory
   permissions 0700 and file permissions 0600. This read-only page uses the same
   owner check as the API export and batches all seven table reads together.
   A Sites service bearer passes the private Site boundary but supplies no
   visitor identity; it cannot satisfy these owner-authenticated exports. Do not
   spoof identity headers or weaken that check to make a service export work.
3. Rehearse `node scripts/prepare-restore.mjs` and import its private SQL into an
   empty local database. Verify table counts, each event's totals, split amounts,
   aliases, linked manual/email records, voids, and deleted receipt suppression.
   Read back all seven tables after the remote restore and compare every field,
   including timestamps and source IDs, rather than totals alone.
4. After cloud staging tests pass, schedule a brief cashier pause: stop the
   reader timer, avoid manual entry, and take a **fresh final snapshot**. Preserve
   a backup and its totals. Keep the old app available as the rollback target.
5. Create the separate production D1 database; deploy the production target only
   with `CASHIER_STAGING_TESTED=1`. Configure new password/import secrets only for
   a new Worker; the promoted tested Worker retains its existing secrets. Do not
   arm its reader yet. Apply `private/restore.sql` with Wrangler to that new database.
   The restore refuses an existing ledger or an armed reader and validates table
   and column names before creating SQL. If an import fails, investigate the
   unused new database; do not resume from a partial ledger or overwrite the old
   app. Reconcile counts and totals before allowing any new payment entry.
6. Change Google's `REGISTER_ORIGIN` and `IMPORT_TOKEN` to the tested production
   target, remove staging shadow properties, run `checkConnection`, a genuine
   receipt dry run, and `startReceiptImport`. Replay is safe because original
   Gmail source IDs and deletion markers were preserved. Keep old credentials
   privately for rollback until acceptance, then retire unused credentials.
7. Change **only the destination** of root `cashier.html` to the accepted new
   origin. Update its fixed-destination hygiene check in the same commit and
   run TLPT's quality gates. The short URL stays the same; it continues to be
   unlisted. Its existing destination is intentionally unchanged in this PR.
8. Remove the temporary Sites export route and backup page; retain the old app as a read-only
   reference until the migration is accepted. Rollback after new payments have
   started requires reconciling those new records first; never switch between
   two diverged ledgers and assume totals match.

All original applied SQL migrations and Drizzle snapshots are copied unchanged.
Only new migrations add polling indexes, the revision counter, and login limits. No private
runtime state, credentials, production payment examples, or dependency folders
belong in this repository.

A rehearsal production copy may be prepared while the current reader stays live.
Before cutover, take a fresh snapshot and compare it with the copied ledger.
If ledger records or settings changed, restore the fresh snapshot into another
new, unused database and reconcile it before binding the production Worker.
The guarded restore intentionally refuses an occupied copy. Reader heartbeat
and schedule-fetch timestamps naturally advance while the original remains live.

## Approved promotion of the verified secondary connection

`promoteCloudflareReader` checks the exact tested Cloudflare destination before
moving the existing secondary origin/key into the primary Google Script
Properties. It keeps the previous origin/key privately in
`PREVIOUS_REGISTER_ORIGIN` and `PREVIOUS_IMPORT_TOKEN`, preserves
`SITES_ACCESS_TOKEN`, and removes the secondary properties. Credential values
never leave Google or appear in logs. The script lock prevents overlapping polls;
the existing one-minute trigger and processed receipt IDs stay unchanged.
A failed check changes no properties; a repeated successful promotion is safe.
After promotion, run `checkConnection` and `pollVenmoReceipts`, verify the current
mailbox check in the production register, and check that there is still one timer.
Use `verifyReceiptFormat` when the first genuine receipt arrives.


## Branded subdomain with DNS remaining at Porkbun

`cashier/domain-gateway/` is a minimal Cloudflare Pages advanced-mode gateway.
A Pages project named `tlpt-cashier-domain` binds `CASHIER` to the existing
`tlpt-cashier-staging` production Worker. Every request is forwarded intact,
including its custom origin, method, body, and cookies. The existing Worker
continues to enforce password sessions, same-origin writes, and import tokens;
the gateway has no database binding and stores no credentials or payment data.
A missing service binding returns 503 rather than a static app or public ledger.

This allows only the `cashier.tlpt.org` CNAME to be added at Porkbun, without
moving the domain's nameservers or its other DNS records. Associate the custom
hostname in the Pages dashboard before adding the CNAME shown there. TLS must
be active and the password/API behavior checked before the existing shortcut
is changed. Keep the workers.dev address and Google reader destination working.
The reader may continue using the original Worker address; both addresses use
the same production database. The same password works at the branded address,
but it requires its own host-bound browser session.

The automatic release updates this gateway only when its source or configuration
changes. For emergency recovery through the Cloudflare dashboard, upload a ZIP of
the three files in `domain-gateway/`, add the production service binding under
Settings > Bindings, and redeploy the gateway after a binding change. Do not add
payment methods or enroll in paid plans. `wrangler.gateway.jsonc` documents the
equivalent deployment configuration; the existing CLI OAuth was not expanded
for this dashboard setup. Gateway Functions share Workers Free limits with the
app. They add an invocation per forwarded request; exceeding free limits stops
service rather than enabling paid fallback.

References: [externally managed Pages subdomains](https://developers.cloudflare.com/pages/configuration/custom-domains/),
[service bindings](https://developers.cloudflare.com/pages/functions/bindings/#service-bindings),
[advanced-mode direct upload](https://developers.cloudflare.com/pages/get-started/direct-upload/#functions).

## Batch payments

Open **Batch payments**, **Batch check-in**, or **Needs confirmation → Review multiple**.
A batch belongs to the selected event. The round-checkbox player list opens with
each new manual group. Select several players (or **Select all shown**), then
tap **Add players together**. Switch between **Event RSVPs** and **All TLPT
players** without losing selections; players already in that group cannot be
added twice. Use **Select players** to reopen the list or **Add guest / one
player** for an individual entry. Each row has independent Buy-in (including
the event's bounty), Rebuy, Food and
Cash/Venmo selections. For five MTT entries and three food contributions, add five
players and select Food on only three rows. The individual records, category
filters, totals, avatars, RSVP status and event export use those same allocations.

Add open emails to that workspace and choose **Confirm as new payment** or
**Match recorded payments** per receipt. A receipt can cover multiple players;
separate emails can cover parts of one manual bundle. Matched amounts must equal
the receipt and cannot exceed the unmatched balance of any recorded payment.
Matching adds no money. Remember a payer name only for a single TLPT player,
never for a shared payment covering multiple players.

New entries, confirmations, matches, exclusions, voids and deletions can share one
batch. Review its totals and verify the payments, then save once. Deletions have
an additional permanent-delete acknowledgement and never send refunds. A changed
record or invalid allocation rejects the entire batch. Retrying the exact saved
request is idempotent, including concurrent taps; an uncertain submission is
retained in this browser tab's session storage for a safe retry after reload.
The confirmation sound plays once per successfully saved batch, including a
receipt-matching batch, using its request ID so duplicate acknowledgements do
not replay it. The iPad's sound-off setting still applies. Batches are limited to
30 groups and 80 player allocations/receipt matches per save.

The additive `0011_batch_payments.sql` migration preserves existing payments and
seeds coverage for older receipt links. It adds private retry summaries, temporary
transaction guards and receipt-to-payment allocations. Event replacement clears
its retry summaries and related links; changing RSVPs or prices retains them.
No Gmail reader changes, new secrets, paid resources or gateway publication are
required. Legacy Sites export/restore scripts describe the original seven-table
migration; they are not a complete backup of the new batch relations. Use D1's
native backups/Time Travel with reconciliation for production recovery.

## iPad Home Screen setup

Open <https://cashier.tlpt.org/install.html> in Safari on the iPad. Use
Share → Add to Home Screen, leave Open as Web App on if offered, and check the
yellow poker-chip preview before adding TLPT Cashier. Launch the new icon from
the Home Screen. Keep any previous shortcut until the new one is verified.
The dedicated public setup page uses fresh icon filenames to avoid reusing a
cached fallback icon. Login and register pages use the same artwork and manifest.

The manifest retains the app ID, scope and protected start URL `/`. If an older
iPad instead launches the saved setup URL, its standalone-only launch script
navigates to `/` within that app window. Browser visitors stay on the instructions.
In the installed app, screen controls show “App window” instead of a fullscreen
toggle. The app still uses the existing password, live database and Gmail reader;
this is not an offline copy. No new secrets, database migrations or paid resources.

The local Worker integration checks that installation assets are anonymously
available with correct content types and PNG sizes while private APIs remain
protected. Confirm the Home Screen icon and standalone window on the physical
iPad after installation; desktop automation cannot verify the iPad launcher UI.

## Embedded-icon Web Clip installer

If Safari's Home Screen installation still chooses a fallback letter, open
<https://cashier.tlpt.org/webclip.html> in Safari on the iPad. Download
`TLPT-Cashier.mobileconfig`, then install it yourself from Settings → Profile
Downloaded within eight minutes. Settings may instead list it under General →
VPN & Device Management. Review that it contains only one Web Clip for
`https://cashier.tlpt.org/`. It is an unsigned, manually installed profile; no
signing certificate or device-management enrollment is included or needed.

The profile embeds the existing opaque 180×180 poker-chip PNG, sets FullScreen
and Precomposed true, and leaves IsRemovable true and IgnoreManifestScope false.
The only payload is `com.apple.webClip.managed`; there are no certificates,
VPN/network settings, restrictions, credentials, payment data, or MDM payloads.
Stable profile and payload identifiers permit a future deliberate replacement.
The `_headers` rule applies only to this file and sets the Apple profile MIME
type, attachment filename, no-store caching and nosniff. The production Worker,
database, password/session/import secrets and gateway do not change.

Keep the working Home Screen entry until the new icon/window is verified on
the actual iPad. To undo, remove the TLPT Cashier profile in Settings → General
→ VPN & Device Management. Only its Home Screen entry is removed; server-side
payment data remains. Unit tests parse the plist and allowlist every key;
Worker integration checks the exact bytes and download headers. Installation
and the iPad launcher icon still need a physical-device acceptance check.

## Venmo receipt formats and reader maintenance

The reader supports both authenticated incoming subjects observed on October 17:
`Player paid you $30.00` and `Player paid $30.00 to your Venmo account. Leave it
in Venmo or transfer it to your bank account.` Gmail discovery uses an OR of
those subject phrases. Sender validation and Google's passing Venmo DKIM result
are still required; outgoing payments, reloads/transfers, requests and promotional
emails are not receipts. Both subjects use the same immutable Gmail message ID,
existing duplicate/deletion guards, and review-before-confirmation process.

When MIME text/plain is empty, the bridge converts text/html to plain text,
stripping markup, scripts/styles and decoding common/numeric entities. This
retains recognized TLPT notes instead of discarding them. An actual nonempty
plain-text part takes priority. No email HTML is executed or displayed as markup.

A reader-source release has two publication steps: first merge/pass/publish the
Worker parser; then update the existing Apps Script project's Code.gs to the
exact tested bridge/Code.gs. Keep appsscript.json, Script Properties, credentials,
processed IDs and the existing one-minute trigger unchanged. Do not run
startReceiptImport or promoteCloudflareReader for a parser/search correction.
Use verifyReceiptFormat for a recent-message diagnostic only: it includes Trash
for read-only format inspection but creates no payment records. Normal polling
continues to exclude Spam/Trash. Live batch logs give counts/rejection reasons
without names, amounts, subjects or credentials. Rejected messages are not marked
processed; only server-acknowledged IDs are.

Recovery of a previous game's missed messages is a separate reconciliation task.
Do not blindly replay messages into a newly selected event, untrash emails, clear
processed IDs, or reconstruct a replaced event's ledger. A date replacement may
already have cleared the old ledger under the owner's configured retention rule.
