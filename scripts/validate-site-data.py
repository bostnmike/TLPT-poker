#!/usr/bin/env python3

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
PARSED_EVENTS_DIR = DATA_DIR / "parsed" / "events"
GENERATED_DIR = DATA_DIR / "generated"

METADATA_PATH = DATA_DIR / "player-metadata.json"
CONFIG_PATH = DATA_DIR / "league-config.json"
SITE_DATA_PATH = GENERATED_DIR / "site-data.json"
REPORT_PATH = GENERATED_DIR / "validation-report.json"


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def normalize(value):
    return str(value or "").strip().lower()


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


def almost_equal(a, b, tol=1e-9):
    return abs(float(a) - float(b)) <= tol


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


def build_alias_map(metadata_players):
    alias_map = {}
    for player in metadata_players:
        alias_map[normalize(player["name"])] = player["slug"]
        alias_map[normalize(player["slug"])] = player["slug"]
        for alias in player.get("aliases", []):
            alias_map[normalize(alias)] = player["slug"]
    return alias_map


def choose_expected_record_value(player, rule):
    value = player.get(rule["key"], 0)
    fmt = rule.get("format", "int")

    if fmt == "money":
        sign = "-" if value < 0 else ""
        return f"{sign}${abs(int(round(value))):,}"
    if fmt == "pct":
        return f"{float(value) * 100:.1f}%"
    if fmt == "num1":
        return f"{float(value):.1f}"
    return str(int(round(float(value))))


def aggregate_from_parsed_events(metadata_players):
    players = {
        p["slug"]: {
            "name": p["name"],
            "slug": p["slug"],
            "entries": 0,
            "buyIns": 0,
            "rebuys": 0,
            "hits": 0,
            "timesPlaced": 0,
            "bubbles": 0,
            "profit": 0,
            "totalCost": 0,
            "totalWinnings": 0
        }
        for p in metadata_players
    }

    parsed_files = sorted(PARSED_EVENTS_DIR.glob("*.json"))
    if not parsed_files:
        raise RuntimeError(f"No parsed event JSON files found in {PARSED_EVENTS_DIR}")

    parse_warnings = []

    for parsed_file in parsed_files:
        event = load_json(parsed_file)
        for warning in event.get("warnings", []):
            parse_warnings.append(f"{parsed_file.name}: {warning}")

        for event_player in event.get("players", []):
            slug = event_player["slug"]
            if slug not in players:
                raise RuntimeError(f"Unknown player slug '{slug}' in parsed event {parsed_file.name}")

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
                players[slug][key] += event_player.get(key, 0)

    return players, parsed_files, parse_warnings


def add_formula_fields(players):
    total_entries = sum(float(p["entries"]) for p in players.values())
    total_profit = sum(float(p["profit"]) for p in players.values())
    league_avg_profit_per_entry = (total_profit / total_entries) if total_entries else 0.0

    for p in players.values():
        total_cost = float(p["totalCost"])
        buyins = float(p["buyIns"])
        entries = float(p["entries"])
        profit = float(p["profit"])

        p["roi"] = (profit / total_cost) if total_cost else 0.0
        p["cashRate"] = (float(p["timesPlaced"]) / buyins) if buyins else 0.0
        p["bubbleRate"] = (float(p["bubbles"]) / buyins) if buyins else 0.0
        p["hitRate"] = (float(p["hits"]) / entries) if entries else 0.0

        p["expectedProfit"] = entries * league_avg_profit_per_entry
        p["luckIndex"] = profit - p["expectedProfit"]
        p["clutchIndex"] = (p["cashRate"] * 100 * 0.55) + (p["roi"] * 100 * 0.35) - (p["bubbleRate"] * 100 * 0.20)
        p["aggressionIndex"] = p["hitRate"] * 100
        p["survivorIndex"] = max(0.0, (p["cashRate"] * 100 * 0.8) + ((1 - p["bubbleRate"]) * 20))
        p["tiltIndex"] = max(0.0, (float(p["rebuys"]) / max(buyins, 1.0)) * 100 + p["bubbleRate"] * 40 + max(0.0, -p["roi"] * 20))
        p["trueSkillScore"] = (
            (p["roi"] * 100 * 0.30)
            + (p["cashRate"] * 100 * 0.20)
            + (p["hitRate"] * 100 * 0.15)
            + (p["clutchIndex"] * 0.20)
            + (p["aggressionIndex"] * 0.10)
            + (p["survivorIndex"] * 0.10)
            - (p["tiltIndex"] * 0.15)
        )

    return players


