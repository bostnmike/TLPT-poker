#!/usr/bin/env python3

import csv
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
GENERATED_DIR = DATA_DIR / "generated"

METADATA_PATH = DATA_DIR / "player-metadata.json"
CONFIG_PATH = DATA_DIR / "league-config.json"
EVENTS_PATH = DATA_DIR / "events.json"
OUTPUT_PATH = GENERATED_DIR / "site-data.json"


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def normalize(s):
    return str(s or "").strip().lower()


def safe_num(value):
    if value is None:
        return 0
    text = str(value).strip().replace(",", "").replace("$", "").replace("%", "")
    if text == "":
        return 0
    try:
        if "." in text:
            return float(text)
        return int(text)
    except ValueError:
        return 0


def fmt_money(value):
    sign = "-" if value < 0 else ""
    return f"{sign}${abs(int(round(value))):,}"


def fmt_pct(value):
    return f"{value * 100:.1f}%"


def fmt_num1(value):
    return f"{value:.1f}"


def choose_record_value(player, key, fmt):
    value = player.get(key, 0)
    if fmt == "money":
        return fmt_money(value)
    if fmt == "pct":
        return fmt_pct(value)
    if fmt == "num1":
        return fmt_num1(value)
    return str(int(round(value)))


def sort_players(players, key, direction="desc"):
    reverse = direction == "desc"
    return sorted(
        players,
        key=lambda p: (float(p.get(key, 0)), p.get("name", "")),
        reverse=reverse
    )


def compute_expected_profit(entries, league_avg_profit_per_entry):
    return entries * league_avg_profit_per_entry


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


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/build-site-data.py data/raw/<csvfile>")
        sys.exit(1)

    csv_path = Path(sys.argv[1]).resolve()
    metadata = load_json(METADATA_PATH)
    config = load_json(CONFIG_PATH)
    events = load_json(EVENTS_PATH)

    raw_field_map = config["raw_field_map"]
    buy_in_amount = config["buy_in_amount"]

    meta_players = metadata["players"]
    alias_map = {}
    slug_map = {}

    for player in meta_players:
        slug = player["slug"]
        slug_map[slug] = player
        for alias in player.get("aliases", []):
            alias_map[normalize(alias)] = player
        alias_map[normalize(player["name"])] = player

    csv_rows = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            csv_rows.append(row)

    mapped_players = {}
    unmapped_rows = []

    for row in csv_rows:
        raw_name = row.get(raw_field_map["name"], "")
        lookup = alias_map.get(normalize(raw_name))
        if not lookup:
            unmapped_rows.append(raw_name)
            continue

        slug = lookup["slug"]
        mapped_players[slug] = {
            "name": lookup["name"],
            "slug": lookup["slug"],
            "image": lookup["image"],
            "notes": lookup["notes"],
            "entries": safe_num(row.get(raw_field_map["entries"])),
            "buyIns": safe_num(row.get(raw_field_map["buyIns"])),
            "rebuys": safe_num(row.get(raw_field_map["rebuys"])),
            "hits": safe_num(row.get(raw_field_map["hits"])),
            "timesPlaced": safe_num(row.get(raw_field_map["timesPlaced"])),
            "bubbles": safe_num(row.get(raw_field_map["bubbles"])),
            "profit": safe_num(row.get(raw_field_map["profit"])),
            "totalCost": safe_num(row.get(raw_field_map["totalCost"])),
            "totalWinnings": safe_num(row.get(raw_field_map["totalWinnings"]))
        }

    missing_players = [p["slug"] for p in meta_players if p["slug"] not in mapped_players]

    if unmapped_rows:
        raise RuntimeError(f"Unmapped CSV rows: {unmapped_rows}")

    if missing_players:
        raise RuntimeError(f"Players missing from CSV: {missing_players}")

    players = list(mapped_players.values())

    total_entries = sum(float(p["entries"]) for p in players)
    total_profit = sum(float(p["profit"]) for p in players)
    league_avg_profit_per_entry = (total_profit / total_entries) if total_entries else 0.0

    for p in players:
        p["roi"] = (float(p["profit"]) / float(p["totalCost"])) if float(p["totalCost"]) else 0.0
        p["cashRate"] = (float(p["timesPlaced"]) / float(p["buyIns"])) if float(p["buyIns"]) else 0.0
        p["bubbleRate"] = (float(p["bubbles"]) / float(p["buyIns"])) if float(p["buyIns"]) else 0.0
        p["hitRate"] = (float(p["hits"]) / float(p["entries"])) if float(p["entries"]) else 0.0

        p["expectedProfit"] = compute_expected_profit(float(p["entries"]), league_avg_profit_per_entry)
        p["luckIndex"] = float(p["profit"]) - float(p["expectedProfit"])
        p["clutchIndex"] = compute_clutch_index(p)
        p["aggressionIndex"] = compute_aggression_index(p)
        p["survivorIndex"] = compute_survivor_index(p)
        p["tiltIndex"] = compute_tilt_index(p)
        p["trueSkillScore"] = compute_true_skill(p)

    leaders_min_entries = config["qualification_thresholds"]["leaders_min_entries"]
    qualified = [p for p in players if float(p["entries"]) >= leaders_min_entries]

    honors = []
    for rule in config["honors"]:
        sorted_pool = sort_players(qualified, rule["key"], rule["direction"])
        leader = sorted_pool[0]
        honors.append({
            "type": rule["type"],
            "name": leader["name"],
            "note": rule["note"]
        })

    records = []
    for rule in config["records"]:
        sorted_pool = sort_players(players, rule["key"], rule["direction"])
        leader = sorted_pool[0]
        records.append({
            "label": rule["label"],
            "name": leader["name"],
            "value": choose_record_value(leader, rule["key"], rule["format"])
        })

    output = {
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
