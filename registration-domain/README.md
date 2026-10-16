# Registration address

GitHub Pages project https://github.com/bostnmike/tlpt-registration serves the
unlisted form at https://register.tlpt.org/. Porkbun DNS has CNAME `register`
pointing to `bostnmike.github.io`, TTL 600. The main `tlpt.org` and cashier
configuration must not change.

The form's source of truth is still this repository's `register.html`.
`build.mjs` generates static registration HTML for GitHub Pages: main-site
assets/navigation, local skip link, and a branded FormSubmit success URL.
No Worker, proxy, runtime database or Cloudflare deployment is needed.

After registration changes reach `main`, **TLPT Registration Quality Gate** runs
the tests and automatically starts **Publish registration** in `tlpt-registration`.
The publisher reads the exact source commit recorded in `source-revision.txt`,
validates it again, and deploys it. The main workflow waits until both public
registration addresses and the shared form CSS/JS match the source. A failed or
stale publication fails the workflow; a successful push alone is not completion.
Publication starts automatically after checks and normally takes a few minutes.

The main repository's `REGISTRATION_PUBLISH_SSH_KEY` Actions secret holds a
dedicated write deploy key restricted to `tlpt-registration`. The matching public
key is registered there as **TLPT registration auto-publisher**. It cannot write
to the main site, cashier, or other repositories. The key advances only the
publisher's source-revision file; private key material never belongs in Git.
To rotate it, replace that deploy key and Actions secret together.
GitHub also removes keys created through GitHub CLI if its authorizing token is
revoked; recreate this dedicated key and secret if that happens.

Manual **Publish registration** and the hourly schedule remain recovery paths
and read the latest canonical `main`. GitHub can delay scheduled runs or disable
them after 60 days of repository inactivity. To rerun the full publish and
two-address verification, manually run **TLPT Registration Quality Gate** on
`main`. Shared assets load directly from the main site and need no separate copy.

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
