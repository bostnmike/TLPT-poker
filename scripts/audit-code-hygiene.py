#!/usr/bin/env python3
"""Fail fast on structural mistakes in the static TLPT site.

This audit intentionally does not calculate poker statistics. It protects the
HTML/CSS/asset contract around the existing, separately validated data model.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_ROBOTS_LINES = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /NewReports/",
    "Disallow: /data/",
    "Disallow: /scripts/",
    "Disallow: /knockout-events-full.json",
    "Disallow: /knockout-name-map-full.json",
    "Disallow: /knockouts.json",
    "Disallow: /news-data.json",
    "",
    "Sitemap: https://tlpt.org/sitemap.xml",
]
SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9"
EXPECTED_SITEMAP_URLS = [
    "https://tlpt.org/",
    "https://tlpt.org/champions.html",
    "https://tlpt.org/dashboard.html",
    "https://tlpt.org/form-lab.html",
    "https://tlpt.org/gallery.html",
    "https://tlpt.org/knockouts.html",
    "https://tlpt.org/media.html",
    "https://tlpt.org/news.html",
    "https://tlpt.org/player-movement.html",
    "https://tlpt.org/players.html",
    "https://tlpt.org/rules.html",
    "https://tlpt.org/schedule.html",
    "https://tlpt.org/standings.html",
    "https://tlpt.org/streaks.html",
    "https://tlpt.org/trophy-room.html",
]
EXPECTED_PAGES = {
    "404.html",
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
RSVP_VISUAL_GROUP_SELECTORS = {
    "#home-events-list .event-rsvp-block",
    "#schedule-list .event-rsvp-block",
}
RSVP_VISUAL_GROUP_SHIFT = "-18px"
RSVP_DESKTOP_SEAT_POSITIONS = {
    1: (2, "50%", "87%"),
    2: (3, "30%", "84%"),
    3: (4, "14%", "61%"),
    4: (5, "21%", "27%"),
    5: (6, "40%", "13%"),
    6: (7, "60%", "13%"),
    7: (8, "79%", "27%"),
    8: (9, "86%", "61%"),
    9: (10, "70%", "84%"),
}
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
EXPECTED_NAV_LABELS = [
    "Home",
    "Metrics",
    "Dashboard",
    "Form Lab",
    "Heater Meter",
    "Streak Tracker",
    "Knockout Central",
    "Standings",
    "Members",
    "TLPT Crew",
    "Player Profiles",
    "Trophy Room",
    "Schedule",
    "Roast Zone",
    "Hall of Fame",
    "The Week That Was",
    "Rules",
    "Media",
    "Film Room",
    "Art Gallery",
]
EXPECTED_SHELL_REVISION_MARKERS = {
    "dashboard.html": "20260825-3g3",
    "streaks.html": "20260825-3g3",
}
EXPECTED_NAV_ACTIVE_LABELS = {
    "404.html": [],
    "champions.html": ["Roast Zone", "Hall of Fame"],
    "dashboard.html": ["Metrics", "Dashboard"],
    "form-lab.html": ["Metrics", "Form Lab"],
    "gallery.html": ["Media", "Art Gallery"],
    "index.html": ["Home"],
    "knockouts.html": ["Metrics", "Knockout Central"],
    "media.html": ["Media", "Film Room"],
    "news.html": ["Roast Zone", "The Week That Was"],
    "player-movement.html": ["Metrics", "Heater Meter"],
    "player.html": ["Members", "Player Profiles"],
    "players.html": ["Members", "TLPT Crew"],
    "rules.html": ["Rules"],
    "schedule.html": ["Schedule"],
    "standings.html": ["Metrics", "Standings"],
    "streaks.html": ["Metrics", "Streak Tracker"],
    "trophy-room.html": ["Members", "Trophy Room"],
}
EXPECTED_NAV_CURRENT_LABEL = {
    page: labels[-1] if labels else ""
    for page, labels in EXPECTED_NAV_ACTIVE_LABELS.items()
}
EXPECTED_PAGE_TITLES = {
    "404.html": "Page Not Found | TLPT Poker League",
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
    "404.html": "This Hand Went Missing",
    "dashboard.html": "The Dashboard",
    "form-lab.html": "The Form Lab",
    "gallery.html": "The Art Gallery",
    "index.html": "Welcome to TLPT Poker League",
    "knockouts.html": "Knockout Central",
    "media.html": "The Film Room",
    "news.html": "The Week That Was",
    "player-movement.html": "The Heater Meter",
    "players.html": "Meet the Crew",
    "rules.html": "TLPT Rules & Structures",
    "schedule.html": "Next at Caahhd Room",
    "standings.html": "Sortable League Standings",
    "streaks.html": "The Streak Tracker",
}
TROPHY_INSPIRED_HERO_PAGES = {
    "404.html",
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
    "404.html": "The requested TLPT Poker League page could not be found. Return home or view the upcoming schedule.",
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
SITE_ORIGIN = "https://tlpt.org"
EXPECTED_CANONICAL_URLS = {
    "champions.html": f"{SITE_ORIGIN}/champions.html",
    "dashboard.html": f"{SITE_ORIGIN}/dashboard.html",
    "form-lab.html": f"{SITE_ORIGIN}/form-lab.html",
    "gallery.html": f"{SITE_ORIGIN}/gallery.html",
    "index.html": f"{SITE_ORIGIN}/",
    "knockouts.html": f"{SITE_ORIGIN}/knockouts.html",
    "media.html": f"{SITE_ORIGIN}/media.html",
    "news.html": f"{SITE_ORIGIN}/news.html",
    "player-movement.html": f"{SITE_ORIGIN}/player-movement.html",
    "players.html": f"{SITE_ORIGIN}/players.html",
    "rules.html": f"{SITE_ORIGIN}/rules.html",
    "schedule.html": f"{SITE_ORIGIN}/schedule.html",
    "standings.html": f"{SITE_ORIGIN}/standings.html",
    "streaks.html": f"{SITE_ORIGIN}/streaks.html",
    "trophy-room.html": f"{SITE_ORIGIN}/trophy-room.html",
}
EXPECTED_SOCIAL_IMAGES = {
    "champions.html": f"{SITE_ORIGIN}/images/site/chip-T-25000.png",
    "dashboard.html": f"{SITE_ORIGIN}/images/site/chip-T-10000.png",
    "form-lab.html": f"{SITE_ORIGIN}/images/site/chip-T-500.png",
    "gallery.html": f"{SITE_ORIGIN}/images/site/chip-T-5000.png",
    "index.html": f"{SITE_ORIGIN}/images/site/chip-T-100.png",
    "knockouts.html": f"{SITE_ORIGIN}/images/site/chip-T-25000.png",
    "media.html": f"{SITE_ORIGIN}/images/site/chip-T-500.png",
    "news.html": f"{SITE_ORIGIN}/images/site/chip-T-1000.png",
    "player-movement.html": f"{SITE_ORIGIN}/images/site/chip-T-1000.png",
    "player.html": f"{SITE_ORIGIN}/images/site/chip-T-1000.png",
    "players.html": f"{SITE_ORIGIN}/images/site/chip-T-25000.png",
    "rules.html": f"{SITE_ORIGIN}/images/site/chip-T-25.png",
    "schedule.html": f"{SITE_ORIGIN}/images/site/chip-T-100000.png",
    "standings.html": f"{SITE_ORIGIN}/images/site/chip-T-5000.png",
    "streaks.html": f"{SITE_ORIGIN}/images/site/chip-T-1000.png",
    "trophy-room.html": f"{SITE_ORIGIN}/images/site/chip-T-25000.png",
}
EXPECTED_SOCIAL_IMAGE_ALT = {
    "champions.html": "TLPT 25,000 tournament poker chip",
    "dashboard.html": "TLPT 10,000 tournament poker chip",
    "form-lab.html": "TLPT 500 tournament poker chip",
    "gallery.html": "TLPT 5,000 tournament poker chip",
    "index.html": "TLPT 100 tournament poker chip",
    "knockouts.html": "TLPT 25,000 tournament poker chip",
    "media.html": "TLPT 500 tournament poker chip",
    "news.html": "TLPT 1,000 tournament poker chip",
    "player-movement.html": "TLPT 1,000 tournament poker chip",
    "player.html": "TLPT 1,000 tournament poker chip",
    "players.html": "TLPT 25,000 tournament poker chip",
    "rules.html": "TLPT 25 tournament poker chip",
    "schedule.html": "TLPT 100,000 tournament poker chip",
    "standings.html": "TLPT 5,000 tournament poker chip",
    "streaks.html": "TLPT 1,000 tournament poker chip",
    "trophy-room.html": "TLPT 25,000 tournament poker chip",
}
EXPECTED_BREADCRUMB_LABELS = {
    "champions.html": "Hall of Fame",
    "dashboard.html": "Dashboard",
    "form-lab.html": "Form Lab",
    "gallery.html": "Art Gallery",
    "knockouts.html": "Knockout Central",
    "media.html": "Film Room",
    "news.html": "The Week That Was",
    "player-movement.html": "Heater Meter",
    "players.html": "TLPT Crew",
    "rules.html": "The Rules",
    "schedule.html": "The Schedule",
    "standings.html": "Standings",
    "streaks.html": "Streak Tracker",
    "trophy-room.html": "Trophy Room",
}
EXPECTED_VIEWPORT = "width=device-width, initial-scale=1.0"
EXPECTED_SKIP_LINK_HREF = "#main-content"
EXPECTED_SKIP_LINK_TEXT = "Skip to main content"
EXPECTED_SHARED_STYLESHEET = "style.css?v=20260825-6"
EXPECTED_FORM_LAB_STYLESHEET = "form-lab.css?v=20260825-1"
EXPECTED_FORM_LAB_SCRIPT = "form-lab.js?v=20260825-3"
EXPECTED_GALLERY_STYLESHEET = "gallery.css?v=20260825-1"
EXPECTED_GALLERY_SCRIPT = "gallery.js?v=20260825-3"
EXPECTED_KNOCKOUTS_SCRIPT = "knockouts.js?v=20260825-2"
EXPECTED_NEWS_SCRIPT = "news-render.js?v=20260825-2"
EXPECTED_APP_SCRIPT_REFERENCE = "app.js?v=20260825-11"
EXPECTED_SITE_QUALITY_TEST_COMMANDS = [
    "node scripts/test-site-shell.mjs",
    "node scripts/test-app-load-failure.mjs",
]
EXPECTED_WORKFLOW_ACTIONS = {
    "build-gallery-manifest.yml": [
        "actions/checkout@v7",
        "actions/setup-node@v7",
    ],
    "site-quality.yml": [
        "actions/checkout@v7",
        "actions/setup-python@v7",
        "actions/setup-node@v7",
    ],
    "tlpt-update.yml": [
        "actions/checkout@v7",
        "actions/setup-python@v7",
        "actions/setup-node@v7",
    ],
}
EXPECTED_WORKFLOW_NODE_VERSIONS = {
    "build-gallery-manifest.yml": ["24"],
    "site-quality.yml": ["22"],
    "tlpt-update.yml": ["22"],
}
EXPECTED_PLAYER_STYLESHEET = "player.css?v=20260825-1"
EXPECTED_PLAYER_KNOCKOUTS_SCRIPT = "player-knockouts.js?v=20260825-1"
EXPECTED_PLAYER_MOVEMENT_SCRIPT = "player-movement.js?v=20260825-7"
EXPECTED_STREAKS_SCRIPT = "streaks.js?v=20260825-2"
EXPECTED_TROPHY_ROOM_SCRIPT = "trophy-room.js?v=20260825-2"
INDEPENDENT_LOADER_RECOVERY_CONTRACTS = {
    "player-movement.js": (
        ('role="alert"', "Heater Meter failure state must be announced"),
        (
            "The Heater Meter couldn’t load the latest results.",
            "Heater Meter failure state must use visitor-facing copy",
        ),
        (
            "data-player-movement-retry",
            "Heater Meter failure state must provide a retry control",
        ),
        (
            "window.location.reload();",
            "Heater Meter retry control must reload the current page",
        ),
    ),
    "form-lab.js": (
        ('role="alert"', "Form Lab failure state must be announced"),
        (
            "The latest event data is unavailable. Check your connection and try again.",
            "Form Lab failure state must use visitor-facing copy",
        ),
        (
            "data-form-lab-retry",
            "Form Lab failure state must provide a retry control",
        ),
        (
            "window.location.reload();",
            "Form Lab retry control must reload the current page",
        ),
    ),
    "streaks.js": (
        ('role="alert"', "Streak Tracker failure state must be announced"),
        (
            "The Streak Tracker couldn’t load the latest results.",
            "Streak Tracker failure state must use visitor-facing copy",
        ),
        (
            "data-streaks-retry",
            "Streak Tracker failure state must provide a retry control",
        ),
        (
            "window.location.reload();",
            "Streak Tracker retry control must reload the current page",
        ),
    ),
    "knockouts.js": (
        ('role="alert"', "Knockout Central failure state must be announced"),
        (
            "The latest knockout results couldn’t be loaded. Check your connection and try again.",
            "Knockout Central failure state must use visitor-facing copy",
        ),
        (
            "data-knockouts-retry",
            "Knockout Central failure state must provide a retry control",
        ),
        (
            "window.location.reload();",
            "Knockout Central retry control must reload the current page",
        ),
    ),
    "trophy-room.js": (
        (
            "The Trophy Room vault would not open.",
            "Trophy Room failure state must remain visitor-facing",
        ),
        (
            "Please refresh after the latest site-data update finishes.",
            "Trophy Room failure state must retain its recovery guidance",
        ),
    ),
    "news-render.js": (
        (
            "The latest stories couldn’t be loaded. Check your connection and try again.",
            "News failure state must use visitor-facing copy",
        ),
        (
            "data-news-retry",
            "News failure state must provide a retry control",
        ),
        (
            "window.location.reload();",
            "News retry control must reload the current page",
        ),
    ),
    "gallery.js": (
        ('setAttribute("role", "alert")', "Gallery failure state must be announced"),
        (
            "The Gallery couldn’t load the poster collection.",
            "Gallery failure state must use visitor-facing copy",
        ),
        (
            "data-gallery-retry",
            "Gallery failure state must provide a retry control",
        ),
        (
            "window.location.reload();",
            "Gallery retry control must reload the current page",
        ),
    ),
}
INDEPENDENT_LOADER_TECHNICAL_COPY = {
    "player-movement.js": (
        "Check the browser console for details.",
    ),
    "form-lab.js": (
        'error && error.message ? error.message : "Check the console for details."',
    ),
    "knockouts.js": (
        "showKnockoutsError(String(err.message || err));",
    ),
    "news-render.js": (
        "Check news-data.json for valid JSON and the new event-based schema.",
    ),
}
EXPECTED_ICON_LINKS = [
    ("icon", "images/site/favicon-32.png", "image/png", "32x32"),
    ("icon", "images/site/favicon-16.png", "image/png", "16x16"),
    ("apple-touch-icon", "images/site/apple-touch-icon.png", "", "180x180"),
]


def expected_structured_data(page_name: str) -> dict[str, object] | None:
    if page_name == "index.html":
        return {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "SportsOrganization",
                    "@id": f"{SITE_ORIGIN}/#organization",
                    "name": "TLPT Poker League",
                    "alternateName": "TLPT",
                    "url": f"{SITE_ORIGIN}/",
                    "description": EXPECTED_META_DESCRIPTIONS["index.html"],
                    "sport": "Poker",
                    "slogan": "The League. The Players. The Tilt.",
                },
                {
                    "@type": "WebSite",
                    "@id": f"{SITE_ORIGIN}/#website",
                    "url": f"{SITE_ORIGIN}/",
                    "name": "TLPT Poker League",
                    "alternateName": "TLPT",
                    "publisher": {"@id": f"{SITE_ORIGIN}/#organization"},
                },
            ],
        }

    breadcrumb_label = EXPECTED_BREADCRUMB_LABELS.get(page_name)
    if not breadcrumb_label:
        return None
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": f"{SITE_ORIGIN}/",
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": breadcrumb_label,
            },
        ],
    }
SHARED_SHELL_SCRIPT = "site-shell.js"
GLOBAL_SHARED_ASSETS = ("style.css", "site-tail.css", SHARED_SHELL_SCRIPT)
EXPECTED_SITE_TAIL_REFERENCE = "site-tail.css?v=20260825-3"
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
        self.head_depth = 0
        self.html_lang = ""
        self.charsets: list[str] = []
        self.viewports: list[str] = []
        self.descriptions: list[str] = []
        self.meta_names: dict[str, list[str]] = defaultdict(list)
        self.meta_properties: dict[str, list[str]] = defaultdict(list)
        self.title_depth = 0
        self.title_text: list[str] = []
        self.icon_links: list[tuple[str, str, str, str]] = []
        self.canonical_links: list[str] = []
        self.structured_data_blocks: list[list[str]] = []
        self.open_structured_data: list[str] | None = None
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
        if tag == "head":
            self.head_depth += 1
        if re.fullmatch(r"h[1-6]", tag):
            self.heading_counts[tag] += 1

        if "id" in attrs:
            self.ids.append(attrs["id"])

        if tag == "meta":
            if "charset" in attrs:
                self.charsets.append(attrs["charset"])
            meta_name = attrs.get("name", "").lower()
            meta_property = attrs.get("property", "").lower()
            if meta_name:
                self.meta_names[meta_name].append(attrs.get("content", "").strip())
            if meta_property:
                self.meta_properties[meta_property].append(
                    attrs.get("content", "").strip()
                )
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
            if rel == "canonical":
                self.canonical_links.append(attrs.get("href", "").strip())
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
            self.nav_links.append(urlsplit(attrs["href"]).path.lstrip("/"))
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
            if attrs.get("type", "").lower() == "application/ld+json":
                if not self.head_depth:
                    self.errors.append("JSON-LD structured data must be inside <head>")
                if self.open_structured_data is not None:
                    self.errors.append("nested JSON-LD script block found")
                self.open_structured_data = []
                self.structured_data_blocks.append(self.open_structured_data)
            else:
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
            for attribute, value in (
                ("loading", "eager"),
                ("decoding", "async"),
                ("fetchpriority", "auto"),
                ("width", "112"),
                ("height", "112"),
            ):
                if attrs.get(attribute, "").lower() != value:
                    self.errors.append(
                        f"static title-chip image must use {attribute}={value}"
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
                self.stylesheets.append(urlsplit(href).path.lstrip("/"))
                self.stylesheet_references.append(href)
            if is_local_reference(href) and not urlsplit(href).query.startswith("v="):
                self.errors.append(f"local stylesheet lacks a cache version: {href}")

        if tag == "script":
            src = attrs.get("src", "")
            if src and is_local_reference(src):
                self.scripts.append(urlsplit(src).path.lstrip("/"))
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
        if tag == "script" and self.open_structured_data is not None:
            self.open_structured_data = None
        if tag == "head" and self.head_depth:
            self.head_depth -= 1
        if (
            self.site_page_title_depth
            and tag == self.site_page_title_tag
        ):
            self.site_page_title_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.open_structured_data is not None:
            self.open_structured_data.append(data)
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

    recovery_contract = INDEPENDENT_LOADER_RECOVERY_CONTRACTS.get(path.name, ())
    for fragment, message in recovery_contract:
        if fragment not in text:
            errors.append(message)

    for fragment in INDEPENDENT_LOADER_TECHNICAL_COPY.get(path.name, ()):
        if fragment in text:
            errors.append(
                f"{path.name} failure state exposes implementation details to visitors"
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
        for fragment, message in (
            (
                'const imageLoading = options.imageLoading === "eager" ? "eager" : "lazy";',
                "Heater Meter cards must default portraits to lazy loading",
            ),
            (
                'loading="${imageLoading}"',
                "Heater Meter portraits must publish their selected loading priority",
            ),
            (
                'decoding="async"',
                "Heater Meter portraits must decode asynchronously",
            ),
            (
                'width="52"',
                "Heater Meter portraits must publish an intrinsic width",
            ),
            (
                'height="52"',
                "Heater Meter portraits must publish an intrinsic height",
            ),
        ):
            if fragment not in card_source:
                errors.append(message)
        top_movers_source = function_source("renderTopMovers")
        if '.map(player => createCard(player, { imageLoading: "eager" }))' not in top_movers_source:
            errors.append(
                "Heater Meter visible top movers must keep eager portrait loading"
            )
        all_players_source = function_source("renderAllPlayers")
        if '.map(player => createCard(player, { imageLoading: "lazy" }))' not in all_players_source:
            errors.append(
                "Heater Meter full-board portraits must use lazy loading"
            )

    if path.name in {"knockouts.js", "player-knockouts.js"}:
        avatar_class = (
            "knockouts-avatar" if path.name == "knockouts.js" else "knockout-avatar"
        )
        avatar_contract = re.search(
            rf'<img\s+class="{avatar_class} \$\{{sizeClass\}}".*?'
            r'loading="lazy".*?decoding="async".*?'
            r'width="\$\{intrinsicSize\}".*?height="\$\{intrinsicSize\}"',
            text,
            flags=re.DOTALL,
        )
        if not avatar_contract:
            errors.append(
                "Knockout portraits must use lazy loading, asynchronous decoding, "
                "and matched intrinsic dimensions"
            )
        if "const intrinsicSize = avatarIntrinsicSize(sizeClass);" not in text:
            errors.append(
                "Knockout portraits must derive intrinsic size from their visual size class"
            )
        if path.name == "knockouts.js":
            for fragment in (
                'if (sizeClass === "knockouts-avatar-lg") return 68;',
                'if (sizeClass === "knockouts-avatar-sm") return 40;',
                "return 72;",
            ):
                if fragment not in text:
                    errors.append(
                        "Knockout Central portrait dimensions differ from its CSS contract"
                    )
                    break
        elif 'return sizeClass === "knockout-avatar-lg" ? 108 : 42;' not in text:
            errors.append(
                "Player knockout portrait dimensions differ from the large/small CSS contract"
            )

    if path.name == "app.js":
        load_failure_source = function_source("renderSiteLoadFailure")
        for fragment, message in (
            (
                'document.getElementById("site-load-error")',
                "Shared data-load recovery must prevent duplicate failure panels",
            ),
            (
                'document.getElementById("main-content")',
                "Shared data-load recovery must target the primary page content",
            ),
            (
                'failurePanel.setAttribute("role", "alert");',
                "Shared data-load recovery must announce its failure state",
            ),
            (
                'failurePanel.setAttribute("aria-labelledby", "site-load-error-title");',
                "Shared data-load recovery must expose an accessible name",
            ),
            (
                'type="button" data-site-load-retry',
                "Shared data-load recovery must provide an explicit retry button",
            ),
            (
                'href="/index.html">Return Home</a>',
                "Shared data-load recovery must provide a root-safe Home link",
            ),
            (
                'window.location.reload();',
                "Shared data-load recovery retry must reload the current page",
            ),
            (
                "mainContent.prepend(failurePanel);",
                "Shared data-load recovery must lead the primary page content",
            ),
        ):
            if fragment not in load_failure_source:
                errors.append(message)
        if not re.search(
            r'\.catch\(error => \{\s*'
            r'console\.error\("TLPT site load failed:", error\);\s*'
            r'renderSiteLoadFailure\(\);\s*\}\);',
            text,
        ):
            errors.append(
                "Shared app startup failures must log diagnostics and render recovery UI"
            )

        metadata_source = function_source("updatePlayerProfileMetadata")
        for fragment, message in (
            (
                'const canonicalUrl = new URL("/player.html", TLPT_SITE_ORIGIN);',
                "Player Profile metadata must build its canonical from the production origin",
            ),
            (
                'canonicalUrl.searchParams.set("name", player.name);',
                "Player Profile canonical URL must preserve the resolved player identity",
            ),
            (
                "player.image || PLAYER_PROFILE_FALLBACK_IMAGE",
                "Player Profile social image must prefer the resolved player portrait",
            ),
            (
                "upsertCanonicalLink(canonicalUrl.href);",
                "Player Profile metadata must publish its query-aware canonical URL",
            ),
            (
                'upsertPageMetadata("property", "og:url", canonicalUrl.href);',
                "Player Profile Open Graph URL must match its canonical URL",
            ),
            (
                'upsertPageMetadata("name", "twitter:image", imageUrl);',
                "Player Profile social metadata must publish its resolved portrait",
            ),
            (
                "document.title = title;",
                "Player Profile document title must identify the resolved player",
            ),
        ):
            if fragment not in metadata_source:
                errors.append(message)
        profile_source = function_source("renderPlayerProfile")
        if "updatePlayerProfileMetadata(player);" not in profile_source:
            errors.append(
                "Player Profile render must synchronize query-aware head metadata"
            )

        size_source = function_source("playerAvatarIntrinsicSize")
        for fragment in (
            "const numericSize = Number(requestedSize);",
            "return Math.round(numericSize);",
            "return PLAYER_AVATAR_INTRINSIC_SIZES[size] || 44;",
        ):
            if fragment not in size_source:
                errors.append(
                    "Shared player portraits must resolve an approved intrinsic size"
                )
                break
        for fragment in (
            "small: 44",
            "medium: 44",
            "table: 44",
            "standings: 44",
            "crew: 128",
            "dashboard: 82",
            "honors: 76",
            "hall: 114",
            "profile: 340",
        ):
            if fragment not in text:
                errors.append(
                    "Shared player portrait size mapping differs from the visual contract"
                )
                break
        image_source = function_source("playerImageMarkup")
        for fragment, message in (
            (
                "const intrinsicSize = playerAvatarIntrinsicSize(size, options.intrinsicSize);",
                "Shared player portraits must resolve their intrinsic dimensions",
            ),
            (
                'const loading = options.loading === "eager" ? "eager" : "lazy";',
                "Shared player portraits must default to lazy loading",
            ),
            (
                'const fetchPriority = options.fetchPriority === "high" ? "high" : "auto";',
                "Shared player portraits must default to automatic fetch priority",
            ),
            ('loading="${loading}"', "Shared player portraits must publish loading priority"),
            ('decoding="async"', "Shared player portraits must decode asynchronously"),
            (
                'fetchpriority="${fetchPriority}"',
                "Shared player portraits must publish fetch priority",
            ),
            ('width="${intrinsicSize}"', "Shared player portraits must publish intrinsic width"),
            ('height="${intrinsicSize}"', "Shared player portraits must publish intrinsic height"),
        ):
            if fragment not in image_source:
                errors.append(message)
        rsvp_source = function_source("eventRsvpAvatarMarkup")
        if 'playerImageMarkup(player, "table", { intrinsicSize: 96 })' not in rsvp_source:
            errors.append(
                "RSVP seats must retain their 96-pixel desktop portrait reservation"
            )
        comparison_source = function_source("playerCardComparisonCardMarkup")
        if 'playerImageMarkup(player, "profile", { intrinsicSize: 142 })' not in comparison_source:
            errors.append(
                "Player comparison cards must retain their 142-pixel portrait reservation"
            )
        profile_card_source = function_source("playerCardMarkup")
        if not re.search(
            r'playerImageMarkup\(player,\s*"profile",\s*\{\s*'
            r'intrinsicSize:\s*210,\s*loading:\s*"eager",\s*'
            r'fetchPriority:\s*"high"\s*\}\)',
            profile_card_source,
            flags=re.DOTALL,
        ):
            errors.append(
                "Primary Player Profile portrait must be eager, high-priority, and 210 pixels"
            )
        if 'playerImageMarkup(player, "profile", { intrinsicSize: 88 })' not in text:
            errors.append(
                "Collectible cards must retain their 88-pixel portrait reservation"
            )
        if text.count('fetchPriority: "high"') != 1:
            errors.append(
                "Only the primary Player Profile portrait may request high fetch priority"
            )
        decorative_image_contracts = (
            (
                "featured and Crew card crests",
                r'<img\s+class="crew-ultimate-chip"[^>]*loading="lazy"[^>]*'
                r'decoding="async"[^>]*fetchpriority="auto"[^>]*width="38"[^>]*'
                r'height="38"[^>]*/?>',
                2,
            ),
            (
                "Player comparison crest",
                r'<img\s+class="tlpt-compare-crest"[^>]*loading="lazy"[^>]*'
                r'decoding="async"[^>]*fetchpriority="auto"[^>]*width="46"[^>]*'
                r'height="46"[^>]*/?>',
                1,
            ),
            (
                "primary Player Card crest",
                r'<img\s+class="tlpt-card-crest"[^>]*loading="eager"[^>]*'
                r'decoding="async"[^>]*fetchpriority="auto"[^>]*width="56"[^>]*'
                r'height="56"[^>]*/?>',
                1,
            ),
            (
                "collectible card crest",
                r'<span\s+class="tlpt-card-collectible-head">.*?'
                r'<img[^>]*loading="lazy"[^>]*decoding="async"[^>]*'
                r'fetchpriority="auto"[^>]*width="28"[^>]*height="28"[^>]*/?>',
                1,
            ),
            (
                "Hall laurel images",
                r'<img\s+class="hall-laurel-image[^>]*loading="lazy"[^>]*'
                r'decoding="async"[^>]*fetchpriority="auto"[^>]*width="632"[^>]*'
                r'height="1024"[^>]*/?>',
                2,
            ),
            (
                "Hall prop images",
                r'<img\s+class="hall-plaque-prop[^>]*loading="lazy"[^>]*'
                r'decoding="async"[^>]*fetchpriority="auto"[^>]*width="512"[^>]*'
                r'height="512"[^>]*/?>',
                2,
            ),
            (
                "Rules chip images",
                r'<img\s+class="rules-chip-image"[^>]*loading="lazy"[^>]*'
                r'decoding="async"[^>]*fetchpriority="auto"[^>]*width="76"[^>]*'
                r'height="76"[^>]*>',
                1,
            ),
        )
        for label, pattern, expected_count in decorative_image_contracts:
            if len(re.findall(pattern, text, flags=re.DOTALL)) != expected_count:
                errors.append(
                    f"{label} differ from the decorative image-delivery contract"
                )
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
        avatar_source = function_source("playerAvatarMarkup")
        if not re.search(
            r'<img\s+class="fl-player-avatar".*?loading="lazy".*?'
            r'decoding="async".*?width="54".*?height="54"',
            avatar_source,
            flags=re.DOTALL,
        ):
            errors.append(
                "Form Lab portraits must use lazy loading, asynchronous decoding, "
                "and 54-pixel intrinsic dimensions"
            )
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

    if path.name == "streaks.js":
        avatar_source = function_source("renderAvatar")
        if not re.search(
            r'<img\s+class="player-avatar table".*?loading="lazy".*?'
            r'decoding="async".*?width="46".*?height="46"',
            avatar_source,
            flags=re.DOTALL,
        ):
            errors.append(
                "Streak Tracker portraits must use lazy loading, asynchronous decoding, "
                "and 46-pixel intrinsic dimensions"
            )

    if path.name == "news-render.js":
        avatar_source = function_source("renderAvatar")
        for fragment, message in (
            (
                "const numericSize = Number(options.intrinsicSize);",
                "News portraits must resolve an approved intrinsic size",
            ),
            (
                "const loading = options.loading === 'eager' ? 'eager' : 'lazy';",
                "News portraits must default to lazy loading",
            ),
            (
                "const fetchPriority = options.fetchPriority === 'high' ? 'high' : 'auto';",
                "News portraits must default to automatic fetch priority",
            ),
            ('loading="${loading}"', "News portraits must publish loading priority"),
            ('decoding="async"', "News portraits must decode asynchronously"),
            (
                'fetchpriority="${fetchPriority}"',
                "News portraits must publish fetch priority",
            ),
            ('width="${intrinsicSize}"', "News portraits must publish intrinsic width"),
            ('height="${intrinsicSize}"', "News portraits must publish intrinsic height"),
        ):
            if fragment not in avatar_source:
                errors.append(message)
        author_source = function_source("renderAuthor")
        if not re.search(
            r"renderAvatar\(\{.*?\},\s*\{\s*intrinsicSize:\s*68,\s*"
            r"loading:\s*'eager',\s*fetchPriority:\s*'high'\s*\}\)",
            author_source,
            flags=re.DOTALL,
        ):
            errors.append(
                "Visible News author portrait must be eager, high-priority, and 68 pixels"
            )
        summary_source = function_source("renderSummaryCard")
        for fragment, message in (
            (
                "renderAvatar(avatar, { intrinsicSize: 38 })",
                "News multi-player summaries must reserve 38-pixel portraits",
            ),
            (
                "}, { intrinsicSize: 46 })",
                "News single-player summaries must reserve 46-pixel portraits",
            ),
        ):
            if fragment not in summary_source:
                errors.append(message)
        spotlight_source = function_source("renderGameSpotlight")
        for fragment, message in (
            (
                "renderAvatar(avatar, { intrinsicSize: 42 })",
                "News multi-player spotlights must reserve 42-pixel portraits",
            ),
            (
                'fetchpriority="auto"',
                "News single-player spotlights must retain automatic fetch priority",
            ),
            ('width="42"', "News single-player spotlights must reserve 42-pixel width"),
            ('height="42"', "News single-player spotlights must reserve 42-pixel height"),
        ):
            if fragment not in spotlight_source:
                errors.append(message)
        roast_source = function_source("renderRoastSection")
        for fragment in (
            'fetchpriority="auto"',
            'width="44"',
            'height="44"',
        ):
            if fragment not in roast_source:
                errors.append(
                    "News roast portrait must retain automatic priority and 44-pixel dimensions"
                )
                break
        if text.count("fetchPriority: 'high'") != 1:
            errors.append(
                "Only the visible News author portrait may request high fetch priority"
            )

    if path.name == "trophy-room.js":
        trophy_avatar_contract = re.search(
            r"function\s+avatarMarkup\(card\).*?<img.*?loading=\"lazy\".*?"
            r"decoding=\"async\".*?width=\"128\".*?height=\"128\"",
            text,
            flags=re.DOTALL,
        )
        if not trophy_avatar_contract:
            errors.append(
                "Trophy Room portraits must use lazy loading, asynchronous decoding, "
                "and 128-pixel intrinsic dimensions"
            )
        trophy_crest_contract = re.search(
            r'<img\s+src="images/site/chip-T-1000\.png"[^>]*'
            r'loading="lazy"[^>]*decoding="async"[^>]*fetchpriority="auto"[^>]*'
            r'width="38"[^>]*height="38"[^>]*/?>',
            text,
            flags=re.DOTALL,
        )
        if not trophy_crest_contract:
            errors.append(
                "Trophy Room card crests must remain lazy, asynchronous, automatic-priority, "
                "and 38 pixels"
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
        for fragment, message in (
            (
                'const loading = isLeadPoster ? "eager" : "lazy";',
                "Gallery must load its lead poster eagerly and defer archive posters",
            ),
            (
                'loading="${loading}"',
                "Gallery posters must publish their selected loading priority",
            ),
            (
                'decoding="async"',
                "Gallery posters must decode asynchronously",
            ),
            (
                'fetchpriority="${isLeadPoster ? "high" : "auto"}"',
                "Gallery must prioritize only its lead poster",
            ),
            (
                'width="1024"',
                "Gallery posters must publish their intrinsic width",
            ),
            (
                'height="1536"',
                "Gallery posters must publish their intrinsic height",
            ),
        ):
            if fragment not in poster_source:
                errors.append(message)
        year_source = function_source("createYearGroup")
        if "createPosterCard(poster, poster.src === leadPosterSource)" not in year_source:
            errors.append(
                "Gallery year groups must identify the single lead poster"
            )
        if (
            'const leadPosterSource = galleryPosters[0]?.src || "";' not in text
            or "createYearGroup(year, posters, leadPosterSource)" not in text
        ):
            errors.append(
                "Gallery rendering must pass the newest poster as its lead image"
            )
        winner_source = function_source("buildGalleryWinnerBadgesMarkup")
        for fragment in (
            "const intrinsicAvatarSize = winners.length === 1 ? 46 : 34;",
            'width="${intrinsicAvatarSize}"',
            'height="${intrinsicAvatarSize}"',
        ):
            if fragment not in winner_source:
                errors.append(
                    "Gallery winner avatars must publish dimensions matching their badge layout"
                )
                break
        if "trapGalleryLightboxFocus(e, lightbox)" not in text:
            errors.append(
                "Gallery lightbox keydown handling must invoke the focus trap"
            )

    return errors


def audit_site_quality_workflow() -> list[str]:
    errors: list[str] = []
    workflow_path = ROOT / ".github" / "workflows" / "site-quality.yml"
    if not workflow_path.is_file():
        return ["site-quality workflow: missing required quality gate"]

    workflow_text = workflow_path.read_text(encoding="utf-8")
    command_positions: list[int] = []
    for command in EXPECTED_SITE_QUALITY_TEST_COMMANDS:
        command_line = f"run: {command}"
        if workflow_text.count(command_line) != 1:
            errors.append(
                "site-quality workflow: expected exactly one test command: "
                + command
            )
            continue
        command_positions.append(workflow_text.index(command_line))

        script_path = ROOT / command.removeprefix("node ")
        if not script_path.is_file():
            errors.append(
                "site-quality workflow: test command targets a missing script: "
                + command
            )

    if len(command_positions) == len(EXPECTED_SITE_QUALITY_TEST_COMMANDS):
        if command_positions != sorted(command_positions):
            errors.append(
                "site-quality workflow: shared behavior tests differ from the approved order"
            )

    return errors


def audit_workflow_runtimes() -> list[str]:
    errors: list[str] = []
    workflows_root = ROOT / ".github" / "workflows"

    for workflow_name, expected_actions in EXPECTED_WORKFLOW_ACTIONS.items():
        workflow_path = workflows_root / workflow_name
        if not workflow_path.is_file():
            errors.append(f"workflow runtimes: missing required workflow: {workflow_name}")
            continue

        workflow_text = workflow_path.read_text(encoding="utf-8")
        actual_actions = re.findall(
            r"uses:\s*(actions/(?:checkout|setup-node|setup-python)@v\d+)",
            workflow_text,
        )
        if actual_actions != expected_actions:
            errors.append(
                f"workflow runtimes: {workflow_name}: expected action sequence "
                + ", ".join(expected_actions)
                + "; found "
                + (", ".join(actual_actions) or "none")
            )

        actual_node_versions = re.findall(
            r'^\s*node-version:\s*["\']?([^"\'\s]+)',
            workflow_text,
            flags=re.MULTILINE,
        )
        expected_node_versions = EXPECTED_WORKFLOW_NODE_VERSIONS[workflow_name]
        if actual_node_versions != expected_node_versions:
            errors.append(
                f"workflow runtimes: {workflow_name}: expected Node version sequence "
                + ", ".join(expected_node_versions)
                + "; found "
                + (", ".join(actual_node_versions) or "none")
            )

    return errors


def audit_search_discovery() -> list[str]:
    errors: list[str] = []

    robots_path = ROOT / "robots.txt"
    if not robots_path.exists():
        errors.append("robots.txt: missing search-crawler policy")
    else:
        robots_lines = robots_path.read_text(encoding="utf-8").splitlines()
        if robots_lines != EXPECTED_ROBOTS_LINES:
            errors.append(
                "robots.txt: crawler rules or sitemap declaration differ from the approved contract"
            )

    sitemap_path = ROOT / "sitemap.xml"
    if not sitemap_path.exists():
        errors.append("sitemap.xml: missing stable-page discovery inventory")
        return errors

    try:
        sitemap_root = ElementTree.parse(sitemap_path).getroot()
    except ElementTree.ParseError as exc:
        errors.append(f"sitemap.xml: invalid XML: {exc}")
        return errors

    expected_root_tag = f"{{{SITEMAP_NAMESPACE}}}urlset"
    if sitemap_root.tag != expected_root_tag:
        errors.append("sitemap.xml: urlset namespace differs from the sitemap protocol")
        return errors

    sitemap_urls: list[str] = []
    url_tag = f"{{{SITEMAP_NAMESPACE}}}url"
    loc_tag = f"{{{SITEMAP_NAMESPACE}}}loc"
    for entry in list(sitemap_root):
        if entry.tag != url_tag:
            errors.append("sitemap.xml: urlset contains an unsupported child element")
            continue
        children = list(entry)
        if len(children) != 1 or children[0].tag != loc_tag:
            errors.append("sitemap.xml: every URL entry must contain exactly one loc element")
            continue
        location = (children[0].text or "").strip()
        if not location:
            errors.append("sitemap.xml: empty loc element")
            continue
        sitemap_urls.append(location)

    if sitemap_urls != EXPECTED_SITEMAP_URLS:
        errors.append(
            "sitemap.xml: stable-page URL inventory differs from the approved 15-page order"
        )
    if len(sitemap_urls) != len(set(sitemap_urls)):
        errors.append("sitemap.xml: duplicate URL found")

    for location in sitemap_urls:
        relative_path = urlsplit(location).path.lstrip("/") or "index.html"
        if not (ROOT / relative_path).is_file():
            errors.append(f"sitemap.xml: URL has no matching site file: {location}")

    return errors


def main() -> int:
    errors: list[str] = []
    errors.extend(audit_site_quality_workflow())
    errors.extend(audit_workflow_runtimes())
    errors.extend(audit_search_discovery())
    errors.extend(audit_phase_3h2_validation_parity())
    errors.extend(audit_phase_3g4_rsvp_control_spacing())
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
        page_text = page.read_text(encoding="utf-8")
        parser.feed(page_text)
        parser.close()

        expected_shell_revision = EXPECTED_SHELL_REVISION_MARKERS.get(page.name)
        if expected_shell_revision:
            marker = (
                f'<meta name="tlpt-shell-revision" '
                f'content="{expected_shell_revision}" />'
            )
            if marker not in page_text:
                parser.errors.append(
                    "page shell revision marker is missing or stale"
                )

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
        expected_shared_stylesheet = (
            f"/{EXPECTED_SHARED_STYLESHEET}"
            if page.name == "404.html"
            else EXPECTED_SHARED_STYLESHEET
        )
        if expected_shared_stylesheet not in parser.stylesheet_references:
            parser.errors.append(
                "shared visible-focus stylesheet cache version is stale"
            )

        if page.name == "404.html":
            for record in parser.element_records:
                attrs = record["attrs"]
                assert isinstance(attrs, dict)
                for attribute in ("href", "src"):
                    reference = attrs.get(attribute, "")
                    reference_path = urlsplit(reference).path
                    if (
                        reference_path
                        and is_local_reference(reference)
                        and not reference_path.startswith("/")
                    ):
                        parser.errors.append(
                            "404 recovery references must be root-absolute: "
                            + reference
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

        expected_robots_metadata = ["noindex"] if page.name == "404.html" else []
        if parser.meta_names.get("robots", []) != expected_robots_metadata:
            parser.errors.append("robots metadata differs from the page-head contract")

        expected_canonical = EXPECTED_CANONICAL_URLS.get(page.name)
        if expected_canonical:
            if parser.canonical_links != [expected_canonical]:
                parser.errors.append(
                    "self-referential canonical URL differs from the page-head contract"
                )
        elif parser.canonical_links:
            parser.errors.append(
                "page must not publish a static canonical URL"
            )

        expected_social_image = EXPECTED_SOCIAL_IMAGES.get(page.name, "")
        expected_image_alt = EXPECTED_SOCIAL_IMAGE_ALT.get(page.name, "")
        expected_og_metadata = {} if page.name == "404.html" else {
            "og:type": "profile" if page.name == "player.html" else "website",
            "og:site_name": "TLPT Poker League",
            "og:title": EXPECTED_PAGE_TITLES.get(page.name, ""),
            "og:description": expected_description,
            "og:image": expected_social_image,
            "og:image:alt": expected_image_alt,
        }
        if expected_canonical:
            expected_og_metadata["og:url"] = expected_canonical
        for key, value in expected_og_metadata.items():
            if parser.meta_properties.get(key, []) != [value]:
                parser.errors.append(f"{key} differs from the social-metadata contract")
        unexpected_og_properties = sorted(
            set(parser.meta_properties) - set(expected_og_metadata)
        )
        if unexpected_og_properties:
            parser.errors.append(
                "unexpected Open Graph metadata: "
                + ", ".join(unexpected_og_properties)
            )

        expected_twitter_metadata = {} if page.name == "404.html" else {
            "twitter:card": "summary",
            "twitter:title": EXPECTED_PAGE_TITLES.get(page.name, ""),
            "twitter:description": expected_description,
            "twitter:image": expected_social_image,
            "twitter:image:alt": expected_image_alt,
        }
        for key, value in expected_twitter_metadata.items():
            if parser.meta_names.get(key, []) != [value]:
                parser.errors.append(f"{key} differs from the social-metadata contract")

        unexpected_twitter_metadata = sorted(
            key
            for key in parser.meta_names
            if key.startswith("twitter:") and key not in expected_twitter_metadata
        )
        if unexpected_twitter_metadata:
            parser.errors.append(
                "unexpected Twitter metadata: "
                + ", ".join(unexpected_twitter_metadata)
            )

        if expected_social_image:
            social_image_path = urlsplit(expected_social_image).path.lstrip("/")
            if not social_image_path or not (ROOT / social_image_path).is_file():
                parser.errors.append("social preview image does not resolve to a local asset")

        parsed_structured_data: list[object] = []
        for block in parser.structured_data_blocks:
            try:
                parsed_structured_data.append(json.loads("".join(block)))
            except json.JSONDecodeError as exc:
                parser.errors.append(f"invalid JSON-LD structured data: {exc}")
        expected_json_ld = expected_structured_data(page.name)
        if expected_json_ld is None:
            if parsed_structured_data:
                parser.errors.append(
                    "page must not publish static structured data"
                )
        elif parsed_structured_data != [expected_json_ld]:
            parser.errors.append(
                "JSON-LD structured data differs from the page-head contract"
            )

        expected_icon_links = (
            [
                (rel, f"/{href}", icon_type, sizes)
                for rel, href, icon_type, sizes in EXPECTED_ICON_LINKS
            ]
            if page.name == "404.html"
            else EXPECTED_ICON_LINKS
        )
        if parser.icon_links != expected_icon_links:
            parser.errors.append("favicon links differ from the shared page-head contract")

        if page.name == "form-lab.html":
            if EXPECTED_FORM_LAB_STYLESHEET not in parser.stylesheet_references:
                parser.errors.append(
                    "Form Lab accessibility stylesheet cache version is stale"
                )
            if EXPECTED_FORM_LAB_SCRIPT not in parser.script_references:
                parser.errors.append(
                    "Form Lab portrait-delivery script cache version is stale"
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

        if page.name == "streaks.html":
            if EXPECTED_STREAKS_SCRIPT not in parser.script_references:
                parser.errors.append(
                    "Streak Tracker portrait-delivery script cache version is stale"
                )

        if page.name == "news.html":
            if EXPECTED_NEWS_SCRIPT not in parser.script_references:
                parser.errors.append(
                    "News portrait-delivery script cache version is stale"
                )

        if page.name == "trophy-room.html":
            if EXPECTED_TROPHY_ROOM_SCRIPT not in parser.script_references:
                parser.errors.append(
                    "Trophy Room portrait-delivery script cache version is stale"
                )

        if page.name == "player.html":
            if EXPECTED_PLAYER_STYLESHEET not in parser.stylesheet_references:
                parser.errors.append(
                    "Player Profile accessibility stylesheet cache version is stale"
                )
            if EXPECTED_PLAYER_KNOCKOUTS_SCRIPT not in parser.script_references:
                parser.errors.append(
                    "Player Profile knockout portrait script cache version is stale"
                )

        if page.name == "knockouts.html":
            if EXPECTED_KNOCKOUTS_SCRIPT not in parser.script_references:
                parser.errors.append(
                    "Knockout Central portrait script cache version is stale"
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
                if thumbnail_attrs.get("fetchpriority", "").lower() != "auto":
                    parser.errors.append(
                        "Film Room Nitro thumbnail must retain automatic fetch priority"
                    )
                if (
                    thumbnail_attrs.get("width") != "1536"
                    or thumbnail_attrs.get("height") != "1024"
                ):
                    parser.errors.append(
                        "Film Room Nitro thumbnail must publish its source aspect ratio"
                    )

        if page.name == "gallery.html":
            if EXPECTED_GALLERY_STYLESHEET not in parser.stylesheet_references:
                parser.errors.append(
                    "Gallery lightbox focus stylesheet cache version is stale"
                )
            if EXPECTED_GALLERY_SCRIPT not in parser.script_references:
                parser.errors.append(
                    "Gallery poster-delivery script cache version is stale"
                )
            lightbox_images = [
                record
                for record in parser.element_records
                if record["tag"] == "img"
                and record["attrs"].get("id") == "gallery-lightbox-image"
            ]
            if len(lightbox_images) != 1:
                parser.errors.append("Gallery lightbox image is missing")
            else:
                lightbox_image_attrs = lightbox_images[0]["attrs"]
                if lightbox_image_attrs.get("decoding", "").lower() != "async":
                    parser.errors.append(
                        "Gallery lightbox image must decode asynchronously"
                    )
                if (
                    lightbox_image_attrs.get("width") != "1024"
                    or lightbox_image_attrs.get("height") != "1536"
                ):
                    parser.errors.append(
                        "Gallery lightbox image must publish its poster aspect ratio"
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

        nav_labels: list[str] = []
        nav_active_labels: list[str] = []
        nav_current_labels: list[str] = []
        for record in parser.nav_link_records:
            text_parts = record["text"]
            classes = record["classes"]
            assert isinstance(text_parts, list)
            assert isinstance(classes, set)
            label = " ".join(" ".join(text_parts).split())
            nav_labels.append(label)
            if "is-active" in classes:
                nav_active_labels.append(label)
            if record["aria_current"] == "page":
                nav_current_labels.append(label)

        if nav_labels != EXPECTED_NAV_LABELS:
            parser.errors.append(
                "primary navigation labels/order differ from the shared contract"
            )

        expected_active_labels = EXPECTED_NAV_ACTIVE_LABELS.get(page.name, [])
        if nav_active_labels != expected_active_labels:
            parser.errors.append(
                "active navigation labels must be: "
                + " → ".join(expected_active_labels)
            )

        expected_current_label = EXPECTED_NAV_CURRENT_LABEL.get(page.name, "")
        expected_current_labels = [expected_current_label] if expected_current_label else []
        if nav_current_labels != expected_current_labels:
            parser.errors.append(
                "aria-current navigation labels must be: "
                + " → ".join(expected_current_labels)
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
            asset_path = urlsplit(reference).path.lstrip("/")
            if asset_path in global_asset_references_by_path:
                global_asset_references_by_path[asset_path].setdefault(
                    page.name, []
                ).append(reference)

        app_script_references = [
            reference
            for reference in parser.script_references
            if urlsplit(reference).path.lstrip("/") == SHARED_APP_SCRIPT
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
                single_asset_references.add(references[0].lstrip("/"))
        if len(single_asset_references) != 1:
            errors.append(
                f"site: {asset_path} consumers must use one shared "
                "cache-version reference"
            )
        if asset_path == "site-tail.css" and single_asset_references != {EXPECTED_SITE_TAIL_REFERENCE}:
            errors.append(
                "site: site-tail.css consumers must use the Phase 3H.1 cache reference "
                + EXPECTED_SITE_TAIL_REFERENCE
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
            for seat_number, (child_number, expected_x, expected_y) in (
                RSVP_DESKTOP_SEAT_POSITIONS.items()
            ):
                selector = (
                    f".event-rsvp-avatar-row > :nth-child({child_number})"
                )
                seat_rules = [
                    (body, line)
                    for rule_selector, body, line in root_style_rules
                    if rule_selector == selector
                ]
                if len(seat_rules) != 1:
                    errors.append(
                        f"style.css: expected exactly one desktop RSVP Seat {seat_number} rule"
                    )
                    continue
                seat_body, seat_line = seat_rules[0]
                for property_name, property_value in (
                    ("--seat-x", expected_x),
                    ("--seat-y", expected_y),
                ):
                    if not re.search(
                        rf"(?:^|;)\s*{re.escape(property_name)}\s*:\s*"
                        rf"{re.escape(property_value)}\s*(?:;|$)",
                        seat_body,
                        flags=re.IGNORECASE,
                    ):
                        errors.append(
                            f"style.css:{seat_line}: RSVP Seat {seat_number} must use "
                            f"{property_name}:{property_value}"
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
            mobile_header_rules = [
                (selector, body, line)
                for context, selector, body, line in css_rule_blocks(stylesheet_text)
                if any("@media (max-width:700px)" == scope for scope in context)
                and selector in {"body", ".site-header", ".nav"}
            ]
            mobile_header_by_selector = {
                selector: (body, line)
                for selector, body, line in mobile_header_rules
            }
            mobile_header_contract = {
                "body": (("padding-top", "0"),),
                ".site-header": (
                    ("position", "relative"),
                    ("width", "calc(100% - 24px)"),
                    ("transform", "none"),
                ),
                ".nav": (
                    ("flex-wrap", "wrap"),
                    ("overflow", "visible"),
                ),
            }
            for selector, properties in mobile_header_contract.items():
                if selector not in mobile_header_by_selector:
                    errors.append(
                        f"site-tail.css: missing 700px mobile navigation rule for {selector}"
                    )
                    continue
                rule_body, rule_line = mobile_header_by_selector[selector]
                for property_name, property_value in properties:
                    if not re.search(
                        rf"(?:^|;)\s*{re.escape(property_name)}\s*:\s*"
                        rf"{re.escape(property_value)}\s*(?:;|$)",
                        rule_body,
                        flags=re.IGNORECASE,
                    ):
                        errors.append(
                            f"site-tail.css:{rule_line}: {selector} mobile navigation "
                            f"must use {property_name}:{property_value}"
                        )
            mobile_nav_target_rules = [
                (body, line)
                for context, selector, body, line in css_rule_blocks(stylesheet_text)
                if any("@media (max-width:700px)" == scope for scope in context)
                and {part.strip() for part in selector.split(",")}
                == {".nav > a", ".nav-dropdown-parent"}
            ]
            if len(mobile_nav_target_rules) != 1:
                errors.append(
                    "site-tail.css: expected exactly one 700px mobile navigation tap-target rule"
                )
            elif not re.search(
                r"(?:^|;)\s*min-height\s*:\s*44px\s*(?:;|$)",
                mobile_nav_target_rules[0][0],
                flags=re.IGNORECASE,
            ):
                errors.append(
                    "site-tail.css: mobile navigation tap targets must be at least 44px high"
                )
            rsvp_visual_group_rules = [
                (body, line)
                for context, selector, body, line in css_rule_blocks(stylesheet_text)
                if any("@media (min-width:981px)" == scope for scope in context)
                and {part.strip() for part in selector.split(",")}
                == RSVP_VISUAL_GROUP_SELECTORS
            ]
            if len(rsvp_visual_group_rules) != 1:
                errors.append(
                    "site-tail.css: expected exactly one 981px desktop Home/Schedule RSVP visual-group lift rule"
                )
            else:
                visual_body, visual_line = rsvp_visual_group_rules[0]
                if not re.search(
                    rf"(?:^|;)\s*transform\s*:\s*translateY\(\s*{re.escape(RSVP_VISUAL_GROUP_SHIFT)}\s*\)\s*(?:;|$)",
                    visual_body,
                    flags=re.IGNORECASE,
                ):
                    errors.append(
                        f"site-tail.css:{visual_line}: Home/Schedule RSVP visual group must use "
                        f"transform:translateY({RSVP_VISUAL_GROUP_SHIFT})"
                    )
            misplaced_rsvp_lift_rules = [
                (context, selector, line)
                for context, selector, body, line in css_rule_blocks(stylesheet_text)
                if "event-rsvp-block" in selector
                and re.search(r"(?:^|;)\s*transform\s*:\s*translateY\(", body, flags=re.IGNORECASE)
                and not (
                    any("@media (min-width:981px)" == scope for scope in context)
                    and {part.strip() for part in selector.split(",")} == RSVP_VISUAL_GROUP_SELECTORS
                )
            ]
            if misplaced_rsvp_lift_rules:
                errors.append(
                    "site-tail.css: RSVP visual-group lift must remain desktop-only and scoped only to Home/Schedule"
                )
            shifted_event_detail_rules = [
                line
                for context, selector, body, line in css_rule_blocks(stylesheet_text)
                if "event-details-col" in selector
                and re.search(r"(?:^|;)\s*transform\s*:\s*translateY\(", body, flags=re.IGNORECASE)
            ]
            if shifted_event_detail_rules:
                errors.append(
                    "site-tail.css: Home/Schedule event details must not receive a vertical translate"
                )
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
            avatar_rules = [
                (body, line)
                for context, selector, body, line in css_rule_blocks(stylesheet_text)
                if not context
                and {".fl-player-card img", ".fl-player-avatar-fallback"}.issubset(
                    {part.strip() for part in selector.split(",")}
                )
            ]
            if len(avatar_rules) != 1:
                errors.append(
                    "form-lab.css: expected exactly one player-avatar dimension rule"
                )
            else:
                avatar_body, avatar_line = avatar_rules[0]
                for dimension in ("width", "height"):
                    if not re.search(
                        rf"(?:^|;)\s*{dimension}\s*:\s*54px\s*(?:;|$)",
                        avatar_body,
                        flags=re.IGNORECASE,
                    ):
                        errors.append(
                            f"form-lab.css:{avatar_line}: Form Lab portrait {dimension} "
                            "must remain 54px"
                        )
        if stylesheet.name == "streaks.css":
            streak_avatar_selectors = {
                ".streak-row .player-avatar.table",
                ".streak-row .player-avatar-fallback.table",
                ".streak-player-summary .player-avatar.table",
                ".streak-player-summary .player-avatar-fallback.table",
            }
            avatar_rules = [
                (body, line)
                for context, selector, body, line in css_rule_blocks(stylesheet_text)
                if not context
                and streak_avatar_selectors.issubset(
                    {part.strip() for part in selector.split(",")}
                )
            ]
            if len(avatar_rules) != 1:
                errors.append(
                    "streaks.css: expected exactly one streak-avatar dimension rule"
                )
            else:
                avatar_body, avatar_line = avatar_rules[0]
                for dimension in ("width", "height", "min-width", "min-height"):
                    if not re.search(
                        rf"(?:^|;)\s*{dimension}\s*:\s*46px\s*(?:;|$)",
                        avatar_body,
                        flags=re.IGNORECASE,
                    ):
                        errors.append(
                            f"streaks.css:{avatar_line}: Streak Tracker portrait "
                            f"{dimension} must remain 46px"
                        )
        if stylesheet.name == "news.css":
            news_avatar_contracts = (
                ({
                    ".news-author-strip .player-avatar.table",
                    ".news-author-strip .player-avatar-fallback.table",
                }, 68, "author"),
                ({
                    ".news-summary-head .player-avatar.table",
                    ".news-summary-head .player-avatar-fallback.table",
                }, 46, "single-player summary"),
                ({
                    ".news-summary-avatar-row .player-avatar.table",
                    ".news-summary-avatar-row .player-avatar-fallback.table",
                }, 38, "multi-player summary"),
                ({
                    ".news-receipt-top .player-avatar.table",
                    ".news-receipt-top .player-avatar-fallback.table",
                }, 42, "spotlight"),
                ({
                    ".news-pull-quote-row .player-avatar.table",
                    ".news-pull-quote-row .player-avatar-fallback.table",
                }, 44, "roast"),
            )
            news_rules = [
                (selector, body, line)
                for context, selector, body, line in css_rule_blocks(stylesheet_text)
                if not context
            ]
            for selectors, expected_size, label in news_avatar_contracts:
                matches = [
                    (body, line)
                    for selector, body, line in news_rules
                    if selectors.issubset(
                        {part.strip() for part in selector.split(",")}
                    )
                ]
                if len(matches) != 1:
                    errors.append(
                        f"news.css: expected exactly one {label} portrait dimension rule"
                    )
                    continue
                avatar_body, avatar_line = matches[0]
                for dimension in ("width", "height"):
                    if not re.search(
                        rf"(?:^|;)\s*{dimension}\s*:\s*{expected_size}px\s*(?:;|$)",
                        avatar_body,
                        flags=re.IGNORECASE,
                    ):
                        errors.append(
                            f"news.css:{avatar_line}: News {label} portrait {dimension} "
                            f"must remain {expected_size}px"
                        )
        if stylesheet.name == "trophy-room.css":
            trophy_avatar_rules = [
                (body, line)
                for context, selector, body, line in css_rule_blocks(stylesheet_text)
                if not context
                and selector == ".trophy-room-page .trophy-card-avatar-wrap"
            ]
            if len(trophy_avatar_rules) != 1:
                errors.append(
                    "trophy-room.css: expected exactly one card-avatar dimension rule"
                )
            elif not re.search(
                r"(?:^|;)\s*width\s*:\s*min\(\s*128px\s*,\s*100%\s*\)\s*(?:;|$)",
                trophy_avatar_rules[0][0],
                flags=re.IGNORECASE,
            ):
                errors.append(
                    f"trophy-room.css:{trophy_avatar_rules[0][1]}: Trophy Room "
                    "portrait width must remain capped at 128px"
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




def audit_phase_3g4_rsvp_control_spacing() -> list[str]:
    """Phase 3G.4: preserve table/avatar lift; lower only desktop dots/pill rails."""
    errors: list[str] = []
    css_path = ROOT / "site-tail.css"
    css = css_path.read_text(encoding="utf-8")
    required = [
        "@media (min-width:981px)",
        "#home-events-list .home-rotator-nav-inline",
        "transform:translateY(8px);",
        "#home-events-list .event-rsvp-summary-wrap,",
        "#schedule-list .event-rsvp-summary-wrap",
        "transform:translateY(10px);",
        "#home-events-list .event-rsvp-block,",
        "#schedule-list .event-rsvp-block{",
        "transform:translateY(-18px);",
    ]
    for token in required:
        if token not in css:
            errors.append(f"site-tail.css: Phase 3G.4 spacing contract missing: {token}")

    phase = css.split("PHASE 3G.4 — RSVP CONTROL BREATHING ROOM", 1)[-1]
    forbidden = [
        ("#home-events-list .event-rsvp-avatar-row", "Home table/chairs/avatar geometry"),
        ("#schedule-list .event-rsvp-avatar-row", "Schedule table/chairs/avatar geometry"),
        (".event-details-col", "left event details"),
    ]
    for token, label in forbidden:
        if token in phase:
            errors.append(f"site-tail.css: Phase 3G.4 must not move or restyle the {label}")
    return errors



def audit_phase_3h2_validation_parity() -> list[str]:
    """Phase 3H.2: every maintenance path must run the same recovery/calculation gates."""
    errors: list[str] = []
    targets = (
        (ROOT / ".github" / "workflows" / "site-quality.yml", 1, "python"),
        (ROOT / ".github" / "workflows" / "tlpt-update.yml", 2, "python"),
        (ROOT / "scripts" / "run-weekly-update.sh", 1, "python3"),
    )
    for path, expected_count, python_cmd in targets:
        text = path.read_text(encoding="utf-8")
        required_commands = (
            "node scripts/test-site-shell.mjs",
            "node scripts/test-app-load-failure.mjs",
            f"{python_cmd} scripts/audit-site-integrity.py",
            "node scripts/audit-page-calculations.mjs",
        )
        for command in required_commands:
            actual = text.count(command)
            if actual != expected_count:
                errors.append(
                    f"{path.relative_to(ROOT)}: expected {expected_count} occurrence(s) "
                    f"of maintenance gate `{command}`, found {actual}"
                )
    return errors


if __name__ == "__main__":
    sys.exit(main())
