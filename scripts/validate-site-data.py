#!/usr/bin/env python3

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
GENERATED_PATH = DATA_DIR / "generated" / "site-data.json"
OUTPUT_PATH = DATA_DIR / "generated" / "validation-report.json"


def load_json(path):
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
    expected_cost = p["entries"] * 30
    if p["totalCost"] != expected_cost:
        errors.append(f"totalCost mismatch: {p['totalCost']} != {expected_cost}")

    expected_profit = p["totalWinnings"] - p["totalCost"]
    if p["profit"] != expected_profit:
        errors.append(f"profit mismatch: {p['profit']} != {expected_profit}")

    expected_roi = safe_div(p["profit"], p["totalCost"])
    if not approx_equal(p["roi"], expected_roi):
        errors.append(f"roi mismatch")

    expected_cash = safe_div(p["timesPlaced"], p["buyIns"])
    if not approx_equal(p["cashRate"], expected_cash):
        errors.append(f"cashRate mismatch")

    expected_bubble = safe_div(p["bubbles"], p["buyIns"])
    if not approx_equal(p["bubbleRate"], expected_bubble):
        errors.append(f"bubbleRate mismatch")

    expected_hit = safe_div(p["hits"], p["entries"])
    if not approx_equal(p["hitRate"], expected_hit):
        errors.append(f"hitRate mismatch")

    # -----------------------------
    # Advanced metrics (SANITY ONLY)
    # -----------------------------
    # We DO NOT validate exact formulas anymore
    # because they are now normalized / composite

    for key in [
        "clutchIndex",
        "aggressionIndex",
        "survivorIndex",
        "tiltIndex",
        "trueSkillScore"
    ]:
        val = p.get(key)

        if val is None:
            errors.append(f"{key} missing")
        elif not isinstance(val, (int, float)):
            errors.append(f"{key} not numeric")
        elif val < -50 or val > 200:
            errors.append(f"{key} out of expected range")

    return errors


def main():
    data = load_json(GENERATED_PATH)

    players = data.get("players", [])
    if not players:
        raise RuntimeError("No players found in site-data.json")

    report = {
        "status": "PASS",
        "errors": {}
    }

    total_errors = 0

    for p in players:
        errors = validate_player(p)
        if errors:
            report["errors"][p["slug"]] = errors
            total_errors += len(errors)

    if total_errors > 0:
        report["status"] = "FAIL"

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"Wrote {OUTPUT_PATH}")
    print(f"Validation status: {report['status']}")

    if report["status"] == "FAIL":
        exit(2)


if __name__ == "__main__":
    main()
