#!/usr/bin/env python3

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

DATA_DIR = ROOT / "data"
PARSED_EVENTS_DIR = DATA_DIR / "parsed" / "events"
SITE_DATA_PATH = DATA_DIR / "generated" / "site-data.json"

ROOT_KNOCKOUTS_PATH = ROOT / "knockouts.json"
GENERATED_KNOCKOUTS_PATH = DATA_DIR / "generated" / "knockouts-generated.json"
GENERATED_KNOCKOUTS_ALIAS_PATH = DATA_DIR / "generated" / "knockouts.json"

KNOCKOUT_EVENTS_FULL_PATH = ROOT / "knockout-events-full.json"
KNOCKOUT_NAME_MAP_FULL_PATH = ROOT / "knockout-name-map-full.json"


def load_json(path: Path, default=None):
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def bump_nested_counter(container, outer_key, inner_key, amount=1):
    if not outer_key or not inner_key:
        return

    container.setdefault(outer_key, {})
    container[outer_key][inner_key] = container[outer_key].get(inner_key, 0) + amount


def get_site_slugs():
    site_data = load_json(SITE_DATA_PATH, default={})
    players = site_data.get("players", [])
    return {
        str(player.get("slug"))
        for player in players
        if player.get("slug")
    }


def load_existing_name_map():
    existing = load_json(KNOCKOUT_NAME_MAP_FULL_PATH, default={})
    if not isinstance(existing, dict):
        return {}
    return existing


def normalize_name_map_key(value):
    return str(value or "").strip()


def extract_knockout_archive_from_parsed_events():
    archive = {}
    name_map = load_existing_name_map()

    parsed_files = sorted(PARSED_EVENTS_DIR.glob("*.json"))

    for parsed_file in parsed_files:
        if parsed_file.name == "index.json":
            continue

        event = load_json(parsed_file, default={})

        if not isinstance(event, dict):
            print(f"⚠️ Skipping non-event JSON: {parsed_file}")
            continue

        event_id = event.get("eventId") or event.get("date") or parsed_file.stem
        actions = event.get("actions", [])

        if not isinstance(actions, list):
            print(f"⚠️ Skipping event with invalid actions: {parsed_file}")
            continue

        entries = []

        for action in actions:
            if not isinstance(action, dict):
                continue

            if action.get("type") != "bustout":
                continue

            victim_slug = action.get("slug")
            killer_slug = action.get("bySlug")

            if not victim_slug or not killer_slug:
                continue

            source_victim = (
                action.get("sourceVictim")
                or action.get("player")
                or victim_slug
            )

            source_killer = (
                action.get("sourceKiller")
                or action.get("by")
                or killer_slug
            )

            entries.append({
                "victim": victim_slug,
                "killer": killer_slug,
                "sourceVictim": source_victim,
                "sourceKiller": source_killer
            })

            # Keep the legacy audit map alive.
            # This is primarily useful for forensic review and raw-name tracking.
            if source_victim:
                name_map[normalize_name_map_key(source_victim)] = victim_slug
            if source_killer:
                name_map[normalize_name_map_key(source_killer)] = killer_slug

        archive[event_id] = entries

    archive = {
        event_id: archive[event_id]
        for event_id in sorted(archive.keys())
    }

    name_map = {
        key: name_map[key]
        for key in sorted(name_map.keys(), key=lambda x: x.lower())
    }

    return archive, name_map


def rebuild_runtime_from_archive(archive):
    by_victim = {}
    by_killer = {}

    for event_id in sorted(archive.keys()):
        entries = archive[event_id]

        if not isinstance(entries, list):
            raise RuntimeError(f"Invalid knockout archive entry for {event_id}: expected list")

        for entry in entries:
            victim_slug = entry.get("victim")
            killer_slug = entry.get("killer")

            if not victim_slug or not killer_slug:
                continue

            bump_nested_counter(by_victim, victim_slug, killer_slug, 1)
            bump_nested_counter(by_killer, killer_slug, victim_slug, 1)

    return {
        "byVictim": {
            slug: dict(sorted(victims.items()))
            for slug, victims in sorted(by_victim.items())
        },
        "byKiller": {
            slug: dict(sorted(kills.items()))
            for slug, kills in sorted(by_killer.items())
        },
        "eventsProcessed": sorted(archive.keys())
    }


def validate_runtime(runtime, archive):
    errors = []

    archive_dates = sorted(archive.keys())
    runtime_dates = sorted(runtime.get("eventsProcessed", []))

    if archive_dates != runtime_dates:
        errors.append("eventsProcessed does not match knockout-events-full.json dates")

    site_slugs = get_site_slugs()

    if site_slugs:
        used_slugs = set()

        for entries in archive.values():
            for entry in entries:
                if entry.get("victim"):
                    used_slugs.add(entry["victim"])
                if entry.get("killer"):
                    used_slugs.add(entry["killer"])

        missing = sorted(used_slugs - site_slugs)

        if missing:
            errors.append(
                "Knockout slugs missing from site-data.json: "
                + ", ".join(missing)
            )

    # Internal consistency check:
    # every byVictim count must mirror byKiller.
    by_victim = runtime.get("byVictim", {})
    by_killer = runtime.get("byKiller", {})

    for victim_slug, killers in by_victim.items():
        for killer_slug, count in killers.items():
            mirrored = by_killer.get(killer_slug, {}).get(victim_slug)
            if mirrored != count:
                errors.append(
                    f"Mismatch: byVictim[{victim_slug}][{killer_slug}]={count} "
                    f"but byKiller[{killer_slug}][{victim_slug}]={mirrored}"
                )

    if errors:
        for error in errors:
            print(f"❌ {error}")
        raise RuntimeError("Knockout validation failed")

    print("✅ Knockout validation passed")


def main():
    if not PARSED_EVENTS_DIR.exists():
        raise RuntimeError(f"Missing parsed events directory: {PARSED_EVENTS_DIR}")

    archive, name_map = extract_knockout_archive_from_parsed_events()
    runtime = rebuild_runtime_from_archive(archive)

    validate_runtime(runtime, archive)

    write_json(KNOCKOUT_EVENTS_FULL_PATH, archive)
    write_json(KNOCKOUT_NAME_MAP_FULL_PATH, name_map)

    write_json(ROOT_KNOCKOUTS_PATH, runtime)
    write_json(GENERATED_KNOCKOUTS_PATH, runtime)
    write_json(GENERATED_KNOCKOUTS_ALIAS_PATH, runtime)

    print(f"✅ Wrote {KNOCKOUT_EVENTS_FULL_PATH}")
    print(f"✅ Wrote {KNOCKOUT_NAME_MAP_FULL_PATH}")
    print(f"✅ Wrote {ROOT_KNOCKOUTS_PATH}")
    print(f"✅ Wrote {GENERATED_KNOCKOUTS_PATH}")
    print(f"✅ Wrote {GENERATED_KNOCKOUTS_ALIAS_PATH}")
    print(f"✅ Events processed: {len(runtime['eventsProcessed'])}")


if __name__ == "__main__":
    main()
