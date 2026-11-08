# Commish → Cashier close-out protocol, version 1

This is the final shared contract. No `actionId`, `counts` or `canonical` aliases.
Only an explicitly configured same-account Cloudflare service binding can call
the named `EventCloseout` export. It has no public fetch endpoint or new secret.
Production binding: `CASHIER_CLOSEOUT`, service `tlpt-cashier-staging`, entrypoint
`EventCloseout`. `cashier/closeout-worker.ts` is the standalone entrypoint; its
dependencies use only Cloudflare builtins and local JavaScript modules.

Both methods take the following object. Preview permits false/absent checkboxes.
Close requires all three checkboxes to be exactly true.

```json
{
  "protocol": 1,
  "eventId": "saturday:2026-11-07",
  "rsvpEventId": "the-stable-rsvp-id",
  "title": "Full Metal Stack-It | 9-Max",
  "confirmationDate": "2026-11-07",
  "payoutsConfirmed": false,
  "receiptsReviewed": false,
  "resultsConfirmed": false
}
```

`preview(args)` returns:

```json
{
  "ok": true,
  "protocol": 1,
  "eventId": "saturday:2026-11-07",
  "rsvpEventId": "the-stable-rsvp-id",
  "confirmationDate": "2026-11-07",
  "alreadyClosed": false,
  "alreadyCleared": false,
  "historyRevision": 123,
  "records": 8,
  "review": 1,
  "evidence": {
    "revision": "40-character-canonical-Git-commit",
    "date": "2026-11-07",
    "title": "Full Metal Stack-It | 9-Max",
    "sourceFile": "Event Report 2026-11-07.html",
    "rawSha256": "64-character-SHA256",
    "parsedSha256": "64-character-SHA256",
    "completedAt": "2026-11-08T04:04:25.000Z"
  }
}
```

`records` and `review` are nonnegative integers, not row arrays. They cover rows
assigned to this event and unassigned receipts whose sole candidate is this event.
Shared ambiguous receipts remain for other events with this event removed from
their candidates. Evidence is fetched independently by Cashier from one pinned
canonical main commit: raw report, parsed result, generated event history and
passing validation/integrity reports. The published parsed file must match.
Date/title/source report must match (ignoring only a trailing 9-Max/18-Max table-capacity decoration) and the parsed finish time must be in the
past. Future or undated games fail; a finished game may close before the legacy
next-morning 6 a.m. receipt cutoff after explicit payout/receipt confirmation.

If already completed, preview returns the identity fields, `ok:true`,
`alreadyClosed:true` and the stable `receipt` below. It does not fetch results.

`close(args)` additionally requires:

```json
{
  "requestId": "a-UUID-generated-and-durably-saved-by-Commish",
  "expectedRevision": 123,
  "expectedResultsRevision": "the-preview-evidence-revision"
}
```

Commish must first authenticate its admin and enforce same origin, then atomically
freeze the exact event/date/title/state revision, persist requestId and all
confirmations, and stop new RSVP/coffee/metadata changes. The public event must
be absent or `rsvpOpen:false` before calling close. Cashier rechecks evidence,
revision, confirmations and public closed state, then clears one ledger and
creates its permanent anti-replay marker and minimal close-out receipt in one D1
transaction. Even zero-payment events receive the marker.

Production reads that same anonymous public GET through `CASHIER_RSVP`, a service
binding to the existing `tlpt-rsvp` default fetch handler. This avoids depending
on a public HTTP callback from RSVP → Cashier → RSVP. The helper accepts only the
exact public-feed URL and GET, and creates a new request without cookies or keys.
No private RSVP endpoint or arbitrary method/path is forwarded. Local/staging
fixtures without the binding may use the existing public transport. External
proof failures identify only the resource category and HTTP status, never the
response body. Latest-main canonical revision/raw/parsed/PASS/hash guards remain.

Success from `close(args)`:

```json
{
  "ok": true,
  "alreadyClosed": false,
  "receipt": {
    "protocol": 1,
    "eventId": "saturday:2026-11-07",
    "rsvpEventId": "the-stable-rsvp-id",
    "requestId": "the-saved-UUID",
    "closed": true,
    "receiptId": "the-saved-UUID",
    "closedAt": "UTC-ISO-timestamp",
    "resultsRevision": "the-verified-Git-commit"
  }
}
```

The same requestId retries return that identical receipt with `alreadyClosed:true`,
even if canonical main has advanced or the original response was lost. Another
requestId or RSVP identity for an already closed event fails. Commish must match
protocol, eventId, rsvpEventId, requestId and closed before permanently removing
the RSVP event; persist only its minimal completion receipt. A failure leaves
Commish pending/closed and visibly resumable, never reported as complete. A stale
preview requires renewed review. Do not unfreeze an event after Cashier cleared it.

All expected failures return `{ok:false,protocol:1,code,error}`. Codes include
`protocol`, `identity`, `not-finished`, `confirmation`, `results-unavailable`,
`results-mismatch`, `results-unverified`, `results-unpublished`, `results-changed`,
`ledger-changed`, `schedule-unavailable`, `event-open`, `action-conflict`,
and `unavailable`. Unexpected errors never disclose SQL or credentials.

Deploy Cashier first; only then publish RSVP's binding and flow. Test with actual
disposable Worker/D1 service bindings plus synthetic result URLs; never invent
production events or automatically close anything on deploy. Mike authorized
one real close-out for November 7 after both releases and joint verification.
