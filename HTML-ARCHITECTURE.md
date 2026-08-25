# TLPT HTML Architecture

This document records the shared page-shell contract introduced in Phase 2D.
The site remains a static multi-page application; shared shell markup is kept
consistent in each HTML file and verified by `scripts/audit-code-hygiene.py`.

## Document head

Every public page uses the same document-head foundation: English language,
UTF-8 encoding, the canonical responsive viewport, the three shared favicon
links, one page-specific title, and one page-specific description. Stylesheet
ownership and order remain governed by `CSS-ARCHITECTURE.md`.

The hygiene audit verifies each page's exact title and description as well as
the shared language, encoding, viewport, and favicon contract. Head metadata is
nonvisual and must not initialize page behavior or calculations.

## Shared header and navigation

All 16 public pages use the same `.site-header` and `.nav` structure, link set,
and link order. Page differences are limited to the active-state attributes:

- A direct top-level page uses one `is-active` link with
  `aria-current="page"`.
- A page inside a dropdown marks the dropdown parent with `is-active` for
  visual group context.
- Only the current submenu item receives `aria-current="page"`.
- The current submenu item also receives `is-active`.
- Even when a dropdown parent and its first submenu item share the same URL,
  only the submenu item is exposed as the current page to assistive technology.

The hygiene audit enforces the complete link order, the expected active labels,
and exactly one current-page link on every page.

## Primary page hero contract

Phase 3A.3 introduces the Trophy Room-inspired `.site-page-hero` structure for
chip-based primary page headers. Its static form contains one
`.site-page-hero-copy` wrapper with a kicker, the primary title, and descriptive
copy; one `.site-page-hero-chip` image on the far right; and, when the page has
controls or summary content, one optional `.site-page-hero-lower` region that
spans the full header width.

Home, Crew, all six Metrics pages, Schedule, Rules, Film Room, and Gallery use
the static contract. Dashboard, Standings, and Streak Tracker also use the
optional lower region for controls, status, or definitions. Trophy Room remains
the isolated visual reference. The hygiene audit protects exactly one complete
static hero structure on each page in the rollout.

Player Profile is an intentional exception. Phase 3A.4 restores its original
dynamic `.tlpt-player-summary` template because the full collectible card is
already the page's dominant visual. Its name, quote, status, career snapshot,
archetypes, and badges remain adjacent to that card without a second chip or
page-hero wrapper.

## Shared footer

Every `.site-footer` contains exactly one `.site-footer-inner` wrapper and the
canonical BostnMike/Tournament Director attribution. Footer structure, text,
URL, new-tab target, and security relationship are enforced by the hygiene
audit. Footer presentation remains owned by `style.css`.

## Page content

Page-specific content remains inside each page's existing `<main>` structure.
Do not move calculations, data rendering, card logic, or page initialization
into the shared shell. Those behaviors remain owned by their existing
JavaScript and generated-data pipeline.

## Shared shell behavior

Every public page loads `site-shell.js` once, before its page or feature
scripts. The module owns small behavior shared by the static page shell; it
does not initialize data, calculations, cards, filters, or page-specific UI.

Static page-title chip images opt into the shared missing-asset fallback with
`data-hide-on-error`. The module hides a failed chip without placing executable
event-handler code in the HTML. Public-page markup must not contain inline
event handlers or inline presentation styles.

## Phase 2D.1 navigation cleanup

Phase 2D.1 normalizes the active state for every dropdown page. It corrects the
Metrics pages that identified the dropdown parent instead of the actual page,
and removes duplicate or incorrect `aria-current` markers from other dropdown
parents. Existing `is-active` classes preserve the visual treatment while the
navigation now exposes one unambiguous current page.

## Phase 2D.2 document-head cleanup

Phase 2D.2 adds a concise, unique description to all 16 public pages and turns
the existing head conventions into an enforced contract. Titles and icon paths
are unchanged. This phase has no body-markup, stylesheet, JavaScript, data, or
calculation changes.

## Phase 2D.3 inline shell-behavior cleanup

Phase 2D.3 replaces the 13 repeated page-chip `onerror` attributes with one
shared listener in `site-shell.js`. It also replaces the Crew page's two
initial `style="display:none"` declarations with the semantic `hidden`
attribute and updates the existing Crew view toggle to use that same state.

The hygiene audit now rejects inline event handlers and inline `style`
attributes in public-page HTML, requires `site-shell.js` before feature
scripts, and verifies that static title-chip images retain the shared fallback
contract. This phase changes no visible default state, data, calculations,
card logic, or page content.

## Phase 2D.4 generated image-fallback cleanup

Phase 2D.4 removes executable `onerror` attributes from HTML generated by the
site's JavaScript modules. Generated images now opt into one of the shared,
declarative `data-image-error-action` behaviors owned by `site-shell.js`:

- reveal the next sibling fallback;
- replace the image with the next sibling fallback;
- mark a gallery avatar wrapper as missing;
- retry the shared default-player image once; or
- cycle through the Rules chip image candidates.

Existing fallback visuals and candidate order are unchanged. Repeated
`style="display:none"` declarations on generated avatar fallbacks are replaced
with the semantic `hidden` attribute. Legitimate calculated presentation—such
as chart widths, progress fills, and metric colors—remains owned by the page
modules and is intentionally unchanged.

The hygiene audit now also scans root JavaScript modules for generated inline
event handlers and generated `display:none` attributes. The Site Quality Gate
runs `scripts/test-site-shell.mjs` to verify every shared image-error action,
including the second-failure guard on the default-avatar retry.

## Phase 3B.1 player-card rule lock

