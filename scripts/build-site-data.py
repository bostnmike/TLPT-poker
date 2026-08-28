#!/usr/bin/env python3

import json
import math
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
PARSED_EVENTS_DIR = DATA_DIR / "parsed" / "events"
GENERATED_DIR = DATA_DIR / "generated"

METADATA_PATH = DATA_DIR / "player-metadata.json"
CONFIG_PATH = DATA_DIR / "league-config.json"
EVENTS_PATH = DATA_DIR / "events.json"
FEATURED_CARDS_PATH = DATA_DIR / "featured-cards.json"
OUTPUT_PATH = GENERATED_DIR / "site-data.json"

CARD_FORM_WINDOW = 5
CARD_MILESTONES = (10, 25, 50, 75, 100)
CREW_ELIGIBLE_MIN_BUY_INS = 3
CREW_PROVISIONAL_MIN_BUY_INS = CREW_ELIGIBLE_MIN_BUY_INS
CREW_ESTABLISHED_MIN_BUY_INS = 5
CARD_OVERALL_MIN_RATING = 40
CARD_OVERALL_MAX_RATING = 99
HALL_PERCENTAGE = 0.25
HALL_MIN_EVENTS = 10


def hall_minimum_appearances(event_count):
    """Return the live 25%-of-history Hall threshold, with its floor."""
    return max(math.ceil(event_count * HALL_PERCENTAGE), HALL_MIN_EVENTS)


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def apply_featured_card_policy(players, featured_card_policy):
    """Apply the locked automatic Crew-skin policy without changing live card data."""
    if not isinstance(featured_card_policy, dict):
        raise ValueError("featured-cards.json must contain a JSON object")

    if featured_card_policy.get("mode") != "automatic":
        raise ValueError("featured-cards.json mode must be automatic")
    if "featuredCards" in featured_card_policy:
        raise ValueError(
            "featured-cards.json must not contain manual featuredCards overrides"
        )

    for player in players:
        collection = player.get("cardCollection") or []
        player["featuredCardEdition"] = collection[0]["id"] if collection else "base"
        player["featuredCardMode"] = "automatic"

    return {
        "source": "data/featured-cards.json",
        "version": int(featured_card_policy.get("version", 2)),
        "mode": "automatic",
        "overrideCount": 0,
        "rules": {
            "activeSkin": "Uses the first card in the permanent prestige-ordered collection, or Base when no special edition is earned.",
            "manualOverrides": "Not supported.",
            "liveData": "The automatic skin changes presentation only; ratings, tier placement, Crew ordering and ownership remain unchanged."
        }
    }


def sort_players(players, key, direction="desc"):
    if direction == "desc":
        return sorted(players, key=lambda p: (-float(p.get(key, 0)), p["name"].lower()))
    return sorted(players, key=lambda p: (float(p.get(key, 0)), p["name"].lower()))


def normalize_stat(players, key):
    values = [float(p.get(key, 0)) for p in players]
    min_val = min(values)
    max_val = max(values)

    if max_val == min_val:
        for p in players:
            p[f"{key}_norm"] = 50.0
        return

    for p in players:
        p[f"{key}_norm"] = 100 * (float(p[key]) - min_val) / (max_val - min_val)


