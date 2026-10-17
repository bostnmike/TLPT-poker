# Incoming goal pucks — October 16, 2026

Owner-authorized gap-first numbering: **31** and **61**, not 78/79. Canonical handoff: `Marchand Puck Collection/Maintenance Logs/Incoming pucks handoff 2026-10-16.json`. Workbook SHA256: `82c5759b5a0c01a7a89f8a1702c92811ac63bb893b7c9b61f1313342d921c576`.

- 31: January 10, 2022 at Washington; career RS goal 334 / season 15; P1 19:14; PPG; Zach Fucale; MG48 then DP88; Boston 7 @ Washington 3.
- 61: January 23, 2018 vs New Jersey; career RS goal 213 / season 21; P2 19:27; even-strength backhand / GWG; Cory Schneider; DP88 sole assist; New Jersey 2 @ Boston 3.

Both are incoming, not yet in hand. Full canonical Notes and both rows are imported; all 170 prior active record objects, their source rows, authentication fields, stories and game statistics are preserved. The catalog now has 172 records, including 77 Goals & Games, and 171 playable video mappings. New games have all 13 game statistics cross-checked against NHL box scores and official event reports.

## Historical ID inspection

Git history before `ce20ef23` shows old goal-31 was a removed San Jose entry (career 373, subsequently corrected to October 19, 2023); old goal-61 described the April 10, 2025 Detroit game, consolidated into milestone-330. Neither is active. There is no current 31/61 photo manifest mapping, local folder, story or redirect; the only Museum redirect remains milestone-333 → goal-59. The external image inventory retains `images/pucks/61/coa.webp` as historical archival data, never mapped to the new record. Do not delete or reattach it. Artifact 330 is unchanged. Reused goal-31 / goal-61 URLs now intentionally identify the owner's new canonical records.

## Videos

The canonical Goal Video hyperlinks point to NHL recap articles. Their nine-digit article IDs must never be embedded as Brightcove IDs. Artifact 31's official scoring feed identifies reviewed goal clip **6335868297112**, kept separately as videoClipId while retaining the canonical hyperlink. Artifact 61 retains the official recap as a source link; no working embedded clip was verified, so its Watch button is disabled. A recap article is not counted as a playable video. No guessed clip ID is published.

## Receipt follow-up

After physical receipt, verify identity and authentication from the supplied photos/documents, explicitly map newly processed photos, remove `photoStatus: Pending owner receipt`, and update receiptStatus. Until then the renderer blocks photo manifests and legacy imageUrl fallbacks for these pending objects. Never attach an archived numbered folder by inference. Excel remains the detailed database; Word remains concise. Canonical masters were read only; no broad resync of older owner notes was performed.
