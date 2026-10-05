# Data QA corrections

The September 29 audit corrections preserve all 170 artifacts and existing videos.

- Correct Loui Eriksson to NHL player 8470626 and Anders Bjork to 8478075, including portraits and positions from the official profiles.
- Carry artifact 324's six scoring fields through the importer. This is Kyle Palmieri's goal, commemorating Marchand's final Boston home game; it must not enter Marchand goal or assist totals.
- Populate 132 previously blank gallery filename fields. Add front, back, detail and COA filename columns to Goals & Games and Road to History.
- Add official final scores and NHL source links for 32 milestone records.
- Synchronize the five stale Word stories (700, 707, 711, 510, 716), add 40 missing arenas and 33 scores, and record the five visually reviewed holograms.
- Support all six canonical collection sheets in the importer. Match stable inventory IDs instead of row positions. Preserve exhibit titles, existing personnel and selected video labels.

## Authentication policy

The [October 5 digital COA review](marchand-digital-coa-20261005.md) expands this policy and supersedes the older public wording about paper-certificate limitations. Holograms identify digital COAs; their absence from a paper-COA gallery view is not a provenance concern.

A visible authentication hologram counts as COA evidence under the owner's collection policy. A separate paper certificate is not required for those records. Do not fabricate a certificate image or duplicate a back/edge photo under a COA filename.

The canonical Authentication Type, Authentication Evidence and Authentication Notes columns distinguish a COA/supporting document, a hologram, and evidence not yet documented. Evidence filenames point to the actual photograph or document. “COA / Supporting Document” means a file is attached, not that every attached label is an item-specific certificate; existing discrepancy and scope notes remain authoritative.

Holograms visually confirmed in the previously paper-COA-free goal group:

| Artifact | Photograph | Visible branding |
| --- | --- | --- |
| 10 | Back | Fanatics |
| 12 | Back | Fanatics |
| 32 | Edge 4 | NHL-branded |
| 67 | Back | Holographic authentication label |
| 77 | Edge 1 | Montreal Canadiens |

Serials were not independently authenticated. Current photos do not document a separate COA or hologram for goal pucks 22, 25, 36, 37, 44, 45, 56, 65. Artifact 64 still awaits photographs. These are evidence follow-ups, not assertions that the pucks lack authentication.

For future audits, do not derive “missing authentication” solely from absence of a gallery view labeled COA. Check the canonical authentication evidence and the actual front/back/edge photographs. Preserve known certificate discrepancies and owner-approved catalog identifications.

## Sources

- https://api-web.nhle.com/v1/player/8470626/landing
- https://api-web.nhle.com/v1/player/8478075/landing
- https://api-web.nhle.com/v1/gamecenter/2015020686/landing
- https://api-web.nhle.com/v1/gamecenter/2019020378/landing
- Each added milestone score links its official NHL game record in the canonical Research Sources column.