def finalize_career_metrics(players):
    # Calculate career metrics without letting zero-game metadata affect the league.
    active_players = [
        player for player in players
        if int(player.get("buyIns", 0) or 0) > 0
    ]
    inactive_players = [
        player for player in players
        if int(player.get("buyIns", 0) or 0) <= 0
    ]

    for player in inactive_players:
        for key in (
            "roi", "cashRate", "bubbleRate", "hitRate",
            "expectedProfit", "luckIndex",
            "clutchRaw", "aggressionRaw", "survivorRaw",
            "tiltScoreDirect", "tiltIndex", "trueSkillScore",
            "roi_norm", "luckIndex_norm", "clutchRaw_norm",
            "aggressionRaw_norm", "survivorRaw_norm",
            "clutchIndex", "aggressionIndex", "survivorIndex",
        ):
            player[key] = 0.0
        player["tier"] = "C"

    if not active_players:
        return players

    for player in active_players:
        cost = float(player["totalCost"])
        buyins = float(player["buyIns"])
        entries = float(player["entries"])

        player["roi"] = (player["profit"] / cost) if cost else 0.0
        player["cashRate"] = (player["timesPlaced"] / buyins) if buyins else 0.0
        player["bubbleRate"] = (player["bubbles"] / buyins) if buyins else 0.0
        player["hitRate"] = (player["hits"] / entries) if entries else 0.0
        player["luckProxy"] = (
            (0.40 * player["cashRate"])
            + (0.20 * player["hitRate"])
            + (0.40 * (1 - player["bubbleRate"]))
        )

    league_avg_proxy = (
        math.fsum(player["luckProxy"] for player in active_players)
        / len(active_players)
    )

    for player in active_players:
        proxy_delta = player["luckProxy"] - league_avg_proxy
        expected_roi = max(-0.75, min(1.50, proxy_delta * 2.5))
        player["expectedProfit"] = round(player["totalCost"] * expected_roi, 1)
        player["luckIndex"] = round(player["profit"] - player["expectedProfit"], 1)

        cash_rate = player["cashRate"]
        bubble_rate = player["bubbleRate"]
        hit_rate = player["hitRate"]
        buy_ins = max(player["buyIns"], 1)
        rebuy_rate = player["rebuys"] / buy_ins

        player["clutchRaw"] = player["timesPlaced"] / buy_ins
        player["aggressionRaw"] = player["hits"] / max(player["entries"], 1)
        player["survivorRaw"] = (
            (0.55 * cash_rate)
            + (0.25 * (1 - bubble_rate))
            + (0.20 * hit_rate)
        )

        base_composure = 100 * (
            1 - ((0.70 * rebuy_rate) + (0.30 * bubble_rate))
        )
        sample_factor = min(player["buyIns"], 8) / 8.0
        composure_score = 50 + ((base_composure - 50) * sample_factor)
        player["tiltScoreDirect"] = max(0.0, min(100.0, composure_score))

    for key in ("roi", "luckIndex", "clutchRaw", "aggressionRaw", "survivorRaw"):
        normalize_stat(active_players, key)

    for player in active_players:
        player["clutchIndex"] = player["clutchRaw_norm"]
        player["aggressionIndex"] = player["aggressionRaw_norm"]
        player["survivorIndex"] = player["survivorRaw_norm"]
        player["tiltIndex"] = round(player["tiltScoreDirect"], 1)

        sample_bonus = min(10, player["buyIns"])
        player["trueSkillScore"] = (
            (player["roi_norm"] * 1.4)
            + (player["clutchIndex"] * 1.2)
            + player["aggressionIndex"]
            + player["survivorIndex"]
            + (player["luckIndex_norm"] * 0.5)
            + (player["tiltIndex"] * 0.8)
            + sample_bonus
        )
        player.pop("luckProxy", None)

    ranked = sorted(active_players, key=lambda player: -player["trueSkillScore"])
    total_ranked = len(ranked)
    for index, player in enumerate(ranked):
        percentile = index / max(total_ranked - 1, 1)
        if percentile <= 0.15:
            player["tier"] = "S"
        elif percentile <= 0.35:
            player["tier"] = "A"
        elif percentile <= 0.65:
            player["tier"] = "B"
        else:
            player["tier"] = "C"

    return players


def build_zero_player(meta):
    return {
        "name": meta["name"],
        "slug": meta["slug"],
        "image": meta["image"],
        "notes": meta.get("notes", ""),
        "entries": 0,
        "buyIns": 0,
        "rebuys": 0,
        "hits": 0,
        "timesPlaced": 0,
        "bubbles": 0,
        "profit": 0,
        "roi": 0.0,
        "cashRate": 0.0,
        "bubbleRate": 0.0,
        "hitRate": 0.0,
        "totalCost": 0,
        "totalWinnings": 0,
        "expectedProfit": 0.0,
        "luckIndex": 0.0,
        "clutchIndex": 0.0,
        "aggressionIndex": 0.0,
        "survivorIndex": 0.0,
        "tiltIndex": 0.0,
        "trueSkillScore": 0.0,
    }


def parse_event_date(event):
    raw = str(event.get("date") or event.get("eventId") or "")
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return datetime.max


def build_player_lookup(players):
    return {
        p["slug"]: {
            "name": p["name"],
            "slug": p["slug"],
            "image": p["image"],
            "notes": p.get("notes", "")
        }
        for p in players
    }


def make_streak_record(player_meta, streak_type, played_events, start_idx, end_idx, active=False):
    if start_idx is None or end_idx is None or start_idx > end_idx:
        return None

    window = played_events[start_idx:end_idx + 1]
    if not window:
        return None

    return {
        "player": player_meta["name"],
        "slug": player_meta["slug"],
        "image": player_meta["image"],
        "type": streak_type,
        "length": len(window),
        "startDate": window[0]["date"],
        "endDate": window[-1]["date"],
        "startTitle": window[0]["title"],
        "endTitle": window[-1]["title"],
        "active": active,
        "events": [
            {
                "date": item["date"],
                "title": item["title"],
                "cashed": item["cashed"]
            }
            for item in window
        ]
    }


def compute_best_run(played_events, target_cash):
    best = None
    run_start = None

    for idx, event in enumerate(played_events):
        matches = event["cashed"] == target_cash

        if matches and run_start is None:
            run_start = idx
        elif not matches and run_start is not None:
            candidate = (run_start, idx - 1)
            if best is None or (candidate[1] - candidate[0]) > (best[1] - best[0]):
                best = candidate
            run_start = None

    if run_start is not None:
        candidate = (run_start, len(played_events) - 1)
        if best is None or (candidate[1] - candidate[0]) > (best[1] - best[0]):
            best = candidate

    return best


