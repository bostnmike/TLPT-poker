#!/usr/bin/env python3

"""Independent, source-to-page integrity audit for the TLPT static site.

This deliberately recomputes the important outputs from parsed event rows
instead of trusting the generated site-data file. It is intended to catch
stale generated files, incomplete pipeline runs, arithmetic regressions,
broken card ledgers, knockout drift, and missing page assets/links.
"""

from __future__ import annotations

import json
import math
import re
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW_DIR = DATA / "raw" / "events"
PARSED_DIR = DATA / "parsed" / "events"
SITE_DATA_PATH = DATA / "generated" / "site-data.json"
REPORT_PATH = DATA / "generated" / "integrity-report.json"

CORE_KEYS = (
    "entries", "buyIns", "rebuys", "hits", "timesPlaced", "bubbles",
    "profit", "totalCost", "totalWinnings"
)
NORMALIZED_KEYS = ("roi", "luckIndex", "clutchRaw", "aggressionRaw", "survivorRaw")
CARD_MILESTONES = (10, 25, 50, 75, 100)
PROVISIONAL_MIN = 3
ESTABLISHED_MIN = 5
HALL_PERCENTAGE = 0.25
HALL_MIN_EVENTS = 10


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def deep_equal(left, right, tolerance=1e-6):
    if isinstance(left, bool) or isinstance(right, bool):
        return left is right
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        return abs(float(left) - float(right)) <= tolerance
    if type(left) is not type(right):
        return False
    if isinstance(left, dict):
        return set(left) == set(right) and all(
            deep_equal(left[key], right[key], tolerance) for key in left
        )
    if isinstance(left, list):
        return len(left) == len(right) and all(
            deep_equal(a, b, tolerance) for a, b in zip(left, right)
        )
    return left == right


class Audit:
    def __init__(self):
        self.checks = Counter()
        self.errors = []
        self.warnings = []

    def check(self, condition, section, message):
        self.checks[section] += 1
        if not condition:
            self.errors.append({"section": section, "message": message})
        return bool(condition)

    def warn(self, section, message):
        self.warnings.append({"section": section, "message": message})


def empty_player(meta):
    return {
        "name": meta["name"],
        "slug": meta["slug"],
        "image": meta["image"],
        "notes": meta.get("notes", ""),
        **{key: 0 for key in CORE_KEYS},
        "roi": 0.0,
        "cashRate": 0.0,
        "bubbleRate": 0.0,
        "hitRate": 0.0,
        "expectedProfit": 0.0,
        "luckIndex": 0.0,
        "clutchIndex": 0.0,
        "aggressionIndex": 0.0,
        "survivorIndex": 0.0,
        "tiltIndex": 0.0,
        "trueSkillScore": 0.0,
    }


def normalize(records, key):
    values = [float(record.get(key, 0)) for record in records]
    low, high = min(values), max(values)
    for record in records:
        record[f"{key}_norm"] = (
            50.0 if high == low
            else 100 * (float(record.get(key, 0)) - low) / (high - low)
        )


def finalize_metrics(records):
    """Independent implementation of the published career/window formula."""
    for player in records:
        cost = float(player["totalCost"])
        buy_ins = float(player["buyIns"])
        entries = float(player["entries"])
        player["roi"] = player["profit"] / cost if cost else 0.0
        player["cashRate"] = player["timesPlaced"] / buy_ins if buy_ins else 0.0
        player["bubbleRate"] = player["bubbles"] / buy_ins if buy_ins else 0.0
        player["hitRate"] = player["hits"] / entries if entries else 0.0
        player["luckProxy"] = (
            0.40 * player["cashRate"]
            + 0.20 * player["hitRate"]
            + 0.40 * (1 - player["bubbleRate"])
        )

    league_proxy = sum(player["luckProxy"] for player in records) / max(len(records), 1)
    for player in records:
        proxy_delta = player["luckProxy"] - league_proxy
        expected_roi = max(-0.75, min(1.50, proxy_delta * 2.5))
        player["expectedProfit"] = round(player["totalCost"] * expected_roi, 1)
        player["luckIndex"] = round(player["profit"] - player["expectedProfit"], 1)

        buy_ins = max(player["buyIns"], 1)
        rebuy_rate = player["rebuys"] / buy_ins
        player["clutchRaw"] = player["timesPlaced"] / buy_ins
        player["aggressionRaw"] = player["hits"] / max(player["entries"], 1)
        player["survivorRaw"] = (
            0.55 * player["cashRate"]
            + 0.25 * (1 - player["bubbleRate"])
            + 0.20 * player["hitRate"]
        )
        base_composure = 100 * (
            1 - (0.70 * rebuy_rate + 0.30 * player["bubbleRate"])
        )
        sample_factor = min(player["buyIns"], 8) / 8.0
        direct = 50 + (base_composure - 50) * sample_factor
        player["tiltScoreDirect"] = max(0.0, min(100.0, direct))
        player["tiltIndex"] = round(player["tiltScoreDirect"], 1)

    for key in NORMALIZED_KEYS:
        normalize(records, key)

    for player in records:
        player["clutchIndex"] = player["clutchRaw_norm"]
        player["aggressionIndex"] = player["aggressionRaw_norm"]
        player["survivorIndex"] = player["survivorRaw_norm"]
        player["trueSkillScore"] = (
            player["roi_norm"] * 1.4
            + player["clutchIndex"] * 1.2
            + player["aggressionIndex"]
            + player["survivorIndex"]
            + player["luckIndex_norm"] * 0.5
            + player["tiltIndex"] * 0.8
            + min(10, player["buyIns"])
        )
        player.pop("luckProxy", None)
    return records


