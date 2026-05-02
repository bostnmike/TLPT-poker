#!/usr/bin/env python3

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
GENERATED_PATH = DATA_DIR / "generated" / "site-data.json"
OUTPUT_PATH = DATA_DIR / "generated" / "validation-report.json"


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
        # Current tier/power-index formulas can legitimately push top players
        # well above 200, so this gets a wider sanity range.
        "trueSkillScore": (-50, 500),
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