def compute_current_run(played_events, target_cash):
    if not played_events:
        return None

    if played_events[-1]["cashed"] != target_cash:
        return None

    start_idx = len(played_events) - 1
    while start_idx > 0 and played_events[start_idx - 1]["cashed"] == target_cash:
        start_idx -= 1

    return (start_idx, len(played_events) - 1)


def build_streak_payload(players_lookup, parsed_events, min_events=4, min_streak=2):
    played_by_slug = {slug: [] for slug in players_lookup}

    for event in parsed_events:
        title = event.get("title", "")
        date = event.get("date", "")

        for ep in event.get("players", []):
            if ep.get("entries", 0) <= 0:
                continue

            slug = ep["slug"]
            if slug not in played_by_slug:
                continue

            played_by_slug[slug].append({
                "date": date,
                "title": title,
                "cashed": bool(ep.get("timesPlaced", 0) > 0)
            })

    players_payload = {}
    cash_leaders = []
    drought_leaders = []
    active_heaters = []
    active_droughts = []
    eligible_players = []

    for slug, player_meta in players_lookup.items():
        played_events = played_by_slug.get(slug, [])
        played_count = len(played_events)
        eligible = played_count >= min_events

        best_cash_idx = compute_best_run(played_events, True)
        best_drought_idx = compute_best_run(played_events, False)
        current_cash_idx = compute_current_run(played_events, True)
        current_drought_idx = compute_current_run(played_events, False)

        best_cash = make_streak_record(
            player_meta,
            "cash",
            played_events,
            *(best_cash_idx or (None, None)),
            active=False
        )
        best_drought = make_streak_record(
            player_meta,
            "drought",
            played_events,
            *(best_drought_idx or (None, None)),
            active=False
        )
        current_cash = make_streak_record(
            player_meta,
            "cash",
            played_events,
            *(current_cash_idx or (None, None)),
            active=True
        )
        current_drought = make_streak_record(
            player_meta,
            "drought",
            played_events,
            *(current_drought_idx or (None, None)),
            active=True
        )

        if best_cash and best_cash["length"] < min_streak:
            best_cash = None
        if best_drought and best_drought["length"] < min_streak:
            best_drought = None
        if current_cash and current_cash["length"] < min_streak:
            current_cash = None
        if current_drought and current_drought["length"] < min_streak:
            current_drought = None

        players_payload[slug] = {
            "playedEvents": played_count,
            "eligible": eligible,
            "bestCashStreak": best_cash,
            "currentCashStreak": current_cash,
            "bestDroughtStreak": best_drought,
            "currentDroughtStreak": current_drought,
        }

        if eligible:
            eligible_players.append({
                "name": player_meta["name"],
                "slug": player_meta["slug"],
                "image": player_meta["image"],
                "playedEvents": played_count,
            })

            if best_cash:
                cash_leaders.append(best_cash)
            if best_drought:
                drought_leaders.append(best_drought)
            if current_cash:
                active_heaters.append(current_cash)
            if current_drought:
                active_droughts.append(current_drought)

    cash_leaders = sorted(
        cash_leaders,
        key=lambda s: (-s["length"], s["player"].lower(), s["endDate"])
    )
    drought_leaders = sorted(
        drought_leaders,
        key=lambda s: (-s["length"], s["player"].lower(), s["endDate"])
    )
    active_heaters = sorted(
        active_heaters,
        key=lambda s: (-s["length"], s["player"].lower(), s["endDate"])
    )
    active_droughts = sorted(
        active_droughts,
        key=lambda s: (-s["length"], s["player"].lower(), s["endDate"])
    )
    eligible_players = sorted(eligible_players, key=lambda p: p["name"].lower())

    return {
        "definitions": {
            "cashStreak": "Consecutive played events that ended in a cash.",
            "droughtStreak": "Consecutive played events without a cash.",
            "minimumEligibleEvents": min_events,
            "minimumTrackedStreak": min_streak,
            "note": "Skipped events do not break or extend streaks."
        },
        "cashLeaders": cash_leaders,
        "droughtLeaders": drought_leaders,
        "activeCashLeaders": active_heaters,
        "activeDroughtLeaders": active_droughts,
        "eligiblePlayers": eligible_players,
        "players": players_payload
    }


def aggregate_card_form_window(player_meta, event_rows):
    metrics = build_zero_player(player_meta)

    for item in event_rows:
        row = item["row"]
        for key in [
            "entries", "buyIns", "rebuys", "hits", "timesPlaced",
            "bubbles", "profit", "totalCost", "totalWinnings"
        ]:
            metrics[key] += row.get(key, 0) or 0

    return {
        "eventCount": len(event_rows),
        "startDate": event_rows[0]["date"] if event_rows else None,
        "endDate": event_rows[-1]["date"] if event_rows else None,
        "metrics": metrics,
        "events": [
            {
                "date": item["date"],
                "title": item["title"],
                "entries": item["row"].get("entries", 0) or 0,
                "rebuys": item["row"].get("rebuys", 0) or 0,
                "hits": item["row"].get("hits", 0) or 0,
                "timesPlaced": item["row"].get("timesPlaced", 0) or 0,
                "bubbles": item["row"].get("bubbles", 0) or 0,
                "profit": item["row"].get("profit", 0) or 0,
                "totalCost": item["row"].get("totalCost", 0) or 0,
                "totalWinnings": item["row"].get("totalWinnings", 0) or 0,
            }
            for item in event_rows
        ]
    }


