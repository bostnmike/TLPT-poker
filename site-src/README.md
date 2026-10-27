# TLPT application and stylesheet source

Edit these smaller files, **not** the generated root `app.js` or `style.css`.
`manifest.json` explicitly lists their order. Files are named by responsibility;
the numeric prefixes help readers follow the existing execution/cascade order.

## Build and check

```sh
python3 scripts/build-site-shell.py
bash scripts/run-quality-gates.sh
python3 scripts/package-site.py
CI=true node scripts/run-browser-gates.cjs
```

The normal data build already calls this shared build. It assembles the two
delivery files first, then regenerates the HTML shell and content-based asset
versions. `build-site-assets.py --check` checks only the bundles without writing.
Never fix a generated-output warning by copying a manually edited bundle back
over the sections: edit the relevant section and rebuild.

## JavaScript map

- `01–06`: data loading/recovery, state/configuration, format definitions,
  formatting, player eligibility, archetypes and tiers.
- `07–10`: identity/avatar markup, RSVP/seat previews, home event rotation,
  leaderboard headlines.
- `11–14`: home highlights, commissioner reports, guides and home rendering.
- `15–17`: standings/dashboard and Crew cards, controls and rendering.
- `18–23`: card ratings, editions, comparisons, card rendering/collections,
  and player profiles.
- `24–29`: schedule, honors, blind structures, filters, interaction helpers
  and the final startup handler.

These are ordered **classic-script sections**, not independently loaded ES
modules. Shared globals, function hoisting, initialization timing and the single
DOMContentLoaded handler remain exactly as before. Do not add `import`, `export`,
wrappers or an asynchronous loader as part of routine maintenance.

## Stylesheet map

- `01–04`: foundation, navigation/selects, layout/heroes, headings/buttons.
- `05–07`: home modules, event guide and snapshot.
- `08–11`: event cards, seating/RSVP, event/MTT themes and home treatments.
- `12–16`: avatars/tables, dashboard, Crew grid, controls and archetypes.
- `17–20`: profiles, honors, later badge/spacing overrides, status/accessibility.

Keep overrides in their original position. Do not regroup duplicate selectors,
sort declarations, introduce cascade layers or move media queries between files
without a separate behavior/design review. CSS URLs still resolve relative to
the root `style.css`, **not** to these authoring files.

## Delivery and isolation

Assembly is byte concatenation: no separators, minifier or new dependency.
The browser still downloads the same two URLs with content-based cache versions.
`app.js` and `style.css` therefore remain long **generated delivery artifacts**;
maintenance happens in the small source files. Source sections are excluded from
the public package. Lily, Marchand, Cashier and RSVP sources are not managed here.

`migration-baseline.json` records the prior release and SHA-256 of both original
files. This initial split reproduces those bytes exactly. It is historical
evidence, not a hash to update or a restriction against future approved edits.
Quality checks always compare current source assembly with current delivery
files, validate complete JS/CSS boundaries, and reject missing/unlisted files.
