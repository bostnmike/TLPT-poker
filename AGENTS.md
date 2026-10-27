# TLPT generated assets

`app.js` and `style.css` are generated delivery files. Their editable source is
in `site-src/app/` and `site-src/styles/`, ordered by `site-src/manifest.json`.
Read `site-src/README.md` before changing either bundle. Edit source sections,
then run `python3 scripts/build-site-shell.py` to rebuild assets, shared markup
and content-based versions. Do not patch the generated bundle alone.

Preserve source order, script scope and CSS precedence unless the user requests
a behavior/design change. Keep Lily, Marchand, Cashier and RSVP ownership separate.
See `MAINTENANCE-RUNBOOK.md` for the complete checks and publication process.

Visual release checks use reviewed Linux references in `tests/visual/`.
Read its README before changing reference images. Never regenerate references
automatically just to clear a failed gate; inspect differences and confirm the
design change is authorized. Keep test fixtures and reports out of public assets.