def tier_score(player):
    buy_ins = float(player.get("buyIns", 0))
    if buy_ins >= 20:
        sample = 3.0
    elif buy_ins >= 15:
        sample = 2.0
    elif buy_ins >= 10:
        sample = 1.0
    elif buy_ins >= ESTABLISHED_MIN:
        sample = 0.25
    elif buy_ins >= PROVISIONAL_MIN:
        sample = 0.0
    else:
        sample = -2.0
    return (
        float(player.get("trueSkillScore", 0)) * 1.5
        + float(player.get("clutchIndex", 0)) * 1.1
        + float(player.get("aggressionIndex", 0)) * 0.65
        + float(player.get("survivorIndex", 0))
        + float(player.get("tiltIndex", 0)) * 1.25
        + sample
        - float(player.get("rebuys", 0)) * 0.6
    )


def tier_meta(player, players):
    appearances = int(player.get("buyIns", 0))
    established = [p for p in players if int(p.get("buyIns", 0)) >= ESTABLISHED_MIN]
    established.sort(key=lambda p: -tier_score(p))
    if appearances < PROVISIONAL_MIN:
        return "RKI", "rookie", "Rookie", None, len(established)
    if appearances < ESTABLISHED_MIN:
        return "PRO", "provisional", "Provisional", None, len(established)
    rank = next(i + 1 for i, p in enumerate(established) if p["slug"] == player["slug"])
    percentile = rank / max(len(established), 1)
    if percentile <= 0.15:
        code, class_name = "S", "s"
    elif percentile <= 0.35:
        code, class_name = "A", "a"
    elif percentile <= 0.60:
        code, class_name = "B", "b"
    elif percentile <= 0.80:
        code, class_name = "C", "c"
    else:
        code, class_name = "D", "d"
    return code, class_name, "Established", rank, len(established)


def js_round(value):
    return int(math.floor(float(value) + 0.5))


def metric_rating(player, players, key, low=40, high=96):
    pool = [p for p in players if int(p.get("buyIns", 0)) >= ESTABLISHED_MIN]
    if len(pool) < 2:
        pool = [p for p in players if int(p.get("buyIns", 0)) >= PROVISIONAL_MIN]
    if len(pool) < 2:
        pool = players
    values = [float(p.get(key, 0)) for p in pool]
    if not values:
        return 68
    minimum, maximum = min(values), max(values)
    value = float(player.get(key, 0))
    scaled = 0.5 if maximum == minimum else (value - minimum) / (maximum - minimum)
    scaled = max(0.0, min(1.0, scaled))
    return max(1, min(99, js_round(low + scaled * (high - low))))


def card_snapshot(player, players):
    code, class_name, status, rank, total = tier_meta(player, players)
    ret = js_round(
        metric_rating(player, players, "roi") * 0.65
        + metric_rating(player, players, "profit") * 0.35
    )
    attrs = [
        {"code": "RET", "label": "Return", "value": ret},
        {"code": "CLT", "label": "Clutch", "value": metric_rating(player, players, "clutchIndex")},
        {"code": "ITM", "label": "In the Money", "value": metric_rating(player, players, "cashRate")},
        {"code": "AGR", "label": "Aggression", "value": metric_rating(player, players, "aggressionIndex")},
        {"code": "HIT", "label": "Hit Rate", "value": metric_rating(player, players, "hitRate")},
        {"code": "SUR", "label": "Survival", "value": metric_rating(player, players, "survivorIndex")},
    ]
    return {
        "overall": metric_rating(player, players, "trueSkillScore", 62, 95),
        "tierCode": code,
        "tierClassName": class_name,
        "tierStatus": status,
        "powerRank": rank,
        "totalRanked": total,
        "appearances": int(player.get("buyIns", 0)),
        "attributes": attrs,
        "metrics": {
            "profit": player.get("profit", 0),
            "roi": round(float(player.get("roi", 0)), 6),
            "cashRate": round(float(player.get("cashRate", 0)), 6),
            "hitRate": round(float(player.get("hitRate", 0)), 6),
            "trueSkillScore": round(float(player.get("trueSkillScore", 0)), 3),
        },
    }


