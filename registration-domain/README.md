# Registration address

Cloudflare Pages project `tlpt-register-domain` serves the existing unlisted
registration form at `https://register.tlpt.org/`. The gateway reads the current
public `https://tlpt.org/register.html`, so future form fixes need only be
published once. A base URL keeps assets and navigation on the main site; the
FormSubmit success destination returns to the registration subdomain.

The gateway stores no registrations, files, credentials, or contact information.
Form submissions continue directly to the existing FormSubmit endpoint and the
commissioner's Gmail inbox. The legacy registration address continues working.
The public form is unlisted, not protected by authentication.

Porkbun DNS: CNAME `register` -> `tlpt-register-domain.pages.dev`, TTL 600.
Associate `register.tlpt.org` under Pages > Custom domains before adding DNS.
Keep the existing root, www, cashier, wildcard, and verification records intact.
Cloudflare must finish hostname verification and TLS issuance before handoff.

Deploy only the three files in `site/` through Pages Direct Upload (advanced
mode). The root ZIP must contain `_worker.js`, `_routes.json`, and `index.html`.
No bindings, secrets, databases, paid plans, or nameserver changes are needed.
Wrangler configuration documents the equivalent deployment; do not expand CLI
OAuth permissions just to deploy when the existing dashboard session suffices.

Checks: `node --test registration-domain/tests/gateway.test.mjs`.
