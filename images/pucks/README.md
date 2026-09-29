# Marchand collection puck photos

Approved, cropped transparent PNGs or WebP images, organized by **artifact number**, not career goal number.

| Artifact | Puck | Game | Photos |
| --- | --- | --- | --- |
| [503](503/) | Warm-Up Puck | Boston at St. Louis, April 2, 2023 | [Front](503/front.png), [Back](503/back.png) |
| [509](509/) | Game-Used Puck | Boston at St. Louis, April 2, 2023 | [Front](509/front.png), [Back](509/back.png), [Edge 1](509/edge-01.png), [Edge 2](509/edge-02.png) |

## Adding future photos

### Image-library hosting and database-led mapping

New photo batches are hosted in [marchand-puck-images](https://github.com/bostnmike/marchand-puck-images), served at `https://bostnmike.github.io/marchand-puck-images/`. Keep the same `images/pucks/<artifact>/` naming within that repository. Existing local images and COAs remain supported and must not be removed just to make space. The collection page stays at tlpt.org.

The validated canonical database is authoritative. Cross-check visible date, opponents and identifying marks; correct mistaken intake names when the evidence gives a unique match. Do not rewrite verified statistics to fit a filename. Do not choose among different physical pucks based only on a shared game or upload order. Publish confirmed views even if a front/back pairing remains held; retain the generic Deep Dive button when no front is confirmed.

For each library release, update its `assets.json` byte/hash inventory and this site's `data/marchand-photo-library.json`. Use absolute library URLs in the photo manifest, versioned with the file hash; keep rotation at zero. Deploy the library first and run `node scripts/test-marchand-photo-manifest.mjs --live` before publishing the site's associations. Verify the live site before archiving the exact successful Drive originals. Never publish raw originals, private Drive download URLs, unresolved images or working masters.

The September 28 third batch adds 240 confirmed photo views across 52 artifacts (239 additional views and a new front for 334), plus 51 lossless front thumbnails. Files named 301 map to validated artifact 302 based on the November 18, 2023 Montreal-at-Boston game. The subsequent owner-approved follow-up publishes 331's confirmed face pair and assigns the second physical April 15, 2025 milestone puck to 339; 336 remains the separate 1,000-point warm-up puck. Existing COAs and all other existing gallery views are preserved; 334's two additional edge photos use Edge 5 and Edge 6.

Create one folder per artifact: `images/pucks/ARTIFACT-NUMBER/`.
Use `front.webp`, `back.webp`, and optional `edge-01.webp`, `edge-02.webp`, and so on. Existing PNG sets remain supported.
Include every supplied edge view, including four or more; do not cap the count at three. Include only views actually photographed.
Keep raw originals unchanged in Google Drive's **Brad Puck / Raw Full Images** folder until the finished set has passed visual QA, publication, and live verification. Then move those successfully published originals into **EDITED AND UPLOADED** inside that folder. Do not move unresolved or failed files.

For HEIC intake, preserve the original files and process full-resolution copies. Match the approved neutral color/crop treatment without smoothing, reconstructing, or removing puck wear, printed markings, tape, or authentication labels. Inspect every front, back, and edge for clipping and individually correct rotation using the logo or readable lettering. Preserve real perspective and irregular worn edges. Center faces on square transparent canvases and keep edge views horizontal with modest breathing room.

Preserve full-resolution PNG working masters and lossless exports outside the repository. User-approved website copies use high-quality WebP, exact alpha, and no upscaling: faces up to 2400 pixels and edges up to 2800 pixels on the longest side. Check wear and label readability against the masters, and confirm the complete published site stays below GitHub Pages' 1 GB limit. A separate lossless `front-thumb.webp` is used only for the small Artifact Hall button; set `thumbnailUrl` on the Front manifest entry. Deep dives use the large website `url`, never the thumbnail. If no thumbnail is registered, the button uses the large Front.

For compression-only passes, retain the published dimensions and exact alpha. Test WebP quality 94, then 96 or 98 as needed against the lossless master at those dimensions, or the backed-up published original. Require opaque-RGB PSNR of at least 41 dB for faces and 42 dB for edges, at least 2% size savings, and close-up visual checks of the lowest-scoring images. Retain the original if checks fail. Keep COAs, lossless thumbnails, and legacy PNG/JPEG encodings unchanged. Do not resize, rotate, recolor, or retouch during compression. Update inventories and version hashes, deploy the library before the site, and verify live bytes. The September 28 per-file audit is `data/marchand-image-optimization.json`; savings apply to current published assets, not retained Git history.

Bake approved rotation into the actual exported pixels. Keep manifest `rotation` at zero; do not rely on CSS to fix a tilted source. Measure the printed design against the correct-era logo or its horizontal/vertical printed lines, and assess edges by their central silhouette midline. Inspect every exported view, preserve natural perspective, regenerate front thumbnails, and use a new image URL version when overwriting published files.

Cross-check artifact numbers against visible dates, opponents, and authentication markings. Record any evidence-backed filename corrections in the private intake audit; never guess an ambiguous mapping.

The beta photos above were processed from the original uploads using conventional cropping and background removal, without generative reconstruction or tonal retouching. Actual wear, printed markings, tape, and authentication labels were preserved. The two artifacts are separate pucks despite sharing a game date.

The first September 27 intake added 101 photographs across 20 artifacts: 1, 2, 8, 12, 16, 26, 28, 32, 34, 37, 40, 42, 43, 44, 48, 56, 68, 69, 70, and 334. Together with the beta sets, this established 107 views across 22 artifacts.

The second intake adds 210 photographs across 40 more artifacts, bringing the collection to 317 views across 62 artifacts. These use conventional Adobe tone correction and background isolation, individually measured pixel rotation, and high-quality website copies from retained full-resolution lossless masters. Every full-resolution front, back, and edge was visually checked; website copies receive compression checks and close-up spot checks. The per-view audit is in `docs/marchand-photo-batch2-review.json`.

Artifact 30 includes five distinct edge views: both sources named `030-edge-04` were retained, with the additional view registered as Edge 5. Artifact 54's formerly unnamed front was confirmed by the owner renaming it `054-front`; it now leads its six-view set and serves as its Deep Dive button. A missing front must not prevent publishing other confirmed views, and the Artifact Hall must keep the generic Deep Dive button until a front is confirmed.

Map each artifact's photos in `data/marchand-photos.json` using a view label and image path. The deep dive shows the first image by default and provides labeled view buttons. This manifest is separate from the canonical statistics import, so spreadsheet synchronization does not overwrite photo mappings. Uploading future files alone does not associate them with records.

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

### Warm-Up narrative policy
Describe the game and Marchand’s role directly. Do not add boilerplate saying a Warm-Up Puck is not a goal puck or is not tied to a scoring play. Preserve genuine provenance conflicts, uncertain dates/use, and player non-participation.