def make_streak(meta, kind, played, start, end, active=False):
    if start is None or end is None or start > end:
        return None
    window = played[start:end + 1]
    if not window:
        return None
    return {
        "player": meta["name"], "slug": meta["slug"], "image": meta["image"],
        "type": kind, "length": len(window),
        "startDate": window[0]["date"], "endDate": window[-1]["date"],
        "startTitle": window[0]["title"], "endTitle": window[-1]["title"],
        "active": active,
        "events": [dict(item) for item in window],
    }


def best_run(played, target):
    best = None
    start = None
    for index, event in enumerate(played):
        match = event["cashed"] == target
        if match and start is None:
            start = index
        elif not match and start is not None:
            candidate = (start, index - 1)
            if best is None or candidate[1] - candidate[0] > best[1] - best[0]:
                best = candidate
            start = None
    if start is not None:
        candidate = (start, len(played) - 1)
        if best is None or candidate[1] - candidate[0] > best[1] - best[0]:
            best = candidate
    return best


def current_run(played, target):
    end = len(played) - 1
    if end < 0 or played[end]["cashed"] != target:
        return None
    start = end
    while start > 0 and played[start - 1]["cashed"] == target:
        start -= 1
    return start, end


def expected_streaks(metadata, events):
    played_by_slug = {meta["slug"]: [] for meta in metadata}
    for event in events:
        for row in event["players"]:
            if int(row.get("entries", 0)) <= 0 or row["slug"] not in played_by_slug:
                continue
            played_by_slug[row["slug"]].append({
                "date": event["date"], "title": event["title"],
                "cashed": int(row.get("timesPlaced", 0)) > 0,
            })

    players_payload = {}
    cash, drought, active_cash, active_drought, eligible = [], [], [], [], []
    for meta in metadata:
        played = played_by_slug[meta["slug"]]
        is_eligible = len(played) >= 2
        best_cash_range = best_run(played, True)
        best_drought_range = best_run(played, False)
        current_cash_range = current_run(played, True)
        current_drought_range = current_run(played, False)
        best_cash = make_streak(meta, "cash", played, *(best_cash_range or (None, None)))
        best_drought = make_streak(meta, "drought", played, *(best_drought_range or (None, None)))
        current_cash = make_streak(meta, "cash", played, *(current_cash_range or (None, None)), active=True)
        current_drought = make_streak(meta, "drought", played, *(current_drought_range or (None, None)), active=True)
        if best_cash and best_cash["length"] < 2: best_cash = None
        if best_drought and best_drought["length"] < 2: best_drought = None
        if current_cash and current_cash["length"] < 2: current_cash = None
        if current_drought and current_drought["length"] < 2: current_drought = None
        players_payload[meta["slug"]] = {
            "playedEvents": len(played), "eligible": is_eligible,
            "bestCashStreak": best_cash, "currentCashStreak": current_cash,
            "bestDroughtStreak": best_drought, "currentDroughtStreak": current_drought,
        }
        if is_eligible:
            eligible.append({**{key: meta[key] for key in ("name", "slug", "image")}, "playedEvents": len(played)})
            if best_cash: cash.append(best_cash)
            if best_drought: drought.append(best_drought)
            if current_cash: active_cash.append(current_cash)
            if current_drought: active_drought.append(current_drought)

    streak_sort = lambda item: (-item["length"], item["player"].lower(), item["endDate"])
    return {
        "definitions": {
            "cashStreak": "Consecutive played events that ended in a cash.",
            "droughtStreak": "Consecutive played events without a cash.",
            "minimumEligibleEvents": 2, "minimumTrackedStreak": 2,
            "note": "Skipped events do not break or extend streaks.",
        },
        "cashLeaders": sorted(cash, key=streak_sort),
        "droughtLeaders": sorted(drought, key=streak_sort),
        "activeCashLeaders": sorted(active_cash, key=streak_sort),
        "activeDroughtLeaders": sorted(active_drought, key=streak_sort),
        "eligiblePlayers": sorted(eligible, key=lambda item: item["name"].lower()),
        "players": players_payload,
    }


def event_date_from_raw_name(path):
    match = re.search(r"\d{4}-\d{2}-\d{2}", path.stem)
    return match.group(0) if match else None


def raw_table_count(html, table_title, label):
    table = re.search(
        rf'<td class="infotitle"[^>]*>\s*{re.escape(table_title)}\s*</td>(.*?)</table>',
        html, flags=re.IGNORECASE | re.DOTALL,
    )
    if not table:
        return None
    row = re.search(
        rf'<td class="fieldname">\s*{re.escape(label)}\s*</td>\s*'
        rf'<td class="fieldvalue">.*?</td>\s*'
        rf'<td class="fieldvalue">\s*\((\d+)\)\s*</td>',
        table.group(1), flags=re.IGNORECASE | re.DOTALL,
    )
    return int(row.group(1)) if row else None


