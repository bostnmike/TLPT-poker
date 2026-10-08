"""Validate Lily's isolation, portable assets, and inquiry delivery configuration."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import re

SITE = Path(__file__).resolve().parent
ROOT = SITE.parent
EMAIL_LINK = 'mailto:lilycaresforpets@gmail.com'
FORM_ENDPOINT = 'https://formsubmit.co/lilycaresforpets@gmail.com'
PRIVACY_LINK = 'https://formsubmit.co/privacy.pdf'

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []
        self.assets = []
        self.forms = 0
        self.h1 = 0
        self.fields = 0
        self.in_form = False
        self.form_fields = {}
        self.submit_buttons = 0
        self.navigation_controls = []
        self.scripts = 0
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            assert attrs["id"] not in self.ids, "Duplicate HTML ID"
            self.ids.add(attrs["id"])
        if tag == "h1": self.h1 += 1
        if tag == "a": self.links.append(attrs.get("href", ""))
        if tag in {"img", "script"}: self.assets.append(attrs.get("src", ""))
        if tag == "link": self.assets.append(attrs.get("href", ""))
        assert tag not in {"iframe", "base"}, "Unexpected external content"
        if tag == "script":
            self.scripts += 1
            assert attrs.get("src", "").endswith("/site-nav.js") and "defer" in attrs, "Only deferred standalone navigation code is permitted"
        assert not any(k.startswith("on") for k in attrs), "Inline event handler is forbidden"
        if tag == "form":
            self.forms += 1
            self.in_form = True
            assert attrs.get("action") == FORM_ENDPOINT, "Inquiry must use Lily's exact HTTPS endpoint"
            assert attrs.get("method", "").lower() == "post", "Inquiry data must not enter the URL"
            assert set(attrs.get("aria-describedby", "").split()) == {"form-help", "form-status", "privacy-note"}
        if tag == "fieldset":
            assert self.in_form and "disabled" not in attrs, "Inquiry fields must be enabled"
        if tag == "button" and "data-nav-toggle" in attrs:
            assert not self.in_form, "Navigation control cannot be inside the inquiry form"
            assert attrs.get("type") == "button" and attrs.get("aria-expanded") == "false"
            self.navigation_controls.append(attrs.get("aria-controls"))
        elif tag in {"input", "textarea", "button"}:
            self.fields += 1
            assert self.in_form and "disabled" not in attrs, "Inquiry controls must be enabled and inside the form"
            if tag == "button":
                assert attrs.get("type") == "submit", "Inquiry button must submit"
                self.submit_buttons += 1
            else:
                name = attrs.get("name")
                assert name and name not in self.form_fields, "Every inquiry field needs a unique name"
                self.form_fields[name] = attrs
    def handle_endtag(self, tag):
        if tag == "form": self.in_form = False

pages = {}
for path in (ROOT / "lily.html", SITE / "index.html", SITE / "questionnaire.html"):
    text = path.read_text()
    assert not re.search(r"TLPT|Marchand|poker", text, re.I), "Unrelated branding or content"
    assert 'name="robots" content="noindex, nofollow"' in text, "Review page must remain unindexed"
    parser = Page()
    parser.feed(text)
    assert parser.h1 == 1 and parser.scripts == 1
    assert len(parser.navigation_controls) == 1 and parser.navigation_controls[0] in parser.ids, "Menu control must point to its navigation"
    if path.name != 'questionnaire.html':
        assert parser.forms == 1 and parser.fields == 12 and parser.submit_buttons == 1
        fields = parser.form_fields
        assert set(fields) == {"name", "email", "phone", "dates", "pets", "service", "location", "message", "_subject", "_template", "_honey"}
        for name in ("name", "email", "dates", "pets", "service", "location", "message"):
            assert "required" in fields[name] and int(fields[name]["maxlength"]) > 0, f"Missing validation: {name}"
        assert fields["email"].get("type") == "email"
        assert "required" not in fields["phone"] and fields["phone"].get("type") == "tel"
        assert fields["_template"].get("value") == "table" and fields["_template"].get("type") == "hidden"
        assert fields["_subject"].get("type") == "hidden" and fields["_subject"].get("value")
        assert fields["_honey"].get("class") == "form-honeypot" and fields["_honey"].get("tabindex") == "-1" and fields["_honey"].get("aria-hidden") == "true"
        assert "Email confirmation pending" in text and "one-time confirmation" in text, "Do not claim verified email delivery before activation"
        assert PRIVACY_LINK in parser.links and "processed by FormSubmit" in text
        assert text.count('class="review-badge">Permission pending') == 3, "Reference permission states missing"
        assert '$75/day' in text and 'draft pet and house sitting rate' in text, "Draft rate must be labeled"
        assert EMAIL_LINK in parser.links, "Direct email fallback must remain available"
    else:
        assert parser.forms == 0 and parser.fields == 0, "Source record must be read-only"
        assert 'Template instructions are reproduced as source material' in text
    pages[path.resolve()] = parser
    for asset in parser.assets:
        assert not urlsplit(asset).scheme, "Remote asset dependency"
        target = (path.parent / asset).resolve()
        assert target.is_relative_to(SITE), f"Asset outside Lily directory: {asset}"
        assert target.is_file(), f"Missing asset: {asset}"
    print(f"PASS: {path.name}: isolated assets, review labels, validated inquiry or read-only source")

for path, parser in pages.items():
    for link in parser.links:
        if link in {EMAIL_LINK, PRIVACY_LINK}:
            continue
        parsed = urlsplit(link)
        assert not parsed.scheme and not parsed.netloc, f"Unexpected external navigation: {link}"
        target = (path.parent / parsed.path).resolve() if parsed.path else path
        assert target in pages, f"Link escapes portable site or points to unvalidated page: {link}"
        if parsed.fragment:
            assert parsed.fragment in pages[target].ids, f"Broken anchor: {link}"

portable = (SITE / "index.html").read_text()
for asset in ("styles.css", "inquiry-form.css", "favicon.svg", "companions.svg", "questionnaire.html", "site-nav.js"):
    portable = portable.replace(f'"./{asset}"', f'"lily-site/{asset}"')
assert (ROOT / "lily.html").read_text() == portable, "Root page differs from portable source; run lily-site/build.py"
for path in SITE.glob("*.css"):
    css = path.read_text()
    assert "url(" not in css and "@import" not in css, "Styles must have no hidden remote/shared asset dependency"
navigation = (SITE / 'site-nav.js').read_text()
assert not re.search(r'\b(?:fetch|XMLHttpRequest|WebSocket|FormData|localStorage|sessionStorage|sendBeacon)\b|\.submit\s*\(', navigation), "Navigation code must not transmit, store, or submit form information"
print("PASS: portable navigation, source parity, exact inquiry endpoint, validation, privacy, and spam protection")
