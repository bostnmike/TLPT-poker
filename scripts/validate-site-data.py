#!/usr/bin/env python3

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
GENERATED_PATH = DATA_DIR / "generated" / "site-data.json"
OUTPUT_PATH = DATA_DIR / "generated" / "validation-report.json"
PARSED_EVENTS_DIR = DATA_DIR / "parsed" / "events"


def load_json(path):
    if not path.exists():
        raise FileNotFoundError(f"Missing required file: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def safe_div(a, b):
    return a / b if b else 0


def approx_equal(a, b, tol=0.01):
    return abs(a - b) <= tol


def validate_player(p):
    errors = []

    # -----------------------------
    # Core math checks (STRICT)
    # -----------------------------
    expected_cost = p.get("entries", 0) * 30
    if p.get("totalCost", 0) != expected_cost:
        errors.append(f"totalCost mismatch: {p.get('totalCost')} != {expected_cost}")

    expected_profit = p.get("totalWinnings", 0) - p.get("totalCost", 0)
    if p.get("profit", 0) != expected_profit:
        errors.append(f"profit mismatch: {p.get('profit')} != {expected_profit}")

    expected_roi = safe_div(p.get("profit", 0), p.get("totalCost", 0))
    if not approx_equal(p.get("roi", 0), expected_roi):
        errors.append("roi mismatch")

    expected_cash = safe_div(p.get("timesPlaced", 0), p.get("buyIns", 0))
    if not approx_equal(p.get("cashRate", 0), expected_cash):
        errors.append("cashRate mismatch")

    expected_bubble = safe_div(p.get("bubbles", 0), p.get("buyIns", 0))
    if not approx_equal(p.get("bubbleRate", 0), expected_bubble):
        errors.append("bubbleRate mismatch")

    expected_hit = safe_div(p.get("hits", 0), p.get("entries", 0))
    if not approx_equal(p.get("hitRate", 0), expected_hit):
        errors.append("hitRate mismatch")

    # -----------------------------
    # Advanced metrics (SANITY ONLY)
    # -----------------------------
    metric_ranges = {
        "clutchIndex": (-50, 200),
        "aggressionIndex": (-50, 200),
        "survivorIndex": (-50, 200),
        "tiltIndex": (-50, 200),

        # trueSkillScore is a composite score, not a 0-100 style index.
        # Current formulas can push elite players well above 200 and
        # very weak / tiny-sample profiles below -50, so allow more room.
        "trueSkillScore": (-100, 500),
    }

    for key, (min_allowed, max_allowed) in metric_ranges.items():
        val = p.get(key)

        if val is None:
            errors.append(f"{key} missing")
        elif not isinstance(val, (int, float)):
            errors.append(f"{key} not numeric")
        elif val < min_allowed or val > max_allowed:
            errors.append(
                f"{key} out of expected range: {val} not between {min_allowed} and {max_allowed}"
            )

    # -----------------------------
    # Permanent card ledger + Crew feature selection (STRICT)
    # -----------------------------
    collection = p.get("cardCollection")
    if not isinstance(collection, list):
        errors.append("cardCollection missing or not a list")
        collection = []

    card_ids = []
    for card in collection:
        card_id = card.get("id") if isinstance(card, dict) else None
        if not card_id:
            errors.append("cardCollection contains a card without an id")
            continue
        card_ids.append(card_id)

        snapshot = card.get("snapshot")
        if not isinstance(snapshot, dict):
            errors.append(f"{card_id} snapshot missing")
            continue

        if not isinstance(snapshot.get("overall"), (int, float)):
            errors.append(f"{card_id} snapshot overall missing or not numeric")

        attributes = snapshot.get("attributes")
        if not isinstance(attributes, list) or len(attributes) != 6:
            errors.append(f"{card_id} snapshot must contain six attributes")

    if len(card_ids) != len(set(card_ids)):
        errors.append("cardCollection contains duplicate card ids")

    featured = p.get("featuredCardEdition")
    valid_featured = {"base", *card_ids}
    if featured not in valid_featured:
        errors.append(
            f"featuredCardEdition '{featured}' is not base or an earned card id"
        )

    featured_mode = p.get("featuredCardMode")
    if featured_mode not in {"automatic", "commissioner"}:
        errors.append("featuredCardMode must be automatic or commissioner")
    elif featured_mode == "automatic":
        expected_featured = card_ids[0] if card_ids else "base"
        if featured != expected_featured:
            errors.append(
                f"automatic featuredCardEdition mismatch: {featured} != {expected_featured}"
            )
            
    return errors


def validate_featured_card_summary(data, players):
    errors = []
    summary = data.get("featuredCardConfig")
    if not isinstance(summary, dict):
        return ["featuredCardConfig summary missing"]

    if summary.get("source") != "data/featured-cards.json":
        errors.append("featuredCardConfig source mismatch")

    override_count = sum(
        1 for player in players
        if player.get("featuredCardMode") == "commissioner"
    )
    if summary.get("overrideCount") != override_count:
        errors.append(
            f"featuredCardConfig overrideCount mismatch: "
            f"{summary.get('overrideCount')} != {override_count}"
        )

    return errors


def validate_source_coverage(data):
    """Reject a mathematically valid but stale generated site snapshot."""
    errors = []
    parsed_files = sorted(
        path for path in PARSED_EVENTS_DIR.glob("*.json")
        if path.name != "index.json"
    )
    parsed_names = [path.name for path in parsed_files]
    parsed_dates = [path.stem for path in parsed_files]
    ledger = data.get("cardLedger") or {}

    if ledger.get("eventCount") != len(parsed_files):
        errors.append(
            f"cardLedger eventCount is stale: "
            f"{ledger.get('eventCount')} != {len(parsed_files)} parsed events"
        )

    latest_date = parsed_dates[-1] if parsed_dates else ""
    if ledger.get("replayedThrough") != latest_date:
        errors.append(
            f"cardLedger replay date is stale: "
            f"{ledger.get('replayedThrough')} != {latest_date}"
        )

    index_path = PARSED_EVENTS_DIR / "index.json"
    try:
        parsed_index = load_json(index_path)
    except (FileNotFoundError, json.JSONDecodeError) as error:
        errors.append(f"parsed event index could not be read: {error}")
    else:
        if parsed_index != parsed_names:
            errors.append("parsed event index does not exactly match parsed event files")

    return errors


def main():
    data = load_json(GENERATED_PATH)

    players = data.get("players", [])
    if not players:
        raise RuntimeError("No players found in site-data.json")

    report = {
        "status": "PASS",
        "totalPlayers": len(players),
        "errorCount": 0,
        "errors": {}
    }

    for p in players:
        slug = p.get("slug", "unknown")
        errors = validate_player(p)

        if errors:
            report["errors"][slug] = errors
            report["errorCount"] += len(errors)

    featured_errors = validate_featured_card_summary(data, players)
    if featured_errors:
        report["errors"]["_featuredCardConfig"] = featured_errors
        report["errorCount"] += len(featured_errors)

    source_errors = validate_source_coverage(data)
    if source_errors:
        report["errors"]["_sourceCoverage"] = source_errors
        report["errorCount"] += len(source_errors)

    if report["errorCount"] > 0:
        report["status"] = "FAIL"

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"✔ Wrote {OUTPUT_PATH}")
    print(f"✔ Players checked: {report['totalPlayers']}")
    print(f"✔ Errors found: {report['errorCount']}")
    print(f"✔ Status: {report['status']}")

    if report["status"] == "FAIL":
        exit(2)


if __name__ == "__main__":
    main()