def audit_sources(audit, metadata, config, events, site_data):
    raw_files = sorted(RAW_DIR.glob("*.html"))
    parsed_files = sorted(path for path in PARSED_DIR.glob("*.json") if path.name != "index.json")
    raw_dates = [event_date_from_raw_name(path) for path in raw_files]
    parsed_dates = [path.stem for path in parsed_files]
    index = load_json(PARSED_DIR / "index.json")
    audit.check(raw_dates == parsed_dates, "sources", "Raw and parsed event date sets differ")
    audit.check(index == [path.name for path in parsed_files], "sources", "Parsed index does not exactly match parsed event files")
    audit.check(site_data.get("sourceMode") == "event_reports", "sources", "site-data sourceMode is not event_reports")
    audit.check(site_data.get("events") == events.get("events"), "sources", "Published schedule differs from data/events.json")
    ledger = site_data.get("cardLedger") or {}
    audit.check(ledger.get("eventCount") == len(parsed_files), "sources", "Card ledger event count is stale")
    audit.check(ledger.get("replayedThrough") == parsed_dates[-1], "sources", "Card ledger replay date is stale")
    return parsed_files


def audit_events(audit, parsed_files, metadata, config):
    metadata_slugs = {meta["slug"] for meta in metadata}
    buy_in_amount = int(config.get("buy_in_amount", 30))
    events = []
    for path in parsed_files:
        event = load_json(path)
        events.append(event)
        section = "eventMath"
        event_id = path.stem
        audit.check(event.get("eventId") == event_id and event.get("date") == event_id, section, f"{event_id}: date/id mismatch")
        raw_path = RAW_DIR / str(event.get("sourceFile", ""))
        audit.check(raw_path.exists(), section, f"{event_id}: source HTML is missing")
        summary = event.get("summary") or {}
        rows = event.get("players") or []
        actions = event.get("actions") or []
        winners = event.get("winners") or []
        row_slugs = [row.get("slug") for row in rows]
        audit.check(set(row_slugs) == metadata_slugs and len(row_slugs) == len(set(row_slugs)), section, f"{event_id}: player rows do not match metadata exactly")
        audit.check(not any(action.get("type") == "unparsed" for action in actions), section, f"{event_id}: unparsed action remains")

        sums = {key: sum(int(row.get(key, 0) or 0) for row in rows) for key in CORE_KEYS}
        audit.check(sums["buyIns"] == int(summary.get("buyIns", 0)), section, f"{event_id}: buy-in total mismatch")
        audit.check(sums["rebuys"] == int(summary.get("rebuys", 0)), section, f"{event_id}: rebuy total mismatch")
        audit.check(sums["entries"] == int(summary.get("entries", 0)), section, f"{event_id}: entry total mismatch")
        audit.check(sums["entries"] == sums["buyIns"] + sums["rebuys"], section, f"{event_id}: entries != buy-ins + rebuys")
        audit.check(sums["totalCost"] == sums["entries"] * buy_in_amount, section, f"{event_id}: cost does not equal entries × buy-in")
        audit.check(sums["totalWinnings"] == int(summary.get("totalPot", 0)), section, f"{event_id}: winnings do not equal pot")
        audit.check(sums["profit"] == 0, section, f"{event_id}: event is not zero-sum")
        audit.check(sums["hits"] == sum(action.get("type") == "bustout" and bool(action.get("bySlug")) for action in actions), section, f"{event_id}: credited hits differ from bustout actions")
        audit.check(sums["timesPlaced"] == len(winners), section, f"{event_id}: cash count differs from payouts")
        audit.check(sum(int(winner.get("payout", 0)) for winner in winners) == int(summary.get("totalPot", 0)), section, f"{event_id}: payout total differs from pot")
        audit.check(int(summary.get("paidSpots", 0)) == len(winners), section, f"{event_id}: paidSpots differs from payout rows")
        audit.check(sums["bubbles"] in (0, 1), section, f"{event_id}: more than one bubble recorded")

        for row in rows:
            slug = row.get("slug", "unknown")
            audit.check(int(row.get("entries", 0)) == int(row.get("buyIns", 0)) + int(row.get("rebuys", 0)), section, f"{event_id}/{slug}: entries mismatch")
            audit.check(int(row.get("totalCost", 0)) == int(row.get("entries", 0)) * buy_in_amount, section, f"{event_id}/{slug}: cost mismatch")
            audit.check(int(row.get("profit", 0)) == int(row.get("totalWinnings", 0)) - int(row.get("totalCost", 0)), section, f"{event_id}/{slug}: profit mismatch")

        if raw_path.exists():
            html = raw_path.read_text(encoding="utf-8", errors="ignore")
            raw_buyins = raw_table_count(html, "Take-in", "Buy-ins:")
            raw_rebuys = raw_table_count(html, "Take-in", "Rebuys:")
            raw_paid = raw_table_count(html, "Prizes", "Total:")
            raw_pot = re.search(r"Total pot:\s*\$([0-9,]+(?:\.\d{2})?)", html, re.IGNORECASE)
            raw_pot_value = int(round(float(raw_pot.group(1).replace(",", "")))) if raw_pot else None
            audit.check(raw_buyins == summary.get("buyIns"), section, f"{event_id}: parsed buy-ins differ from raw report")
            audit.check(raw_rebuys == summary.get("rebuys"), section, f"{event_id}: parsed rebuys differ from raw report")
            audit.check(raw_paid == summary.get("paidSpots"), section, f"{event_id}: parsed paid spots differ from raw report")
            audit.check(raw_pot_value == summary.get("totalPot"), section, f"{event_id}: parsed pot differs from raw report")
    return events