def main():
    csv_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else None

    metadata = load_json(METADATA_PATH)
    config = load_json(CONFIG_PATH)
    site_data = load_json(SITE_DATA_PATH)

    metadata_players = metadata["players"]
    alias_map = build_alias_map(metadata_players)
    player_by_slug = {player["slug"]: player for player in site_data["players"]}

    parsed_aggregate, parsed_files, parse_warnings = aggregate_from_parsed_events(metadata_players)
    parsed_aggregate = add_formula_fields(parsed_aggregate)

    duplicate_slugs = []
    duplicate_names = []

    seen_slugs = set()
    seen_names = set()

    for player in site_data["players"]:
        slug = player["slug"]
        name = player["name"]

        if slug in seen_slugs:
            duplicate_slugs.append(slug)
        seen_slugs.add(slug)

        norm_name = normalize(name)
        if norm_name in seen_names:
            duplicate_names.append(name)
        seen_names.add(norm_name)

    missing_from_generated = [
        meta_player["slug"]
        for meta_player in metadata_players
        if meta_player["slug"] not in player_by_slug
    ]

    raw_mismatches = []
    for slug, expected_player in parsed_aggregate.items():
        generated = player_by_slug.get(slug)
        if not generated:
            continue

        for key in [
            "buyIns",
            "rebuys",
            "entries",
            "hits",
            "timesPlaced",
            "bubbles",
            "totalCost",
            "totalWinnings",
            "profit"
        ]:
            expected = expected_player.get(key, 0)
            actual = generated.get(key, 0)
            if not almost_equal(actual, expected):
                raw_mismatches.append({
                    "slug": slug,
                    "field": key,
                    "parsed_events": expected,
                    "generated": actual
                })

    formula_mismatches = []
    for slug, expected_player in parsed_aggregate.items():
        generated = player_by_slug.get(slug)
        if not generated:
            continue

        for field in [
            "roi",
            "cashRate",
            "bubbleRate",
            "hitRate",
            "expectedProfit",
            "luckIndex",
            "clutchIndex",
            "aggressionIndex",
            "survivorIndex",
            "tiltIndex",
            "trueSkillScore"
        ]:
            expected = expected_player.get(field, 0)
            actual = generated.get(field, 0)
            if not almost_equal(actual, expected):
                formula_mismatches.append({
                    "slug": slug,
                    "field": field,
                    "expected": expected,
                    "generated": actual
                })

    honors_mismatches = []
    qualified_min = config["qualification_thresholds"]["leaders_min_entries"]
    qualified = [p for p in parsed_aggregate.values() if float(p.get("entries", 0)) >= qualified_min]

    for rule in config["honors"]:
        sorted_pool = sort_players(qualified, rule["key"], rule["direction"])
        expected_leader = sorted_pool[0]["name"] if sorted_pool else None
        actual_honor = next((h for h in site_data["honors"] if h["type"] == rule["type"]), None)
        actual_leader = actual_honor["name"] if actual_honor else None
        if expected_leader != actual_leader:
            honors_mismatches.append({
                "type": rule["type"],
                "expected": expected_leader,
                "generated": actual_leader
            })

    records_mismatches = []
    aggregate_player_list = list(parsed_aggregate.values())
    for rule in config["records"]:
        sorted_pool = sort_players(aggregate_player_list, rule["key"], rule["direction"])
        expected_player = sorted_pool[0] if sorted_pool else None
        expected_name = expected_player["name"] if expected_player else None
        expected_value = choose_expected_record_value(expected_player, rule) if expected_player else None

        actual_record = next((r for r in site_data["records"] if r["label"] == rule["label"]), None)
        actual_name = actual_record["name"] if actual_record else None
        actual_value = actual_record["value"] if actual_record else None

        if expected_name != actual_name or expected_value != actual_value:
            records_mismatches.append({
                "label": rule["label"],
                "expected_name": expected_name,
                "generated_name": actual_name,
                "expected_value": expected_value,
                "generated_value": actual_value
            })

    csv_mismatches = []
    unmapped_csv_rows = []

    if csv_path:
        if not csv_path.exists():
            raise RuntimeError(f"CSV file not found: {csv_path}")

        raw_field_map = config["raw_field_map"]
        with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                raw_name = row.get(raw_field_map["name"], "")
                slug = alias_map.get(normalize(raw_name))
                if not slug:
                    unmapped_csv_rows.append(raw_name)
                    continue

                generated = player_by_slug.get(slug)
                if not generated:
                    continue

                for key in [
                    "buyIns",
                    "rebuys",
                    "entries",
                    "hits",
                    "timesPlaced",
                    "bubbles",
                    "totalCost",
                    "totalWinnings",
                    "profit"
                ]:
                    csv_value = safe_num(row.get(raw_field_map[key]))
                    actual = generated.get(key, 0)
                    if not almost_equal(actual, csv_value):
                        csv_mismatches.append({
                            "slug": slug,
                            "field": key,
                            "csv": csv_value,
                            "generated": actual
                        })

    report = {
        "status": "PASS",
        "summary": {
            "parsed_event_files": len(parsed_files),
            "metadata_players": len(metadata_players),
            "generated_players": len(site_data["players"]),
            "missing_from_generated": len(missing_from_generated),
            "duplicate_slugs": len(duplicate_slugs),
            "duplicate_names": len(duplicate_names),
            "raw_mismatches": len(raw_mismatches),
            "formula_mismatches": len(formula_mismatches),
            "honors_mismatches": len(honors_mismatches),
            "records_mismatches": len(records_mismatches),
            "parse_warnings": len(parse_warnings),
            "csv_checked": bool(csv_path),
            "unmapped_csv_rows": len(unmapped_csv_rows),
            "csv_mismatches": len(csv_mismatches)
        },
        "parse_warnings": parse_warnings,
        "missing_from_generated": missing_from_generated,
        "duplicate_slugs": duplicate_slugs,
        "duplicate_names": duplicate_names,
        "raw_mismatches": raw_mismatches,
        "formula_mismatches": formula_mismatches,
        "honors_mismatches": honors_mismatches,
        "records_mismatches": records_mismatches,
        "unmapped_csv_rows": unmapped_csv_rows,
        "csv_mismatches": csv_mismatches
    }

    has_errors = any([
        missing_from_generated,
        duplicate_slugs,
        duplicate_names,
        raw_mismatches,
        formula_mismatches,
        honors_mismatches,
        records_mismatches,
        csv_mismatches
    ])

    if has_errors:
        report["status"] = "FAIL"

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    with REPORT_PATH.open("w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"Wrote {REPORT_PATH}")
    print(f"Validation status: {report['status']}")

    if has_errors:
        sys.exit(2)


if __name__ == "__main__":
    main()
