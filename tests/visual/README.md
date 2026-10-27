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
Footer capture starts in a fresh tab after the expanded-navigation shot,
so menu focus/sticky compositing state cannot leak into the footer scene. It
asserts the normal link color and attaches geometry/font/focus diagnostics.

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