def finalize_card_form_windows(windows):
    active_metrics = [
        window["metrics"]
        for window in windows
        if window["eventCount"] > 0
    ]

    if not active_metrics:
        return

    for metrics in active_metrics:
        cost = float(metrics["totalCost"])
        buyins = float(metrics["buyIns"])
        entries = float(metrics["entries"])

        metrics["roi"] = (metrics["profit"] / cost) if cost else 0.0
        metrics["cashRate"] = (metrics["timesPlaced"] / buyins) if buyins else 0.0
        metrics["bubbleRate"] = (metrics["bubbles"] / buyins) if buyins else 0.0
        metrics["hitRate"] = (metrics["hits"] / entries) if entries else 0.0
        metrics["luckProxy"] = (
            (0.40 * metrics["cashRate"])
            + (0.20 * metrics["hitRate"])
            + (0.40 * (1 - metrics["bubbleRate"]))
        )

    league_avg_proxy = (
        math.fsum(metrics["luckProxy"] for metrics in active_metrics)
        / max(len(active_metrics), 1)
    )

    for metrics in active_metrics:
        proxy_delta = metrics["luckProxy"] - league_avg_proxy
        expected_roi = max(-0.75, min(1.50, proxy_delta * 2.5))
        metrics["expectedProfit"] = round(metrics["totalCost"] * expected_roi, 1)
        metrics["luckIndex"] = round(metrics["profit"] - metrics["expectedProfit"], 1)

        cash_rate = metrics["cashRate"]
        bubble_rate = metrics["bubbleRate"]
        hit_rate = metrics["hitRate"]
        buy_ins = max(metrics["buyIns"], 1)
        rebuy_rate = metrics["rebuys"] / buy_ins

        metrics["clutchRaw"] = metrics["timesPlaced"] / buy_ins
        metrics["aggressionRaw"] = metrics["hits"] / max(metrics["entries"], 1)
        metrics["survivorRaw"] = (
            (0.55 * cash_rate)
            + (0.25 * (1 - bubble_rate))
            + (0.20 * hit_rate)
        )

        base_composure = 100 * (
            1 - ((0.70 * rebuy_rate) + (0.30 * bubble_rate))
        )
        sample_factor = min(metrics["buyIns"], 8) / 8.0
        composure_score = 50 + ((base_composure - 50) * sample_factor)
        metrics["tiltIndex"] = round(
            max(0.0, min(100.0, composure_score)),
            1
        )

    for key in ["roi", "luckIndex", "clutchRaw", "aggressionRaw", "survivorRaw"]:
        normalize_stat(active_metrics, key)

    for metrics in active_metrics:
        metrics["clutchIndex"] = metrics["clutchRaw_norm"]
        metrics["aggressionIndex"] = metrics["aggressionRaw_norm"]
        metrics["survivorIndex"] = metrics["survivorRaw_norm"]
        sample_bonus = min(10, metrics["buyIns"])
        metrics["trueSkillScore"] = (
            (metrics["roi_norm"] * 1.4)
            + (metrics["clutchIndex"] * 1.2)
            + (metrics["aggressionIndex"] * 1.0)
            + (metrics["survivorIndex"] * 1.0)
            + (metrics["luckIndex_norm"] * 0.5)
            + (metrics["tiltIndex"] * 0.8)
            + sample_bonus
        )

        metrics.pop("luckProxy", None)


