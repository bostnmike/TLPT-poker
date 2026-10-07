"""Validate Lily's isolation, portable assets, and inactive inquiry surface."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import re

SITE = Path(__file__).resolve().parent
ROOT = SITE.parent

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []
        self.assets = []
        self.forms = 0
        self.disabled_fieldset = False
        self.h1 = 0
        self.fields = 0
        self.in_disabled_fieldset = False
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            assert attrs["id"] not in self.ids, "Duplicate HTML ID"
            self.ids.add(attrs["id"])
        if tag == "h1": self.h1 += 1
        if tag == "a": self.links.append(attrs.get("href", ""))
        if tag in {"img", "script"}: self.assets.append(attrs.get("src", ""))
        if tag == "link": self.assets.append(attrs.get("href", ""))
        assert tag not in {"script", "iframe", "base"}, "Unexpected executable or external content"
        assert not any(k.startswith("on") for k in attrs), "Inline event handler is forbidden"
        if tag == "form":
            self.forms += 1
            assert "action" not in attrs, "Review form must have no destination"
            assert attrs.get("aria-describedby") == "form-status"
        if tag == "fieldset":
            assert "disabled" in attrs, "Review fieldset must be disabled"
            self.disabled_fieldset = self.in_disabled_fieldset = True
        if tag in {"input", "textarea", "button"}:
            self.fields += 1
            assert self.in_disabled_fieldset, "All controls must be disabled"
            if tag == "button":
                assert attrs.get("type") == "button" and "disabled" in attrs, "No submission button permitted"
    def handle_endtag(self, tag):
        if tag == "fieldset": self.in_disabled_fieldset = False

for path in (ROOT / "lily.html", SITE / "index.html"):
    text = path.read_text()
    assert not re.search(r"TLPT|Marchand|poker|testimonial|mailto:|\$75", text, re.I), "Private or unrelated content"
    assert 'name="robots" content="noindex, nofollow"' in text, "Review page must remain unindexed"
    parser = Page()
    parser.feed(text)
    assert parser.h1 == 1 and parser.forms == 1 and parser.disabled_fieldset and parser.fields == 5
    assert "cannot send or save information" in text
    for link in parser.links:
        assert link.startswith("#") and link[1:] in parser.ids, f"Broken or external navigation: {link}"
    for asset in parser.assets:
        assert not urlsplit(asset).scheme, "Remote asset dependency"
        target = (path.parent / asset).resolve()
        assert target.is_relative_to(SITE), f"Asset outside Lily directory: {asset}"
        assert target.is_file(), f"Missing asset: {asset}"
    print(f"PASS: {path.name}: isolated local assets, valid anchors, disabled form")

portable = (SITE / "index.html").read_text()
for asset in ("styles.css", "favicon.svg", "companions.svg"):
    portable = portable.replace(f'"./{asset}"', f'"lily-site/{asset}"')
assert (ROOT / "lily.html").read_text() == portable, "Root page differs from portable source; run lily-site/build.py"
css = (SITE / "styles.css").read_text()
assert "url(" not in css and "@import" not in css, "Styles must have no hidden remote/shared asset dependency"
print("PASS: portable source matches public route; no CSS network dependencies")
