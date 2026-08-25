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
4. Any existing feature stylesheet for that page, such as `home.css`,
   `schedule.css`, `news.css`, `players.css`, `player.css`, `champions.css`,
   or `gallery.css`.

The ordering is intentional. Do not move `site-tail.css` after an existing
feature stylesheet without a visual regression review.

## Ownership rules

- Put genuinely reusable primitives and components in `style.css`.
- Keep the root `.page-title-row` and `.site-footer` primitives in
  `style.css`; page modules may target qualified variants without redefining
  those exact root selectors.
- Put Rules-page selectors in `rules.css`.
- Put Film Room selectors in `media.css`.
- Put Schedule header-shell selectors in `schedule.css`.
- Put News-page selectors in `news.css`, scoped through `.news-page` when they
  target document-level elements.
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
- `home.css` is loaded only by `index.html`, immediately after
  `site-tail.css`;
- `schedule.css` is loaded only by `schedule.html`, immediately after
  `site-tail.css`;
- `news.css` is loaded only by `news.html`, immediately after `site-tail.css`,
  and the page carries `news-page` on both `<html>` and `<body>`;
- the exact root `.page-title-row` and `.site-footer` selectors are owned by
  `style.css` and may not be reintroduced in another stylesheet;
- the exact root `html` and `body` selectors are owned by `style.css`; page
  modules must qualify document-level overrides with their page scope;
- local CSS references exist and carry cache versions.

The independent data and calculation audits remain separate and must continue
to pass before CSS changes are deployed.

## Phase 3A shared page-title system

Phase 3A.1 introduces `.site-page-title` as the single shared typography
primitive for the primary headings on the six Metrics pages: Standings,
Dashboard, Form Lab, Knockout Central, Heater Meter, and Streak Tracker.

`style.css` owns the title's responsive size, weight, line height, letter
spacing, and wrapping. Page modules continue to own their header shell, title
color, shadow, chip, accent line, helper copy, and controls. A page module must
not redefine the primary title's size, weight, or line height.

The shared `.site-page-title-long` modifier is available for unusually long
primary titles. It preserves the same typography contract with a slightly
lower desktop ceiling so the title stays on one line when the standard chip and
section padding are present. Page modules must not recreate this modifier.

The shared title uses `clamp()` so it grows from a readable mobile size to the
larger Trophy Room/Hall of Fame-inspired desktop scale without additional
breakpoint overrides. Home and Crew receive their tailored structural
treatment in Phase 3A.3; the six Metrics pages follow in Phase 3A.4.

The hygiene audit enforces exactly one `.site-page-title` heading on each of
the rollout pages, verifies its text contract, and reserves the exact root
selector for `style.css`.

### Phase 3A.2 structured content-page rollout

Phase 3A.2 extends the same shared title typography to the five remaining
content pages whose existing header shells already follow the shared page-title
contract: Schedule, Rules, The Week That Was, The Gallery, and the Film Room.

Only the primary heading adopts `.site-page-title`. Each page retains its
existing title color, chip or emoji identity, accent line, shell background,
kicker, content layout, and responsive header spacing. Schedule initially used
the shared long-title modifier, and the News emoji is scaled to balance the larger desktop
heading while retaining its existing mobile size. No page-module title
typography override is needed because those modules already defer primary
heading size, weight, line height, and letter spacing to the shared foundation.

### Phase 3A.3 Trophy-inspired tailored page heroes

Phase 3A.3 establishes the Trophy Room as the visual reference for chip-based
primary page headers. `style.css` owns the reusable `.site-page-hero` structure:
a left-side kicker/title/description stack, an enlarged chip on the far right,
an optional full-width lower region, the larger hero-title scale, and the
Trophy Room-aligned 820px and 560px responsive transitions.

Home and Crew adopt the shared structure directly in their HTML. Home keeps its
gold/green identity in `home.css`; Crew keeps its red/purple identity and owns
its header controls in `players.css`. Phase 3A.3 briefly applied the same
structure to Player Profile for review; Phase 3A.4 restores that page's
purpose-built card-and-summary composition. The Trophy Room remains unchanged
and isolated as the reference implementation.

This step deliberately removes the obsolete Home-only hero selectors and the
old Crew title-row shell from the shared compatibility layers. No data,
rankings, card-selection rules, or calculations are changed.

### Phase 3A.4 Metrics header rollout and profile rollback

Phase 3A.4 moves all six Metrics pages—Dashboard, Form Lab, Heater Meter,
Streak Tracker, Knockout Central, and Standings—onto `.site-page-hero`. Their
chips now sit on the far right, their existing helper copy becomes the shared
description beneath the primary title, and pages with controls or definitions
use `.site-page-hero-lower` for a full-width second row.