def finalize_historical_metrics(players):
    """Rebuild the live card inputs for one cumulative event checkpoint."""
    for player in players:
        cost = float(player["totalCost"])
        buy_ins = float(player["buyIns"])
        entries = float(player["entries"])

        player["roi"] = (player["profit"] / cost) if cost else 0.0
        player["cashRate"] = (player["timesPlaced"] / buy_ins) if buy_ins else 0.0
        player["bubbleRate"] = (player["bubbles"] / buy_ins) if buy_ins else 0.0
        player["hitRate"] = (player["hits"] / entries) if entries else 0.0
        player["luckProxy"] = (
            (0.40 * player["cashRate"])
            + (0.20 * player["hitRate"])
            + (0.40 * (1 - player["bubbleRate"]))
        )

    league_avg_proxy = (
        math.fsum(player["luckProxy"] for player in players)
        / max(len(players), 1)
    )

    for player in players:
        proxy_delta = player["luckProxy"] - league_avg_proxy
        expected_roi = max(-0.75, min(1.50, proxy_delta * 2.5))
        player["expectedProfit"] = round(player["totalCost"] * expected_roi, 1)
        player["luckIndex"] = round(
            player["profit"] - player["expectedProfit"],
            1
        )

        buy_ins = max(player["buyIns"], 1)
        rebuy_rate = player["rebuys"] / buy_ins
        player["clutchRaw"] = player["timesPlaced"] / buy_ins
        player["aggressionRaw"] = player["hits"] / max(player["entries"], 1)
        player["survivorRaw"] = (
            (0.55 * player["cashRate"])
            + (0.25 * (1 - player["bubbleRate"]))
            + (0.20 * player["hitRate"])
        )

        base_composure = 100 * (
            1 - ((0.70 * rebuy_rate) + (0.30 * player["bubbleRate"]))
        )
        sample_factor = min(player["buyIns"], 8) / 8.0
        composure_score = 50 + ((base_composure - 50) * sample_factor)
        player["tiltIndex"] = round(
            max(0.0, min(100.0, composure_score)),
            1
        )

    for key in ["roi", "luckIndex", "clutchRaw", "aggressionRaw", "survivorRaw"]:
        normalize_stat(players, key)

    for player in players:
        player["clutchIndex"] = player["clutchRaw_norm"]
        player["aggressionIndex"] = player["aggressionRaw_norm"]
        player["survivorIndex"] = player["survivorRaw_norm"]
        player["trueSkillScore"] = (
            (player["roi_norm"] * 1.4)
            + (player["clutchIndex"] * 1.2)
            + player["aggressionIndex"]
            + player["survivorIndex"]
            + (player["luckIndex_norm"] * 0.5)
            + (player["tiltIndex"] * 0.8)
            + min(10, player["buyIns"])
        )
        player.pop("luckProxy", None)


def js_round(value):
    return int(math.floor(float(value) + 0.5))


def historical_tier_score(player):
    buy_ins = float(player.get("buyIns", 0))
    rebuys = float(player.get("rebuys", 0))

    if buy_ins >= 20:
        sample_bonus = 3.0
    elif buy_ins >= 15:
        sample_bonus = 2.0
    elif buy_ins >= 10:
        sample_bonus = 1.0
    elif buy_ins >= CREW_ESTABLISHED_MIN_BUY_INS:
        sample_bonus = 0.25
    elif buy_ins >= CREW_PROVISIONAL_MIN_BUY_INS:
        sample_bonus = 0.0
    else:
        sample_bonus = -2.0

    return (
        (float(player.get("trueSkillScore", 0)) * 1.5)
        + (float(player.get("clutchIndex", 0)) * 1.1)
        + (float(player.get("aggressionIndex", 0)) * 0.65)
        + float(player.get("survivorIndex", 0))
        + (float(player.get("tiltIndex", 0)) * 1.25)
        + sample_bonus
        - (rebuys * 0.6)
    )


def historical_tier_meta(player, players):
    appearances = int(player.get("buyIns", 0))
    established = [
        candidate
        for candidate in players
        if int(candidate.get("buyIns", 0)) >= CREW_ESTABLISHED_MIN_BUY_INS
    ]
    established = sorted(established, key=lambda item: -historical_tier_score(item))

    if appearances < CREW_PROVISIONAL_MIN_BUY_INS:
        return {
            "code": "RKI",
            "className": "rookie",
            "status": "Rookie",
            "rank": None,
            "totalRanked": len(established)
        }

    if appearances < CREW_ESTABLISHED_MIN_BUY_INS:
        return {
            "code": "PRO",
            "className": "provisional",
            "status": "Provisional",
            "rank": None,
            "totalRanked": len(established)
        }

    rank = next(
        (
            index + 1
            for index, candidate in enumerate(established)
            if candidate["slug"] == player["slug"]
        ),
        None
    )
    percentile = (rank or (len(established) + 1)) / max(len(established), 1)

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

    return {
        "code": code,
        "className": class_name,
        "status": "Established",
        "rank": rank,
        "totalRanked": len(established)
    }


def historical_card_benchmark_pool(players):
    established = [
        player
        for player in players
        if int(player.get("buyIns", 0)) >= CREW_ESTABLISHED_MIN_BUY_INS
    ]
    if len(established) >= 2:
        return established

    provisional = [
        player
        for player in players
        if int(player.get("buyIns", 0)) >= CREW_PROVISIONAL_MIN_BUY_INS
    ]
    return provisional if len(provisional) >= 2 else players


def historical_metric_rating(player, players, key, min_rating=40, max_rating=96):
    pool = historical_card_benchmark_pool(players)
    values = [float(candidate.get(key, 0)) for candidate in pool]
    if not values:
        return 68

    min_value = min(values)
    max_value = max(values)
    value = float(player.get(key, 0))
    normalized = 0.5 if max_value == min_value else (
        (value - min_value) / (max_value - min_value)
    )
    bounded = max(0.0, min(1.0, normalized))
    return max(1, min(99, js_round(
        min_rating + (bounded * (max_rating - min_rating))
    )))


