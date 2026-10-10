#!/usr/bin/env python3

"""Keep split payouts accurate through parsing and independent event audits."""

import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


parser = load_script("parse-event-reports")
integrity = load_script("audit-site-integrity")


class RecordingAudit:
    def __init__(self):
        self.failures = []

    def check(self, condition, section, message):
        if not condition:
            self.failures.append(message)


class EventCurrencyTests(unittest.TestCase):
    def setUp(self):
        self.metadata = parser.load_json(parser.METADATA_PATH)["players"]
        self.config = parser.load_json(parser.CONFIG_PATH)
        self.event = parser.parse_report_file(
            parser.RAW_EVENTS_DIR / "Event Report 2026-10-09.html",
            parser.build_alias_map(self.metadata), self.metadata,
            self.config["buy_in_amount"],
        )

    def audit_event(self, event):
        audit = RecordingAudit()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "2026-10-09.json"
            path.write_text(json.dumps(event))
            integrity.audit_events(audit, [path], self.metadata, self.config)
        return audit.failures

    def test_currency_keeps_cents_and_whole_dollar_compatibility(self):
        for source, expected in [("$132.50", 132.5), ("$1,234.99", 1234.99),
                                 ("$0.01", 0.01), ("$65.00", 65)]:
            with self.subTest(source=source):
                self.assertEqual(parser.parse_currency(source), expected)
        self.assertIsInstance(parser.parse_currency("$65.00"), int)
        for invalid in [None, "", "bad", "NaN", "Infinity"]:
            self.assertEqual(parser.parse_currency(invalid), 0)

    def test_report_payouts_and_profits_balance_without_rounding(self):
        winners = {row["slug"]: row["payout"] for row in self.event["winners"]}
        self.assertEqual(winners, {"ahmed": 132.5, "hiro": 132.5, "alex-c": 65})
        self.assertEqual(sum(winners.values()), 330)
        rows = {row["slug"]: row for row in self.event["players"]}
        self.assertEqual(rows["ahmed"]["profit"], 102.5)
        self.assertEqual(rows["hiro"]["profit"], 102.5)
        self.assertEqual(sum(row["profit"] for row in rows.values()), 0)
        self.assertEqual(self.audit_event(self.event), [])

    def test_audit_rejects_a_one_cent_profit_error(self):
        event = copy.deepcopy(self.event)
        next(row for row in event["players"] if row["slug"] == "hiro")["profit"] += 0.01
        failures = self.audit_event(event)
        self.assertTrue(any("event is not zero-sum" in error for error in failures))
        self.assertTrue(any("hiro: profit mismatch" in error for error in failures))


if __name__ == "__main__":
    unittest.main()
