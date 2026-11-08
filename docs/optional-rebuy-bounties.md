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

## Host-confirmed incomplete bounty exports

Never infer missing bounty purchases from fee profiles, configured defaults or
payout gaps. When the host confirms that a specific export omitted actual
initial bounty charges, `sourceCorrections` records the reason, SHA-256 of both
originals, every affected initial entry by slug and exact ISO timestamp, its
reported zero and confirmed charge, the complete reported bounty aggregates,
and each original receipt. It requires exact regular prizes and confirmed
`actualReceiptsByPlayer` for **every entrant**, including zero receipts. The
existing omitted-zero-receipt flag remains mandatory when the export lacks them.

This narrowly supported correction handles omitted **initial** charges only;
it does not authorize arbitrary purchase changes, unknown actions, live reloads,
forfeiture reallocation, or settlement adjustments. Any changed source hash,
unmatched entry, missing confirmation or actual-payout mismatch fails intake.
The corrected entry keeps `sourceBountyPosted` and `bountyCorrectionReason`;
the original combined receipt actions and both raw files remain untouched.
The reconciliation separately shows reported bounty returns, verified bounty
winnings, the corrected receipt and its difference. A purchase/receipt export
error is not a house contribution or a settlement payment. The independent
source audit checks the evidence, annotations, ledger and confirmed receipts.

With a chop, `rolloverRecipient` is required only if an eligible victim's bounty
was actually forfeited. No recipient or extra award is invented when rollover
is zero. Every surviving eligible finalist still retains their own bounty.

## November 7, 2026 confirmed production intake

**Full Metal Stack-It | 9-Max** was a single-table 500K event. There were seven
players and two rebuys, both by Phattedcalf: nine purchases at $30 regular entry
plus $10 bounty each. The Commish confirmed that the game became a bounty game
and no one opted out. He also confirmed the final take-home amounts below.
The regular pool is $270; the $90 bounty pool splits into seven collected claims
($70) and two retained personal bounties ($20). There are no forfeitures,
settlement adjustments or unexplained funds. Total collected and paid: $360.

| Player | Regular prize | Bounty wins | Own bounty retained | Take-home | Cost | Net | Hits |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Cougar | $118.54 | $50 | $10 | $178.54 | $40 | +$138.54 | 5 |
| Nasa Al | $97.46 | $10 | $10 | $117.46 | $40 | +$77.46 | 1 |
| Phattedcalf | $54 | $10 | $0 | $64 | $120 | -$56 | 1 |
| BostnMike | $0 | $0 | $0 | $0 | $40 | -$40 | 0 |
| Ahmed | $0 | $0 | $0 | $0 | $40 | -$40 | 0 |
| ProvidenceMike | $0 | $0 | $0 | $0 | $40 | -$40 | 0 |
| Hiro | $0 | $0 | $0 | $0 | $40 | -$40 | 0 |

Cougar and Nasa Al chopped first. Phattedcalf finished third; BostnMike fourth
and on the bubble; Ahmed fifth; ProvidenceMike sixth; Hiro seventh and first
permanently out. Phattedcalf's earlier two eliminations followed by rebuys are
real hits and bounty claims. The two uncredited terminal summary eliminations
at the chop are artifacts and are excluded. Play ran 19:13:17–23:04:25 Eastern
on November 7 (3h 51m 08s). Initial registrations were recorded November 5;
preserve those timestamps instead of changing the event date or inventing play.

The source summary reports only $20 bought, $0 won, $20 kept and receipts of
$118.54/$97.46/$74 for Cougar/Nasa Al/Phattedcalf. The detailed history omits
all seven initial bounty charges but records both $10 rebuy charges. Preserve
these originals. The configured correction restores the seven confirmed charges
and derives all claims from the actual elimination sequence. Phattedcalf's
reported $20 "kept" is not personal retention: all three of his entries busted.
His correct bounty return is the $10 won by eliminating Ahmed.

Source provenance:

- HTML SHA-256: `a71ace0f0b005787ac6e890002fdc0bdd7b5797197124d11accff1e9f0ded2a8`.
- History TXT SHA-256: `90325f237d8314d516914c6805085327a6b2b1d68c6dadd646d1c4eda4f1f604`.
- The TXT is the complete ordered extraction of 52 paragraphs from the user's
  `11-07-26Full event history.docx` (SHA-256
  `cfcbd83c5011f2b8aa5f96a88447db6b0945b4c6128e61d64ff472c95165a7b7`).
  The original Word file remains unchanged in the supplied zip; it was not
  copied into raw storage. The original `.tdt` save remains in that zip too.
  Its 52 history actions agree, with only same-timestamp seating/start controls
  ordered differently; all purchase and knockout sequences match.

Production regressions check the corrected original pair, exact cents and
receipts, every missing/mismatched confirmation, evidence fingerprints,
preservation of raw receipt actions and corrected-entry annotations, independent
audit failures for manufactured retention/settlements, and all three separate
Phattedcalf entry claims. The existing 55 historical financial baselines and
October 24 production accounting remain protected.

The cent-based chop also exercises career/form aggregation. Python monetary
totals use decimal arithmetic, browser filter totals add integer cents, and
validation compares exact cents (including rejection of a one-cent error or
sub-cent value). Rates and rating formulas are unchanged. All older parsed
results and every previously earned collectible snapshot remain unchanged.
This event awards Cougar his 25-Appearance Milestone card and Phattedcalf his
10-Appearance Milestone card; no additional special card was earned.

## October 24, 2026 confirmed production intake

The host authorized correcting the stored HTML receipts on November 8, 2026,
after confirming that Wild Bill's reported $20 was a clerical error and his
actual payment was $10. ProvidenceMike's previously confirmed payment remains
$490. The canonical report now records those two receipts directly, so future
builds do not need a settlement exception or a misplaced forfeiture allocation.
No entry, purchase, knockout, timestamp, rank, or prize schedule was changed.

`Event History 2026-10-24.txt` remains the unchanged, ordered plain-text
extraction of 176 paragraphs from the supplied Word history. The paired import
applies 21 explicit TD undos. Kishan's registration was undone, so he did not play.
Hiro at 14:51:20 and ProvidenceMike at 17:37:24 were confirmed live-stack reloads;
Liam O and ProvidenceMike chopped first.

The regular prize ledger is Liam $370, ProvidenceMike $470, Li-Fo $220,
Hiro $165, Ahmed $135, Nasa Al $40. These total the $1,400 entry pool.
There were 17 entrants, 18 rebuys/reloads, 31 knockouts and 30 purchased bounties:
27 collected ($270), two legitimately retained ($20) and one forfeited ($10).
The forfeiture is Wild Bill's bounty, after his elimination by opted-out A.I. Dave.
ProvidenceMike received it as winner-only prize money: $470 regular prize +
$10 forfeiture + $10 own bounty retained = $490. Wild Bill earned one $10 bounty
by eliminating A.I. Dave and retained none. There is no second claim, settlement
payment or personal/house contribution. Total collected and paid both equal
$1,700. All receipt reconciliation adjustments are zero.

Correction provenance (only the two receipt amounts changed):

- Wild Bill: $20 → $10; ProvidenceMike: $480 → $490.
- Original HTML SHA-256:
  `5913d29f95894ed10d8decce84ec890d0353770a1fef75ba9df19f5bb58077ad`.
- Corrected canonical HTML SHA-256:
  `b48ad1094725b8e3d42f3f2b0728117c418dd77debbab04e9f34fc429d7e98b9`.
- Unchanged history SHA-256:
  `02183cb6c69a651e5ba4a87884c1d23f916f5617238831140f4ea9699c2d676c`.
- The untouched original HTML remains in Git at commit
  `260905b73901c7d0b6b313b63189b1bbe0372e5f`, path
  `data/raw/events/Event Report 2026-10-24.html`. A separate local original-export
  copy was retained with the November 8 data-pipeline audit evidence.

Production regressions pin the corrected report and unchanged detailed history,
verify both receipts, the $1,700 balance and absence of settlement adjustments,
and reject reintroducing the obsolete $20 confirmation or settlement. Independent
source replay still detects manufactured bounty retention, prizes or settlement
payments. This specific host-authorized receipt correction does not change the
separate fingerprinted November 7 incomplete-purchase correction contract.

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