def historical_card_snapshot(player, players):
    tier = historical_tier_meta(player, players)
    return_rating = js_round(
        (historical_metric_rating(player, players, "roi") * 0.65)
        + (historical_metric_rating(player, players, "profit") * 0.35)
    )
    attributes = [
        {"code": "RET", "label": "Return", "value": return_rating},
        {
            "code": "CLT",
            "label": "Clutch",
            "value": historical_metric_rating(player, players, "clutchIndex")
        },
        {
            "code": "ITM",
            "label": "In the Money",
            "value": historical_metric_rating(player, players, "cashRate")
        },
        {
            "code": "AGR",
            "label": "Aggression",
            "value": historical_metric_rating(player, players, "aggressionIndex")
        },
        {
            "code": "HIT",
            "label": "Hit Rate",
            "value": historical_metric_rating(player, players, "hitRate")
        },
        {
            "code": "SUR",
            "label": "Survival",
            "value": historical_metric_rating(player, players, "survivorIndex")
        }
    ]

    return {
        "overall": historical_metric_rating(
            player,
            players,
            "trueSkillScore",
            CARD_OVERALL_MIN_RATING,
            CARD_OVERALL_MAX_RATING
        ),
        "tierCode": tier["code"],
        "tierClassName": tier["className"],
        "tierStatus": tier["status"],
        "powerRank": tier["rank"],
        "totalRanked": tier["totalRanked"],
        "appearances": int(player.get("buyIns", 0)),
        "attributes": attributes,
        "metrics": {
            "profit": player.get("profit", 0),
            "roi": round(float(player.get("roi", 0)), 6),
            "cashRate": round(float(player.get("cashRate", 0)), 6),
            "hitRate": round(float(player.get("hitRate", 0)), 6),
            "trueSkillScore": round(float(player.get("trueSkillScore", 0)), 3)
        }
    }


def historical_leader(players, key, direction="desc"):
    if not players:
        return None

    if direction == "asc":
        return sorted(
            players,
            key=lambda player: (float(player.get(key, 0)), player["name"].lower())
        )[0]

    return sorted(
        players,
        key=lambda player: (-float(player.get(key, 0)), player["name"].lower())
    )[0]


def historical_money(value):
    amount = float(value or 0)
    sign = "-" if amount < 0 else ""
    rounded = abs(js_round(amount))
    return f"{sign}${rounded:,}"


def historical_percent(value):
    return f"{float(value or 0) * 100:.1f}%"


