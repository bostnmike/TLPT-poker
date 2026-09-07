#!/usr/bin/env python3
import copy
import json
from pathlib import Path


def replace_once(path, before, after):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    assert text.count(before) == 1, f"{path}: expected exactly one match for {before!r}"
    p.write_text(text.replace(before, after, 1), encoding="utf-8")


replace_once("news-render.js", "<h4>📰 The Main Story</h4>", "<h4>👂🏼 Felt Whispers</h4>")
replace_once("news.html", "news-render.js?v=20260906-1", "news-render.js?v=20260906-2")
replace_once(
    "scripts/audit-code-hygiene.py",
    'EXPECTED_NEWS_SCRIPT = "news-render.js?v=20260906-1"',
    'EXPECTED_NEWS_SCRIPT = "news-render.js?v=20260906-2"',
)

# Normalize historical summary-card labels only; preserve every other byte/value.
data_path = Path("news-data.json")
raw_before = data_path.read_text(encoding="utf-8")
data_before = json.loads(raw_before)
expected = copy.deepcopy(data_before)
old_labels = {"📰 The Main Story", "🎬 Main Story"}
changed = 0
for week in expected.get("weeks", []):
    for card in week.get("summaryCards", []):
        if card.get("label") in old_labels:
            card["label"] = "👂🏼 Felt Whispers"
            changed += 1
assert changed > 0
raw_after = raw_before.replace('"label": "📰 The Main Story"', '"label": "👂🏼 Felt Whispers"')
raw_after = raw_after.replace('"label": "🎬 Main Story"', '"label": "👂🏼 Felt Whispers"')
data_after = json.loads(raw_after)
assert data_after == expected, "news-data.json changed beyond intended summary-card labels"
assert len(data_after["weeks"]) == len(data_before["weeks"])
assert [w["id"] for w in data_after["weeks"]] == [w["id"] for w in data_before["weeks"]]
assert [w.get("featured") for w in data_after["weeks"]] == [w.get("featured") for w in data_before["weeks"]]
for week in data_after["weeks"]:
    assert all("Main Story" not in str(card.get("label", "")) for card in week.get("summaryCards", []))
data_path.write_text(raw_after, encoding="utf-8")

# Update permanent prompt and disambiguate the reused phrase.
guide_path = Path("TWTW-WRITING-GUIDE.md")
guide = guide_path.read_text(encoding="utf-8")
old_retired = (
    "TL;DR, Felt Whispers (also formerly called Felt Said / What the Felt Said), and Quick Hits are permanently retired. "
    "Never generate `tldr`, `feltSaid`, `quickHitsLeft`, or `quickHitsRight` in a new story. "
    "Do not recreate the removed sections under different names, embed them in HTML, or move all of their content into another section."
)
new_retired = (
    "TL;DR, the old four-card Felt Whispers grid (stored historically as `feltSaid` and also formerly called Felt Said / What the Felt Said), and Quick Hits are permanently retired. "
    "**Felt Whispers now means the long-form narrative article section backed by `mainStoryHtml`; it does NOT restore the old `feltSaid` grid.** "
    "Never generate `tldr`, `feltSaid`, `quickHitsLeft`, or `quickHitsRight` in a new story. "
    "Do not recreate the removed card-grid sections under different names, embed them in HTML, or move all of their content into another section."
)
assert guide.count(old_retired) == 1
guide = guide.replace(old_retired, new_retired, 1)
assert guide.count("1. Main Story") == 1
guide = guide.replace("1. Main Story", "1. Felt Whispers", 1)
assert guide.count("- Main Story:") == 1
guide = guide.replace("- Main Story:", "- Felt Whispers:", 1)
assert guide.count("not a summary of the Main Story") == 1
guide = guide.replace("not a summary of the Main Story", "not a summary of Felt Whispers", 1)
guide_path.write_text(guide, encoding="utf-8")

# Update regression contract.
test_path = Path("scripts/test-news-layout.mjs")
test = test_path.read_text(encoding="utf-8")
old_order = "const order = ['📰 The Main Story', '🔦 Game Spotlight', '🔢 Numbers That Matter', '🎙️ Host Roast'];"
new_order = "const order = ['👂🏼 Felt Whispers', '🔦 Game Spotlight', '🔢 Numbers That Matter', '🎙️ Host Roast'];"
assert test.count(old_order) == 1
test = test.replace(old_order, new_order, 1)
old_deprecated = "const deprecatedMarkup = /news-felt-(?:grid|card)|news-quickhits-grid|news-section-divider|<h4>[^<]*(?:Felt Whispers|Quick Hits)/;"
new_deprecated = "const deprecatedMarkup = /news-felt-(?:grid|card)|news-quickhits-grid|news-section-divider|<h4>[^<]*Quick Hits/;"
assert test.count(old_deprecated) == 1
test = test.replace(old_deprecated, new_deprecated, 1)
marker = "assert.doesNotMatch(sandbox.renderWeekBody(fixture), deprecatedMarkup, 'Removed section markup');"
assert test.count(marker) == 1
test = test.replace(
    marker,
    marker + "\nassert.doesNotMatch(sandbox.renderWeekBody(fixture), /The Main Story/, 'Old narrative heading must stay retired');",
    1,
)
loop_marker = "for (const [index, week] of data.weeks.entries()) {"
assert test.count(loop_marker) == 1
extra = """for (const week of data.weeks) {
  const labels = (week.summaryCards || []).map((card) => String(card?.label || ''));
  assert.ok(labels.includes('👂🏼 Felt Whispers'), `Felt Whispers summary label: ${week.id}`);
  assert.ok(labels.every((label) => !label.includes('Main Story')), `Legacy Main Story summary label: ${week.id}`);
}

"""
test = test.replace(loop_marker, extra + loop_marker, 1)
old_console = "console.log(`TWTW layout PASS: ${data.weeks.length} stories; correct order in featured and archive modes; no TL;DR, Felt Whispers or Quick Hits; links, cards, stat pills and avatars retained.`);"
new_console = "console.log(`TWTW layout PASS: ${data.weeks.length} stories; Felt Whispers narrative heading in featured and archive modes; no TL;DR, legacy feltSaid card grid or Quick Hits; links, cards, stat pills and avatars retained.`);"
assert test.count(old_console) == 1
test = test.replace(old_console, new_console, 1)
test_path.write_text(test, encoding="utf-8")

assert '<h4>👂🏼 Felt Whispers</h4>' in Path("news-render.js").read_text(encoding="utf-8")
assert '<h4>📰 The Main Story</h4>' not in Path("news-render.js").read_text(encoding="utf-8")
assert "1. Felt Whispers" in guide
assert "Felt Whispers now means the long-form narrative article section" in guide
assert "news-render.js?v=20260906-2" in Path("news.html").read_text(encoding="utf-8")
print(f"Renamed narrative heading and normalized {changed} summary-card labels across {len(data_after['weeks'])} stories.")
