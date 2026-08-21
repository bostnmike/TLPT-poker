#!/usr/bin/env python3

import json
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
PARSED_EVENTS_DIR = DATA_DIR / "parsed" / "events"
GENERATED_DIR = DATA_DIR / "generated"

METADATA_PATH = DATA_DIR / "player-metadata.json"
CONFIG_PATH = DATA_DIR / "league-config.json"
EVENTS_PATH = DATA_DIR / "events.json"
OUTPUT_PATH = GENERATED_DIR / "site-data.json"

CARD_FORM_WINDOW = 5


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


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
        sum(metrics["luckProxy"] for metrics in active_metrics)
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

    for p in players:
        cost = float(p["totalCost"])
        buyins = float(p["buyIns"])
        entries = float(p["entries"])

        p["roi"] = (p["profit"] / cost) if cost else 0.0
        p["cashRate"] = (p["timesPlaced"] / buyins) if buyins else 0.0
        p["bubbleRate"] = (p["bubbles"] / buyins) if buyins else 0.0
        p["hitRate"] = (p["hits"] / entries) if entries else 0.0

    for p in players:
        p["luckProxy"] = (
            (0.40 * p["cashRate"])
            + (0.20 * p["hitRate"])
            + (0.40 * (1 - p["bubbleRate"]))
        )

    league_avg_proxy = sum(p["luckProxy"] for p in players) / max(len(players), 1)

    for p in players:
        proxy_delta = p["luckProxy"] - league_avg_proxy
        expected_roi = max(-0.75, min(1.50, proxy_delta * 2.5))
        p["expectedProfit"] = round(p["totalCost"] * expected_roi, 1)
        p["luckIndex"] = round(p["profit"] - p["expectedProfit"], 1)

    for p in players:
        cash_rate = p["cashRate"]
        bubble_rate = p["bubbleRate"]
        hit_rate = p["hitRate"]

        buy_ins = max(p["buyIns"], 1)
        rebuy_rate = p["rebuys"] / buy_ins

        p["clutchRaw"] = p["timesPlaced"] / buy_ins
        p["aggressionRaw"] = p["hits"] / max(p["entries"], 1)
        p["survivorRaw"] = (
            (0.55 * cash_rate)
            + (0.25 * (1 - bubble_rate))
            + (0.20 * hit_rate)
        )

        base_composure = 100 * (1 - ((0.70 * rebuy_rate) + (0.30 * bubble_rate)))
        sample_factor = min(p["buyIns"], 8) / 8.0
        composure_score = 50 + ((base_composure - 50) * sample_factor)
        p["tiltScoreDirect"] = max(0.0, min(100.0, composure_score))

    normalize_stat(players, "roi")
    normalize_stat(players, "luckIndex")
    normalize_stat(players, "clutchRaw")
    normalize_stat(players, "aggressionRaw")
    normalize_stat(players, "survivorRaw")

    for p in players:
        p["clutchIndex"] = p["clutchRaw_norm"]
        p["aggressionIndex"] = p["aggressionRaw_norm"]
        p["survivorIndex"] = p["survivorRaw_norm"]
        p["tiltIndex"] = round(p["tiltScoreDirect"], 1)

        sample_bonus = min(10, p["buyIns"])

        p["trueSkillScore"] = (
            (p["roi_norm"] * 1.4)
            + (p["clutchIndex"] * 1.2)
            + (p["aggressionIndex"] * 1.0)
            + (p["survivorIndex"] * 1.0)
            + (p["luckIndex_norm"] * 0.5)
            + (p["tiltIndex"] * 0.8)
            + sample_bonus
        )

    sorted_by_skill = sorted(players, key=lambda p: -p["trueSkillScore"])
    total_players = len(sorted_by_skill)

    for idx, p in enumerate(sorted_by_skill):
        percentile = idx / max(total_players - 1, 1)

        if percentile <= 0.15:
            tier = "S"
        elif percentile <= 0.35:
            tier = "A"
        elif percentile <= 0.65:
            tier = "B"
        else:
            tier = "C"

        p["tier"] = tier

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
    for rule in config["records"]:
        leader = sort_players(players, rule["key"], rule["direction"])[0]
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
    for player in players:
        player["cardForm"] = card_form.get(player["slug"])

    streaks = build_streak_payload(player_lookup, parsed_events, min_events=2, min_streak=2)

    output = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "sourceMode": "event_reports",
        "events": events["events"],
        "honors": honors,
        "records": records,
        "players": players,
        "streaks": streaks
    }

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