def aggregate_players(metadata, events):
    totals = {meta["slug"]: empty_player(meta) for meta in metadata}
    for event in events:
        for row in event["players"]:
            slug = row["slug"]
            if slug not in totals:
                continue
            for key in CORE_KEYS:
                totals[slug][key] += row.get(key, 0) or 0
    records = list(totals.values())
    finalize_metrics(records)
    ranked = sorted(records, key=lambda player: -player["trueSkillScore"])
    for index, player in enumerate(ranked):
        percentile = index / max(len(ranked) - 1, 1)
        player["tier"] = "S" if percentile <= 0.15 else "A" if percentile <= 0.35 else "B" if percentile <= 0.65 else "C"
    return records


def audit_players(audit, expected_players, site_data, config):
    actual = site_data.get("players") or []
    expected_by_slug = {player["slug"]: player for player in expected_players}
    actual_by_slug = {player.get("slug"): player for player in actual}
    audit.check(list(actual_by_slug) == sorted(actual_by_slug, key=lambda slug: actual_by_slug[slug]["name"].lower()), "playerAggregates", "Published players are not alphabetically ordered")
    audit.check(set(actual_by_slug) == set(expected_by_slug), "playerAggregates", "Published player set differs from source metadata")
    numeric_keys = (*CORE_KEYS, "roi", "cashRate", "bubbleRate", "hitRate", "expectedProfit", "luckIndex", "clutchRaw", "aggressionRaw", "survivorRaw", "tiltScoreDirect", "tiltIndex", "trueSkillScore", "roi_norm", "luckIndex_norm", "clutchRaw_norm", "aggressionRaw_norm", "survivorRaw_norm", "clutchIndex", "aggressionIndex", "survivorIndex")
    for slug, expected in expected_by_slug.items():
        actual_player = actual_by_slug.get(slug, {})
        for key in numeric_keys:
            audit.check(deep_equal(actual_player.get(key), expected.get(key)), "playerAggregates", f"{slug}: {key} differs from independent recomputation")
        audit.check(actual_player.get("tier") == expected.get("tier"), "playerAggregates", f"{slug}: published tier differs from formula")

    qualified = [player for player in expected_players if player["entries"] >= config["qualification_thresholds"]["leaders_min_entries"]]
    def leader(pool, key, direction):
        return sorted(pool, key=(lambda p: (float(p.get(key, 0)), p["name"].lower())) if direction == "asc" else (lambda p: (-float(p.get(key, 0)), p["name"].lower())))[0]
    expected_honors = [{"type": rule["type"], "name": leader(qualified, rule["key"], rule["direction"])["name"], "note": rule.get("note", "")} for rule in config["honors"]]
    expected_records = [{"label": rule["label"], "name": leader(expected_players, rule["key"], rule["direction"])["name"], "value": str(round(leader(expected_players, rule["key"], rule["direction"])[rule["key"]], 2))} for rule in config["records"]]
    audit.check(site_data.get("honors") == expected_honors, "leaderboards", "Honors do not match qualification and sorting rules")
    audit.check(site_data.get("records") == expected_records, "leaderboards", "Records do not match sorting rules")


