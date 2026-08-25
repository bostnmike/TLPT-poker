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
    ".skip-link",
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
ACCESSIBLE_CONTROL_FOCUS_SELECTORS = {
    "[data-dashboard-sort]:focus-visible",
    "[data-standings-sort]:focus-visible",
    "#format-btn-40k:focus-visible",
    "#format-btn-500k:focus-visible",
    "#crew-view-tier:focus-visible",
    "#crew-view-archetype:focus-visible",
    ".archetype-mode-btn:focus-visible",
    ".archetype-filter-pill:focus-visible",
    ".pm-btn:focus-visible",
}
ACCESSIBLE_SWITCH_FOCUS_SELECTORS = {
    ".format-switch input:focus-visible + .format-switch-track",
    ".crew-view-switch input:focus-visible + .crew-view-switch-track",
    ".archetype-mode-switch input:focus-visible + .archetype-mode-switch-track",
}
TABLE_SCROLL_FOCUS_SELECTORS = {
    ".standings-table-shell .table-wrap:focus-visible",
    ".blind-table-scroll:focus-visible",
}
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
EXPECTED_SKIP_LINK_HREF = "#main-content"
EXPECTED_SKIP_LINK_TEXT = "Skip to main content"
EXPECTED_SHARED_STYLESHEET = "style.css?v=20260825-5"
EXPECTED_FORM_LAB_STYLESHEET = "form-lab.css?v=20260825-1"
EXPECTED_FORM_LAB_SCRIPT = "form-lab.js?v=20260825-1"
EXPECTED_GALLERY_STYLESHEET = "gallery.css?v=20260825-1"
EXPECTED_GALLERY_SCRIPT = "gallery.js?v=20260825-1"
EXPECTED_APP_SCRIPT_REFERENCE = "app.js?v=20260825-7"
EXPECTED_PLAYER_STYLESHEET = "player.css?v=20260825-1"
EXPECTED_PLAYER_MOVEMENT_SCRIPT = "player-movement.js?v=20260825-5"
EXPECTED_ICON_LINKS = [
    ("icon", "images/site/favicon-32.png", "image/png", "32x32"),
    ("icon", "images/site/favicon-16.png", "image/png", "16x16"),
    ("apple-touch-icon", "images/site/apple-touch-icon.png", "", "180x180"),
]
SHARED_SHELL_SCRIPT = "site-shell.js"
GLOBAL_SHARED_ASSETS = ("style.css", "site-tail.css", SHARED_SHELL_SCRIPT)
SHARED_APP_SCRIPT = "app.js"
EXPECTED_APP_SCRIPT_PAGES = {
    "champions.html",
    "dashboard.html",
    "index.html",
    "player.html",
    "players.html",
    "rules.html",
    "schedule.html",
    "standings.html",
}
EXPECTED_PRESSED_BUTTON_GROUPS = {
    "dashboard.html": (
        "data-dashboard-sort",
        {
            "profit", "hits", "timesPlaced", "bubbles", "hitRate",
            "cashRate", "bubbleRate", "roi", "trueSkillScore",
            "luckIndex", "clutchIndex", "aggressionIndex",
            "survivorIndex", "tiltIndex",
        },
        "profit",
    ),
    "standings.html": (
        "data-standings-sort",
        {
            "totalWinnings", "profit", "timesPlaced", "bubbles",
            "hits", "buyIns", "rebuys", "entries",
        },
        "totalWinnings",
    ),
    "rules.html": (
        "id",
        {"format-btn-40k", "format-btn-500k"},
        "format-btn-40k",
    ),
    "players.html": (
        "id",
        {"crew-view-tier", "crew-view-archetype"},
        "crew-view-tier",
    ),
    "player-movement.html": (
        "data-sort",
        {"momentum", "cold", "consistent", "volatile"},
        "momentum",
    ),
}
EXPECTED_CONTROL_GROUPS = {
    "dashboard.html": ("dashboard-button-groups", "Dashboard metric"),
    "standings.html": ("standings-buttons", "Standings metric"),
    "rules.html": ("format-toggle", "Tournament structure"),
    "players.html": ("crew-view-toolbar", "Crew view"),
    "player-movement.html": ("pm-button-row", "Heater Meter view"),
}
EXPECTED_CONTROLLED_RESULTS = {
    "dashboard.html": "dashboard-current-stat dashboard-formula-display dashboard-grid",
    "standings.html": "standings-race-strip standings-table",
    "rules.html": "format-content",
    "players.html": "players-visual players-grid",
    "player-movement.html": "pm-top-movers pm-player-grid",
}
EXPECTED_SWITCH_INPUT_LABELS = {
    "rules.html": (
        "format-switch-input",
        "Saturday 500K structure",
        "format-content",
    ),
    "players.html": (
        "crew-view-switch-input",
        "Archetype crew view",
        "players-visual players-grid",
    ),
}
EXPECTED_LIVE_STATUSES = {
    "dashboard.html": "dashboard-current-stat",
    "player-movement.html": "pm-top-title",
}
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
        self.heading_counts: Counter[str] = Counter()
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
        self.stylesheet_references: list[str] = []
        self.scripts: list[str] = []
        self.script_references: list[str] = []
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
        self.main_content_count = 0
        self.skip_link_records: list[dict[str, object]] = []
        self.open_skip_link: dict[str, object] | None = None
        self.button_records: list[dict[str, object]] = []
        self.element_records: list[dict[str, object]] = []
        self.gallery_lightbox_attrs: dict[str, str] | None = None
        self.gallery_lightbox_dialog_attrs: list[dict[str, str]] = []
        self.gallery_lightbox_backdrop_attrs: dict[str, str] | None = None

    def handle_starttag(self, tag: str, attrs_list: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attrs = {key.lower(): (value or "") for key, value in attrs_list}
        self.start_counts[tag] += 1
        if re.fullmatch(r"h[1-6]", tag):
            self.heading_counts[tag] += 1

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
        self.element_records.append({"tag": tag, "attrs": attrs, "classes": classes})
        self.class_counts.update(classes)
        if tag == "main" and attrs.get("id") == "main-content":
            self.main_content_count += 1
        if tag == "div" and attrs.get("id") == "gallery-lightbox":
            self.gallery_lightbox_attrs = attrs
        if tag == "div" and "gallery-lightbox-dialog" in classes:
            self.gallery_lightbox_dialog_attrs.append(attrs)
        if tag == "div" and attrs.get("id") == "gallery-lightbox-backdrop":
            self.gallery_lightbox_backdrop_attrs = attrs
        if tag == "a" and "skip-link" in classes:
            self.open_skip_link = {
                "href": attrs.get("href", ""),
                "text": [],
            }
            self.skip_link_records.append(self.open_skip_link)
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

        if tag == "button":
            self.button_records.append({"attrs": attrs, "classes": classes})
            if not attrs.get("type"):
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

        if tag == "img" and attrs.get("src", "").startswith("images/site/chip-T-"):
            if "data-hide-on-error" not in attrs:
                self.errors.append(
                    "static title-chip image is missing data-hide-on-error"
                )
            if "alt" not in attrs or attrs.get("alt") != "":
                self.errors.append(
                    "static title-chip image must use empty alternative text"
                )
            if attrs.get("aria-hidden", "").lower() != "true":
                self.errors.append(
                    "static title-chip image must be hidden from assistive technology"
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
                self.stylesheet_references.append(href)
            if is_local_reference(href) and not urlsplit(href).query.startswith("v="):
                self.errors.append(f"local stylesheet lacks a cache version: {href}")

        if tag == "script":
            src = attrs.get("src", "")
            if src and is_local_reference(src):
                self.scripts.append(urlsplit(src).path)
                self.script_references.append(src)
            if is_local_reference(src) and not urlsplit(src).query.startswith("v="):
                self.errors.append(f"local script lacks a cache version: {src}")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        self.end_counts[tag] += 1
        if tag == "nav" and self.nav_depth:
            self.nav_depth -= 1
        if tag == "a" and self.open_nav_link is not None:
            self.open_nav_link = None
        if tag == "a" and self.open_skip_link is not None:
            self.open_skip_link = None
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
        if self.open_skip_link is not None:
            text_parts = self.open_skip_link["text"]
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

    def function_source(name: str) -> str:
        match = re.search(
            rf"^function\s+{re.escape(name)}\([^\n]*\)\s*\{{.*?"
            r"(?=^function\s+|\Z)",
            text,
            flags=re.DOTALL | re.MULTILINE,
        )
        return match.group(0) if match else ""

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

    if path.name == "player-movement.js":
        if not re.search(
            r"\bconst\s+DATA_REQUEST_VERSION\s*=\s*Date\.now\(\)\s*;",
            text,
        ):
            errors.append(
                "Player Movement must create one data request version per page load"
            )
        if not re.search(
            r"function\s+versionedDataUrl\(path\)\s*\{\s*"
            r"return\s+`\$\{path\}\?v=\$\{DATA_REQUEST_VERSION\}`\s*;\s*\}",
            text,
        ):
            errors.append(
                "Player Movement versionedDataUrl helper differs from the freshness contract"
            )

        fetch_lines = [
            line.strip()
            for line in text.splitlines()
            if re.search(r"\bfetch\s*\(", line)
        ]
        if len(fetch_lines) != 3:
            errors.append(
                "Player Movement must contain exactly three JSON fetch operations"
            )
        for line_number, line in enumerate(text.splitlines(), start=1):
            if not re.search(r"\bfetch\s*\(", line):
                continue
            if "versionedDataUrl(" not in line or 'cache: "no-store"' not in line:
                errors.append(
                    f"line {line_number}: Player Movement JSON fetch must use "
                    "versionedDataUrl and cache:no-store"
                )
        controls_source = function_source("bindControls")
        if 'setAttribute("aria-pressed"' not in controls_source:
            errors.append(
                "Heater Meter controls must synchronize visual and aria-pressed state"
            )
        card_source = function_source("createCard")
        if not re.search(
            r'<img\s+class="pm-avatar".*?alt="".*?aria-hidden="true"',
            card_source,
            flags=re.DOTALL,
        ):
            errors.append(
                "Heater Meter player portraits must be decorative beside the visible player name"
            )
        if not re.search(
            r'<canvas\s+class="pm-sparkline".*?aria-hidden="true"',
            card_source,
            flags=re.DOTALL,
        ):
            errors.append(
                "Heater Meter sparkline canvas must be hidden when the same trend data is written out"
            )

    if path.name == "app.js":
        reduced_motion_source = function_source("prefersReducedMotion")
        if (
            'window.matchMedia("(prefers-reduced-motion: reduce)").matches'
            not in reduced_motion_source
        ):
            errors.append(
                "Shared app motion helper must read the reduced-motion preference"
            )
        count_up_source = function_source("animateCountUp")
        if not re.search(
            r"if\s*\(prefersReducedMotion\(\)\)\s*\{\s*"
            r"el\.textContent\s*=\s*meta\.raw;\s*return;\s*\}",
            count_up_source,
        ):
            errors.append(
                "Animated counters must render their final value immediately for reduced motion"
            )
        typing_source = function_source("typeTextIntoElement")
        if not re.search(
            r"if\s*\(prefersReducedMotion\(\)\)\s*\{\s*"
            r"element\.textContent\s*=\s*text;.*?"
            r"element\.classList\.add\(\"is-typing-done\"\);\s*return;\s*\}",
            typing_source,
            flags=re.DOTALL,
        ):
            errors.append(
                "Commissioner copy must bypass typing animation for reduced motion"
            )
        if text.count("if (prefersReducedMotion())") != 3:
            errors.append(
                "Shared app must protect counters, typing, and report rotation from motion"
            )
        for function_name, label in (
            ("setActiveSortButton", "Dashboard and Standings sort controls"),
            ("setActiveFormatButton", "Rules format controls"),
            ("renderPlayers", "Crew view controls"),
        ):
            source = function_source(function_name)
            if 'setAttribute("aria-pressed"' not in source:
                errors.append(
                    f"{label} must synchronize visual and aria-pressed state"
                )
        archetype_source = function_source("archetypeFilterMarkup")
        if archetype_source.count('aria-pressed="${') < 4:
            errors.append(
                "Crew archetype mode and filter controls must expose selected state"
            )
        for group_markup, label in (
            (
                '<div class="archetype-mode-toggle" role="group" '
                'aria-label="Archetype mode">',
                "Crew archetype mode controls",
            ),
            (
                '<div class="archetype-filter-row" role="group" '
                'aria-label="Archetype filter">',
                "Crew archetype filter controls",
            ),
        ):
            if group_markup not in archetype_source:
                errors.append(f"{label} must expose a named group")
        if not re.search(
            r'id="archetype-mode-switch-input".*?'
            r'aria-label="Secondary archetypes"',
            archetype_source,
            flags=re.DOTALL,
        ):
            errors.append(
                "Crew archetype mode switch must expose its own accessible name"
            )
        if archetype_source.count(
            'aria-controls="players-visual players-grid"'
        ) != 5:
            errors.append(
                "Crew archetype controls must identify both controlled result regions"
            )
        standings_headline_source = function_source("ensureStandingsHeadline")
        for attribute, value in (
            ("role", "status"),
            ("aria-live", "polite"),
            ("aria-atomic", "true"),
        ):
            if f'headline.setAttribute("{attribute}", "{value}")' not in standings_headline_source:
                errors.append(
                    f"Standings status headline must use {attribute}={value}"
                )
        standings_source = function_source("renderStandings")
        for fragment, message in (
            ('<td role="rowheader">', "Standings player cells must be row headers"),
            (
                'header.setAttribute("aria-sort", "descending")',
                "Standings must expose the active descending sort column",
            ),
            (
                'header.removeAttribute("aria-sort")',
                "Standings must clear inactive sort-column state",
            ),
        ):
            if fragment not in standings_source:
                errors.append(message)
        if 'role="link"' in standings_source or 'tabindex="0"' in standings_source:
            errors.append(
                "Standings rows must preserve table-row semantics instead of impersonating links"
            )
        blind_table_source = function_source("buildRulesBlindTable")
        if blind_table_source.count('scope="col"') != 5:
            errors.append("Rules blind table must expose five scoped column headers")
        for fragment, message in (
            ('<td role="rowheader">${row.level}</td>', "Rules levels must be row headers"),
            (
                'class="blind-table-scroll" role="region"',
                "Rules blind table must use a named scroll region",
            ),
            (
                'aria-label="Scrollable ${escapeHtmlAttr(tableLabel)}" tabindex="0"',
                "Rules blind table scroll region must be named and keyboard focusable",
            ),
            (
                'class="blind-table" aria-label="${escapeHtmlAttr(tableLabel)}"',
                "Rules blind table must expose an accessible name",
            ),
        ):
            if fragment not in blind_table_source:
                errors.append(message)
        player_profile_source = function_source("renderPlayerProfile")
        for fragment, message in (
            (
                'data-stat-formula="${escapeHtmlAttr(formula)}"',
                "Player Profile stat formulas must be escaped before entering markup",
            ),
            (
                'role="group"',
                "Player Profile focusable stat cards must expose group semantics",
            ),
            (
                'aria-label="${escapeHtmlAttr(accessibleLabel)}"',
                "Player Profile stat cards must announce the value and calculation",
            ),
            (
                "Mouse over or focus any stat to reveal the calculation.",
                "Player Profile stat help must identify both pointer and keyboard access",
            ),
        ):
            if fragment not in player_profile_source:
                errors.append(message)

    if path.name == "form-lab.js":
        point_contract = re.search(
            r'<g\s+class="fl-point".*?tabindex="0".*?role="button".*?'
            r'aria-pressed="\$\{selected \? "true" : "false"\}".*?'
            r'aria-label="\$\{escapeAttr\(pointLabel\)\}"',
            text,
            flags=re.DOTALL,
        )
        if not point_contract:
            errors.append(
                "Form Lab chart points must expose button role, keyboard focus, "
                "accessible name, and selected state"
            )
        event_card_contract = re.search(
            r'<button\s+class="fl-event-card.*?aria-pressed="\$\{'
            r'row\.id === FL_STATE\.selectedEventId \? "true" : "false"'
            r'\}"',
            text,
            flags=re.DOTALL,
        )
        if not event_card_contract:
            errors.append(
                "Form Lab event-list buttons must expose their selected state"
            )

    if path.name == "gallery.js":
        focus_source = function_source("focusGalleryLightbox")
        if "getGalleryLightboxFocusable" not in focus_source or ".focus(" not in focus_source:
            errors.append(
                "Gallery lightbox must move focus into the modal when opened"
            )
        trap_source = function_source("trapGalleryLightboxFocus")
        if (
            'event.key !== "Tab"' not in trap_source
            or "event.preventDefault()" not in trap_source
            or trap_source.count(".focus(") < 3
        ):
            errors.append(
                "Gallery lightbox must contain forward and reverse Tab focus"
            )
        open_source = function_source("openLightbox")
        if (
            "galleryLightboxReturnFocus" not in open_source
            or "focusGalleryLightbox" not in open_source
        ):
            errors.append(
                "Gallery lightbox must remember its trigger and focus the modal"
            )
        close_source = function_source("closeLightbox")
        if (
            "galleryLightboxReturnFocus = null" not in close_source
            or "returnFocus.focus(" not in close_source
        ):
            errors.append(
                "Gallery lightbox must restore focus to its trigger when closed"
            )
        poster_source = function_source("createPosterCard")
        if "openLightbox(poster, button)" not in poster_source:
            errors.append(
                "Gallery poster controls must pass their focus origin to the lightbox"
            )
        if "trapGalleryLightboxFocus(e, lightbox)" not in text:
            errors.append(
                "Gallery lightbox keydown handling must invoke the focus trap"
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
    global_asset_references_by_path: dict[str, dict[str, list[str]]] = {
        asset_path: {} for asset_path in GLOBAL_SHARED_ASSETS
    }
    app_script_references_by_page: dict[str, list[str]] = {}
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
        if parser.heading_counts["h1"] != 1:
            parser.errors.append(
                "document must contain exactly one site-brand h1 heading"
            )
        if parser.html_lang.lower() != "en":
            parser.errors.append('root <html> must use lang="en"')
        if parser.charsets != ["UTF-8"]:
            parser.errors.append('document must contain exactly one charset="UTF-8" meta tag')
        if parser.viewports != [EXPECTED_VIEWPORT]:
            parser.errors.append(
                "document must contain exactly one canonical viewport meta tag"
            )
        if EXPECTED_SHARED_STYLESHEET not in parser.stylesheet_references:
            parser.errors.append(
                "shared visible-focus stylesheet cache version is stale"
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
            elif parser.site_page_title_tag != "h2":
                parser.errors.append(
                    "shared site-page-title must preserve the site-brand h1 hierarchy as h2"
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

        if page.name == "form-lab.html":
            if EXPECTED_FORM_LAB_STYLESHEET not in parser.stylesheet_references:
                parser.errors.append(
                    "Form Lab accessibility stylesheet cache version is stale"
                )
            if EXPECTED_FORM_LAB_SCRIPT not in parser.script_references:
                parser.errors.append(
                    "Form Lab accessibility script cache version is stale"
                )
            form_lab_charts = [
                record
                for record in parser.element_records
                if record["tag"] == "svg"
                and record["attrs"].get("id") == "fl-chart"
            ]
            if len(form_lab_charts) != 1:
                parser.errors.append("Form Lab must contain exactly one #fl-chart")
            else:
                chart_attrs = form_lab_charts[0]["attrs"]
                if chart_attrs.get("role", "").lower() != "group":
                    parser.errors.append(
                        "Form Lab chart must expose its interactive points as a group"
                    )
                if chart_attrs.get("aria-labelledby") != (
                    "fl-chart-title fl-chart-subtitle"
                ):
                    parser.errors.append(
                        "Form Lab chart must use the visible title and subtitle as its name"
                    )

        if page.name == "player.html":
            if EXPECTED_PLAYER_STYLESHEET not in parser.stylesheet_references:
                parser.errors.append(
                    "Player Profile accessibility stylesheet cache version is stale"
                )

        if page.name == "media.html":
            film_embeds = [
                record
                for record in parser.element_records
                if record["tag"] == "iframe"
                and record["attrs"].get("src", "").startswith(
                    "https://www.youtube.com/embed/"
                )
            ]
            if len(film_embeds) != 8:
                parser.errors.append(
                    "Film Room must contain the eight approved YouTube embeds"
                )
            elif any(
                record["attrs"].get("loading", "").lower() != "lazy"
                for record in film_embeds
            ):
                parser.errors.append(
                    "Every Film Room YouTube embed must use native lazy loading"
                )
            film_thumbnails = [
                record
                for record in parser.element_records
                if record["tag"] == "img"
                and record["attrs"].get("src")
                == "images/site/TheNitroStrikesBack.png"
            ]
            if len(film_thumbnails) != 1:
                parser.errors.append(
                    "Film Room must contain the approved Nitro thumbnail"
                )
            else:
                thumbnail_attrs = film_thumbnails[0]["attrs"]
                if thumbnail_attrs.get("loading", "").lower() != "lazy":
                    parser.errors.append(
                        "Film Room Nitro thumbnail must use native lazy loading"
                    )
                if thumbnail_attrs.get("decoding", "").lower() != "async":
                    parser.errors.append(
                        "Film Room Nitro thumbnail must decode asynchronously"
                    )

        if page.name == "gallery.html":
            if EXPECTED_GALLERY_STYLESHEET not in parser.stylesheet_references:
                parser.errors.append(
                    "Gallery lightbox focus stylesheet cache version is stale"
                )
            if EXPECTED_GALLERY_SCRIPT not in parser.script_references:
                parser.errors.append(
                    "Gallery lightbox focus script cache version is stale"
                )
            lightbox = parser.gallery_lightbox_attrs
            if not lightbox:
                parser.errors.append("Gallery lightbox modal wrapper is missing")
            else:
                if lightbox.get("role", "").lower() != "dialog":
                    parser.errors.append("Gallery lightbox wrapper must own dialog role")
                if lightbox.get("aria-modal", "").lower() != "true":
                    parser.errors.append("Gallery lightbox wrapper must be aria-modal")
                if lightbox.get("aria-labelledby") != "gallery-lightbox-title":
                    parser.errors.append("Gallery lightbox has the wrong accessible title")
                if lightbox.get("aria-describedby") != "gallery-lightbox-date":
                    parser.errors.append("Gallery lightbox has the wrong description")
                if "hidden" not in lightbox:
                    parser.errors.append("Gallery lightbox must be hidden by default")
            if len(parser.gallery_lightbox_dialog_attrs) != 1:
                parser.errors.append("Gallery lightbox must contain one visual dialog shell")
            elif "role" in parser.gallery_lightbox_dialog_attrs[0]:
                parser.errors.append(
                    "Gallery visual dialog shell must not exclude sibling controls from the modal"
                )
            backdrop = parser.gallery_lightbox_backdrop_attrs
            if not backdrop or backdrop.get("aria-hidden", "").lower() != "true":
                parser.errors.append("Gallery lightbox backdrop must be decorative")

        if page.name == "standings.html":
            standings_tables = [
                record
                for record in parser.element_records
                if record["tag"] == "table"
                and record["attrs"].get("id") == "standings-table"
            ]
            if len(standings_tables) != 1:
                parser.errors.append("expected exactly one #standings-table")
            else:
                table_attrs = standings_tables[0]["attrs"]
                assert isinstance(table_attrs, dict)
                if table_attrs.get("aria-label") != "TLPT standings sorted by the selected metric":
                    parser.errors.append("Standings table accessible name differs from the contract")

            standings_scroll_regions = [
                record
                for record in parser.element_records
                if record["tag"] == "div"
                and "table-wrap" in record["classes"]
            ]
            if len(standings_scroll_regions) != 1:
                parser.errors.append("expected exactly one Standings table scroll region")
            else:
                region_attrs = standings_scroll_regions[0]["attrs"]
                assert isinstance(region_attrs, dict)
                for attribute, value in (
                    ("role", "region"),
                    ("aria-label", "Scrollable TLPT standings"),
                    ("tabindex", "0"),
                ):
                    if region_attrs.get(attribute) != value:
                        parser.errors.append(
                            f"Standings table scroll region must use {attribute}={value}"
                        )

            standings_headers = [
                record
                for record in parser.element_records
                if record["tag"] == "th"
            ]
            if len(standings_headers) != 10:
                parser.errors.append("Standings table must expose ten column headers")
            elif any(
                record["attrs"].get("scope", "").lower() != "col"
                for record in standings_headers
            ):
                parser.errors.append("Every Standings header must use scope=col")
            sortable_headers = {
                record["attrs"].get("data-standings-column", ""):
                record["attrs"].get("aria-sort", "")
                for record in standings_headers
                if record["attrs"].get("data-standings-column")
            }
            expected_sortable_headers = {
                "totalWinnings", "profit", "timesPlaced", "bubbles",
                "hits", "buyIns", "rebuys", "entries",
            }
            if set(sortable_headers) != expected_sortable_headers:
                parser.errors.append("Standings sortable columns differ from the table contract")
            elif sortable_headers.get("totalWinnings") != "descending" or any(
                value for key, value in sortable_headers.items() if key != "totalWinnings"
            ):
                parser.errors.append("Standings initial aria-sort state differs from the default")

        if page.name in EXPECTED_APP_SCRIPT_PAGES:
            if EXPECTED_APP_SCRIPT_REFERENCE not in parser.script_references:
                parser.errors.append(
                    "shared selected-state app script cache version is stale"
                )
        if page.name == "player-movement.html":
            if EXPECTED_PLAYER_MOVEMENT_SCRIPT not in parser.script_references:
                parser.errors.append(
                    "Heater Meter selected-state script cache version is stale"
                )

        pressed_group = EXPECTED_PRESSED_BUTTON_GROUPS.get(page.name)
        if pressed_group:
            identifier, expected_values, default_value = pressed_group
            records: dict[str, dict[str, object]] = {}
            for record in parser.button_records:
                attrs = record["attrs"]
                assert isinstance(attrs, dict)
                value = attrs.get(identifier, "")
                if value in expected_values:
                    records[value] = record
            if set(records) != expected_values:
                parser.errors.append(
                    "selected-state button group differs from the page contract"
                )
            else:
                pressed_values: set[str] = set()
                active_values: set[str] = set()
                for value, record in records.items():
                    attrs = record["attrs"]
                    classes = record["classes"]
                    assert isinstance(attrs, dict)
                    assert isinstance(classes, set)
                    pressed = attrs.get("aria-pressed", "").lower()
                    if pressed not in {"true", "false"}:
                        parser.errors.append(
                            f"{value} must expose a boolean aria-pressed state"
                        )
                    if pressed == "true":
                        pressed_values.add(value)
                    if "active" in classes:
                        active_values.add(value)
                    expected_results = EXPECTED_CONTROLLED_RESULTS[page.name]
                    if attrs.get("aria-controls") != expected_results:
                        parser.errors.append(
                            f"{value} controlled results differ from the page contract"
                        )
                if pressed_values != {default_value}:
                    parser.errors.append(
                        "selected-state button group has the wrong initial pressed option"
                    )
                if active_values != pressed_values:
                    parser.errors.append(
                        "selected-state button group visual and semantic defaults differ"
                    )

        expected_control_group = EXPECTED_CONTROL_GROUPS.get(page.name)
        if expected_control_group:
            group_class, group_label = expected_control_group
            matching_groups = [
                record
                for record in parser.element_records
                if group_class in record["classes"]
            ]
            if len(matching_groups) != 1:
                parser.errors.append(
                    f"expected exactly one .{group_class} control group"
                )
            else:
                group_attrs = matching_groups[0]["attrs"]
                assert isinstance(group_attrs, dict)
                if group_attrs.get("role", "").lower() != "group":
                    parser.errors.append(
                        f".{group_class} must expose role=group"
                    )
                if group_attrs.get("aria-label") != group_label:
                    parser.errors.append(
                        f".{group_class} accessible name differs from the control-group contract"
                    )

        expected_switch = EXPECTED_SWITCH_INPUT_LABELS.get(page.name)
        if expected_switch:
            switch_id, switch_label, switch_controls = expected_switch
            matching_switches = [
                record
                for record in parser.element_records
                if record["tag"] == "input"
                and record["attrs"].get("id") == switch_id
            ]
            if len(matching_switches) != 1:
                parser.errors.append(
                    f"expected exactly one #{switch_id} switch input"
                )
            else:
                switch_attrs = matching_switches[0]["attrs"]
                assert isinstance(switch_attrs, dict)
                if switch_attrs.get("aria-label") != switch_label:
                    parser.errors.append(
                        f"#{switch_id} must expose its own accessible name"
                    )
                if switch_attrs.get("aria-controls") != switch_controls:
                    parser.errors.append(
                        f"#{switch_id} controlled results differ from the page contract"
                    )

        expected_status_id = EXPECTED_LIVE_STATUSES.get(page.name)
        if expected_status_id:
            matching_statuses = [
                record
                for record in parser.element_records
                if record["attrs"].get("id") == expected_status_id
            ]
            if len(matching_statuses) != 1:
                parser.errors.append(
                    f"expected exactly one #{expected_status_id} live status"
                )
            else:
                status_attrs = matching_statuses[0]["attrs"]
                assert isinstance(status_attrs, dict)
                for attribute, value in (
                    ("role", "status"),
                    ("aria-live", "polite"),
                    ("aria-atomic", "true"),
                ):
                    if status_attrs.get(attribute, "").lower() != value:
                        parser.errors.append(
                            f"#{expected_status_id} must use {attribute}={value}"
                        )

        if len(parser.skip_link_records) != 1:
            parser.errors.append("expected exactly one shared skip link")
        else:
            skip_link = parser.skip_link_records[0]
            skip_text_parts = skip_link["text"]
            assert isinstance(skip_text_parts, list)
            skip_text = " ".join(" ".join(skip_text_parts).split())
            if skip_link["href"] != EXPECTED_SKIP_LINK_HREF:
                parser.errors.append("skip link must target #main-content")
            if skip_text != EXPECTED_SKIP_LINK_TEXT:
                parser.errors.append("skip link text differs from the shared contract")
        if parser.main_content_count != 1:
            parser.errors.append("expected exactly one <main id=\"main-content\"> target")

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

        for record in parser.element_records:
            attrs = record["attrs"]
            assert isinstance(attrs, dict)
            for controlled_id in attrs.get("aria-controls", "").split():
                if controlled_id not in parser.ids:
                    parser.errors.append(
                        f"aria-controls references missing id: {controlled_id}"
                    )

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

        for reference in parser.stylesheet_references + parser.script_references:
            asset_path = urlsplit(reference).path
            if asset_path in global_asset_references_by_path:
                global_asset_references_by_path[asset_path].setdefault(
                    page.name, []
                ).append(reference)

        app_script_references = [
            reference
            for reference in parser.script_references
            if urlsplit(reference).path == SHARED_APP_SCRIPT
        ]
        if app_script_references:
            app_script_references_by_page[page.name] = app_script_references

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

    for asset_path, references_by_page in global_asset_references_by_path.items():
        actual_asset_pages = set(references_by_page)
        missing_asset_pages = sorted(EXPECTED_PAGES - actual_asset_pages)
        unexpected_asset_pages = sorted(actual_asset_pages - EXPECTED_PAGES)
        if missing_asset_pages:
            errors.append(
                f"site: pages missing {asset_path}: " + ", ".join(missing_asset_pages)
            )
        if unexpected_asset_pages:
            errors.append(
                f"site: unexpected {asset_path} consumers: "
                + ", ".join(unexpected_asset_pages)
            )

        single_asset_references: set[str] = set()
        for page_name, references in sorted(references_by_page.items()):
            if len(references) != 1:
                errors.append(f"{page_name}: {asset_path} must be loaded exactly once")
            else:
                single_asset_references.add(references[0])
        if len(single_asset_references) != 1:
            errors.append(
                f"site: {asset_path} consumers must use one shared "
                "cache-version reference"
            )

    actual_app_script_pages = set(app_script_references_by_page)
    missing_app_script_pages = sorted(
        EXPECTED_APP_SCRIPT_PAGES - actual_app_script_pages
    )
    unexpected_app_script_pages = sorted(
        actual_app_script_pages - EXPECTED_APP_SCRIPT_PAGES
    )
    if missing_app_script_pages:
        errors.append(
            "site: pages missing app.js: " + ", ".join(missing_app_script_pages)
        )
    if unexpected_app_script_pages:
        errors.append(
            "site: unexpected app.js consumers: "
            + ", ".join(unexpected_app_script_pages)
        )

    single_app_script_references: set[str] = set()
    for page_name, references in sorted(app_script_references_by_page.items()):
        if len(references) != 1:
            errors.append(f"{page_name}: app.js must be loaded exactly once")
        else:
            single_app_script_references.add(references[0])
    if len(single_app_script_references) != 1:
        errors.append(
            "site: app.js consumers must use one shared cache-version reference"
        )

    for stylesheet in sorted(ROOT.glob("*.css")):
        stylesheet_text = stylesheet.read_text(encoding="utf-8")
        errors.extend(f"{stylesheet.name}: {message}" for message in audit_css(stylesheet))
        if stylesheet.name == "style.css":
            style_rule_blocks = css_rule_blocks(stylesheet_text)
            root_style_rules = [
                (selector, body, line)
                for context, selector, body, line in style_rule_blocks
                if not context
            ]
            reduced_motion_rules = [
                (body, line)
                for context, selector, body, line in style_rule_blocks
                if any(
                    re.sub(r"\s+", "", scope).lower()
                    == "@media(prefers-reduced-motion:reduce)"
                    for scope in context
                )
                and {part.strip() for part in selector.split(",")}
                == {"*", "*::before", "*::after"}
            ]
            if len(reduced_motion_rules) != 1:
                errors.append(
                    "style.css: expected exactly one shared reduced-motion safety rule"
                )
            else:
                motion_body, motion_line = reduced_motion_rules[0]
                for property_name, property_value in (
                    ("animation-duration", ".01ms !important"),
                    ("animation-iteration-count", "1 !important"),
                    ("animation-delay", "0ms !important"),
                    ("transition-duration", ".01ms !important"),
                    ("transition-delay", "0ms !important"),
                    ("scroll-behavior", "auto !important"),
                ):
                    if not re.search(
                        rf"(?:^|;)\s*{re.escape(property_name)}\s*:\s*"
                        rf"{re.escape(property_value)}\s*(?:;|$)",
                        motion_body,
                        flags=re.IGNORECASE,
                    ):
                        errors.append(
                            f"style.css:{motion_line}: reduced-motion rule must use "
                            f"{property_name}:{property_value}"
                        )
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
            skip_link_rules = [
                (body, line)
                for selector, body, line in root_style_rules
                if selector == ".skip-link"
            ]
            if len(skip_link_rules) != 1:
                errors.append(
                    "style.css: expected exactly one root .skip-link rule"
                )
            else:
                skip_body, skip_line = skip_link_rules[0]
                for property_name, property_value in (
                    ("position", "fixed"),
                    ("z-index", "10000"),
                    ("transform", "translateY(calc(-100% - 24px))"),
                ):
                    if not re.search(
                        rf"(?:^|;)\s*{re.escape(property_name)}\s*:\s*"
                        rf"{re.escape(property_value)}\s*(?:;|$)",
                        skip_body,
                        flags=re.IGNORECASE,
                    ):
                        errors.append(
                            f"style.css:{skip_line}: .skip-link must use "
                            f"{property_name}:{property_value}"
                        )
            skip_focus_rules = [
                (body, line)
                for selector, body, line in root_style_rules
                if selector == ".skip-link:focus"
            ]
            if len(skip_focus_rules) != 1:
                errors.append(
                    "style.css: expected exactly one root .skip-link:focus rule"
                )
            else:
                focus_body, focus_line = skip_focus_rules[0]
                if not re.search(
                    r"(?:^|;)\s*transform\s*:\s*translateY\(0\)\s*(?:;|$)",
                    focus_body,
                    flags=re.IGNORECASE,
                ):
                    errors.append(
                        f"style.css:{focus_line}: focused skip link must be visible"
                    )
                if not re.search(
                    r"(?:^|;)\s*outline\s*:\s*3px\s+solid\s+var\(--white\)\s*(?:;|$)",
                    focus_body,
                    flags=re.IGNORECASE,
                ):
                    errors.append(
                        f"style.css:{focus_line}: focused skip link must keep its outline"
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
            control_focus_rules = [
                (body, line)
                for selector, body, line in root_style_rules
                if ACCESSIBLE_CONTROL_FOCUS_SELECTORS.issubset(
                    {part.strip() for part in selector.split(",")}
                )
            ]
            if len(control_focus_rules) != 1:
                errors.append(
                    "style.css: expected exactly one shared visible-focus control rule"
                )
            else:
                focus_body, focus_line = control_focus_rules[0]
                for property_name, property_value in (
                    ("outline", "3px solid var(--white)"),
                    ("outline-offset", "3px"),
                ):
                    if not re.search(
                        rf"(?:^|;)\s*{re.escape(property_name)}\s*:\s*"
                        rf"{re.escape(property_value)}\s*(?:;|$)",
                        focus_body,
                        flags=re.IGNORECASE,
                    ):
                        errors.append(
                            f"style.css:{focus_line}: shared control focus rule must use "
                            f"{property_name}:{property_value}"
                        )
            switch_focus_rules = [
                (body, line)
                for selector, body, line in root_style_rules
                if ACCESSIBLE_SWITCH_FOCUS_SELECTORS.issubset(
                    {part.strip() for part in selector.split(",")}
                )
            ]
            if len(switch_focus_rules) != 1:
                errors.append(
                    "style.css: expected exactly one shared visible-focus switch-track rule"
                )
            else:
                focus_body, focus_line = switch_focus_rules[0]
                for property_name, property_value in (
                    ("outline", "3px solid var(--white)"),
                    ("outline-offset", "3px"),
                ):
                    if not re.search(
                        rf"(?:^|;)\s*{re.escape(property_name)}\s*:\s*"
                        rf"{re.escape(property_value)}\s*(?:;|$)",
                        focus_body,
                        flags=re.IGNORECASE,
                    ):
                        errors.append(
                            f"style.css:{focus_line}: shared switch focus rule must use "
                            f"{property_name}:{property_value}"
                        )
            table_scroll_rules = [
                (body, line)
                for selector, body, line in root_style_rules
                if selector == ".standings-table-shell .table-wrap"
            ]
            if len(table_scroll_rules) != 1:
                errors.append(
                    "style.css: expected exactly one Standings responsive table-scroll rule"
                )
            elif not re.search(
                r"(?:^|;)\s*overflow-x\s*:\s*auto\s*(?:;|$)",
                table_scroll_rules[0][0],
                flags=re.IGNORECASE,
            ):
                errors.append(
                    "style.css: Standings table wrapper must allow horizontal scrolling"
                )
            blind_scroll_rules = [
                (body, line)
                for selector, body, line in root_style_rules
                if selector == ".blind-table-scroll"
            ]
            if len(blind_scroll_rules) != 1:
                errors.append(
                    "style.css: expected exactly one Rules blind-table scroll rule"
                )
            elif not re.search(
                r"(?:^|;)\s*overflow-x\s*:\s*auto\s*(?:;|$)",
                blind_scroll_rules[0][0],
                flags=re.IGNORECASE,
            ):
                errors.append(
                    "style.css: Rules blind-table wrapper must allow horizontal scrolling"
                )
            table_focus_rules = [
                (body, line)
                for selector, body, line in root_style_rules
                if TABLE_SCROLL_FOCUS_SELECTORS.issubset(
                    {part.strip() for part in selector.split(",")}
                )
            ]
            if len(table_focus_rules) != 1:
                errors.append(
                    "style.css: expected exactly one table-scroll visible-focus rule"
                )
            else:
                focus_body, focus_line = table_focus_rules[0]
                for property_name, property_value in (
                    ("outline", "3px solid var(--white)"),
                    ("outline-offset", "-3px"),
                ):
                    if not re.search(
                        rf"(?:^|;)\s*{re.escape(property_name)}\s*:\s*"
                        rf"{re.escape(property_value)}\s*(?:;|$)",
                        focus_body,
                        flags=re.IGNORECASE,
                    ):
                        errors.append(
                            f"style.css:{focus_line}: table-scroll focus rule must use "
                            f"{property_name}:{property_value}"
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
        if stylesheet.name == "form-lab.css":
            point_focus_rules = [
                (body, line)
                for context, selector, body, line in css_rule_blocks(stylesheet_text)
                if not context and selector == ".fl-point:focus-visible .fl-point-dot"
            ]
            if len(point_focus_rules) != 1:
                errors.append(
                    "form-lab.css: expected exactly one chart-point focus-visible rule"
                )
            else:
                focus_body, focus_line = point_focus_rules[0]
                if not re.search(
                    r"(?:^|;)\s*stroke-width\s*:\s*4\s*(?:;|$)",
                    focus_body,
                    flags=re.IGNORECASE,
                ):
                    errors.append(
                        f"form-lab.css:{focus_line}: chart-point keyboard focus "
                        "must use a 4px stroke"
                    )
        if stylesheet.name == "gallery.css":
            gallery_rules = [
                (selector, body, line)
                for context, selector, body, line in css_rule_blocks(stylesheet_text)
                if not context
            ]
            poster_focus_rules = [
                (body, line)
                for selector, body, line in gallery_rules
                if selector == ".gallery-poster-button:focus-visible"
            ]
            modal_focus_selectors = {
                ".gallery-lightbox-close:focus-visible",
                ".gallery-lightbox-nav:focus-visible",
            }
            modal_focus_rules = [
                (body, line)
                for selector, body, line in gallery_rules
                if modal_focus_selectors.issubset(
                    {part.strip() for part in selector.split(",")}
                )
            ]
            if len(poster_focus_rules) != 1:
                errors.append(
                    "gallery.css: expected exactly one poster-button focus-visible rule"
                )
            if len(modal_focus_rules) != 1:
                errors.append(
                    "gallery.css: expected exactly one modal-control focus-visible rule"
                )
            for body, line in poster_focus_rules + modal_focus_rules:
                if not re.search(
                    r"(?:^|;)\s*outline\s*:\s*3px\s+solid\s+[^;]+(?:;|$)",
                    body,
                    flags=re.IGNORECASE,
                ):
                    errors.append(
                        f"gallery.css:{line}: Gallery focus-visible rule must keep a 3px outline"
                    )
        if stylesheet.name == "player.css":
            player_stat_focus_rules = [
                (body, line)
                for context, selector, body, line in css_rule_blocks(stylesheet_text)
                if not context
                and selector == (
                    ".player-page .player-stat-grid-enhanced "
                    ".player-stat-card:focus-visible"
                )
            ]
            if len(player_stat_focus_rules) != 1:
                errors.append(
                    "player.css: expected exactly one Player Profile stat-card focus-visible rule"
                )
            else:
                focus_body, focus_line = player_stat_focus_rules[0]
                for property_name, property_value in (
                    ("outline", "3px solid #ffe39a"),
                    ("outline-offset", "3px"),
                ):
                    if not re.search(
                        rf"(?:^|;)\s*{re.escape(property_name)}\s*:\s*"
                        rf"{re.escape(property_value)}\s*(?:;|$)",
                        focus_body,
                        flags=re.IGNORECASE,
                    ):
                        errors.append(
                            f"player.css:{focus_line}: Player Profile stat focus rule "
                            f"must use {property_name}:{property_value}"
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
