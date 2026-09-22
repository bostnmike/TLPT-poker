# Marchand collection puck photos

Approved, cropped transparent PNGs, organized by **artifact number**, not career goal number.

| Artifact | Puck | Game | Photos |
| --- | --- | --- | --- |
| [503](503/) | Warm-Up Puck | Boston at St. Louis, April 2, 2023 | [Front](503/front.png), [Back](503/back.png) |
| [509](509/) | Game-Used Puck | Boston at St. Louis, April 2, 2023 | [Front](509/front.png), [Back](509/back.png), [Edge 1](509/edge-01.png), [Edge 2](509/edge-02.png) |

## Adding future photos

Create one folder per artifact: `images/pucks/ARTIFACT-NUMBER/`.
Use `front.png`, `back.png`, and optional `edge-01.png` through `edge-03.png`.
Include only views actually photographed; zero to three edge photos are supported by this naming convention.
Keep raw originals in Google Drive's **Brad Puck / Raw Full Images** folder.

The beta photos above were processed from the original uploads using conventional cropping and background removal, without generative reconstruction or tonal retouching. Actual wear, printed markings, tape, and authentication labels were preserved. The two artifacts are separate pucks despite sharing a game date.

Map each artifact's photos in `data/marchand-photos.json` using a view label and image path. The deep dive shows the first image by default and provides labeled view buttons. This manifest is separate from the canonical statistics import, so spreadsheet synchronization does not overwrite photo mappings. Artifacts 503 and 509 are mapped; uploading future files alone does not associate them with records.
