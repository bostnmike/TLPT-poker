# Lily · Pet & House Sitting

A standalone, buildless microsite. All design, content, assets, scripts, and site-specific checks live here. There are no shared host-site styles or scripts, remote fonts, analytics, or storage dependencies.

## Edit and publish

Edit `index.html`, `styles.css`, and `inquiry-form.css` as needed. Increment their stylesheet query versions, and the form script’s query version when changing its behavior, so returning visitors receive the new files. Run `python3 lily-site/build.py` to emit the root `lily.html` route and `bash scripts/run-quality-gates.sh` before publishing.

The customer page is indexable and has a canonical URL and Open Graph sharing metadata. `social-card.svg` is the original editable source; `social-card.png` is its 1200 × 630 export. All artwork is original to Lily’s site. The original cream cat and brown dog return in `mascots/` as decorative illustrations, hidden from assistive technology and kept clear of text and controls. Motion is limited to optional smooth scrolling, disabled when reduced motion is requested.

## Content and review record

The user approved the customer-facing redesign and requested a clearly labeled portrait placeholder until an approved photo is supplied. No portrait, testimonial, client image, endorsement, or credential has been fabricated. The customer page presents five years of cat/dog care, lifelong cat experience, shy-pet patience, medication experience, one booking at a time, and a free meet-and-greet. Pricing is by quote. The service area remains “Serving the Triangle,” as the user requested. Visit lengths, walk lengths, and overnight timing are agreed before booking; no unsupported fixed duration or rate is promised.

`questionnaire.html` retains every supplied question, answer, draft, unchecked choice, blank field, and pending reference permission. Its source text is unchanged. Only back links and stylesheet references were updated. It remains available through the footer’s Review materials link and marked `noindex, nofollow`; this discourages indexing but does not restrict public access. The draft $75 rate, potential-reference names, and superseded planning email remain in that source record, as requested earlier, and are omitted from the customer journey.

## Inquiry delivery and confirmation

The activated inbox is `lilycaresforpets@gmail.com`. The form uses a native HTTPS POST to `https://formsubmit.co/lilycaresforpets@gmail.com`; default reCAPTCHA and the honeypot remain enabled. The user previously confirmed receipt of a labeled delivery test. The form names FormSubmit in its privacy note and asks visitors not to submit access codes or exact home addresses. FormSubmit retains submissions for 30 days according to its documentation.

After successful submission, `_next` returns to `https://www.tlpt.org/lily.html#inquiry-sent`. The www host redirects to the canonical Lily route. The fragment reveals an accessible confirmation panel using CSS, including a 24–48 hour reply window and a reminder that dates, care, and a quote must be confirmed before booking. No JavaScript initiates form transmission or sets a successful-delivery state before the service’s redirect. Direct email remains available below the form on phones and beside it on wider screens. `thank-you.html` remains a supporting standalone confirmation page, but is not the form’s configured destination.

Native calendars require a start and end date. `inquiry-form.js` validates past/reversed dates, accepts same-day care, and warns about ranges including December 24 or 25, including ranges spanning years. The warning is informational, so a visitor can explain alternate dates in their notes. Service-card shortcuts preselect the matching service. Required fields have associated inline errors; phone is optional and formats as `(XXX) XXX-XXXX`, accepts a leading country code `1`, and preserves invalid letters or excess digits for correction. Email uses native `type=email` and a complete-domain pattern. Format checks do not establish ownership or deliverability. Without JavaScript, native required-field, phone/email-pattern validation, calendars, and CSS confirmation remain available; cross-field dates, formatting, service preselection, and holiday warnings require JavaScript.

No mailbox credentials, private delivery email, browser storage, or client-side data-transmission code is embedded. Service documentation: https://formsubmit.co/documentation and https://formsubmit.co/help.

## Move to another host

Copy this entire directory and use `index.html` as the entry point. No outside files, build, or package install are required. Update the canonical URL, Open Graph URL/image, and the `_next` hidden-field destination to the new host; retain `#inquiry-sent` for confirmation. Verify delivery from that origin before considering the migrated form active. A Lily-specific domain is a future option; none has been purchased or configured.
