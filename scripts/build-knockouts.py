#!/usr/bin/env python3

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
PARSED_EVENTS_DIR = DATA_DIR / "parsed" / "events"
OUTPUT_PATH = ROOT / "data" / "generated" / "knockouts-generated.json"


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def bump_nested_counter(container, outer_key, inner_key, amount=1):
    if outer_key not in container:
        container[outer_key] = {}
    if inner_key not in container[outer_key]:
        container[outer_key][inner_key] = 0
    container[outer_key][inner_key] += amount


def main():
    parsed_files = sorted(PARSED_EVENTS_DIR.glob("*.json"))
    if not parsed_files:
        raise RuntimeError(f"No parsed event JSON files found in {PARSED_EVENTS_DIR}")

    by_victim = {}
    by_killer = {}
    events_processed = []

    for parsed_file in parsed_files:
        event = load_json(parsed_file)
        events_processed.append(event.get("eventId") or parsed_file.stem)

        for action in event.get("actions", []):
            if action.get("type") != "bustout":
                continue

            victim_slug = action.get("slug")
            killer_slug = action.get("bySlug")

            if not victim_slug or not killer_slug:
                continue

            bump_nested_counter(by_victim, victim_slug, killer_slug, 1)
            bump_nested_counter(by_killer, killer_slug, victim_slug, 1)

    output = {
        "byVictim": dict(sorted(by_victim.items(), key=lambda item: item[0])),
        "byKiller": dict(sorted(by_killer.items(), key=lambda item: item[0])),
        "eventsProcessed": events_processed
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"✅ Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
