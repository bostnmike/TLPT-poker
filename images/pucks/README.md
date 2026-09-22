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

## Required front-photo / Deep Dive policy

For every new puck photo intake:

1. Confirm the artifact ID and preserve the raw originals in Drive.
2. Prepare the approved, faithful cutouts without altering the puck's wear or identifying markings.
3. Upload the finished images to the artifact's folder here.
4. Add the front photo to `data/marchand-photos.json` with the label **Front**, followed by Back and any supplied edge views. Keep Front first for the initial deep-dive display.
5. The Artifact Hall automatically uses that **Front** image as the clickable Deep Dive button. Do not hardcode artifact IDs or substitute a back/edge photo as the front.
6. Keep the standard Deep Dive puck button for records with no front photo, while the front loads, or when it fails to load. It must remain clickable and keyboard accessible in every case.
7. Run the site quality gates and verify the photo button opens the correct artifact, all views work, and a missing/failed front image shows the standard fallback. Publish and confirm the live site.

The existing `imageUrl` field remains supported as a legacy front-photo source when no photo manifest entry exists. Photo mappings stay independent of canonical statistics, so regular spreadsheet imports do not remove them.
