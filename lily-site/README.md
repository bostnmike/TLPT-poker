# Lily · Pet & House Sitting

A standalone, buildless microsite. All design, content, assets, and site-specific checks are in this directory. It has no shared site styles, scripts, navigation, remote fonts, or analytics.

## Edit and publish

Edit `index.html` and `styles.css`, then run `python3 lily-site/build.py` from the repository root. This emits the complete `lily.html` route with asset paths adjusted to this directory. Run `bash scripts/run-quality-gates.sh` before publishing.

## Move to another host

Copy this directory to any static host and use `index.html` as the entry point. No build, package installation, or outside files are required. Both versions use relative local assets. `questionnaire.html` is the full text of the supplied planning workbook, preserving all questions, answers, draft ideas, and blank fields for review.

## Review status

All pages are marked `noindex, nofollow` during review. This discourages indexing but does not restrict public access.

At the user's explicit request to publish all supplied content, this review includes Lily's full name, the draft $75/day rate, the listed delivery email, and named potential references. Rates remain labeled draft and reference permissions remain labeled pending. No testimonials, photos, reference contact details, home address, or exact age were supplied. Template instructions in the full source record are reproduced as content rather than operational instructions.

The contact form is intentionally inactive: all fields are disabled, there is no destination or submission button, and no JavaScript executes. It sends and stores nothing. A separate email link exposes the address from the supplied questionnaire; delivery has not been tested. An email address is not a form endpoint. Before enabling the form, supply and verify a real endpoint, update the visible notice, and revise the form checks.
