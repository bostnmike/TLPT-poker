# TLPT CSS Architecture

This document records stylesheet ownership after Phase 2A. Preserve the load
order below: it retains the established cascade while allowing page-only CSS to
stay off unrelated pages.

## Required shared order

Every public page begins its stylesheet chain with:

1. `style.css` — shared foundation, navigation, layout, reusable components,
   events, metrics, Crew, profile, and honors foundations.
2. An optional owned page module:
   - `rules.css` only on `rules.html`
   - `media.css` only on `media.html`
3. `site-tail.css` — shared value helpers, footer, responsive behavior, and the
   later compatibility/polish layer.
4. Any existing feature stylesheet for that page, such as `players.css`,
   `player.css`, `champions.css`, or `gallery.css`.

The ordering is intentional. Do not move `site-tail.css` after an existing
feature stylesheet without a visual regression review.

## Ownership rules

- Put genuinely reusable primitives and components in `style.css`.
- Put Rules-page selectors in `rules.css`.
- Put Film Room selectors in `media.css`.
- Treat `site-tail.css` as a compatibility layer. New page features should not
  be appended there merely because it loads last.
- Prefer an existing page stylesheet for page-only changes.
- Create a new page stylesheet when a page has a substantial independent UI.
- Avoid adding a selector to more than one stylesheet unless the later rule is
  an intentional documented override.
- Keep all local CSS references cache-versioned in the corresponding HTML.

## Automated enforcement

`scripts/audit-code-hygiene.py` checks that:

- all 16 public pages load `style.css` and `site-tail.css` in the required order;
- `rules.css` is loaded only by `rules.html`;
- `media.css` is loaded only by `media.html`;
- local CSS references exist and carry cache versions.

The independent data and calculation audits remain separate and must continue
to pass before CSS changes are deployed.

## Phase 2B hygiene

Phase 2B begins with a zero-visual-change redundancy pass. Exact duplicate rule
blocks have been removed, and `scripts/audit-code-hygiene.py` now rejects a
repeated selector/declaration block inside the same media/support context.

Non-identical override sequences remain intentional until reviewed one page at
a time. Consolidate those only when the final computed cascade can be proven or
visually regression-tested; do not remove `!important` merely to reduce a count.

### Player Movement cleanup

The Phase 2B.2 Player Movement pass consolidates all 13 repeated selector
chains in `player-movement.css`. Seventeen superseded rule blocks and eight
superseded `!important` declarations were removed while preserving all 480
final component/property results across root and responsive contexts.

### Knockout Central cleanup

The Phase 2B.3 Knockout Central pass consolidates the two remaining repeated
header selector chains in `knockouts.css`. The final header spacing and red
accent declarations retain their existing specificity and `!important` status,
so the cleanup changes source ownership without changing the rendered cascade.
