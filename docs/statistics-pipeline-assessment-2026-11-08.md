# Statistics pipeline assessment — November 8, 2026

## Findings and corrections

BostnMike's missing bounty result was a display eligibility defect. His career
bounty return is $25 ($20 collected and $5 retained), against $25 posted: $0 net.
The Dashboard discarded zero results in both combined and filtered views. Its
hygiene check enforced that exclusion, and its rendered-membership test reused
the production filter to decide who should appear.

Financial Dashboard views now include everyone with an actual appearance and a
finite numeric result, including first appearances, $0 and 0% ROI. Missing, null,
string and nonfinite values do not masquerade as zero. Both scope paths use one
eligibility helper. An all-zero bounty-net view is valid even when selected
events had no bounties. Independent participant-set assertions cover all nine
format/bounty scopes. Global numerical ranks remain intact within active/alumni
sections. Existing nonfinancial thresholds and career Standings qualification
remain unchanged.

The audit reopened the October 24 $10 settlement discrepancy. After reviewing
collections and knockouts, the host confirmed Wild Bill's $20 receipt was a
clerical error: he received $10. At the host's explicit request the canonical
raw report now records Wild Bill $10 and ProvidenceMike $490. The obsolete
settlement and misplaced source-forfeiture exceptions were removed. Both
collections and payments now total $1,700; there is no host contribution.
Detailed provenance, fingerprints and the original export's retained Git revision
are in [the accounting contract](optional-rebuy-bounties.md#october-24-2026-confirmed-production-intake).

Wild Bill's career take-home changes from $140 to $130, net from -$150 to -$160,
and dependent ROI, luck and Power follow the existing formulas. His bounty net
remains $0. Other players' career records and earned collectible snapshots are
unchanged. BostnMike's bounty net remains +$20 on October 17, -$10 on October 24
and -$10 on November 7, totaling $0.

## Source-to-display assessment

The path is raw TD reports + financial rules/aliases → parsed events → history,
career aggregates and knockout archive → classified compact events → scoped
page models → rendered UI. The canonical runner owns this sequence. Historical
statistics do not query the live Cashier or RSVP transaction databases.

Reviewed and exercised controls cover:

- All 57 production events, 36 identities and 438 participant appearances;
  unique event/player identities, raw initial-entry/rebuy counts, aliases,
  costs, take-home, net, exact cents and all additive career fields.
- Independent raw replay of optional-bounty purchases, undos, active-stack
  reloads, re-entry choices, individual knockout claims, retained bounties,
  winner-only forfeitures, confirmed prizes and receipts. November 7's separate
  fingerprinted incomplete-export correction is unchanged.
- Parsed/history/compact parity and all nine scope combinations: participation,
  rate denominators, zero versus absent data, knockout parity, and career-field
  immutability during filtering. Streak thresholds and filtering before the
  six-appearance Heater/Form Lab window remain enforced.
- Rendered profile, Standings, Dashboard and Form Lab monetary identities;
  positive/zero/negative numerical ranking; bounty-only returns and settlements
  do not create tournament cashes. Existing earned card snapshots stay intact.

Independent reconciliation completed 13,874 checks with zero errors and no cash
conservation exceptions. It verified 59 raw files unchanged against base commit
260905b73901c7d0b6b313b63189b1bbe0372e5f and the remaining report changed only by
the two authorized receipt replacements. An untouched original is also retained
with the local audit evidence. October 24 correctly transfers $10 from bounties
to tournament prizes: bounty net alone is -$10, tournament net +$10, combined
player net $0. Requiring both subledgers individually to be zero would be wrong.

The required suite completed 62,988 source-to-page checks, including 36,270
rendered calculation checks, zero validation errors and all 55 preexisting
historical financial baselines. A second canonical build was byte-identical
across 119 generated/source assets. Financial browser regressions exercise all
nine scopes and three financial metrics at 1440/820/390/320 pixels, including
membership, zeros and ordering. The normal pinned CI suite remains mandatory.

## Continuing controls

Regressions pin the corrected October 24 report and unchanged detailed history.
Reimporting obsolete receipts, restoring the obsolete settlement or assigning
the forfeiture to Wild Bill fails checks. Source imports can still contain human
errors: paired replay, explicit confirmations and provenance remain necessary.
Agreement between generated files alone is not proof of source accuracy.

This assessment requires no Cashier/RSVP production database changes. Their
existing joint producer/consumer contract runs in the root suite. Publication
uses the normal PR, pinned browser/visual gates and exact-artifact production
workflow. No screenshot reference, tolerance or failed assertion is bypassed.