Crew experience is based on `buyIns`, which counts separate tournament
appearances and never rebuys. Players with one or two appearances remain
visible as green RKI prospects but are excluded from competitive Crew pools.
Crew eligibility begins at three appearances, the PRO band covers three and
four appearances, and official Power Rank plus S–D tiers begin at five.

Crew cards sort by underlying tier priority first and calculated 40–99 rating
second. Automatic special-edition skins remain purely visual and cannot move a
card. Permanent collectible ownership and every frozen issuance snapshot stay
independent of later live ordering changes.

Hall qualification remains dynamic: 25% of completed historical events,
rounded up, with a minimum floor of 10 appearances. This produced a threshold
of 12 after 47 events and 13 after 49 events. A higher live threshold does not
remove a permanent Hall edition that was earned at an earlier historical
checkpoint.

`scripts/audit-page-calculations.mjs` enforces the visibility, eligibility,
experience-band, rating-range, tier-first ordering, skin-independence, and Hall
threshold contracts. `scripts/audit-site-integrity.py` independently replays
historical card ownership and frozen snapshots.

## Phase 3B.2 automatic Crew-skin consistency

The automatic highest-priority skin rule is now enforced from source data
through presentation. `data/featured-cards.json` is a policy manifest rather
than a player selector: manual overrides are rejected, every generated player
uses `featuredCardMode: "automatic"`, and `featuredCardEdition` must match the
first edition in the permanent prestige-ordered collection (or `base` when the
collection is empty).

Crew, Player Profile, and Trophy Room use the shared visible label “Active Crew
Skin.” The Profile collection explains that the selection is automatic, and
the Trophy Room resolves the active skin directly from collection priority.
Base Crew cards now display the same explicit `BASE` edition marker used by the
other card surfaces. Ratings, tiers, ordering, permanent ownership, historic
snapshots, and all special-edition artwork remain unchanged.

## Phase 3B.3 cross-surface card-rendering lock

Home and Crew now use the established “Active Crew Skin” terminology in card
hover and accessibility text instead of the retired “Featured design” wording.
The visible artwork, card dimensions, ratings, tiers, and Crew order do not
change.

The page-calculation audit now executes the real Home, Crew, Player Profile,
and Trophy Room renderers against the generated permanent collection. It
verifies that each surface resolves the same automatic skin, that Crew-facing
cards retain live ratings and tier codes, that every Profile collectible is
present exactly once in prestige order, and that every Trophy Room card keeps
its frozen historic snapshot and active-skin marker. This prevents later UI
work from silently diverging from the card ledger without adding a second
edition-selection system.

## Phase 3B.4 shared app-runtime cache lock

The eight pages that consume `app.js` use one shared versioned reference:
`app.js?v=20260825-1`. This prevents navigation between pages from mixing
different cached generations of the common data and card-rendering runtime.
The application script, page content, styling, calculations, and generated data
remain unchanged.

`scripts/audit-code-hygiene.py` enforces the complete consumer set, requires
each consumer to load `app.js` exactly once, and requires every consumer to use
the same full cache-version reference. Future cache rotations must therefore be
applied consistently across all eight pages.

## Phase 3B.5 shared stylesheet cache lock

All 16 pages use the same versioned references for the two global stylesheets:
`style.css?v=20260825-1` and `site-tail.css?v=20260825-1`. This removes the
three cache generations previously used for each stylesheet and ensures every
page receives the same deployed global presentation rules. No stylesheet rules,
page content, calculations, generated data, or JavaScript behavior change.

`scripts/audit-code-hygiene.py` now enforces complete, exactly-once, uniform
cache references for `style.css`, `site-tail.css`, and `site-shell.js` across
all expected pages. The shared shell script was already consistent and remains
at its existing version; it is included in the contract to prevent later drift.

## Phase 3B.6 cross-runtime calculation determinism lock

The live, card-form, and historic card calculations now use `math.fsum` for
league-wide floating-point `luckProxy` averages. This removes a small Python
runtime-dependent rounding boundary that allowed the Python 3.11 deployment
pipeline and a Python 3.12 independent replay to produce different frozen
snapshot values from the same event ledger.

The published card ledger is rebuilt from the unchanged 49-event source and
restores Hiro's four July 26, 2025 leader snapshots to the established
`trueSkillScore` of `392.064`. Formulas, player statistics, ratings, tiers,
ownership, prestige ordering, and card artwork remain unchanged. The integrity
audit uses the same order-stable reduction while continuing to recompute every
checkpoint independently from parsed events.

## Phase 3B.7 Player Movement data freshness lock

Player Movement now gives its live `site-data.json`, parsed-event index, and
parsed-event file requests one shared version token per page load and fetches
all three source classes with `cache: "no-store"`. The main data response is
also checked before JSON parsing. This prevents a previously cached player list
or partial historical event set from being combined with newly deployed data.

The page script reference advances to `player-movement.js?v=20260825-1` so the
freshness behavior reaches existing browsers immediately. The code-hygiene
audit enforces the single request token and all three versioned, no-store JSON
fetches. Player Movement formulas, default fallback files, controls, markup,
styling, player data, and card behavior remain unchanged.

## Phase 3B.8 Player Movement authoritative event-index lock

Player Movement now requires the generated `data/parsed/events/index.json`
ledger and validates that it is a non-empty array of dated JSON event files.
The retired built-in fallback covered only 32 of the 49 parsed events and could
therefore publish incomplete movement analytics when the index request failed.
The page now shows its existing load-error state instead of silently calculating
rankings from partial history.

The page script reference advances to `player-movement.js?v=20260825-2`.
The source-to-page integrity audit rejects any return of the partial static
fallback and requires the authoritative index contract. Player calculations,
aliases, controls, card presentation, page markup, responsive styling, and the
49 parsed event files remain unchanged.
