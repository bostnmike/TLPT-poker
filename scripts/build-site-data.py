#!/usr/bin/env python3

import json
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

PARSED_EVENTS_DIR = DATA_DIR / "parsed" / "events"
OUTPUT_PATH = DATA_DIR / "generated" / "site-data.json"
METADATA_PATH = DATA_DIR / "player-metadata.json"


# -----------------------------------------
# UTIL
# -----------------------------------------
def load_json(path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def safe_int(val):
    try:
        return int(val)
    except:
        return 0


# -----------------------------------------
# MAIN
# -----------------------------------------
def main():

    print("🔄 Building site data...")

    # -----------------------------------------
    # LOAD PLAYER METADATA
    # -----------------------------------------
    metadata = load_json(METADATA_PATH)
    players_meta = metadata.get("players", [])

    players_map = {}

    for p in players_meta:
        slug = p.get("slug")

        players_map[slug] = {
            **p,
            "buyIns": 0,
            "rebuys": 0,
            "entries": 0,
            "hits": 0,
            "timesPlaced": 0,
            "bubbles": 0,
            "totalCost": 0,
            "totalWinnings": 0,
            "profit": 0,
        }

    # -----------------------------------------
    # LOAD EVENTS (🔥 FIXED)
    # -----------------------------------------
    event_files = sorted(
        f for f in PARSED_EVENTS_DIR.glob("*.json")
        if f.name != "index.json"
    )

    print(f"📁 Found {len(event_files)} event files")

    events = []

    for path in event_files:
        try:
            data = load_json(path)

            # 🚨 HARD GUARD
            if not isinstance(data, dict):
                print(f"⚠️ Skipping non-event file: {path.name}")
                continue

            events.append(data)

        except Exception as e:
            print(f"⚠️ Failed to load {path.name}: {e}")

    print(f"✅ Loaded {len(events)} valid events")

    # -----------------------------------------
    # PROCESS EVENTS
    # -----------------------------------------
    for event in events:

        # 🔒 SAFE ACCESS
        players = event.get("players", [])

        if not isinstance(players, list):
            print("⚠️ Skipping malformed event (players not list)")
            continue

        for ep in players:

            slug = ep.get("slug")

            if slug not in players_map:
                continue

            p = players_map[slug]

            p["buyIns"] += safe_int(ep.get("buyIns"))
            p["rebuys"] += safe_int(ep.get("rebuys"))
            p["entries"] += safe_int(ep.get("entries"))
            p["hits"] += safe_int(ep.get("hits"))
            p["timesPlaced"] += safe_int(ep.get("timesPlaced"))
            p["bubbles"] += safe_int(ep.get("bubbles"))
            p["totalCost"] += safe_int(ep.get("totalCost"))
            p["totalWinnings"] += safe_int(ep.get("totalWinnings"))
            p["profit"] += safe_int(ep.get("profit"))

    # -----------------------------------------
    # FINAL PLAYER LIST
    # -----------------------------------------
    players = list(players_map.values())

    # -----------------------------------------
    # OUTPUT STRUCTURE
    # -----------------------------------------
    output = {
        "players": players
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"✅ site-data.json written successfully")


# -----------------------------------------
# RUN
# -----------------------------------------
if __name__ == "__main__":
    main()
