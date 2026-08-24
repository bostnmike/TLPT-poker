# TLPT HTML Architecture

This document records the shared page-shell contract introduced in Phase 2D.
The site remains a static multi-page application; shared shell markup is kept
consistent in each HTML file and verified by `scripts/audit-code-hygiene.py`.

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

## Phase 2D.1 navigation cleanup

Phase 2D.1 normalizes the active state for every dropdown page. It corrects the
Metrics pages that identified the dropdown parent instead of the actual page,
and removes duplicate or incorrect `aria-current` markers from other dropdown
parents. Existing `is-active` classes preserve the visual treatment while the
navigation now exposes one unambiguous current page.
