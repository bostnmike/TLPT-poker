#!/usr/bin/env python3
"""Fail fast on structural mistakes in the static TLPT site.

This audit intentionally does not calculate poker statistics. It protects the
HTML/CSS/asset contract around the existing, separately validated data model.
"""

from __future__ import annotations

import re
import sys
from collections import Counter, defaultdict
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
STYLE_FOUNDATION_SELECTORS = {
    "[hidden]",
    ".page-title-row",
    ".site-page-hero",
    ".site-page-hero-chip",
    ".site-page-hero-copy",
    ".site-page-hero-description",
    ".site-page-hero-kicker",
    ".site-page-hero-lower",
    ".site-page-hero-title",
    ".site-footer",
    ".site-page-title",
    ".site-page-title-long",
    "body",
    "html",
}
RSVP_DESKTOP_AVATAR_SELECTORS = {
    ".event-rsvp-avatar-row .player-avatar.table",
    ".event-rsvp-avatar-row .player-avatar-fallback.table",
}
RSVP_DESKTOP_AVATAR_SIZE = "96px"
RSVP_MOBILE_AVATAR_SIZE = "64px"
EXPECTED_FOOTER_TEXT = (
    "TLPT is a BostnMike Production... and all that, that entails. "
    "Site data fueled by The Tournament Director"
)
EXPECTED_FOOTER_URL = "https://thetournamentdirector.net/"
EXPECTED_NAV_ACTIVE_LABELS = {
    "champions.html": ["Roast Zone", "The Hall"],
    "dashboard.html": ["The Metrics", "Dashboard"],
    "form-lab.html": ["The Metrics", "The Form Lab"],
    "gallery.html": ["Media", "The Gallery"],
    "index.html": ["Home"],
    "knockouts.html": ["The Metrics", "Knockout Central"],
    "media.html": ["Media", "The Film"],
    "news.html": ["Roast Zone", "The Week That Was"],
    "player-movement.html": ["The Metrics", "The Heater Meter"],
    "player.html": ["Members", "Player Profiles"],
    "players.html": ["Members", "TLPT Crew"],
    "rules.html": ["The Rules"],
    "schedule.html": ["The Schedule"],
    "standings.html": ["The Metrics", "Standings"],
    "streaks.html": ["The Metrics", "Streak Tracker"],
    "trophy-room.html": ["Members", "The Trophy Room"],
}
EXPECTED_NAV_CURRENT_LABEL = {
    page: labels[-1] for page, labels in EXPECTED_NAV_ACTIVE_LABELS.items()
}
EXPECTED_PAGE_TITLES = {
    "champions.html": "TLPT Hall of In-FAM[E]-Y",
    "dashboard.html": "TLPT Dashboard",
    "form-lab.html": "The Form Lab | TLPT",
    "gallery.html": "The Gallery | TLPT Poker League",
    "index.html": "TLPT Poker League",
    "knockouts.html": "Knockout Central | TLPT Poker League",
    "media.html": "TLPT Film Room",
    "news.html": "TLPT News",
    "player-movement.html": "The Heater Meter | TLPT",
    "player.html": "Player Profile | TLPT Poker League",
    "players.html": "TLPT Players",
    "rules.html": "TLPT Rules",
    "schedule.html": "TLPT Schedule",
    "standings.html": "TLPT Standings",
    "streaks.html": "TLPT Streak Tracker",
    "trophy-room.html": "TLPT Trophy Room",
}
UNIFIED_TITLE_PAGES = {
    "dashboard.html": "TLPT Metrics",
    "form-lab.html": "The Form Lab",
    "gallery.html": "The Gallery",
    "index.html": "Welcome to TLPT Poker League",
    "knockouts.html": "Knockout Central",
    "media.html": "TLPT Film Room",
    "news.html": "The Week That Was",
    "player-movement.html": "The Heater Meter",
    "players.html": "Meet the Crew",
    "rules.html": "TLPT Rules & Structures",
    "schedule.html": "Next at Caahhd Room",
    "standings.html": "Sortable League Standings",
    "streaks.html": "TLPT Streak Tracker",
}
TROPHY_INSPIRED_HERO_PAGES = {
    "dashboard.html",
    "form-lab.html",
    "gallery.html",
    "index.html",
    "knockouts.html",
    "media.html",
    "player-movement.html",
    "players.html",
    "rules.html",
    "schedule.html",
    "standings.html",
    "streaks.html",
}
EXPECTED_META_DESCRIPTIONS = {
    "champions.html": "Explore TLPT Poker League champions, honors, streaks, milestones, and the Hall of In-FAM[E]-Y.",
    "dashboard.html": "Explore TLPT Poker League standings, player performance, rankings, trends, and league-wide metrics.",
    "form-lab.html": "Track recent TLPT Poker League player form, momentum, and performance across the latest events.",
    "gallery.html": "Browse photos and memories from TLPT Poker League events in The Gallery.",
    "index.html": "Follow the TLPT Poker League schedule, players, standings, statistics, honors, and latest league stories.",
    "knockouts.html": "Explore TLPT Poker League knockout totals, hit leaders, event eliminations, and head-to-head damage.",
    "media.html": "Watch TLPT Poker League films, highlights, and featured videos in the Film Room.",
    "news.html": "Read The Week That Was for TLPT Poker League event recaps, featured stories, spotlights, and quick hits.",
    "player-movement.html": "Follow TLPT Poker League player movement, recent rating changes, risers, fallers, and momentum.",
    "player.html": "View a TLPT Poker League player profile, Ultimate Player Card, statistics, honors, and card collection.",
    "players.html": "Meet the TLPT Poker League crew and compare tiered Ultimate Player Cards, ratings, and play styles.",
    "rules.html": "Review TLPT Poker League rules, structures, rebuy policies, blind levels, and room etiquette.",
    "schedule.html": "View upcoming TLPT Poker League events, formats, dates, and RSVP information.",
    "standings.html": "Sort and compare TLPT Poker League standings, profits, results, entries, and performance statistics.",
    "streaks.html": "Track TLPT Poker League cashing, appearance, and performance streaks.",
    "trophy-room.html": "Browse collectible TLPT Poker League special-edition player cards and career achievements in the Trophy Room.",
}
EXPECTED_VIEWPORT = "width=device-width, initial-scale=1.0"
EXPECTED_ICON_LINKS = [
    ("icon", "images/site/favicon-32.png", "image/png", "32x32"),
    ("icon", "images/site/favicon-16.png", "image/png", "16x16"),
    ("apple-touch-icon", "images/site/apple-touch-icon.png", "", "180x180"),
]
SHARED_SHELL_SCRIPT = "site-shell.js"
JAVASCRIPT_INLINE_HANDLER = re.compile(
    r"\bon[a-z]+\s*=\s*(['\"])",
    flags=re.IGNORECASE,
)
JAVASCRIPT_HIDDEN_STYLE = re.compile(
    r"style\s*=\s*(['\"])\s*display\s*:\s*none\s*;?\s*\1",
    flags=re.IGNORECASE,
)
JAVASCRIPT_IMAGE_ERROR_ACTION = re.compile(
    r'data-image-error-action="([a-z-]+)"',
    flags=re.IGNORECASE,
)
EXPECTED_IMAGE_ERROR_ACTIONS = {
    "candidate-list",
    "fallback-source",
    "mark-parent",
    "replace-with-next",
    "show-next",
}
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
        self.html_lang = ""
        self.charsets: list[str] = []
        self.viewports: list[str] = []
        self.descriptions: list[str] = []
        self.title_depth = 0
        self.title_text: list[str] = []
        self.icon_links: list[tuple[str, str, str, str]] = []
        self.nav_depth = 0
        self.nav_links: list[str] = []
        self.nav_link_records: list[dict[str, object]] = []
        self.open_nav_link: dict[str, object] | None = None
        self.stylesheets: list[str] = []
        self.scripts: list[str] = []
        self.html_classes: set[str] = set()
        self.body_classes: set[str] = set()
        self.class_counts: Counter[str] = Counter()
        self.site_footer_depth = 0
        self.site_footer_count = 0
        self.site_footer_inner_count = 0
        self.site_footer_links: list[dict[str, str]] = []
        self.site_footer_text: list[str] = []
        self.site_page_title_count = 0
        self.site_page_title_tag = ""
        self.site_page_title_depth = 0
        self.site_page_title_text: list[str] = []

    def handle_starttag(self, tag: str, attrs_list: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attrs = {key.lower(): (value or "") for key, value in attrs_list}
        self.start_counts[tag] += 1

        if "id" in attrs:
            self.ids.append(attrs["id"])

        if tag == "meta":
            if "charset" in attrs:
                self.charsets.append(attrs["charset"])
            meta_name = attrs.get("name", "").lower()
            if meta_name == "viewport":
                self.viewports.append(attrs.get("content", ""))
            elif meta_name == "description":
                self.descriptions.append(attrs.get("content", "").strip())

        if tag == "title":
            self.title_depth += 1

        classes = set(attrs.get("class", "").split())
        self.class_counts.update(classes)
        if "site-page-title" in classes:
            self.site_page_title_count += 1
            self.site_page_title_tag = tag
            self.site_page_title_depth += 1
            if tag not in {"h1", "h2"}:
                self.errors.append("site-page-title must be applied to an h1 or h2")
        if tag == "html":
            self.html_classes = classes
            self.html_lang = attrs.get("lang", "")
        elif tag == "body":
            self.body_classes = classes

        if tag == "link":
            rel = attrs.get("rel", "").lower()
            if rel in {"icon", "apple-touch-icon"}:
                self.icon_links.append(
                    (
                        rel,
                        attrs.get("href", ""),
                        attrs.get("type", ""),
                        attrs.get("sizes", ""),
                    )
                )

        if tag == "footer" and "site-footer" in classes:
            self.site_footer_depth += 1
            self.site_footer_count += 1
        elif self.site_footer_depth and tag == "footer":
            self.site_footer_depth += 1

        if self.site_footer_depth:
            if tag == "div" and "site-footer-inner" in classes:
                self.site_footer_inner_count += 1
            if tag == "a":
                self.site_footer_links.append(attrs)

        if tag == "nav" and "nav" in classes:
            self.nav_depth += 1
        elif self.nav_depth and tag == "nav":
            self.nav_depth += 1

        if self.nav_depth and tag == "a" and attrs.get("href"):
            self.nav_links.append(urlsplit(attrs["href"]).path)
            self.open_nav_link = {
                "href": attrs["href"],
                "classes": classes,
                "aria_current": attrs.get("aria-current", "").lower(),
                "text": [],
            }
            self.nav_link_records.append(self.open_nav_link)

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

        if "style" in attrs:
            self.errors.append("inline style attribute found; move presentation to CSS or use semantic state")

        inline_handlers = sorted(
            attr_name for attr_name in attrs if re.fullmatch(r"on[a-z]+", attr_name)
        )
        for attr_name in inline_handlers:
            self.errors.append(
                f"inline {attr_name} handler found; move behavior to a JavaScript module"
            )

        if (
            tag == "img"
            and attrs.get("src", "").startswith("images/site/chip-T-")
            and "data-hide-on-error" not in attrs
        ):
            self.errors.append(
                "static title-chip image is missing data-hide-on-error"
            )

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
            if src and is_local_reference(src):
                self.scripts.append(urlsplit(src).path)
            if is_local_reference(src) and not urlsplit(src).query.startswith("v="):
                self.errors.append(f"local script lacks a cache version: {src}")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        self.end_counts[tag] += 1
        if tag == "nav" and self.nav_depth:
            self.nav_depth -= 1
        if tag == "a" and self.open_nav_link is not None:
            self.open_nav_link = None
        if tag == "title" and self.title_depth:
            self.title_depth -= 1
        if tag == "footer" and self.site_footer_depth:
            self.site_footer_depth -= 1
        if (
            self.site_page_title_depth
            and tag == self.site_page_title_tag
        ):
            self.site_page_title_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.title_depth:
            self.title_text.append(data)
        if self.open_nav_link is not None:
            text_parts = self.open_nav_link["text"]
            assert isinstance(text_parts, list)
            text_parts.append(data)
        if self.site_footer_depth:
            self.site_footer_text.append(data)
        if self.site_page_title_depth:
            self.site_page_title_text.append(data)


def css_without_comments_or_strings(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    return re.sub(r"(['\"])(?:\\.|(?!\1).)*\1", '""', text, flags=re.DOTALL)


def normalize_css_fragment(value: str) -> str:
    value = re.sub(r"/\*.*?\*/", " ", value, flags=re.DOTALL)
    return re.sub(r"\s+", " ", value).strip()


def matching_css_brace(text: str, opening: int) -> int:
    depth = 1
    quote: str | None = None
    escaped = False
    in_comment = False
    index = opening + 1

    while index < len(text):
        char = text[index]
        following = text[index + 1] if index + 1 < len(text) else ""
        if in_comment:
            if char == "*" and following == "/":
                in_comment = False
                index += 2
                continue
        elif quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
        elif char == "/" and following == "*":
            in_comment = True
            index += 2
            continue
        elif char in "'\"":
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return index
        index += 1

    raise ValueError(f"unclosed CSS block at character {opening}")


def css_rule_blocks(text: str) -> list[tuple[tuple[str, ...], str, str, int]]:
    blocks: list[tuple[tuple[str, ...], str, str, int]] = []

    def parse_range(start: int, end: int, context: tuple[str, ...]) -> None:
        cursor = start
        while cursor < end:
            while cursor < end and text[cursor].isspace():
                cursor += 1
            if text.startswith("/*", cursor):
                close_comment = text.find("*/", cursor + 2, end)
                cursor = end if close_comment < 0 else close_comment + 2
                continue
            if cursor >= end:
                break

            header_start = cursor
            quote: str | None = None
            escaped = False
            in_comment = False
            delimiter = ""
            while cursor < end:
                char = text[cursor]
                following = text[cursor + 1] if cursor + 1 < end else ""
                if in_comment:
                    if char == "*" and following == "/":
                        in_comment = False
                        cursor += 2
                        continue
                elif quote:
                    if escaped:
                        escaped = False
                    elif char == "\\":
                        escaped = True
                    elif char == quote:
                        quote = None
                elif char == "/" and following == "*":
                    in_comment = True
                    cursor += 2
                    continue
                elif char in "'\"":
                    quote = char
                elif char in "{;}":
                    delimiter = char
                    break
                cursor += 1

            if not delimiter:
                break
            header = normalize_css_fragment(text[header_start:cursor])
            if delimiter == ";":
                cursor += 1
                continue

            close = matching_css_brace(text, cursor)
            body_start = cursor + 1
            if header.startswith(("@media", "@supports", "@container", "@layer")):
                parse_range(body_start, close, (*context, header))
            elif not header.startswith("@"):
                blocks.append(
                    (
                        context,
                        header,
                        normalize_css_fragment(text[body_start:close]),
                        text.count("\n", 0, header_start) + 1,
                    )
                )
            cursor = close + 1

    parse_range(0, len(text), ())
    return blocks


def exact_duplicate_css_blocks(text: str) -> list[str]:
    grouped: dict[tuple[tuple[str, ...], str, str], list[int]] = defaultdict(list)
    for context, selector, body, line in css_rule_blocks(text):
        grouped[(context, selector, body)].append(line)

    errors: list[str] = []
    for (context, selector, _body), lines in grouped.items():
        if len(lines) < 2:
            continue
        location = " > ".join(context) or "root"
        line_list = ", ".join(str(line) for line in lines)
        errors.append(
            f"exact duplicate CSS block at lines {line_list} ({location}): {selector}"
        )
    return sorted(errors)


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

    try:
        errors.extend(exact_duplicate_css_blocks(text))
    except ValueError as exc:
        errors.append(str(exc))

    for match in re.finditer(r"url\(\s*(['\"]?)(.*?)\1\s*\)", text, flags=re.IGNORECASE):
        value = match.group(2).strip()
        if not value or value.startswith(("#", "data:", "var(")) or not is_local_reference(value):
            continue
        if not local_path(path, value).exists():
            errors.append(f"missing local url() target: {value}")

    return errors


def audit_javascript(path: Path) -> list[str]:
    """Reject executable or presentational HTML embedded in JS templates."""

    errors: list[str] = []
    text = path.read_text(encoding="utf-8")

    for line_number, line in enumerate(text.splitlines(), start=1):
        if JAVASCRIPT_INLINE_HANDLER.search(line):
            errors.append(
                f"line {line_number}: generated inline event handler found; "
                "use site-shell.js or addEventListener"
            )
        if JAVASCRIPT_HIDDEN_STYLE.search(line):
            errors.append(
                f"line {line_number}: generated display:none style found; "
                "use the hidden attribute"
            )
        for match in JAVASCRIPT_IMAGE_ERROR_ACTION.finditer(line):
            action = match.group(1).lower()
            if action not in EXPECTED_IMAGE_ERROR_ACTIONS:
                errors.append(
                    f"line {line_number}: unknown data-image-error-action: {action}"
                )

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
        if parser.html_lang.lower() != "en":
            parser.errors.append('root <html> must use lang="en"')
        if parser.charsets != ["UTF-8"]:
            parser.errors.append('document must contain exactly one charset="UTF-8" meta tag')
        if parser.viewports != [EXPECTED_VIEWPORT]:
            parser.errors.append(
                "document must contain exactly one canonical viewport meta tag"
            )

        page_title = " ".join(" ".join(parser.title_text).split())
        if page_title != EXPECTED_PAGE_TITLES.get(page.name, ""):
            parser.errors.append("document title differs from the page-head contract")

        expected_site_page_title = UNIFIED_TITLE_PAGES.get(page.name)
        rendered_site_page_title = " ".join(
            " ".join(parser.site_page_title_text).split()
        )
        if expected_site_page_title:
            if parser.site_page_title_count != 1:
                parser.errors.append(
                    "expected exactly one shared site-page-title heading"
                )
            elif rendered_site_page_title != expected_site_page_title:
                parser.errors.append(
                    "shared site-page-title text differs from the page contract"
                )
        elif parser.site_page_title_count:
            parser.errors.append(
                "site-page-title is reserved for the current Phase 3A rollout"
            )

        if page.name in TROPHY_INSPIRED_HERO_PAGES:
            for required_class in (
                "site-page-hero",
                "site-page-hero-copy",
                "site-page-hero-kicker",
                "site-page-hero-title",
                "site-page-hero-chip",
            ):
                if parser.class_counts[required_class] != 1:
                    parser.errors.append(
                        f"expected exactly one .{required_class} in the Phase 3A page hero"
                    )

        expected_description = EXPECTED_META_DESCRIPTIONS.get(page.name, "")
        if parser.descriptions != [expected_description]:
            parser.errors.append("meta description differs from the page-head contract")

        if parser.icon_links != EXPECTED_ICON_LINKS:
            parser.errors.append("favicon links differ from the shared page-head contract")

        if parser.site_footer_count != 1:
            parser.errors.append(
                f"expected one site footer; found {parser.site_footer_count}"
            )
        if parser.site_footer_inner_count != 1:
            parser.errors.append(
                "site footer must contain exactly one .site-footer-inner wrapper"
            )

        footer_text = " ".join(" ".join(parser.site_footer_text).split())
        if footer_text != EXPECTED_FOOTER_TEXT:
            parser.errors.append("site footer text differs from the shared footer contract")

        if len(parser.site_footer_links) != 1:
            parser.errors.append(
                "site footer must contain exactly one Tournament Director link"
            )
        else:
            footer_link = parser.site_footer_links[0]
            footer_rel = set(footer_link.get("rel", "").lower().split())
            if footer_link.get("href") != EXPECTED_FOOTER_URL:
                parser.errors.append("site footer has the wrong Tournament Director URL")
            if footer_link.get("target", "").lower() != "_blank":
                parser.errors.append("site footer link must open in a new tab")
            if not {"noopener", "noreferrer"}.issubset(footer_rel):
                parser.errors.append(
                    'site footer link must use rel="noopener noreferrer"'
                )

        duplicate_ids = sorted(item for item, count in Counter(parser.ids).items() if count > 1)
        if duplicate_ids:
            parser.errors.append(f"duplicate id values: {', '.join(duplicate_ids)}")

        if not parser.nav_links:
            parser.errors.append("primary navigation was not found")
        else:
            navigation_by_page[page.name] = parser.nav_links

        nav_active_labels: list[str] = []
        nav_current_labels: list[str] = []
        for record in parser.nav_link_records:
            text_parts = record["text"]
            classes = record["classes"]
            assert isinstance(text_parts, list)
            assert isinstance(classes, set)
            label = " ".join(" ".join(text_parts).split())
            if "is-active" in classes:
                nav_active_labels.append(label)
            if record["aria_current"] == "page":
                nav_current_labels.append(label)

        expected_active_labels = EXPECTED_NAV_ACTIVE_LABELS.get(page.name, [])
        if nav_active_labels != expected_active_labels:
            parser.errors.append(
                "active navigation labels must be: "
                + " → ".join(expected_active_labels)
            )

        expected_current_label = EXPECTED_NAV_CURRENT_LABEL.get(page.name, "")
        if nav_current_labels != [expected_current_label]:
            parser.errors.append(
                "navigation must expose exactly one aria-current page link: "
                + expected_current_label
            )

        expected_style_prefix = ["style.css"]
        if page.name == "rules.html":
            expected_style_prefix.append("rules.css")
        elif page.name == "media.html":
            expected_style_prefix.append("media.css")
        expected_style_prefix.append("site-tail.css")
        if page.name == "index.html":
            expected_style_prefix.append("home.css")
        elif page.name == "schedule.html":
            expected_style_prefix.append("schedule.css")
        elif page.name == "news.html":
            expected_style_prefix.append("news.css")
        if parser.stylesheets[: len(expected_style_prefix)] != expected_style_prefix:
            parser.errors.append(
                "stylesheet ownership/order must begin with: "
                + " → ".join(expected_style_prefix)
            )

        if parser.scripts.count(SHARED_SHELL_SCRIPT) != 1:
            parser.errors.append("site-shell.js must be loaded exactly once")
        elif parser.scripts[0] != SHARED_SHELL_SCRIPT:
            parser.errors.append("site-shell.js must load before page and feature scripts")

        if page.name != "rules.html" and "rules.css" in parser.stylesheets:
            parser.errors.append("rules.css may be loaded only by rules.html")
        if page.name != "media.html" and "media.css" in parser.stylesheets:
            parser.errors.append("media.css may be loaded only by media.html")
        if page.name != "index.html" and "home.css" in parser.stylesheets:
            parser.errors.append("home.css may be loaded only by index.html")
        if page.name != "schedule.html" and "schedule.css" in parser.stylesheets:
            parser.errors.append("schedule.css may be loaded only by schedule.html")
        if page.name != "news.html" and "news.css" in parser.stylesheets:
            parser.errors.append("news.css may be loaded only by news.html")

        if page.name == "news.html":
            if "news-page" not in parser.html_classes:
                parser.errors.append("News page <html> is missing the news-page class")
            if "news-page" not in parser.body_classes:
                parser.errors.append("News page <body> is missing the news-page class")
        elif "news-page" in parser.html_classes or "news-page" in parser.body_classes:
            parser.errors.append("news-page class may be used only by news.html")

        errors.extend(f"{page.name}: {message}" for message in parser.errors)

    reference_nav = navigation_by_page.get("index.html", [])
    for page_name, nav_links in sorted(navigation_by_page.items()):
        if nav_links != reference_nav:
            errors.append(f"{page_name}: primary navigation links/order differ from index.html")

    for stylesheet in sorted(ROOT.glob("*.css")):
        stylesheet_text = stylesheet.read_text(encoding="utf-8")
        errors.extend(f"{stylesheet.name}: {message}" for message in audit_css(stylesheet))
        if stylesheet.name == "style.css":
            root_style_rules = [
                (selector, body, line)
                for context, selector, body, line in css_rule_blocks(stylesheet_text)
                if not context
            ]
            hidden_rules = [
                (body, line)
                for selector, body, line in root_style_rules
                if selector == "[hidden]"
            ]
            if len(hidden_rules) != 1:
                errors.append(
                    "style.css: expected exactly one root [hidden] visibility rule"
                )
            elif not re.search(
                r"(?:^|;)\s*display\s*:\s*none\s*!important\s*(?:;|$)",
                hidden_rules[0][0],
                flags=re.IGNORECASE,
            ):
                errors.append(
                    "style.css: root [hidden] rule must enforce display:none !important"
                )
            rsvp_avatar_rules = [
                (body, line)
                for selector, body, line in root_style_rules
                if RSVP_DESKTOP_AVATAR_SELECTORS.issubset(
                    {part.strip() for part in selector.split(",")}
                )
            ]
            if len(rsvp_avatar_rules) != 1:
                errors.append(
                    "style.css: expected exactly one RSVP-specific desktop table-avatar rule"
                )
            else:
                rsvp_body, rsvp_line = rsvp_avatar_rules[0]
                for dimension in ("width", "height"):
                    if not re.search(
                        rf"(?:^|;)\s*{dimension}\s*:\s*{re.escape(RSVP_DESKTOP_AVATAR_SIZE)}\s*(?:;|$)",
                        rsvp_body,
                        flags=re.IGNORECASE,
                    ):
                        errors.append(
                            f"style.css:{rsvp_line}: RSVP desktop avatar {dimension} "
                            f"must be {RSVP_DESKTOP_AVATAR_SIZE}"
                        )
                if "!important" in rsvp_body.lower():
                    errors.append(
                        f"style.css:{rsvp_line}: RSVP desktop avatar rule must not use !important"
                    )
            continue
        if stylesheet.name == "site-tail.css":
            rsvp_mobile_rules = [
                (body, line)
                for context, selector, body, line in css_rule_blocks(stylesheet_text)
                if any("@media (max-width:640px)" == scope for scope in context)
                and RSVP_DESKTOP_AVATAR_SELECTORS.issubset(
                    {part.strip() for part in selector.split(",")}
                )
            ]
            if len(rsvp_mobile_rules) != 1:
                errors.append(
                    "site-tail.css: expected exactly one RSVP-specific 640px table-avatar rule"
                )
            else:
                rsvp_body, rsvp_line = rsvp_mobile_rules[0]
                for dimension in ("width", "height"):
                    if not re.search(
                        rf"(?:^|;)\s*{dimension}\s*:\s*{re.escape(RSVP_MOBILE_AVATAR_SIZE)}\s*(?:;|$)",
                        rsvp_body,
                        flags=re.IGNORECASE,
                    ):
                        errors.append(
                            f"site-tail.css:{rsvp_line}: RSVP mobile avatar {dimension} "
                            f"must be {RSVP_MOBILE_AVATAR_SIZE}"
                        )
        for context, selector, _body, line in css_rule_blocks(
            stylesheet_text
        ):
            if context:
                continue
            selector_parts = {part.strip() for part in selector.split(",")}
            for owned_selector in sorted(STYLE_FOUNDATION_SELECTORS & selector_parts):
                errors.append(
                    f"{stylesheet.name}:{line}: {owned_selector} is owned by style.css"
                )

    scripts = sorted(ROOT.glob("*.js"))
    for script in scripts:
        errors.extend(
            f"{script.name}: {message}" for message in audit_javascript(script)
        )

    if errors:
        print(f"❌ Code hygiene audit failed with {len(errors)} issue(s):")
        for error in errors:
            print(f" - {error}")
        return 1

    print(
        f"✅ Code hygiene audit passed: {len(pages)} HTML pages and "
        f"{len(list(ROOT.glob('*.css')))} stylesheets and "
        f"{len(scripts)} JavaScript files checked."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
