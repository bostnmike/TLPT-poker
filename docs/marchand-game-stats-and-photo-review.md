# Game stats and photo alignment

Game narratives and their sources remain unchanged. `data/marchand-game-stats.json` stores Marchand's complete game line once per NHL game ID, shared by all artifacts from that game. The stat card follows the narrative; the original Sources disclosure remains available below it.

## Adding a game

Run `node scripts/build-marchand-game-stats.mjs` after registering a verified story/game ID. The builder fetches official NHL box scores and event reports and cross-checks counting stats, total ice time and the EV/PP/SH time sum. It checks the date and existing narrative verification data before saving. A missing report is reported explicitly, never replaced by invented figures. Publication tests require complete current-game coverage. Re-fetch a corrected game by removing only its specific cached files from `tmp/game-stats-cache` before running the builder.

All 100 games / 122 artifacts passed on September 27, 2026, including 4 Nations. The panel includes goals, assists, points, shots on goal, total/EV/PP/SH ice time, shifts, plus/minus, hits, blocks and penalty minutes. Zero means a recorded zero; null means unavailable; an absent player is displayed as Did Not Play. Future missing stats do not block the rest of the collection.

## Typography

Source Sans 3 is self-hosted from Adobe's open-source release with its OFL license. Regular is used for prose, semibold for headings and figures. Story and deep-dive section headings use fixed gold across team themes. The oversized masthead is unchanged.

## Photo orientation policy

Every published front, back and edge (107 views / 22 pucks) was visually reviewed. The per-view `rotation` in `data/marchand-photos.json` is a clockwise display angle in degrees. Apply it to the featured image, its gallery thumbnail, and the front-image Deep Dive button. Missing rotation defaults to zero for future uploads, but a publication review must record an explicit reviewed value.

Use the printed design's upright axis and horizontal reference lines, not slanted handwriting or a separately applied authentication sticker. Some team emblems intentionally contain diagonal elements. Edge views are assessed separately against the midpoint between the upper and lower puck boundaries. Preserve natural curvature and camera perspective; do not stretch a cylindrical puck edge into a rectangle or alter authentic wear.

The audit is recorded in `marchand-photo-orientation-review.json`. 77 views received fine-angle display corrections; 30 retained their existing orientation. The original photo files are unchanged: no recompression, generated detail, removal of wear, or destructive crop. Corrected contact sheets were visually reviewed before publication. New photos must receive the same front/back/edge check, including a desktop/mobile check for clipping, before publishing.