def build_historical_card_collections(players, parsed_events):
    """Replay parsed events and issue permanent, frozen collectible cards."""
    metadata = {
        player["slug"]: {
            "name": player["name"],
            "slug": player["slug"],
            "image": player["image"],
            "notes": player.get("notes", "")
        }
        for player in players
    }
    cumulative = {
        slug: build_zero_player(player_meta)
        for slug, player_meta in metadata.items()
    }
    collections = {slug: {} for slug in metadata}
    streaks = {
        slug: {
            "current": 0,
            "best": 0,
            "startDate": None,
            "startTitle": None,
            "heaterId": None
        }
        for slug in metadata
    }

    hall_specs = [
        ("hall-tax-collector", "profit", "desc"),
        ("hall-direct-deposit", "cashRate", "desc"),
        ("hall-billing-department", "knockoutRate", "desc"),
        ("infamy-boy-in-the-bubble", "bubbles", "desc")
    ]
    leader_specs = [
        ("leader-profit", "profit", "desc"),
        ("leader-knockouts", "hits", "desc"),
        ("leader-roi", "roi", "desc"),
        ("leader-cash-rate", "cashRate", "desc")
    ]
    leader_labels = {
        "profit": "career-profit",
        "hits": "knockout",
        "roi": "ROI",
        "cashRate": "cash-rate"
    }
    hall_labels = {
        "profit": "Hall career-profit",
        "cashRate": "Hall cash-rate",
        "knockoutRate": "Hall knockout-efficiency",
        "bubbles": "Hall bubble"
    }

    def issue(slug, edition_id, event, reason, snapshot, priority):
        if edition_id in collections[slug]:
            return
        collections[slug][edition_id] = {
            "id": edition_id,
            "earnedDate": event.get("date", ""),
            "earnedEvent": event.get("title", ""),
            "reason": reason,
            "priority": priority,
            "snapshot": snapshot
        }

    for event_index, event in enumerate(parsed_events, start=1):
        event_rows = {
            row.get("slug"): row
            for row in event.get("players", [])
            if (row.get("entries", 0) or 0) > 0 and row.get("slug") in cumulative
        }

        for slug, row in event_rows.items():
            player = cumulative[slug]
            for key in [
                "entries", "buyIns", "rebuys", "hits", "timesPlaced",
                "bubbles", "profit", "totalCost", "totalWinnings"
            ]:
                player[key] += row.get(key, 0) or 0

            streak = streaks[slug]
            if (row.get("timesPlaced", 0) or 0) > 0:
                if streak["current"] == 0:
                    streak["startDate"] = event.get("date", "")
                    streak["startTitle"] = event.get("title", "")
                streak["current"] += 1
            else:
                streak["current"] = 0
                streak["startDate"] = None
                streak["startTitle"] = None

        checkpoint = [dict(cumulative[player["slug"]]) for player in players]
        finalize_historical_metrics(checkpoint)
        by_slug = {player["slug"]: player for player in checkpoint}

        for slug, row in event_rows.items():
            player = by_slug[slug]
            appearances = int(player.get("buyIns", 0))

            for milestone in CARD_MILESTONES:
                if appearances < milestone:
                    continue
                issue(
                    slug,
                    f"milestone-{milestone}",
                    event,
                    f"Joined the {milestone}-Appearance Club at {event.get('title', 'a TLPT event')}.",
                    historical_card_snapshot(player, checkpoint),
                    1
                )

            streak = streaks[slug]
            if streak["current"] >= 2 and streak["current"] > streak["best"]:
                previous_id = streak.get("heaterId")
                previous = collections[slug].pop(previous_id, None) if previous_id else None
                streak["best"] = streak["current"]
                heater_id = f"heater-{streak['best']}"
                streak["heaterId"] = heater_id
                first_date = previous.get("earnedDate") if previous else event.get("date", "")
                first_event = previous.get("earnedEvent") if previous else event.get("title", "")
                record = {
                    "id": heater_id,
                    "earnedDate": first_date,
                    "earnedEvent": first_event,
                    "reason": (
                        f"Personal-best {streak['best']}-appearance cash streak from "
                        f"{streak['startDate']} through {event.get('date', '')}."
                    ),
                    "priority": 2,
                    "snapshot": historical_card_snapshot(player, checkpoint),
                    "streakLength": streak["best"]
                }
                if previous:
                    record["upgradedDate"] = event.get("date", "")
                    record["upgradeEvent"] = event.get("title", "")
                collections[slug][heater_id] = record

        established = [
            player
            for player in checkpoint
            if int(player.get("buyIns", 0)) >= CREW_ESTABLISHED_MIN_BUY_INS
        ]
        for edition_id, key, direction in leader_specs:
            leader = historical_leader(established, key, direction)
            if not leader:
                continue
            if key == "profit":
                value = historical_money(leader.get(key, 0))
            elif key in ("roi", "cashRate"):
                value = historical_percent(leader.get(key, 0))
            else:
                value = f"{int(leader.get(key, 0))} hits"
            issue(
                leader["slug"],
                edition_id,
                event,
                f"First claimed the established-player {leader_labels[key]} lead at {value}.",
                historical_card_snapshot(leader, checkpoint),
                3
            )

        hall_minimum = hall_minimum_appearances(event_index)
        hall_pool = []
        for player in checkpoint:
            if int(player.get("buyIns", 0)) < hall_minimum:
                continue
            hall_player = dict(player)
            hall_player["knockoutRate"] = (
                hall_player["hits"] / hall_player["entries"]
                if hall_player["entries"]
                else 0.0
            )
            hall_pool.append(hall_player)

        for edition_id, key, direction in hall_specs:
            leader = historical_leader(hall_pool, key, direction)
            if not leader:
                continue
            if key == "profit":
                value = historical_money(leader.get(key, 0))
            elif key == "cashRate":
                value = historical_percent(leader.get(key, 0))
            elif key == "knockoutRate":
                value = f"{float(leader.get(key, 0)):.2f} knockouts per entry"
            else:
                value = f"{int(leader.get(key, 0))} bubbles"
            issue(
                leader["slug"],
                edition_id,
                event,
                f"First claimed the {hall_labels[key]} distinction at {value}.",
                historical_card_snapshot(leader, checkpoint),
                4
            )

    fixed_order = {
        "hall-tax-collector": 0,
        "hall-direct-deposit": 1,
        "hall-billing-department": 2,
        "infamy-boy-in-the-bubble": 3,
        "leader-profit": 10,
        "leader-knockouts": 11,
        "leader-roi": 12,
        "leader-cash-rate": 13
    }

    def collection_sort_key(record):
        edition_id = record["id"]
        if edition_id.startswith("heater-"):
            order = 20
        elif edition_id.startswith("milestone-"):
            order = 100 - int(edition_id.split("-")[-1])
        else:
            order = fixed_order.get(edition_id, 99)
        return (-record["priority"], order, record["earnedDate"], edition_id)

    return {
        slug: sorted(records.values(), key=collection_sort_key)
        for slug, records in collections.items()
    }


