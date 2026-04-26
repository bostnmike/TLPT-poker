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
        raise RuntimeError("No parsed events found")

    players_by_slug = {p["slug"]: build_zero_player(p) for p in metadata["players"]}

    for parsed_file in parsed_files:
        event = load_json(parsed_file)

        for ep in event.get("players", []):
            p = players_by_slug[ep["slug"]]
            for key in [
                "entries", "buyIns", "rebuys", "hits",
                "timesPlaced", "bubbles", "profit",
                "totalCost", "totalWinnings"
            ]:
                p[key] += ep.get(key, 0)

    players = list(players_by_slug.values())

    # ---------------- BASIC METRICS ----------------

    for p in players:
        cost = float(p["totalCost"])
        buyins = float(p["buyIns"])
        entries = float(p["entries"])

        p["roi"] = (p["profit"] / cost) if cost else 0.0
        p["cashRate"] = (p["timesPlaced"] / buyins) if buyins else 0.0
        p["bubbleRate"] = (p["bubbles"] / buyins) if buyins else 0.0
        p["hitRate"] = (p["hits"] / entries) if entries else 0.0

    # ---------------- EXPECTED / LUCK ----------------

    total_entries = sum(p["entries"] for p in players)
    total_profit = sum(p["profit"] for p in players)
    league_avg = total_profit / total_entries if total_entries else 0

    for p in players:
        p["expectedProfit"] = p["entries"] * league_avg
        p["luckIndex"] = p["profit"] - p["expectedProfit"]

    # ---------------- RAW COMPONENTS ----------------

    for p in players:
        p["clutchRaw"] = p["timesPlaced"] / max(p["buyIns"], 1)
        p["aggressionRaw"] = p["hits"] / max(p["entries"], 1)
        p["survivorRaw"] = 1 - (p["bubbles"] / max(p["buyIns"], 1))
        p["tiltRaw"] = p["rebuys"] / max(p["buyIns"], 1)

    # ---------------- NORMALIZE ----------------

    normalize_stat(players, "roi")
    normalize_stat(players, "luckIndex")
    normalize_stat(players, "clutchRaw")
    normalize_stat(players, "aggressionRaw")
    normalize_stat(players, "survivorRaw")
    normalize_stat(players, "tiltRaw")

    # ---------------- FINAL METRICS ----------------

    for p in players:
        p["clutchIndex"] = p["clutchRaw_norm"]
        p["aggressionIndex"] = p["aggressionRaw_norm"]
        p["survivorIndex"] = p["survivorRaw_norm"]
        p["tiltIndex"] = 100 - p["tiltRaw_norm"]

        sample_bonus = min(10, p["buyIns"])

        p["trueSkillScore"] = (
            (p["roi_norm"] * 1.4)
            + (p["clutchIndex"] * 1.2)
            + (p["aggressionIndex"] * 1.0)
            + (p["survivorIndex"] * 1.0)
            + (p["luckIndex_norm"] * 0.5)
            - (p["tiltIndex"] * 0.8)
            + sample_bonus
        )

    # -------------------------------
    # TIER SYSTEM (FIXED)
    # -------------------------------

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

    # ---------------- HONORS ----------------

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

    # ---------------- RECORDS ----------------

    records = []
    for rule in config["records"]:
        leader = sort_players(players, rule["key"], rule["direction"])[0]
        records.append({
            "label": rule["label"],
            "name": leader["name"],
            "value": str(round(leader[rule["key"]], 2))
        })

    players = sorted(players, key=lambda p: p["name"].lower())

    output = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "sourceMode": "event_reports",
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