`style.css` owns five reusable color modifiers (`orange`, `purple`, `fire`,
`red`, and `blue`) by setting only the shared hero variables. Page modules no
longer carry duplicate title-row, chip-size, accent-line, or helper-copy rules
for these six headers; they continue to own all controls, cards, tables, charts,
and responsive feature layouts below the hero.

Player Profile intentionally returns to its pre-3A.3 summary treatment. Its
full collectible card already supplies the strong visual anchor, so the
adjacent name, status, snapshot, archetype, and badge panel remains a
profile-specific component owned by `player.css` rather than a site-page hero.
This rollback changes presentation only and restores the prior template
structure without changing player data or calculations.

### Phase 3A.5 remaining chip-header rollout

Phase 3A.5 moves Schedule, Rules, Film Room, and Gallery onto
`.site-page-hero`. Each page keeps its established chip denomination, title,
supporting copy, accent palette, and content modules while moving the chip to
the far right and integrating the copy beneath the primary title.

Rules and Film Room separate their existing content into adjacent page-owned
sections so the shared hero remains a true header rather than absorbing the
rule cards or video library. Schedule initially retained the long-title
modifier with a mobile spacing safeguard, and Gallery keeps its warm archive palette. Player
Profile, Trophy Room, navigation, data, calculations, and card behavior remain
unchanged.

### Phase 3B.1.1 Schedule and RSVP sizing refinement

The Schedule hero title is shortened to “Next at Caahhd Room,” removes the
long-title modifier, and returns to the standard shared hero-title scale on
desktop and mobile. The Schedule module retains only its chip-clearance padding
at the smallest breakpoint.

The shared Home/Schedule RSVP table initially targeted 144px desktop seats and
avatars, with 64px avatars in the compact three-column mobile grid. A later
generic table-avatar rule still limited the visible desktop photos; Phase
3B.2.1 corrects that cascade. `style.css` continues to own the desktop seat and
avatar geometry, while `site-tail.css` owns the coordinated mobile seat,
wrapper, avatar, and fallback dimensions.

### Phase 3B.2.1 desktop RSVP avatar cascade correction

The shared Home/Schedule RSVP table now uses 96px desktop seats, wrappers, and
avatars. The RSVP image rule includes the generated `.table` class so it has
higher specificity than the later generic 44px table-avatar rule. This makes
the larger photos visible without `!important`, while preserving safe spacing
around the fixed 700px by 350px table layout. The mobile grid remains 64px.

`index.html` and `schedule.html` advance both shared stylesheet cache keys so
the coordinated desktop and mobile rules are requested immediately after
deployment. The code hygiene audit protects the RSVP-specific selectors and
their 96px desktop and 64px mobile dimensions from future cascade regressions.

### Phase 3B.3.1 desktop RSVP seat redistribution

The nine Home/Schedule desktop seat coordinates now follow a balanced,
symmetrical ring around the fixed 700px by 350px table. The approved 96px
avatar diameter, chair treatment, hover animation, seat capacity, and table
artwork remain unchanged. Adjacent seat-center spacing is tightened from the
former uneven 99.5px–182.5px range to approximately 128.7px–141.7px, giving
avatars and empty chairs a more consistent visual rhythm around the rail.

The compact `max-width:640px` layout remains a static three-column grid with
64px avatars, so desktop coordinate changes do not affect mobile stacking.
`index.html` and `schedule.html` advance only the shared `style.css` cache key.

### Phase 3A.1.1 avatar fallback hotfix

The shared foundation owns the root `[hidden]` visibility contract. It uses
`display:none !important` so component rules such as avatar fallbacks may
define their visible `flex` or `block` layout without accidentally overriding
the semantic hidden state.

Avatar markup continues to render a real image followed by a hidden initials
fallback. `site-shell.js` reveals that fallback only when the image fails. Page
modules must not redefine the exact root `[hidden]` selector, and the hygiene
audit verifies both its ownership and required declaration.

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

### Film Room module ownership

The Phase 2C.3 pass moves the Film Room's root-level polish rules out of the
shared `site-tail.css` compatibility layer and into its existing owner,
`media.css`. The module now owns its header treatment, cards, accent bars,
titles, and play overlays. Six exact cross-file selector groups are eliminated;
the final values, selector specificity, responsive grid behavior, hover state,
and 640px shared page-header override remain unchanged.

### Rules module ownership

