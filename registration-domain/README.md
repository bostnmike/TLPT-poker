# Registration address

GitHub Pages project https://github.com/bostnmike/tlpt-registration serves the
unlisted form at https://register.tlpt.org/. Porkbun DNS has CNAME `register`
pointing to `bostnmike.github.io`, TTL 600. The main `tlpt.org` and cashier
configuration must not change.

The form's source of truth is still this repository's `register.html`.
`build.mjs` generates static registration HTML for GitHub Pages: main-site
assets/navigation, local skip link, and a branded FormSubmit success URL.
No Worker, proxy, runtime, database, secret or Cloudflare deployment is needed.

After editing the form, run **Publish registration** in the `tlpt-registration`
repository's GitHub Actions for immediate publication. An hourly scheduled run
also refreshes the HTML automatically. GitHub can delay scheduled runs or disable
them after 60 days of repository inactivity; manual publishing stays available.
Shared assets load directly from the main site and need no separate copy.

Submissions, JSON and photos still go directly to FormSubmit and the same Gmail
inbox. No registration details are stored in either GitHub repository. The legacy
https://tlpt.org/register.html also continues working. The form is unlisted, not
password protected, and retains its no-index metadata and restrictive robots.txt.

Checks:

    node --test registration-domain/tests/pages.test.mjs
    node scripts/test-register-page.mjs

Build into an empty output directory:

    node registration-domain/build.mjs /tmp/tlpt-register-static

The retired Cloudflare registration gateway is recoverable in Git history
(commit `de6a4eca`); never remove or edit the separate cashier projects.
