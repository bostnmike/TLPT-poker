# Lily · Pet & House Sitting

A standalone, buildless microsite. All design, content, assets, and site-specific checks are in this directory. It has no shared site styles, scripts, navigation, remote fonts, analytics, or client material.

## Edit and publish

Edit `index.html` and `styles.css`, then run `python3 lily-site/build.py` from the repository root. This emits the complete `lily.html` route with asset paths adjusted to this directory. Run `bash scripts/run-quality-gates.sh` before publishing.

## Move to another host

Copy this directory to any static host and use `index.html` as the entry point. No build, package installation, or outside files are required. Both versions use relative local assets.

## Review status

Both pages are marked `noindex, nofollow` during review. The contact form is intentionally inactive: all fields are disabled, there is no destination or submission button, and no JavaScript executes. It sends and stores nothing. Before enabling inquiries, supply and verify a real endpoint and its privacy requirements, update the visible review notice, and revise the form checks. Do not substitute a private delivery email.

Do not publish client names, photographs, testimonials, or references without permission. Pricing stays quote-based; no draft rate is published.
