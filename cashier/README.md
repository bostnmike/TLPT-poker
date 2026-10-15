# TLPT Cashier — Cloudflare migration

The cashier's interface, payment rules, database migrations, Gmail reader, and
tests now live with TLPT. This is a parallel migration: **the working Sites app,
Google reader configuration, and `https://tlpt.org/cashier.html` remain the live
system until Cloudflare staging is verified and the records are reconciled.**

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
   writes none to disk, checks the form origin and CSRF token, and closes after
   success. Re-running it rotates the password and invalidates existing sessions.
5. Generate a distinct random import token with at least 32 characters and set
   it through `wrangler secret put IMPORT_TOKEN --config
   wrangler.deploy.local.json`. Do not reuse the Sites access credential. Never
   place the new token in source, URLs, issues, screenshots, or chat.
6. Test owner sign-in on the iPad, secure-cookie behavior, sign-out, anonymous
   and forged-cookie rejection, receipt dry runs, and unchanged payment totals.
   Login permits five attempts per source IP and thirty account-wide per
   fifteen-minute window. IP keys are keyed hashes, and stale limit records are
   removed. Hosting quotas remain shared across the account; excessive traffic
   can interrupt service rather than create a bill on Workers Free.

Password sign-in requires no Cloudflare Access enrollment or login exception for
`/api/import`. That endpoint independently requires its strong import secret.
All browser ledger routes independently validate the session. The password
setup helper must run separately for staging and production; their secrets and
databases must remain separate. Browser sessions last 12 hours and use a
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
2. Take a read-only rehearsal snapshot with `scripts/fetch-sites-snapshot.mjs`.
   Its input is `{origin,token}` through hidden stdin; never place the bearer
   credential in a file or shell argument. The output goes to ignored,
   owner-readable `private/sites-snapshot.json`.
3. Rehearse `node scripts/prepare-restore.mjs` and import its private SQL into an
   empty local database. Verify table counts, each event's totals, split amounts,
   aliases, linked manual/email records, voids, and deleted receipt suppression.
4. After cloud staging tests pass, schedule a brief cashier pause: stop the
   reader timer, avoid manual entry, and take a **fresh final snapshot**. Preserve
   a backup and its totals. Keep the old app available as the rollback target.
5. Create the separate production D1 database; deploy the production target only
   with `CASHIER_STAGING_TESTED=1`. Set a new production import secret. Do not arm
   its reader yet. Apply `private/restore.sql` with Wrangler to that new database.
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
8. Remove the temporary Sites export route and retain the old app as a read-only
   reference until the migration is accepted. Rollback after new payments have
   started requires reconciling those new records first; never switch between
   two diverged ledgers and assume totals match.

All original applied SQL migrations and Drizzle snapshots are copied unchanged.
Only new migrations add polling indexes, the revision counter, and login limits. No private
runtime state, credentials, production payment examples, or dependency folders
belong in this repository.
