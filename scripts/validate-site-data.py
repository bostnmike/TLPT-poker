#!/usr/bin/env python3

import csv
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
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
    reverse = direction == "desc"
    return sorted(
        players,
        key=lambda p: (float(p.get(key, 0)), p.get("name", "")),
        reverse=reverse
    )


def build_alias_map(metadata_players):
    alias_map = {}
    for player in metadata_players:
        for alias in player.get("aliases", []):
            alias_map[normalize(alias)] = player["slug"]
        alias_map[normalize(player["name"])] = player["slug"]
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


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/validate-site-data.py data/raw/<csvfile>")
        sys.exit(1)

    csv_path = Path(sys.argv[1]).resolve()

    metadata = load_json(METADATA_PATH)
    config = load_json(CONFIG_PATH)
    site_data = load_json(SITE_DATA_PATH)

    metadata_players = metadata["players"]
    players = site_data["players"]
    alias_map = build_alias_map(metadata_players)
    raw_field_map = config["raw_field_map"]

    player_by_slug = {}
    duplicate_slugs = []
    duplicate_names = []

    seen_slugs = set()
    seen_names = set()

    for player in players:
        slug = player["slug"]
        name = player["name"]

        if slug in seen_slugs:
            duplicate_slugs.append(slug)
        seen_slugs.add(slug)

        if normalize(name) in seen_names:
            duplicate_names.append(name)
        seen_names.add(normalize(name))

        player_by_slug[slug] = player

    csv_rows = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            csv_rows.append(row)

    unmapped_csv_rows = []
    csv_by_slug = {}

    for row in csv_rows:
        raw_name = row.get(raw_field_map["name"], "")
        slug = alias_map.get(normalize(raw_name))
        if not slug:
            unmapped_csv_rows.append(raw_name)
            continue

        csv_by_slug[slug] = {
            "buyIns": safe_num(row.get(raw_field_map["buyIns"])),
            "rebuys": safe_num(row.get(raw_field_map["rebuys"])),
            "entries": safe_num(row.get(raw_field_map["entries"])),
            "hits": safe_num(row.get(raw_field_map["hits"])),
            "timesPlaced": safe_num(row.get(raw_field_map["timesPlaced"])),
            "bubbles": safe_num(row.get(raw_field_map["bubbles"])),
            "totalCost": safe_num(row.get(raw_field_map["totalCost"])),
            "totalWinnings": safe_num(row.get(raw_field_map["totalWinnings"])),
            "profit": safe_num(row.get(raw_field_map["profit"]))
        }

    missing_from_generated = []
    for meta_player in metadata_players:
        if meta_player["slug"] not in player_by_slug:
            missing_from_generated.append(meta_player["slug"])

    raw_mismatches = []
    for slug, csv_stats in csv_by_slug.items():
        generated = player_by_slug.get(slug)
        if not generated:
            continue
        for key, expected in csv_stats.items():
            actual = generated.get(key, 0)
            if not almost_equal(actual, expected):
                raw_mismatches.append({
                    "slug": slug,
                    "field": key,
                    "csv": expected,
                    "generated": actual
                })

    formula_mismatches = []
    for player in players:
        slug = player["slug"]

        total_cost = float(player.get("totalCost", 0))
        buyins = float(player.get("buyIns", 0))
        entries = float(player.get("entries", 0))
        profit = float(player.get("profit", 0))
        times_placed = float(player.get("timesPlaced", 0))
        bubbles = float(player.get("bubbles", 0))
        hits = float(player.get("hits", 0))

        expected_roi = (profit / total_cost) if total_cost else 0.0
        expected_cash_rate = (times_placed / buyins) if buyins else 0.0
        expected_bubble_rate = (bubbles / buyins) if buyins else 0.0
        expected_hit_rate = (hits / entries) if entries else 0.0

        checks = {
            "roi": expected_roi,
            "cashRate": expected_cash_rate,
            "bubbleRate": expected_bubble_rate,
            "hitRate": expected_hit_rate
        }

        for field, expected in checks.items():
            actual = float(player.get(field, 0))
            if not almost_equal(actual, expected):
                formula_mismatches.append({
                    "slug": slug,
                    "field": field,
                    "expected": expected,
                    "generated": actual
                })

    honors_mismatches = []
    qualified_min = config["qualification_thresholds"]["leaders_min_entries"]
    qualified = [p for p in players if float(p.get("entries", 0)) >= qualified_min]

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
    for rule in config["records"]:
        sorted_pool = sort_players(players, rule["key"], rule["direction"])
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

    report = {
        "status": "PASS",
        "summary": {
            "csv_rows": len(csv_rows),
            "metadata_players": len(metadata_players),
            "generated_players": len(players),
            "unmapped_csv_rows": len(unmapped_csv_rows),
            "missing_from_generated": len(missing_from_generated),
            "duplicate_slugs": len(duplicate_slugs),
            "duplicate_names": len(duplicate_names),
            "raw_mismatches": len(raw_mismatches),
            "formula_mismatches": len(formula_mismatches),
            "honors_mismatches": len(honors_mismatches),
            "records_mismatches": len(records_mismatches)
        },
        "unmapped_csv_rows": unmapped_csv_rows,
        "missing_from_generated": missing_from_generated,
        "duplicate_slugs": duplicate_slugs,
        "duplicate_names": duplicate_names,
        "raw_mismatches": raw_mismatches,
        "formula_mismatches": formula_mismatches,
        "honors_mismatches": honors_mismatches,
        "records_mismatches": records_mismatches
    }

    has_errors = any([
        unmapped_csv_rows,
        missing_from_generated,
        duplicate_slugs,
        duplicate_names,
        raw_mismatches,
        formula_mismatches,
        honors_mismatches,
        records_mismatches
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
