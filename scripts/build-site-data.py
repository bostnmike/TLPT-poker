#!/usr/bin/env python3

import json
import sys
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


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def fmt_money(value):
    sign = "-" if float(value) < 0 else ""
    return f"{sign}${abs(int(round(float(value)))):,}"


def fmt_pct(value):
    return f"{float(value) * 100:.1f}%"


def fmt_num1(value):
    return f"{float(value):.1f}"


def choose_record_value(player, key, fmt):
    value = player.get(key, 0)
    if fmt == "money":
        return fmt_money(value)
    if fmt == "pct":
        return fmt_pct(value)
    if fmt == "num1":
        return fmt_num1(value)
    return str(int(round(float(value))))


def sort_players(players, key, direction="desc"):
    if direction == "desc":
        return sorted(
            players,
            key=lambda p: (-float(p.get(key, 0)), str(p.get("name", "")).lower())
        )
    return sorted(
        players,
        key=lambda p: (float(p.get(key, 0)), str(p.get("name", "")).lower())
    )


def compute_expected_profit(entries, league_avg_profit_per_entry):
    return float(entries) * float(league_avg_profit_per_entry)


def compute_clutch_index(player):
    cash_rate = float(player["cashRate"])
    bubble_rate = float(player["bubbleRate"])
    roi = float(player["roi"])
    return (cash_rate * 100 * 0.55) + (roi * 100 * 0.35) - (bubble_rate * 100 * 0.20)


def compute_aggression_index(player):
    return float(player["hitRate"]) * 100


def compute_survivor_index(player):
    cash_rate = float(player["cashRate"])
    bubble_rate = float(player["bubbleRate"])
    return max(0.0, (cash_rate * 100 * 0.8) + ((1 - bubble_rate) * 20))


def compute_tilt_index(player):
    rebuys = float(player["rebuys"])
    buyins = max(float(player["buyIns"]), 1.0)
    bubble_rate = float(player["bubbleRate"])
    roi = float(player["roi"])
    return max(0.0, (rebuys / buyins) * 100 + bubble_rate * 40 + max(0.0, -roi * 20))


def compute_true_skill(player):
    roi = float(player["roi"])
    cash_rate = float(player["cashRate"])
    hit_rate = float(player["hitRate"])
    clutch = float(player["clutchIndex"])
    aggression = float(player["aggressionIndex"])
    survivor = float(player["survivorIndex"])
    tilt = float(player["tiltIndex"])
    return (
        (roi * 100 * 0.30)
        + (cash_rate * 100 * 0.20)
        + (hit_rate * 100 * 0.15)
        + (clutch * 0.20)
        + (aggression * 0.10)
        + (survivor * 0.10)
        - (tilt * 0.15)
    )


def build_zero_player(meta):
    return {
        "name": meta["name"],
        "slug": meta["slug"],
        "image": meta["image"],
        "notes": meta["notes"],
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
        "trueSkillScore": 0.0
    }


def main():
    metadata = load_json(METADATA_PATH)
    config = load_json(CONFIG_PATH)
    events = load_json(EVENTS_PATH)

    parsed_files = sorted(PARSED_EVENTS_DIR.glob("*.json"))
    if not parsed_files:
        raise RuntimeError(f"No parsed event JSON files found in {PARSED_EVENTS_DIR}. Run parse-event-reports.py first.")

    meta_players = metadata["players"]
    players_by_slug = {p["slug"]: build_zero_player(p) for p in meta_players}

    parsed_event_count = 0
    parse_warnings = []

    for parsed_file in parsed_files:
        event = load_json(parsed_file)
        parsed_event_count += 1

        for warning in event.get("warnings", []):
            parse_warnings.append(f"{parsed_file.name}: {warning}")

        for event_player in event.get("players", []):
            slug = event_player["slug"]
            if slug not in players_by_slug:
                raise RuntimeError(f"Parsed event contains unknown player slug '{slug}' in {parsed_file.name}")

            target = players_by_slug[slug]
            for key in [
                "entries",
                "buyIns",
                "rebuys",
                "hits",
                "timesPlaced",
                "bubbles",
                "profit",
                "totalCost",
                "totalWinnings"
            ]:
                target[key] += event_player.get(key, 0)

    players = list(players_by_slug.values())

    total_entries = sum(float(p["entries"]) for p in players)
    total_profit = sum(float(p["profit"]) for p in players)
    league_avg_profit_per_entry = (total_profit / total_entries) if total_entries else 0.0

    for p in players:
        total_cost = float(p["totalCost"])
        buyins = float(p["buyIns"])
        entries = float(p["entries"])

        p["roi"] = (float(p["profit"]) / total_cost) if total_cost else 0.0
        p["cashRate"] = (float(p["timesPlaced"]) / buyins) if buyins else 0.0
        p["bubbleRate"] = (float(p["bubbles"]) / buyins) if buyins else 0.0
        p["hitRate"] = (float(p["hits"]) / entries) if entries else 0.0

        p["expectedProfit"] = compute_expected_profit(p["entries"], league_avg_profit_per_entry)
        p["luckIndex"] = float(p["profit"]) - float(p["expectedProfit"])
        p["clutchIndex"] = compute_clutch_index(p)
        p["aggressionIndex"] = compute_aggression_index(p)
        p["survivorIndex"] = compute_survivor_index(p)
        p["tiltIndex"] = compute_tilt_index(p)
        p["trueSkillScore"] = compute_true_skill(p)

    leaders_min_entries = config["qualification_thresholds"]["leaders_min_entries"]
    qualified = [p for p in players if float(p["entries"]) >= leaders_min_entries]
    if not qualified:
        raise RuntimeError(f"No qualified players found using leaders_min_entries={leaders_min_entries}")

    honors = []
    for rule in config["honors"]:
        sorted_pool = sort_players(qualified, rule["key"], rule["direction"])
        leader = sorted_pool[0]
        honors.append({
            "type": rule["type"],
            "name": leader["name"],
            "note": rule.get("note", "")
        })

    records = []
    for rule in config["records"]:
        sorted_pool = sort_players(players, rule["key"], rule["direction"])
        leader = sorted_pool[0]
        records.append({
            "label": rule["label"],
            "name": leader["name"],
            "value": choose_record_value(leader, rule["key"], rule.get("format", "int"))
        })

    players = sorted(players, key=lambda p: str(p["name"]).lower())

    output = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "sourceMode": "event_reports",
        "parsedEventCount": parsed_event_count,
        "parseWarnings": parse_warnings,
        "events": events["events"],
        "honors": honors,
        "records": records,
        "players": players
    }

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
