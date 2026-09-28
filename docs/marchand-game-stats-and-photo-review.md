# Game stats and photo alignment

Game narratives and their sources remain unchanged. `data/marchand-game-stats.json` stores Marchand's complete game line once per NHL game ID, shared by all artifacts from that game. The stat card occupies its own full-width row below the story/video and above the puck photograph. The original Sources disclosure stays with the narrative. Stat groups sit side by side on desktop and stack on smaller screens.

## Adding a game

Run `node scripts/build-marchand-game-stats.mjs` after registering a verified story/game ID. The builder fetches official NHL box scores and event reports and cross-checks counting stats, total ice time and the EV/PP/SH time sum. It checks the date and existing narrative verification data before saving. A missing report is reported explicitly, never replaced by invented figures. Publication tests require complete current-game coverage. Re-fetch a corrected game by removing only its specific cached files from `tmp/game-stats-cache` before running the builder.

All 100 games / 122 artifacts passed on September 27, 2026, including 4 Nations. The panel includes goals, assists, points, shots on goal, total/EV/PP/SH ice time, shifts, plus/minus, hits, blocks and penalty minutes. Zero means a recorded zero; null means unavailable; an absent player is displayed as Did Not Play. Future missing stats do not block the rest of the collection.

## Typography

Source Sans 3 is self-hosted from Adobe's open-source release with its OFL license. Regular is used for prose, semibold for headings and figures. Story and deep-dive section headings use fixed gold across team themes. The oversized masthead is unchanged.

## Photo orientation policy

Every published front, back and edge is individually measured and visually reviewed. The first audit covered 107 views / 22 pucks; the second intake adds 209 views / 40 pucks, for 316 views / 62 pucks in total. Corrections are baked into the full-resolution image pixels, not applied only by the browser. The per-view `rotation` in `data/marchand-photos.json` must be zero. Regenerate front thumbnails from the corrected full-resolution fronts and version image URLs whenever replacing files.

Use the printed design's upright axis and horizontal reference lines, not slanted handwriting or a separately applied authentication sticker. Some team emblems intentionally contain diagonal elements. Edge views are assessed separately against the midpoint between the upper and lower puck boundaries. Preserve natural curvature and camera perspective; do not stretch a cylindrical puck edge into a rectangle or alter authentic wear.

The first audit is recorded in `marchand-photo-orientation-review.json`. 95 views received pixel-level rotation corrections; 12 already aligned views were retained. Original source bytes and hashes are preserved in the private audit backup. Those corrected exports use lossless encoding after a single rotation from the retained source; expanded transparent canvases preserve the complete rim. No generated detail, wear removal, or perspective stretching. Exported contact sheets were reviewed and edge midlines re-measured before publication. New photos require the same front/back/edge checks plus desktop/mobile checks for clipping.

The second intake is recorded in `marchand-photo-batch2-review.json`. Its full-resolution lossless masters are preserved privately. With user approval, the website uses quality-96 WebP copies, up to 2400px for faces and 2800px for edges, with exact alpha and no upscaling. Compression is checked against resized masters, followed by visual checks for readable labels and preserved wear. This keeps the published site within GitHub Pages' 1 GB limit. See `images/pucks/README.md` for the ongoing export and archive policy.