def audit_card_form(audit, metadata, events, site_data):
    actual_by_slug = {player["slug"]: player for player in site_data["players"]}
    windows = {"recent": [], "previous": []}
    expected = {}
    for meta in metadata:
        played = []
        for event in events:
            row = next((item for item in event["players"] if item["slug"] == meta["slug"]), None)
            if row and int(row.get("entries", 0)) > 0:
                played.append((event, row))
        expected[meta["slug"]] = {}
        for key, subset in (("recent", played[-5:]), ("previous", played[-10:-5])):
            metrics = empty_player(meta)
            for _, row in subset:
                for core in CORE_KEYS:
                    metrics[core] += row.get(core, 0) or 0
            window = {
                "eventCount": len(subset),
                "startDate": subset[0][0]["date"] if subset else None,
                "endDate": subset[-1][0]["date"] if subset else None,
                "metrics": metrics,
                "events": [{"date": event["date"], "title": event["title"], **{core: row.get(core, 0) or 0 for core in ("entries", "rebuys", "hits", "timesPlaced", "bubbles", "profit", "totalCost", "totalWinnings")}} for event, row in subset],
            }
            expected[meta["slug"]][key] = window
            windows[key].append(window)

    for key in ("recent", "previous"):
        active = [window["metrics"] for window in windows[key] if window["eventCount"] > 0]
        if active:
            finalize_metrics(active)
            # Card-form windows publish tiltIndex directly; tiltScoreDirect is
            # an internal career-build helper and is intentionally omitted.
            for metrics in active:
                metrics.pop("tiltScoreDirect", None)

    for slug, pair in expected.items():
        actual_pair = actual_by_slug[slug].get("cardForm") or {}
        for key, expected_window in pair.items():
            audit.check(deep_equal(actual_pair.get(key), expected_window), "cardForm", f"{slug}: {key} card-form window differs from last-five event replay")


def audit_streaks(audit, metadata, events, site_data):
    expected = expected_streaks(metadata, events)
    audit.check(deep_equal(site_data.get("streaks"), expected), "streaks", "Published streak payload differs from played-event replay")


def build_checkpoints(metadata, events):
    cumulative = {meta["slug"]: empty_player(meta) for meta in metadata}
    checkpoints = {}
    for event in events:
        for row in event["players"]:
            if int(row.get("entries", 0)) <= 0:
                continue
            player = cumulative[row["slug"]]
            for key in CORE_KEYS:
                player[key] += row.get(key, 0) or 0
        metrics = finalize_metrics([{**cumulative[meta["slug"]]} for meta in metadata])
        checkpoints[event["date"]] = metrics
    return checkpoints


def audit_cards(audit, metadata, events, site_data):
    checkpoints = build_checkpoints(metadata, events)
    actual_by_slug = {player["slug"]: player for player in site_data["players"]}
    actual_cards = {}
    for slug, player in actual_by_slug.items():
        seen = set()
        for record in player.get("cardCollection") or []:
            card_id = record.get("id")
            audit.check(bool(card_id) and card_id not in seen, "cards", f"{slug}: duplicate or blank card id")
            seen.add(card_id)
            actual_cards[(slug, card_id)] = record
            activity_date = record.get("upgradedDate") or record.get("earnedDate")
            checkpoint = checkpoints.get(activity_date)
            audit.check(checkpoint is not None, "cards", f"{slug}/{card_id}: card date is not an event date")
            if checkpoint:
                expected_player = next(player for player in checkpoint if player["slug"] == slug)
                audit.check(deep_equal(record.get("snapshot"), card_snapshot(expected_player, checkpoint)), "cards", f"{slug}/{card_id}: frozen snapshot differs from its issuance checkpoint")

    expected_cards = {}
    first_heater_date = {}
    best_streak = Counter()
    current_streak = Counter()
    final_heater_date = {}
    fixed_specs = (
        ("leader-profit", "profit", "desc", "leader"),
        ("leader-knockouts", "hits", "desc", "leader"),
        ("leader-roi", "roi", "desc", "leader"),
        ("leader-cash-rate", "cashRate", "desc", "leader"),
        ("hall-tax-collector", "profit", "desc", "hall"),
        ("hall-direct-deposit", "cashRate", "desc", "hall"),
        ("hall-billing-department", "knockoutRate", "desc", "hall"),
        ("infamy-boy-in-the-bubble", "bubbles", "desc", "hall"),
    )
    for event_index, event in enumerate(events, 1):
        checkpoint = checkpoints[event["date"]]
        by_slug = {player["slug"]: player for player in checkpoint}
        active_slugs = {row["slug"] for row in event["players"] if int(row.get("entries", 0)) > 0}
        cash_slugs = {row["slug"] for row in event["players"] if int(row.get("entries", 0)) > 0 and int(row.get("timesPlaced", 0)) > 0}
        for slug in active_slugs:
            for milestone in CARD_MILESTONES:
                key = (slug, f"milestone-{milestone}")
                if int(by_slug[slug]["buyIns"]) >= milestone and key not in expected_cards:
                    expected_cards[key] = event["date"]
            if slug in cash_slugs:
                current_streak[slug] += 1
                if current_streak[slug] >= 2 and current_streak[slug] > best_streak[slug]:
                    if slug not in first_heater_date:
                        first_heater_date[slug] = event["date"]
                    best_streak[slug] = current_streak[slug]
                    final_heater_date[slug] = event["date"]
            else:
                current_streak[slug] = 0

        established = [player for player in checkpoint if int(player["buyIns"]) >= ESTABLISHED_MIN]
        hall_minimum = max(math.ceil(event_index * HALL_PERCENTAGE), HALL_MIN_EVENTS)
        hall = []
        for player in checkpoint:
            if int(player["buyIns"]) < hall_minimum:
                continue
            copy = dict(player)
            copy["knockoutRate"] = copy["hits"] / copy["entries"] if copy["entries"] else 0.0
            hall.append(copy)
        for edition_id, key, direction, pool_name in fixed_specs:
            pool = established if pool_name == "leader" else hall
            if not pool:
                continue
            ordering = (lambda p: (float(p.get(key, 0)), p["name"].lower())) if direction == "asc" else (lambda p: (-float(p.get(key, 0)), p["name"].lower()))
            owner = sorted(pool, key=ordering)[0]
            expected_cards.setdefault((owner["slug"], edition_id), event["date"])

    for slug, length in best_streak.items():
        if length >= 2:
            expected_cards[(slug, f"heater-{length}")] = first_heater_date[slug]

    audit.check(set(actual_cards) == set(expected_cards), "cards", "Permanent card collection set differs from historical achievement replay")
    for key, earned_date in expected_cards.items():
        record = actual_cards.get(key, {})
        audit.check(record.get("earnedDate") == earned_date, "cards", f"{key[0]}/{key[1]}: earned date is not the first qualifying event")
        if key[1].startswith("heater-"):
            final_date = final_heater_date[key[0]]
            expected_upgrade = final_date if final_date != earned_date else None
            audit.check(record.get("upgradedDate") == expected_upgrade, "cards", f"{key[0]}/{key[1]}: heater upgrade date is incorrect")

    configured = load_json(DATA / "featured-cards.json").get("featuredCards", {})
    overrides = 0
    for slug, player in actual_by_slug.items():
        ids = [record["id"] for record in player.get("cardCollection") or []]
        request = configured.get(slug, "auto")
        expected = ids[0] if request == "auto" and ids else "base" if request == "auto" else request
        mode = "automatic" if request == "auto" else "commissioner"
        overrides += mode == "commissioner"
        audit.check(player.get("featuredCardEdition") == expected and player.get("featuredCardMode") == mode, "cards", f"{slug}: featured Crew card resolution is incorrect")
    audit.check((site_data.get("featuredCardConfig") or {}).get("overrideCount") == overrides, "cards", "Featured-card override count is incorrect")


