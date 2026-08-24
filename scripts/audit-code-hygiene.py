#!/usr/bin/env python3
"""Fail fast on structural mistakes in the static TLPT site.

This audit intentionally does not calculate poker statistics. It protects the
HTML/CSS/asset contract around the existing, separately validated data model.
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_PAGES = {
    "champions.html",
    "dashboard.html",
    "form-lab.html",
    "gallery.html",
    "index.html",
    "knockouts.html",
    "media.html",
    "news.html",
    "player-movement.html",
    "player.html",
    "players.html",
    "rules.html",
    "schedule.html",
    "standings.html",
    "streaks.html",
    "trophy-room.html",
}
EXTERNAL_SCHEMES = {"data", "http", "https", "mailto", "tel"}


def is_local_reference(value: str) -> bool:
    value = value.strip()
    if not value or value.startswith("#") or value.startswith("//"):
        return False
    return urlsplit(value).scheme.lower() not in EXTERNAL_SCHEMES


def local_path(source: Path, value: str) -> Path:
    path = urlsplit(value).path
    if path.startswith("/"):
        return ROOT / path.lstrip("/")
    return source.parent / path


class PageAuditParser(HTMLParser):
    def __init__(self, page: Path) -> None:
        super().__init__(convert_charrefs=True)
        self.page = page
        self.errors: list[str] = []
        self.start_counts: Counter[str] = Counter()
        self.end_counts: Counter[str] = Counter()
        self.ids: list[str] = []
        self.has_viewport = False
        self.nav_depth = 0
        self.nav_links: list[str] = []
        self.stylesheets: list[str] = []

    def handle_starttag(self, tag: str, attrs_list: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attrs = {key.lower(): (value or "") for key, value in attrs_list}
        self.start_counts[tag] += 1

        if "id" in attrs:
            self.ids.append(attrs["id"])

        if tag == "meta" and attrs.get("name", "").lower() == "viewport":
            self.has_viewport = True

        classes = set(attrs.get("class", "").split())
        if tag == "nav" and "nav" in classes:
            self.nav_depth += 1
        elif self.nav_depth and tag == "nav":
            self.nav_depth += 1

        if self.nav_depth and tag == "a" and attrs.get("href"):
            self.nav_links.append(urlsplit(attrs["href"]).path)

        if tag == "button" and not attrs.get("type"):
            self.errors.append("button is missing an explicit type attribute")

        if tag == "a" and attrs.get("target", "").lower() == "_blank":
            rel_tokens = set(attrs.get("rel", "").lower().split())
            if "noopener" not in rel_tokens:
                self.errors.append(f'_blank link is missing rel="noopener": {attrs.get("href", "")})')

        if tag == "style":
            self.errors.append("inline <style> block found; move it to a page stylesheet")

        if tag == "script" and not attrs.get("src"):
            self.errors.append("inline <script> block found; move it to a JavaScript file")

        for attr_name in ("href", "src"):
            value = attrs.get(attr_name)
            if not value or not is_local_reference(value):
                continue
            target = local_path(self.page, value)
            if not target.exists():
                self.errors.append(f"missing local {attr_name} target: {value}")

        if tag == "link" and "stylesheet" in attrs.get("rel", "").lower().split():
            href = attrs.get("href", "")
            if is_local_reference(href):
                self.stylesheets.append(urlsplit(href).path)
            if is_local_reference(href) and not urlsplit(href).query.startswith("v="):
                self.errors.append(f"local stylesheet lacks a cache version: {href}")

        if tag == "script":
            src = attrs.get("src", "")
            if is_local_reference(src) and not urlsplit(src).query.startswith("v="):
                self.errors.append(f"local script lacks a cache version: {src}")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        self.end_counts[tag] += 1
        if tag == "nav" and self.nav_depth:
            self.nav_depth -= 1


def css_without_comments_or_strings(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    return re.sub(r"(['\"])(?:\\.|(?!\1).)*\1", '""', text, flags=re.DOTALL)


def audit_css(path: Path) -> list[str]:
    errors: list[str] = []
    text = path.read_text(encoding="utf-8")
    stripped = css_without_comments_or_strings(text)

    if stripped.count("{") != stripped.count("}"):
        errors.append(
            f"unbalanced braces: {stripped.count('{')} opening, {stripped.count('}')} closing"
        )
    if ":contains(" in text:
        errors.append("unsupported :contains() selector found")

    for match in re.finditer(r"url\(\s*(['\"]?)(.*?)\1\s*\)", text, flags=re.IGNORECASE):
        value = match.group(2).strip()
        if not value or value.startswith(("#", "data:", "var(")) or not is_local_reference(value):
            continue
        if not local_path(path, value).exists():
            errors.append(f"missing local url() target: {value}")

    return errors


def main() -> int:
    errors: list[str] = []
    pages = sorted(ROOT.glob("*.html"))
    page_names = {page.name for page in pages}

    missing_pages = sorted(EXPECTED_PAGES - page_names)
    unexpected_pages = sorted(page_names - EXPECTED_PAGES)
    if missing_pages:
        errors.append(f"site: missing expected pages: {', '.join(missing_pages)}")
    if unexpected_pages:
        errors.append(f"site: unexpected root pages: {', '.join(unexpected_pages)}")

    navigation_by_page: dict[str, list[str]] = {}
    for page in pages:
        parser = PageAuditParser(page)
        parser.feed(page.read_text(encoding="utf-8"))
        parser.close()

        for tag in ("html", "head", "body"):
            if parser.start_counts[tag] != 1 or parser.end_counts[tag] != 1:
                parser.errors.append(
                    f"expected one <{tag}> and one </{tag}>; found "
                    f"{parser.start_counts[tag]} and {parser.end_counts[tag]}"
                )
        if not parser.has_viewport:
            parser.errors.append("missing viewport meta tag")

        duplicate_ids = sorted(item for item, count in Counter(parser.ids).items() if count > 1)
        if duplicate_ids:
            parser.errors.append(f"duplicate id values: {', '.join(duplicate_ids)}")

        if not parser.nav_links:
            parser.errors.append("primary navigation was not found")
        else:
            navigation_by_page[page.name] = parser.nav_links

        expected_style_prefix = ["style.css"]
        if page.name == "rules.html":
            expected_style_prefix.append("rules.css")
        elif page.name == "media.html":
            expected_style_prefix.append("media.css")
        expected_style_prefix.append("site-tail.css")
        if parser.stylesheets[: len(expected_style_prefix)] != expected_style_prefix:
            parser.errors.append(
                "stylesheet ownership/order must begin with: "
                + " → ".join(expected_style_prefix)
            )

        if page.name != "rules.html" and "rules.css" in parser.stylesheets:
            parser.errors.append("rules.css may be loaded only by rules.html")
        if page.name != "media.html" and "media.css" in parser.stylesheets:
            parser.errors.append("media.css may be loaded only by media.html")

        errors.extend(f"{page.name}: {message}" for message in parser.errors)

    reference_nav = navigation_by_page.get("index.html", [])
    for page_name, nav_links in sorted(navigation_by_page.items()):
        if nav_links != reference_nav:
            errors.append(f"{page_name}: primary navigation links/order differ from index.html")

    for stylesheet in sorted(ROOT.glob("*.css")):
        errors.extend(f"{stylesheet.name}: {message}" for message in audit_css(stylesheet))

    if errors:
        print(f"❌ Code hygiene audit failed with {len(errors)} issue(s):")
        for error in errors:
            print(f" - {error}")
        return 1

    print(
        f"✅ Code hygiene audit passed: {len(pages)} HTML pages and "
        f"{len(list(ROOT.glob('*.css')))} stylesheets checked."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