def build_card_form_payload(players, parsed_events, window_size=CARD_FORM_WINDOW):
    player_meta = {
        player["slug"]: {
            "name": player["name"],
            "slug": player["slug"],
            "image": player["image"],
            "notes": player.get("notes", "")
        }
        for player in players
    }
    played_by_slug = {slug: [] for slug in player_meta}

    for event in parsed_events:
        date = event.get("date", "")
        title = event.get("title", "")

        for row in event.get("players", []):
            if (row.get("entries", 0) or 0) <= 0:
                continue

            slug = row.get("slug")
            if slug not in played_by_slug:
                continue

            played_by_slug[slug].append({
                "date": date,
                "title": title,
                "row": row
            })

    payload = {}
    recent_windows = []
    previous_windows = []

    for slug, meta in player_meta.items():
        played_events = played_by_slug.get(slug, [])
        recent_rows = played_events[-window_size:]
        previous_rows = played_events[-(window_size * 2):-window_size]
        recent = aggregate_card_form_window(meta, recent_rows)
        previous = aggregate_card_form_window(meta, previous_rows)

        payload[slug] = {
            "windowSize": window_size,
            "recent": recent,
            "previous": previous
        }
        recent_windows.append(recent)
        previous_windows.append(previous)

    finalize_card_form_windows(recent_windows)
    finalize_card_form_windows(previous_windows)
    return payload


def main():
    metadata = load_json(METADATA_PATH)
    config = load_json(CONFIG_PATH)
    events = load_json(EVENTS_PATH)
    featured_card_policy = load_json(FEATURED_CARDS_PATH)

    parsed_files = sorted(
        (f for f in PARSED_EVENTS_DIR.glob("*.json") if f.name != "index.json"),
        key=lambda path: path.name
    )

    if not parsed_files:
        raise RuntimeError("No parsed events found")

    def build_fallback_player(slug):
        image_path = f"images/players/{slug}.jpg"
        if not (ROOT / image_path).exists():
            image_path = "images/players/default.jpg"

        return {
            "name": slug.replace("-", " ").title(),
            "slug": slug,
            "image": image_path,
            "notes": "",
            "active": True
        }

    players_by_slug = {p["slug"]: build_zero_player(p) for p in metadata["players"]}
    parsed_events = []

    for parsed_file in parsed_files:
        event = load_json(parsed_file)

        if not isinstance(event, dict):
            continue

        parsed_events.append(event)

        for ep in event.get("players", []):
            if ep.get("entries", 0) == 0:
                continue

            player_slug = ep["slug"]

            if player_slug not in players_by_slug:
                fallback_meta = build_fallback_player(player_slug)
                players_by_slug[player_slug] = build_zero_player(fallback_meta)

            p = players_by_slug[player_slug]

            for key in [
                "entries", "buyIns", "rebuys", "hits",
                "timesPlaced", "bubbles", "profit",
                "totalCost", "totalWinnings"
            ]:
                p[key] += ep.get(key, 0)

    players = list(players_by_slug.values())
    finalize_career_metrics(players)

    qualified = [
        p for p in players
        if p["entries"] >= config["qualification_thresholds"]["leaders_min_entries"]
    ]

    honors = []
    for rule in config["honors"]:
        leader = sort_players(qualified, rule["key"], rule["direction"])[0]
        honors.append({
            "type": rule["type"],
            "name": leader["name"],
            "note": rule.get("note", "")
        })

    records = []
    record_pool = [
        player for player in players
        if int(player.get("buyIns", 0) or 0) > 0
    ]
    for rule in config["records"]:
        leader = sort_players(record_pool, rule["key"], rule["direction"])[0]
        records.append({
            "label": rule["label"],
            "name": leader["name"],
            "value": str(round(leader[rule["key"]], 2))
        })

    for p in players:
        p.pop("luckProxy", None)

    players = sorted(players, key=lambda p: p["name"].lower())
    player_lookup = build_player_lookup(players)
    parsed_events = sorted(parsed_events, key=parse_event_date)
    card_form = build_card_form_payload(players, parsed_events)
    card_collections = build_historical_card_collections(players, parsed_events)
    for player in players:
        player["cardForm"] = card_form.get(player["slug"])
        player["cardCollection"] = card_collections.get(player["slug"], [])
    featured_card_summary = apply_featured_card_policy(players, featured_card_policy)

    streaks = build_streak_payload(player_lookup, parsed_events, min_events=2, min_streak=2)

    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "sourceMode": "event_reports",
        "events": events["events"],
        "honors": honors,
        "records": records,
        "players": players,
        "streaks": streaks,
        "cardLedger": {
            "version": 1,
            "source": "parsed-event-replay",
            "eventCount": len(parsed_events),
            "replayedThrough": parsed_events[-1].get("date", "") if parsed_events else "",
            "rules": {
                "base": "Live career card; recalculates whenever event data changes.",
                "milestones": list(CARD_MILESTONES),
                "leader": "One permanent card per category per player, dated the first time the lead was claimed.",
                "hall": "Permanent when first earned at the historical Hall qualification threshold.",
                "heater": "One permanent card that upgrades whenever the player sets a longer personal cash streak.",
                "snapshot": "Overall, tier and all six attributes are frozen at issuance or upgrade."
            }
        },
        "featuredCardConfig": featured_card_summary
    }

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