def audit_knockouts(audit, events, site_data):
    archive = {}
    by_victim, by_killer = {}, {}
    for event in events:
        rows = []
        for action in event["actions"]:
            if action.get("type") != "bustout" or not action.get("slug") or not action.get("bySlug"):
                continue
            row = {
                "victim": action["slug"], "killer": action["bySlug"],
                "sourceVictim": action.get("sourceVictim") or action.get("player") or action["slug"],
                "sourceKiller": action.get("sourceKiller") or action.get("by") or action["bySlug"],
            }
            rows.append(row)
            by_victim.setdefault(row["victim"], Counter())[row["killer"]] += 1
            by_killer.setdefault(row["killer"], Counter())[row["victim"]] += 1
        archive[event["eventId"]] = rows
    runtime = {
        "byVictim": {slug: dict(sorted(counts.items())) for slug, counts in sorted(by_victim.items())},
        "byKiller": {slug: dict(sorted(counts.items())) for slug, counts in sorted(by_killer.items())},
        "eventsProcessed": sorted(archive),
    }
    audit.check(deep_equal(load_json(ROOT / "knockout-events-full.json"), archive), "knockouts", "Knockout archive differs from parsed bustouts")
    for path in (ROOT / "knockouts.json", DATA / "generated" / "knockouts.json", DATA / "generated" / "knockouts-generated.json"):
        audit.check(deep_equal(load_json(path), runtime), "knockouts", f"{path.relative_to(ROOT)} differs from parsed bustouts")
    players = {player["slug"]: player for player in site_data["players"]}
    for slug, player in players.items():
        expected_hits = sum(runtime["byKiller"].get(slug, {}).values())
        audit.check(int(player.get("hits", 0)) == expected_hits, "knockouts", f"{slug}: career hits differ from knockout ledger")


