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

Do not combine optional-mode regular prizes with the legacy
`tournamentPayouts` or `tournamentPayoutsByPlayer` fields. Existing historical
chops keep using those fields unchanged. An optional-bounty export must identify
one actual winner and one surviving entry; tied/chopped optional exports fail
closed until their winner/terminal-history ambiguity is resolved. The pipeline
never decides who gets the winner-only bonus by alphabetical order or payout size.

## Per-entry rules

- Initial entry must have the configured bounty. Each rebuy independently
  posts that bounty or opts out. `Bounty Chip: $5.00` is explicit opt-in;
  its omission on a rebuy in this export format is opt-out.
- A new entry requires the prior entry to have busted. Both knockout players
  must be active. Unknown players, unsupported actions, shared/ambiguous killers,
  nonzero rake, mismatched files and missing choices/configuration stop intake.
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
include both tournament and bounty money, preserving the current site contract.
The bounty ledger alone is negative by the rollover; tournament profit is positive
by the same amount. Combined profit is zero-sum. Never force each ledger to zero.

Original combined payout actions remain intact for evidence.
`bountyAccounting.reconciliation` records each original receipt, regular prize,
exported rollover allocation, corrected winner bonus, corrected receipt and
adjustment. Existing money is reallocated, not added again. All adjustments sum
to zero. `bountyAccounting` also fingerprints the history file and lists every
knockout with killer/victim entry ordinals and disposition. The public knockout
archive carries those ordinals so repeated claims involving the same pair are
not collapsed into one. Only collected claims appear in Bounty Hunters.

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