The Phase 2C.4 pass moves the Rules page's remaining foundation declarations
out of shared selector groups in `style.css` and into its existing owner,
`rules.css`. The module now fully owns its rule cards, chip panel, blind sheet,
and blind-table cell behavior. Five cross-file selector groups are eliminated;
the final backgrounds, borders, radii, shadows, spacing, and table wrapping
remain unchanged.

### Crew module ownership

The Phase 2C.5 pass moves the Crew toolbar and tier/archetype visual-container
rules out of `style.css` and `site-tail.css` and into their existing owner,
`players.css`. Root styling, controls, help copy, accent treatment, responsive
padding, and the shared control-shell blur are consolidated with their final
cascade values. Two cross-file selector groups are eliminated, and Crew-only
rule occurrences no longer load through
the shared stylesheets. The Crew and Home card artwork contract remains
unchanged.

### Honors module ownership

The Phase 2C.6 pass moves the Honors page's ID-scoped collection grids, card
layout lock, section banner treatments, value colors, and responsive column
breakpoints out of `style.css` and `site-tail.css` and into their existing
owner, `champions.css`. Superseded shared accent declarations are removed, and
the Honors-only rules no longer load through the shared stylesheets.

Desktop and responsive behavior remain unchanged: the collection grids retain
five columns by default, then step to four, three, two, and one column at the
1280px, 1100px, 800px, and 640px breakpoints. The canonical shared 640px Honors
page-header exception remains in `site-tail.css` pending a broader header-module
review.

### Home shell ownership

The Phase 2C.7 pass creates `home.css` as the owner of six Home-only shell
selector groups: the weekly-events header and its disabled accent, the league
ticker shell, the two cluster containers, and the pulse header. Their formerly
split foundation, compatibility, blur, and responsive declarations are now
consolidated in one page module loaded only by `index.html`.

The final desktop values and the 980px, 800px, and 640px behavior are preserved.
An ineffective 980px cluster-padding rule and the disabled events-header
pseudo-element's unreachable accent geometry are removed. The shared
stylesheets no longer participate in these six Home selector groups, and
`scripts/audit-code-hygiene.py` now enforces the new module's page ownership
and load order.

### Schedule shell ownership

The Phase 2C.8 pass creates `schedule.css` as the owner of the Schedule-only
header shell. Its container treatment, page-title row, title color, accent
line, kicker spacing, and blur now live together in one page module loaded only
by `schedule.html` after `site-tail.css`.

The desktop cascade and canonical shared 640px header exceptions remain
unchanged. A dead descendant rule for `.section.schedule-hero #schedule-list`
is removed: the schedule list is a sibling immediately after the hero in the
document, and the application only populates that existing sibling rather than
moving it inside the hero. The shared stylesheets no longer participate in the
Schedule shell's root-level selector groups, and the hygiene audit enforces the
new module's ownership and load order.

### Shared primitive ownership

The Phase 2C.9 pass consolidates the exact root `.page-title-row` and
`.site-footer` selector groups in `style.css`. The final title-row positioning
and footer spacing, border, padding, and color are unchanged; only their source
ownership moves out of the later compatibility layer.

The dead `.site-footer .wrap` rule is also removed. Every public page uses
`.site-footer-inner` inside the footer, and neither the HTML nor JavaScript
creates a footer `.wrap` descendant. The hygiene audit now prevents the two
shared foundation selectors from being reintroduced in another stylesheet.
The only remaining root-context cross-file groups are the News page's
intentional `html` and `body` canvas overrides, which remain isolated for a
later page-specific review.

### News canvas ownership

The Phase 2C.10 pass scopes the News page's flat canvas treatment through a
dedicated `news-page` class on both `<html>` and `<body>`. `news.css` now uses
`html.news-page` and `body.news-page`, preserving the same final background
while no longer redefining the shared foundation's exact root `html` and
`body` selectors.

The hygiene audit now enforces the News stylesheet's page ownership, load
order, and two-element scope contract. It also reserves exact root `html` and
`body` ownership for `style.css`. This eliminates the final two root-context
cross-file selector groups; page-qualified and responsive composition remain
available where intentional.

### Shared footer markup contract

The Phase 2C.11 pass normalizes the footer markup across all 16 public pages.
Every `.site-footer` now contains exactly one `.site-footer-inner` wrapper and
the same attribution text and Tournament Director link. This corrects the Film
Room's missing inner width wrapper and removes equivalent-but-different source
formatting from Form Lab and the Trophy Room.

The hygiene audit now enforces the shared wrapper, text, URL, new-tab target,
and `noopener noreferrer` relationship. Footer presentation remains owned by
`style.css`; page-specific stylesheets must not redefine the root footer
primitive.