def audit_pages(audit, metadata):
    html_files = sorted(ROOT.glob("*.html"))
    audit.check(len(html_files) == 16, "pages", f"Expected 16 public HTML pages; found {len(html_files)}")
    local_ref_pattern = re.compile(r'(?:href|src)=["\']([^"\']+)["\']', re.IGNORECASE)
    for path in html_files:
        text = path.read_text(encoding="utf-8")
        ids = re.findall(r'\bid=["\']([^"\']+)["\']', text, flags=re.IGNORECASE)
        audit.check(len(ids) == len(set(ids)), "pages", f"{path.name}: duplicate HTML id")
        menus = re.findall(r'<div class="nav-dropdown-menu"[^>]*>(.*?)</div>', text, flags=re.IGNORECASE | re.DOTALL)
        members = next((menu for menu in menus if "players.html" in menu), "")
        links = re.findall(r'href=["\']([^"\']+)', members, flags=re.IGNORECASE)
        audit.check(len(links) >= 3 and links[2].split("?")[0] == "trophy-room.html", "pages", f"{path.name}: Trophy Room is not the third Members item")
        for reference in local_ref_pattern.findall(text):
            clean = reference.split("#", 1)[0].split("?", 1)[0]
            if not clean or clean.startswith(("http://", "https://", "mailto:", "tel:", "javascript:", "data:")):
                continue
            target = ROOT / clean.lstrip("/")
            audit.check(target.exists(), "assets", f"{path.name}: missing local reference {clean}")

    for meta in metadata:
        audit.check((ROOT / meta["image"]).exists(), "assets", f"{meta['slug']}: player image is missing")

    manifest = load_json(ROOT / "images" / "twtw" / "gallery-manifest.json")
    actual_posters = sorted((path.name for path in (ROOT / "images" / "twtw").glob("twtw*.jpg")), reverse=True)
    manifest_posters = manifest.get("files") or []
    audit.check(set(actual_posters) == set(manifest_posters), "assets", "Gallery manifest and poster files differ")
    audit.check(all((ROOT / "images" / "twtw" / name).exists() for name in manifest_posters), "assets", "Gallery manifest references a missing poster")

    index_names = set(load_json(PARSED_DIR / "index.json"))
    movement = (ROOT / "player-movement.js").read_text(encoding="utf-8")
    default_block = re.search(r"const DEFAULT_EVENT_FILES = \[(.*?)\];", movement, flags=re.DOTALL)
    defaults = set(re.findall(r'"(\d{4}-\d{2}-\d{2}\.json)"', default_block.group(1) if default_block else ""))
    audit.check(defaults <= index_names, "pages", "Heater Meter fallback list contains an event file that does not exist")

    for path in sorted(ROOT.glob("*.js")):
        result = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True)
        audit.check(result.returncode == 0, "javascript", f"{path.name}: JavaScript syntax error: {result.stderr.strip()}")

    page_audit = subprocess.run(
        ["node", str(ROOT / "scripts" / "audit-page-calculations.mjs")],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    try:
        page_report = json.loads(page_audit.stdout)
    except json.JSONDecodeError:
        page_report = {
            "checks": 1,
            "errors": [
                "Page-calculation audit did not return JSON: "
                + (page_audit.stderr.strip() or page_audit.stdout.strip())
            ],
        }
    audit.checks["pageCalculations"] += int(page_report.get("checks", 0))
    for message in page_report.get("errors", []):
        audit.errors.append({"section": "pageCalculations", "message": message})
    if page_audit.returncode != 0 and not page_report.get("errors"):
        audit.errors.append({
            "section": "pageCalculations",
            "message": page_audit.stderr.strip() or "Page-calculation audit failed",
        })


def main():
    audit = Audit()
    metadata_payload = load_json(DATA / "player-metadata.json")
    metadata = metadata_payload["players"]
    config = load_json(DATA / "league-config.json")
    schedule = load_json(DATA / "events.json")
    site_data = load_json(SITE_DATA_PATH)

    parsed_files = audit_sources(audit, metadata, config, schedule, site_data)
    events = audit_events(audit, parsed_files, metadata, config)
    expected_players = aggregate_players(metadata, events)
    audit_players(audit, expected_players, site_data, config)
    audit_card_form(audit, metadata, events, site_data)
    audit_streaks(audit, metadata, events, site_data)
    audit_cards(audit, metadata, events, site_data)
    audit_knockouts(audit, events, site_data)
    audit_pages(audit, metadata)

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "status": "FAIL" if audit.errors else "PASS",
        "scope": {
            "rawEvents": len(list(RAW_DIR.glob("*.html"))),
            "parsedEvents": len(parsed_files),
            "players": len(metadata),
            "publicPages": len(list(ROOT.glob("*.html"))),
            "collectibleCards": sum(len(player.get("cardCollection") or []) for player in site_data.get("players") or []),
        },
        "checksRun": sum(audit.checks.values()),
        "checksBySection": dict(sorted(audit.checks.items())),
        "errorCount": len(audit.errors),
        "warningCount": len(audit.warnings),
        "errors": audit.errors,
        "warnings": audit.warnings,
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with REPORT_PATH.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print(f"✔ Wrote {REPORT_PATH}")
    print(f"✔ Checks run: {report['checksRun']}")
    print(f"✔ Errors found: {report['errorCount']}")
    print(f"✔ Status: {report['status']}")
    if audit.errors:
        for error in audit.errors:
            print(f"✘ [{error['section']}] {error['message']}")
        raise SystemExit(2)


if __name__ == "__main__":
    main()
