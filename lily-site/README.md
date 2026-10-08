# Lily · Pet & House Sitting

A standalone, buildless microsite. All design, content, assets, and site-specific checks are in this directory. It has no shared site styles, scripts, navigation, remote fonts, or analytics. Its own `site-nav.js` controls the responsive menu and current-section indicator; it never reads, stores, or submits inquiry information.

## Edit and publish

Edit `index.html`, `styles.css`, and `inquiry-form.css` as needed. Increment the inquiry stylesheet’s `?v=` value when changing it so returning visitors receive the new styles, then run `python3 lily-site/build.py` from the repository root. This emits the complete `lily.html` route with asset paths adjusted to this directory. Run `bash scripts/run-quality-gates.sh` before publishing.

## Move to another host

Copy this directory to any static host and use `index.html` as the entry point. No build, package installation, or outside files are required. Both versions use relative local assets. `questionnaire.html` is the full text of the supplied planning workbook, preserving all questions, answers, draft ideas, and blank fields for review.

## Review status

All pages are marked `noindex, nofollow` during review. This discourages indexing but does not restrict public access.

At the user's explicit request to publish all supplied content, this review includes Lily's full name, the draft $75/day rate, the listed delivery email, and named potential references. Rates remain labeled draft and reference permissions remain labeled pending. No testimonials, photos, reference contact details, home address, or exact age were supplied. Template instructions in the full source record are reproduced as content rather than operational instructions.

## Inquiry delivery

The user selected `lilycaresforpets@gmail.com` and requested a live form. The visible form submits a native HTTPS POST to `https://formsubmit.co/lilycaresforpets@gmail.com`. It works without JavaScript. FormSubmit handles its spam-protection challenge and confirmation screen, then sends inquiries to Lily. The form groups stay details, pets, and contact information. Native start/end calendar controls and a service dropdown reduce typing. Browser validation requires dates, service, general area, pets, name, and a valid email; phone and additional notes are optional. `inquiry-form.js` opens supported native pickers, disallows past dates, and prevents reversed date ranges while accepting same-day care. It does not transmit or store information. Without JavaScript, native calendar controls and required-field validation remain available; cross-field date validation requires JavaScript. The email field supports replying directly to the sender. Default reCAPTCHA remains enabled, and a hidden honeypot adds spam protection.

**Inbox activated:** The user confirmed activation, and a live submission now reaches FormSubmit’s reCAPTCHA instead of its activation page. The public pending-confirmation notice has been replaced with inquiry guidance. A clearly labeled delivery test passed the spam check and reached FormSubmit’s successful-submission page. The user confirmed that the test arrived in Lily’s inbox, completing end-to-end delivery verification. Mailbox receipt was verified before removing the activation notice. FormSubmit retains submissions for 30 days according to its documentation. The form's visible privacy note names this service and tells visitors not to submit access codes or exact home addresses.

If the destination email changes, confirm and test the new inbox before treating delivery as verified. Run the build and full quality suite before republishing.

No mailbox credentials, private delivery address, browser storage, or client-side form submission code are embedded. The email link provides a direct fallback. The original questionnaire's proposed email remains preserved and labeled superseded. When moving the microsite, the same endpoint can be used, but verify delivery from the new host. Service documentation: https://formsubmit.co/documentation and https://formsubmit.co/help.

After successful submission, `_next` directs visitors to `thank-you.html` inside Lily's microsite. The date-control script derives that URL from its own asset location so normal use follows the microsite when it is moved. The hidden field also contains the current live HTTPS URL as a no-JavaScript fallback; update that fallback when hosting elsewhere. The confirmation page links only to Lily's portable site and business email.

The optional US phone field formats typing, pasted numbers, and autofill as `(XXX) XXX-XXXX`, accepts a leading country code `1`, and validates ten digits without silently discarding extra digits or letters. Email uses native `type=email` plus a complete-domain pattern. Both fields provide inline errors after leaving the field or attempting submission, clear errors when corrected, and retain native validation without JavaScript. These checks validate input format; they do not verify ownership or deliverability of a visitor's contact details.
