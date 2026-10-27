# TLPT visual release gate

This is a test-only guardrail, not a second website or a stylesheet override.
It screenshots the existing packaged site at 1440, 820, 390 and 320 pixels.
The reviewed reference is the unchanged public design from release
`2258ddf3cd261eef3f3ed00ca033fe6787dac165`.

## Reproducibility

CI uses Ubuntu 24.04, the exact Playwright version in the lockfile, headless
Chromium, one worker, a fixed clock/timezone, reduced motion and public JSON
fixtures. Live RSVP responses are replaced only inside this test browser.
External requests are blocked; no form is submitted and no payment/RSVP write
is performed. All existing functional browser checks still run separately
against the current generated data and their normal integration paths.

Only the browser-owned audio-control rectangle is masked: Chromium's narrow
native controls vary independently of TLPT styling. Norm's portrait, text,
read-me link and surrounding layout remain compared. The existing audio tests
still check playback, responsive geometry and pause/resume behavior.

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

Linux references are in `baselines/linux/`. Run authoritative comparisons on
Ubuntu 24.04; macOS previews produce different font/emoji rendering and are not
interchangeable. To explore locally, explicitly run `pnpm test:visual
--update-snapshots`; local Darwin references are ignored by Git.

## Review and update

Missing or changed references fail closed. CI NEVER uses an update option.
The failure artifact contains actual/expected/difference images, a browsable
report and traces (14-day retention). A reference update requires inspecting
those images and confirming an intentional, authorized design change; commit
only the reviewed Linux PNGs. Do not accept every screenshot merely to pass CI,
raise tolerances to hide drift, or update fixtures and references automatically.

For initial enrollment, collect the missing-reference actual PNGs from the
PR's Ubuntu run, review against the current design, then commit them and rerun
the unchanged suite. The initial failing PR cannot deploy.

The small 30-pixel allowance at a 0.15 color threshold is for rasterization
noise, not layout movement. Test reports, fixtures and references are excluded
from the public release package.
