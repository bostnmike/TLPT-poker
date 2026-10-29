# TLPT visual release gate

This is a test-only guardrail, not a second website or a stylesheet override.
It screenshots the existing packaged site at 1440, 820, 390 and 320 pixels.
The reviewed reference is the unchanged public design from release
`2258ddf3cd261eef3f3ed00ca033fe6787dac165`.

The four home entrance references were reviewed and updated on 2026-10-27 for
the requested Norm / yellow-chip RSVP campaign, with its introductory label
removed (source `3adf120f`, staging run `40562885387`). Only those four images changed; the other 52 scenarios passed
unchanged. Campaign-before-poem order, image loading, link behavior and responsive
bounds also pass `scripts/test-rsvp-guide-browser.cjs` at all four widths.

On 2026-10-28 the four home entrance references were reviewed again for the
requested three-teaser row: Notifications, Don’t Be a Donkey, Rebuy Hard.
They come from staging run `40788552098` (source `b13587ce`). Only these four
homepage PNGs changed; no footer reference or tolerance was changed. That
staging run also exposed the previously observed intermittent footer link
rasterization difference, which is not approved as part of the homepage update.
The final release must still pass the unchanged footer comparison. Teaser order,
responsive bounds, direct film links and no-autoplay behavior are checked at
1440, 1024, 820, 768, 390 and 320 pixels by the RSVP-guide browser test.

On 2026-10-29 only the 1440px home entrance reference was reviewed and updated
for the approved Empty Chair commercial artwork replacing the brown chair emoji
in shared Home/Schedule seating previews (source `df824eeb`, run `40909228948`).
The actual/difference images show changes confined to the eight empty chairs;
all other 55 scenarios passed unchanged. Seat geometry, occupied avatars and
response counts are preserved. The responsive browser gate additionally checks
the chair images and unchanged seat boxes on both pages at all four widths,
including manual blanks and two-table previews. No comparison tolerance changed.

The same 1440px reference was reviewed again for the owner's requested stronger
chair contrast: brighter detail with a thin warm-gold edge and soft glow (source
`92522e3c`, review run `40912767325`). The actual/difference images are confined
to the chairs; the other 55 scenarios passed unchanged. Original artwork, seat
geometry and all other references/tolerances are unchanged.

On 2026-10-29 the four home entrance references were reviewed for the requested
single “The Many Faces of Norm” banner replacing the three teasers. The artwork
uses the owner's actual card room, the TLPT felt and all nine approved characters
(source `8133998e`, staging run `40960771772`). Actual and difference images at
1440/820/390/320 show only the new banner and the resulting vertical movement of
the unchanged content below it. The other 52 scenarios passed unchanged. The
six-width RSVP-guide test verifies uncropped artwork, responsive bounds,
keyboard focus and navigation to the Film Room. No tolerance or other reference
was changed.

On 2026-10-29 the owner approved cast-specific “Norm Narrates” portraits. Review
run `40965031944` (source `5329c961`) shows intended differences confined to
the 96/80px circular portrait interiors in 18 references: Dashboard, Crew and
Form Lab entrances plus Norm-inline at all four widths, and Form Lab's dropdown
at 1440/820. Actual/difference crops were reviewed for each. Player geometry,
headings, audio controls and read-me links are unchanged. The functional suite
passes every guide/category, including playback, view changes and narrow screens.
37 other visual scenarios passed. The separate 1440px footer font-raster mismatch
also appeared; its reference is NOT updated or approved by this change. The
release must pass that existing comparison. No tolerance or fixture changed.

## Reproducibility

CI uses the official Ubuntu 24.04 Playwright image pinned by version AND digest
in `environment.json`, matching the exact Playwright version in the lockfile.
It contains the browser, fonts and OS libraries; CI does not reinstall Ubuntu
dependencies on each release. Image pulls get at most three 180-second attempts.
The two original DejaVu fallback fonts are checksum-pinned under `fonts/` and
mounted read-only into the container; they are not website fonts or CSS overrides.
The preflight records the image, browser/Node versions and Arial/symbol font resolution
in `browser-results/environment.json`. No credentials are passed into the
disposable browser container, and it runs as the runner's non-root user.

Tests use headless Chromium, one worker, a fixed clock/timezone, reduced motion and public JSON
fixtures. Live RSVP responses are replaced only inside this test browser.
External requests are blocked; no form is submitted and no payment/RSVP write
is performed. All existing functional browser checks still run separately
against the current generated data and their normal integration paths.

Only the browser-owned audio-control rectangle is masked: Chromium's narrow
native controls vary independently of TLPT styling. Norm's portrait, text,
read-me link and surrounding layout remain compared. The existing audio tests
still check playback, responsive geometry and pause/resume behavior.
Masks are scoped to the captured element, so an audio player behind a modal
cannot mask the modal text. The sticky header and its out-of-component skip link are hidden only for the tall
rules-chapter component capture; separate entrance/menu images test that header.
Visible images are decoded after scrolling before screenshots are taken.
Footer capture uses a separate Chromium process with the same pinned browser,
context settings and fixtures. A fresh tab alone still shares process-level
font/raster caches with previous viewport scenes. The isolated capture keeps
the original footer markup, styling, position, references and comparison limits;
it asserts the normal link color and attaches geometry/font/focus diagnostics.
The process-isolation change (`a62fc851`) passed all 168 comparisons in the
three-repeat stability run `40921713116` on 2026-10-29. No footer reference,
site CSS, mask or comparison tolerance was changed.

The fixture copies are public data captured from that release. They deliberately
do not update when league results change. Keep private exports, player links,
registration submissions and credentials out of this directory.

Coverage includes eight page entrances, rule-number badges/avatars, open Trophy
Room and Form Lab menus, the Dashboard help dialog, Norm's inline player,
expanded mobile navigation and the shared footer. These are selected high-risk
views, not a claim that every pixel or interaction is tested.

## Run

After the normal build and `python3 scripts/package-site.py`:

```sh
pnpm test:visual
```

The Linux CI wrapper is `python scripts/browser-ci.py prepare`, followed by
`python scripts/browser-ci.py functional` and `python scripts/browser-ci.py visual`.
Only environment downloads are retried; test retries remain zero. A manual Site
Quality run can request `visual_repeats=3` to repeat all 56 scenarios three times
on one unchanged revision. Every repetition must pass, with the existing references
and thresholds. Setup failure is reported separately from a site regression;
neither can publish. The container image version/digest must be reviewed together
with any future Playwright update, never replaced with a floating `latest` tag.

Linux references are in `baselines/linux/`. Run authoritative comparisons on
Ubuntu 24.04; macOS previews produce different font/emoji rendering and are not
interchangeable. To explore locally, explicitly run `pnpm test:visual
--update-snapshots`; local Darwin references are ignored by Git.

## Review and update

Missing or changed references fail closed. CI NEVER uses an update option.
The failure artifact contains actual/expected/difference images, a browsable
report (14-day retention). Full network traces are disabled to avoid duplicating
the site's large media files in visual artifacts. A reference update requires inspecting
those images and confirming an intentional, authorized design change; commit
only the reviewed Linux PNGs. Do not accept every screenshot merely to pass CI,
raise tolerances to hide drift, or update fixtures and references automatically.

For initial enrollment, collect the missing-reference actual PNGs from the
PR's Ubuntu run, review against the current design, then commit them and rerun
the unchanged suite. The initial failing PR cannot deploy.

The small 30-pixel allowance at a 0.15 color threshold is for rasterization
noise, not layout movement. Test reports, fixtures and references are excluded
from the public release package.
