# Optional rebuy bounties: intake and accounting

This is an **opt-in, event-specific** pipeline mode. Existing no-bounty and
first-entry-only events keep their existing parser and financial results.
Never enable it globally or retroactively infer entry choices from receipts.

## Required intake

1. The original Tournament Director HTML summary in `data/raw/events/`.
2. Its paired, detailed text history in that same directory. The history must
   include every entry and knockout, plus the tournament start/end and winner.
   The summary and history must agree on timestamps, participants and actions.
3. An event-specific entry in `data/event-financials.json`, keyed by event date.
   Supply **regular prizes before all bounty money**. Exact prizes by player
   are preferred; include every entrant, with zero for noncashers. Use metadata
   slugs (for example, Bob is `rob-f`), not display names.

Example schema only — these practice amounts MUST NOT be added as a real event:

```json
{
  "entryAmount": 30,
  "detailedHistoryFile": "Event History YYYY-MM-DD.txt",
  "regularPayoutsByPlayer": {
    "alex-c": 195,
    "ai-dave": 117,
    "ahmed": 78,
    "rob-f": 0
  },
  "bounty": {
    "mode": "optional-rebuy",
    "amount": 5,
    "retainIfUnbusted": true,
    "winnerOnlyRollover": true
  }
}
```

Alternatively replace `regularPayoutsByPlayer` with
`regularPayoutPercentages`, e.g. `{"1":50,"2":30,"3":20}`. Percentages are
never assumed, especially for a two-table event. They must total 100. If a
percentage produces fractional cents, supply `centRemainderRank` explicitly:
each share is floored to cents and all remaining cents go to that configured
paid rank. Without that choice the import fails. Exact prizes must already be
in cents and sum to the regular entry pool. No whole-dollar or $5 rounding is
applied. Historical results are not recalculated under this forward policy.

For an unchopped MTT, `regularPayoutFixed: {"6":40}` reserves sixth place
before `regularPayoutPercentages: {"1":38,"2":24,"3":16,"4":12,"5":10}`
divides the remaining regular pool. Fixed and percentage ranks must not overlap.
At $1,040 this produces $380/$240/$160/$120/$100/$40. Bounty receipts and
winner-only forfeitures are excluded from that percentage calculation. The
event configuration requires its detailed history alongside the HTML.
No fractional-cent or chop allocation has been invented: supply an explicit
cent-remainder choice if needed, and obtain unanimous agreement plus host
confirmation for any chop. Ambiguous optional-bounty chops still fail closed.

Do not combine optional-mode regular prizes with the legacy
`tournamentPayouts` or `tournamentPayoutsByPlayer` fields. Existing historical
chops keep using those fields unchanged. An unchopped optional-bounty export must
identify one actual winner and one surviving entry; tied/chopped exports fail
closed unless the explicit `chopFinalists` match the history and summary, exact
regular prizes are supplied, and `rolloverRecipient` identifies a surviving
finalist. Every unbusted finalist retains their eligible bounty. The pipeline
never decides who gets the winner-only bonus by alphabetical order or payout size.

## Per-entry rules

- Initial entry must have the configured bounty. Each rebuy independently
  posts that bounty or opts out. `Bounty Chip: $5.00` is explicit opt-in;
  its omission on a rebuy in this export format is opt-out.
- A new entry requires the prior entry to have busted. Both knockout players
  must be active. Unknown players, unsupported actions, shared/ambiguous killers,
  nonzero rake, mismatched files and missing choices/configuration stop intake.
- A host-confirmed live-stack reload is separately configured in `reloads` with
  player slug and exact ISO timestamp. It counts as a purchase/rebuy but preserves
  the active entry's ordinal and bounty eligibility; it never creates a knockout.
  Unconfirmed active-player purchases still fail. Reloads cannot post another bounty.
- Known TD entry undo operations cancel only the matching latest purchase with
  identical money and no subsequent participant activity. Unknown undo targets
  fail. Seating and known clock controls are ignored; unknown actions still fail.
  Same-timestamp entry ordering may differ between exports, but every financial
  action and its participant/timestamp must still match, including multiplicity.
- A bounty-bearing victim pays the currently eligible killer. If the killer's
  current entry opted out, the victim's bounty becomes **winner-only prize money**.
- Opting back in works prospectively, never retroactively. An opted-out winner
  still gets the rollover, but cannot retain a personal bounty they did not post.
- Every knockout remains a normal hit. A bounty-only receipt does not create a cash.

## Money and output contracts

`summary.regularPrizePool` is the entry-fee pool. `summary.totalPot` is regular
prizes plus winner rollover. `summary.bounty.pool` includes every posted bounty;
its `collected`, `retained` and `rollover` fields are disjoint and sum to that pool.
The export's **Kept** amount is personal retention PLUS rollover, not all retention.

