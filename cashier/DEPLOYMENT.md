# Cashier publication and recovery

[![Cashier checks and production release](https://github.com/bostnmike/TLPT-poker/actions/workflows/cashier-checks.yml/badge.svg?branch=main)](https://github.com/bostnmike/TLPT-poker/actions/workflows/cashier-checks.yml)

## Normal delivery

A requested Cashier change includes publication. Open a PR, pass its checks,
merge to `main`, then follow **TLPT Cashier Quality Gate → Publish and verify
production** to completion. A green test job alone is not a completed release.
PR and feature-branch runs never receive deployment secrets and never publish.
A manual workflow run on `main` provides a tested recovery/retry path.

The test job runs TypeScript, unit tests, a production UI build, actual disposable
Worker/D1 integration, and staging plus production deployment dry runs. It stamps
the interface artifact with the checked commit. The production job downloads
that exact artifact. It does not change the account plan or buy resources.

Production is pinned in `wrangler.production.jsonc`:

- Account: `4d5ea071300fa71b8fa947c06d8ba314`.
- Existing Worker: `tlpt-cashier-staging` (historical name, production environment).
- Existing D1: `tlpt-cashier`, `9165ae68-16fa-4ce2-9b87-77019e52ef20`.
- Pages gateway: `tlpt-cashier-domain`, binding `CASHIER` to that Worker.
- Branded URL: <https://cashier.tlpt.org/>.
- Unlisted shortcut: <https://tlpt.org/cashier.html>.

Staging remains `tlpt-cashier-test` with its separate database/configuration.
Never substitute the staging database or deploy the staging configuration to
production. No registration, Lily, Marchand, DNS or billing files are involved.

Before publishing, the release validates the live database binding and the
presence (names only) of `CASHIER_PASSWORD_HASH`, `SESSION_SECRET` and
`IMPORT_TOKEN`. It retains these encrypted secrets and existing variables;
ordinary releases never put/delete secrets, rotate passwords/session keys,
change the Google reader, initialize an import token, or replace a database.
Existing signed-in iPads remain valid until their normal session expiry.

Production uses `wrangler versions upload` followed by the single-Worker
deployments API to activate exactly that version at 100% traffic. This avoids
`wrangler deploy` changing triggers or reading the account-wide workers.dev
subdomain. Existing workers.dev/Gmail addresses and Pages/DNS connections remain
untouched; the Worker token needs no account-wide Worker or subdomain access.

The production job is serialized and rejects an obsolete Cashier checkout if a
newer Cashier change is already on main. Non-Cashier generated-data commits do
not prevent publishing the tested Cashier. Worker changes are compared against
the live revision so a failed release is not silently forgotten by the next run.

Gateway deployment is conditional on its source fingerprint: only
`cashier/domain-gateway/**` and `cashier/wrangler.gateway.jsonc` contribute.
An app-only change does not upload Pages. The gateway adds a nonsecret source
fingerprint response header; a changed binding/configuration contributes to the
fingerprint too. The initial rollout adds this marker. It must retain the existing
main production branch and `fail_open: false`; missing or unexpected settings
stop publishing. Workers Free quotas stop service rather than enabling paid
fallback. Do not enable paid plans, Access enrollment, paid logs or add-ons.

## One-time credentials

Use **account-owned API tokens**, not a Global API key or a developer's personal
Wrangler OAuth session. Create three separate tokens and store them as encrypted
**environment secrets** in this repository's `cashier-production` GitHub
Actions environment. Restrict that environment's deployment branch to `main`.
No required-reviewer gate is needed for the requested automatic publishing.
The workflow also explicitly accepts only this repository and trusted push or
manual events on main. Its GitHub token has only `contents: read`.

| Environment secret | Cloudflare permission | Resource scope |
| --- | --- | --- |
| `CF_CASHIER_WORKER_TOKEN` | Individual Workers **Editor** | Only existing `tlpt-cashier-staging` |
| `CF_CASHIER_DATABASE_TOKEN` | D1 **Edit** | This Cloudflare account; commands pin the existing production D1 ID |
| `CF_CASHIER_GATEWAY_TOKEN` | Pages **Write** | This Cloudflare account; commands pin `tlpt-cashier-domain` |

The account token UI does not offer individual D1/Pages resources. Their tokens
are therefore account-scoped for that product only; they cannot manage Workers,
DNS, zones, billing, members, Access, or other products. Keep these tokens
separate; only the step using each product receives its token. Never save their
values in this document, source, screenshots, workflow output, or artifacts.
Do not copy the runtime cashier password, session secret or Gmail import token
into GitHub. No cashier password is needed for automated public verification.

Set a one-year expiry and record the expiration in the private operational
record. Before expiry, create an equivalent token, replace that environment
secret and revoke the old token after a successful release. A missing, expired
or insufficiently scoped token fails visibly; never silently fall back to a
personal login. GitHub's normal failed-workflow notifications apply.

## What a release verifies

`GET /api/version` exposes only app name, Git commit and the actual Cloudflare
Worker version ID. It does not query D1 or reveal owner or credential data.
`/release.json` identifies the tested interface artifact. After propagation, both
must match the expected commit at the branded URL. The gateway fingerprint must
match its source, and the root must show the password form to anonymous visitors.
The shortcut page must still target `https://cashier.tlpt.org/`.
When this run uploaded a Worker, verification also waits for that exact version
ID from its receipt. A same-commit retry cannot pass against the previous
deployment while the newly activated version is still propagating.

Anonymous GETs for register, players, health and reader settings, anonymous
register/import POSTs (including batch submissions), and spoofed identity headers must all return 401 with
only an error and `private, no-store`. No real payments are created by these
checks. A denial failure is immediate; it is never treated as a harmless
propagation delay. Version/asset propagation is retried for up to three minutes,
then fails the release. The Actions job, environment deployment, summary and
uploaded `cashier-production-receipt` show success or failure. The receipt lists
previous/new deployment IDs and verification results; it contains no ledger
rows, credentials or browser sessions. Tests/build artifacts expire after seven
days, receipts after 30 days.

## Recovery

1. Open the failed workflow's **Publish and verify production** job. Read the
   first failing step and its summary; download its deployment receipt.
2. Fix missing/expired environment secrets or the failing code/configuration.
   Re-run the failed job or run the workflow manually **on main**. Both keep
   quality checks and live verification. A superseded checkout is intentionally
   rejected; run the newest main version instead.
3. If Worker upload failed, its previous version generally remains active.
   Migrations may already have succeeded: do not blindly rerun or reverse SQL.
   D1 records applied migrations and re-runs skip them. All future migrations
   must be backward compatible with the previously deployed Worker.
4. If verification failed after publishing, treat the release as failed even
   if the site loads. Investigate whether the expected revision, gateway,
   shortcut or access protections failed; restore service before declaring it live.
5. An authenticated owner can also verify that existing sessions, event tabs,
   saved payments and the mailbox heartbeat still work. Never paste a session or
   password into Actions. A genuine receipt format check remains a separate
   acceptance test when the first real receipt arrives.

## Rollback

Prefer reverting the offending Cashier commit in GitHub and merging the revert:
the same checks then publish and verify the corrected main branch automatically.
Pause this workflow in GitHub before an emergency dashboard rollback so an
in-flight release does not overwrite it. Re-enable it after the main source
matches the intended production state.

For urgent Worker rollback, use Cloudflare's existing Worker's Deployments view
or `wrangler rollback <previous-version-id> --config wrangler.production.jsonc`.
The receipt's `previousWorkerDeployment.versions` contains the previous version
ID. Keep the same production D1 binding and all existing secret values; verify
`/api/version`, the private endpoint denials, the shortcut, and an existing
owner session afterward. The rollback command restores Worker code/assets; it
**does not undo database migrations**. Never rotate secrets just to roll back.

For gateway-only recovery, restore the previous successful production deployment
in the `tlpt-cashier-domain` Pages dashboard (receipt:
`previousGatewayDeployment`). Keep `CASHIER` bound to the existing Worker and
fail closed. Revert the corresponding gateway files/configuration on main so
its next release agrees with the intended gateway source fingerprint.

For a database incident, stop new cashier/reader writes with the owner's
coordination and take a fresh backup. Use D1's available Time Travel or a known
backup only after reconciling payments received since that point. **Never restore
or replace D1 automatically as a code rollback:** it could erase real receipts.
The previous Sites app is only a historical fallback; its ledger is no longer a
current mirror after new production payments arrive. Do not redirect the Gmail
reader or duplicate live receipts as part of an ordinary rollback.

References: [Cloudflare GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/),
[scoped Worker roles](https://developers.cloudflare.com/workers/authorization/workers/),
[Worker rollback](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/).

## Batch schema and rollback

Migration `0011_batch_payments.sql` is additive and does not rewrite existing
payment allocations. It records many-to-many receipt coverage and batch retry
identities. Ordinary releases keep the existing D1 database and all runtime
credentials. The new batch regression suite and actual Worker/D1 integration
must pass before publication; do not test by creating disposable production sales.

After shared/partial receipt matches exist, use a batch-aware release when
rolling back. Earlier Cashier versions can display the individual accounting
rows but do not enforce the new receipt-coverage rules. Avoid entering or matching
payments through an older version. Leave the new tables intact and fix forward;
never drop receipt links, reverse the migration or restore the old seven-table
migration snapshot over the live ledger. A database restore requires the owner's
coordination and reconciliation of all receipts received since the restore point.
