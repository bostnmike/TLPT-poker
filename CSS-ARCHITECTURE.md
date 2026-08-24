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

### The Week That Was cleanup

The Phase 2B.4 News pass consolidates the two remaining split selector chains
in `news.css`: the receipt header layout and the archive-list scrolling rules.
The declarations retain their existing values, context, order, specificity,
and `!important` status, so the rendered cascade is unchanged.

### Global compatibility cleanup

The Phase 2B.5 safe global pass removes three redundant Honors grid rules from
`site-tail.css`; the same responsive values already appear earlier with equal
or stronger priority. It also combines the two identical RSVP-button selector
headers into one rule without changing any declaration value or priority.

The overlapping mobile page-header rules remain intentionally untouched. They
span several pages and should be consolidated only with page-by-page visual
regression testing at the 1100px, 800px, and 640px breakpoints.

### Shared foundation cleanup

The Phase 2B.6 shared-foundation pass consolidates the six remaining repeated
selector chains inside `style.css`: the archetype header, responsive dashboard
button shell, Honors grids, Honors banner layout, League Leader banner, and
Crew title. Earlier declarations were either repeated in or fully superseded by
their later rule, so the final value, context, specificity, and priority of
every affected property remain unchanged.

After this pass, every stylesheet has zero internally repeated selector
headers. Cross-file selector ownership and the overlapping mobile page-header
rules remain deferred to a separate visual-regression phase.

## Phase 2C ownership cleanup

Phase 2C audits selector ownership across the complete stylesheet chain loaded
by each public page. A cross-file match is not automatically an error: shared
foundations, page modules, and the compatibility layer may intentionally
compose different properties for the same component.

### Dead shared-foundation declarations

The Phase 2C.1 pass removes 26 component-rule occurrences from `style.css`
whose complete declaration sets were superseded later by the exact same
selector and media context in `site-tail.css`. The surviving compatibility
rules retain their original order, specificity, values, and `!important`
status. Partially overlapping rules and all page-module composition remain
unchanged.

### Mobile page-header ownership

The Phase 2C.2 pass consolidates three overlapping `max-width:640px` header
groups in `site-tail.css` into one narrowly scoped primary-header rule, one
Honors exception, and one shared accent-line rule. It removes broad
`body:has()` ownership, an ineffective Rules-only margin override, and a final
Home/Schedule/Media block whose normal-priority declarations were already
superseded by earlier `!important` values.

The canonical mobile owners now target the actual header shells used by Home,
Standings, Dashboard, Crew, Schedule, Rules, Media, and Honors. Their final
position, spacing, padding, accent position, and accent height remain
unchanged at the 640px breakpoint.