Player `regularPrize` and `rolloverPrize` remain distinct. `tournamentWinnings`
includes both; `bountyCollected` excludes the rollover. `bountyWinnings` is
collected plus retained. Overall `totalWinnings`, `totalCost`, profit and ROI
include both tournament and bounty money, plus confirmed settlement adjustments.
The bounty ledger alone is negative by the rollover; tournament profit is positive
by the same amount. Combined profit is zero-sum except for explicit host-confirmed
settlement adjustments. Never force each ledger to zero.

Original combined payout actions remain intact for evidence.
`bountyAccounting.reconciliation` records each original receipt, regular prize,
exported rollover allocation, corrected winner bonus, corrected receipt and
adjustment. Existing money is reallocated, not added again. All adjustments sum
to zero unless actual cash paid differs from the source total. A non-prize payment
requires `settlementAdjustmentsByPlayer` (amount and reason) and matching
`actualReceiptsByPlayer`. It remains separate from every bounty and prize field.
`sourceRolloverAllocationsByPlayer` explicitly identifies any export that assigned
forfeiture money to a noncasher. Neither field invents another bounty claim.
When `allowOmittedZeroReceipts` is explicitly true, a missing receipt is accepted
only if that entrant has zero verified earnings; the original actions stay intact.
`bountyAccounting` also fingerprints the history file and lists every
knockout with killer/victim entry ordinals and disposition. The public knockout
archive carries those ordinals so repeated claims involving the same pair are
not collapsed into one. Only collected claims appear in Bounty Hunters.

## October 24, 2026 confirmed production intake

The original HTML is preserved byte-for-byte. `Event History 2026-10-24.txt` is
the ordered, plain-text extraction of 176 paragraphs from the supplied Word
history; the user's original document is unchanged. The paired import applies
21 explicit TD undos. Kishan's registration was undone, so he did not play.

Host confirmations: Hiro at 14:51:20 and ProvidenceMike at 17:37:24 were reloads;
Liam O and ProvidenceMike chopped first; ProvidenceMike received the $10 forfeiture
in addition to the exported $480 (actual $490); Wild Bill actually received $20.
The regular prize ledger is Liam $370, ProvidenceMike $470, Li-Fo $220, Hiro $165,
Ahmed $135, Nasa Al $40. These total the $1,400 entry pool.

There were 17 entrants, 18 rebuys/reloads, 31 knockouts, and 30 purchased bounties:
27 collected ($270), two legitimately retained ($20), and one forfeited ($10).
The forfeiture is Wild Bill's bounty, after his elimination by opted-out A.I. Dave.
It is assigned to ProvidenceMike, never counted as Dave's bounty win or Bill's
retained bounty. Bill earned one $10 bounty; his other $10 is a confirmed
settlement adjustment, not a cash or a second bounty. Actual payments total
$1,710 against $1,700 collected. Funding for that extra $10 is unconfirmed;
the pipeline does not invent a house contribution or alter confirmed payments.

The event-specific regressions replay both originals, require each confirmation,
reject malformed undos and unknown activity, and independently detect accidental
reclassification of the settlement as a bounty or tournament prize. The public
player profile and Form Lab show nonzero settlement adjustments separately.

## Regression evidence and publishing

Fixtures live exclusively under `scripts/fixtures/optional-bounties/`.
`authentic-test2` preserves the original `test 2.html` and `test 2.txt` byte for
byte, with their SHA-256 manifest and original reference expectations. It is a
practice tournament, not a league event. The unrounded 50/30/20 policy is an
explicit regression configuration, not evidence of the application's historical
rounding setting. Its corrected receipts are Alex $215, Dave $127, Ahmed $93,
Bob $5; $440 in and out, including a $10 winner-only rollover.

`winner-opted-out` is earlier reconstructed supplemental case 03, not an authentic
export. The test adapts its HTML wrappers and synthetic Kept convention in a
temporary directory, retaining its entry choices, actions and receipt values.
The tests also mutate the authentic pair for rejected inputs and cent allocation.

`historical-financials.json` locks the 55 existing events' complete player rows,
winners and financial summaries as of upstream `e531696e` (October 18, 2026).
Only an explicitly authorized historical correction should update that baseline.
The production parser, independent raw-entry audit, generated career/form outputs,
ROI validation and repeated-entry knockout archive are exercised in isolated
temporary directories; no practice event is ingested into production directories.

Run the authoritative runners, not a separate publication path:

```sh
bash scripts/run-data-build.sh
bash scripts/run-quality-gates.sh
```

The new production regressions are required by the maintenance baseline and both
existing CI workflows. Only after all gates pass should the maintenance changes
be pushed. Do not publish fixture events into league history.
