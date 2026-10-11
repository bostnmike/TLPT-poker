#!/usr/bin/env python3

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

DATA_DIR = ROOT / "data"
PARSED_EVENTS_DIR = DATA_DIR / "parsed" / "events"
SITE_DATA_PATH = DATA_DIR / "generated" / "site-data.json"
EVENT_FINANCIALS_PATH = DATA_DIR / "event-financials.json"

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


def bounty_claims_for_event(event_id, event, event_financials):
    bounty_summary = (event.get("summary") or {}).get("bounty") or {}
    if not bounty_summary:
        return []

    amount = bounty_summary.get("amount", 0)
    if not amount:
        raise RuntimeError(f"{event_id}: bounty summary is missing its per-claim amount")

    expected_by_killer = {
        row.get("slug"): int(row.get("bountiesWon", 0) or 0)
        for row in event.get("players", [])
        if int(row.get("bountiesWon", 0) or 0) > 0
    }
    financial_rule = (event_financials.get("events") or {}).get(event_id, {})
    override_claims = financial_rule.get("bountyClaims")

    if override_claims is not None:
        if not isinstance(override_claims, list):
            raise RuntimeError(f"{event_id}: bountyClaims must be a list")
        claims = [
            {
                "killer": str(claim.get("killer") or ""),
                "victim": str(claim.get("victim") or ""),
                "amount": amount,
            }
            for claim in override_claims
            if isinstance(claim, dict)
        ]
    else:
        claims = []
        seen_victims = set()
        for action in event.get("actions", []):
            if action.get("type") != "bustout" or not action.get("slug"):
                continue
            victim = str(action["slug"])
            if victim in seen_victims:
                continue
            seen_victims.add(victim)
            killer = str(action.get("bySlug") or "")
            if killer:
                claims.append({"killer": killer, "victim": victim, "amount": amount})

    active_slugs = {
        row.get("slug")
        for row in event.get("players", [])
        if int(row.get("buyIns", 0) or 0) > 0
    }
    if any(
        not claim["killer"]
        or not claim["victim"]
        or claim["killer"] == claim["victim"]
        or claim["killer"] not in active_slugs
        or claim["victim"] not in active_slugs
        for claim in claims
    ):
        raise RuntimeError(f"{event_id}: bounty claims contain an invalid killer/victim pairing")

    victims = [claim["victim"] for claim in claims]
    if len(victims) != len(set(victims)):
        raise RuntimeError(f"{event_id}: a first-entry bounty victim is assigned more than once")

    actual_by_killer = {}
    for claim in claims:
        killer = claim["killer"]
        actual_by_killer[killer] = actual_by_killer.get(killer, 0) + 1

    expected_total = int(bounty_summary.get("bountiesWon", 0) or 0)
    if len(claims) != expected_total or actual_by_killer != expected_by_killer:
        source = "configured" if override_claims is not None else "inferred first-entry"
        raise RuntimeError(
            f"{event_id}: {source} bounty claims {actual_by_killer} do not match "
            f"reported player totals {expected_by_killer}. Add verified bountyClaims "
            "killer/victim pairs to data/event-financials.json."
        )

    return claims


def extract_knockout_archive_from_parsed_events():
    archive = {}
    name_map = load_existing_name_map()
    event_financials = load_json(EVENT_FINANCIALS_PATH, default={})

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
        bounty_claims = bounty_claims_for_event(event_id, event, event_financials)
        remaining_bounty_pairs = {
            (claim["killer"], claim["victim"]): claim["amount"]
            for claim in bounty_claims
        }

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

            entry = {
                "victim": victim_slug,
                "killer": killer_slug,
                "sourceVictim": source_victim,
                "sourceKiller": source_killer
            }
            bounty_pair = (killer_slug, victim_slug)
            if bounty_pair in remaining_bounty_pairs:
                entry["bountyAmount"] = remaining_bounty_pairs.pop(bounty_pair)
            entries.append(entry)

            # Keep the legacy audit map alive.
            # This is primarily useful for forensic review and raw-name tracking.
            if source_victim:
                name_map[normalize_name_map_key(source_victim)] = victim_slug
            if source_killer:
                name_map[normalize_name_map_key(source_killer)] = killer_slug

        if remaining_bounty_pairs:
            missing = ", ".join(
                f"{killer}->{victim}"
                for killer, victim in sorted(remaining_bounty_pairs)
            )
            raise RuntimeError(
                f"{event_id}: verified bounty claim pair is absent from the knockout log: {missing}"
            )

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
    bounty_claims = []
    bounty_events = set()

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

            if entry.get("bountyAmount"):
                bounty_claims.append({
                    "eventId": event_id,
                    "killer": killer_slug,
                    "victim": victim_slug,
                    "amount": entry["bountyAmount"],
                })
                bounty_events.add(event_id)

    return {
        "byVictim": {
            slug: dict(sorted(victims.items()))
            for slug, victims in sorted(by_victim.items())
        },
        "byKiller": {
            slug: dict(sorted(kills.items()))
            for slug, kills in sorted(by_killer.items())
        },
        "eventsProcessed": sorted(archive.keys()),
        "bounties": {
            "claims": bounty_claims,
            "eventsProcessed": sorted(bounty_events),
        },
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

    bounty_runtime = runtime.get("bounties") or {}
    expected_claims = []
    expected_bounty_events = set()
    for event_id, entries in archive.items():
        for entry in entries:
            if not entry.get("bountyAmount"):
                continue
            expected_claims.append({
                "eventId": event_id,
                "killer": entry.get("killer"),
                "victim": entry.get("victim"),
                "amount": entry.get("bountyAmount"),
            })
            expected_bounty_events.add(event_id)

    if bounty_runtime.get("claims") != expected_claims:
        errors.append("bounties.claims does not match the verified knockout archive")
    if bounty_runtime.get("eventsProcessed") != sorted(expected_bounty_events):
        errors.append("bounties.eventsProcessed does not match verified bounty events")

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
