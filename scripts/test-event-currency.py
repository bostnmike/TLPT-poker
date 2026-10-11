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
        self.event_financials = parser.load_json(parser.EVENT_FINANCIALS_PATH)
        self.event = parser.parse_report_file(
            parser.RAW_EVENTS_DIR / "Event Report 2026-10-09.html",
            parser.build_alias_map(self.metadata), self.metadata,
            self.config["buy_in_amount"],
            self.event_financials,
        )

    def audit_event(self, event):
        audit = RecordingAudit()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "2026-10-09.json"
            path.write_text(json.dumps(event))
            integrity.audit_events(
                audit,
                [path],
                self.metadata,
                self.config,
                self.event_financials,
            )
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
        self.assertEqual(winners, {"ahmed": 135, "hiro": 130, "alex-c": 65})
        self.assertEqual(sum(winners.values()), 330)
        rows = {row["slug"]: row for row in self.event["players"]}
        self.assertEqual(rows["ahmed"]["profit"], 105)
        self.assertEqual(rows["hiro"]["profit"], 100)
        self.assertEqual(sum(row["profit"] for row in rows.values()), 0)
        self.assertEqual(self.audit_event(self.event), [])

    def test_fractional_chop_survives_full_report_parsing(self):
        # Keep cents coverage independent of the corrected whole-dollar deal.
        report = parser.RAW_EVENTS_DIR / "Event Report 2026-10-09.html"
        html = report.read_text().replace(
            "Ahmed ranked 1st, received $135.00",
            "Ahmed ranked 1st, received $132.50",
        ).replace(
            "Hiro ranked 1st, received $130.00",
            "Hiro ranked 1st, received $132.50",
        )
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / report.name
            fixture.write_text(html)
            event = parser.parse_report_file(
                fixture, parser.build_alias_map(self.metadata), self.metadata,
                self.config["buy_in_amount"],
                self.event_financials,
            )
        winners = {row["slug"]: row["payout"] for row in event["winners"]}
        self.assertEqual(winners, {"ahmed": 132.5, "hiro": 132.5, "alex-c": 65})
        rows = {row["slug"]: row for row in event["players"]}
        self.assertEqual(rows["ahmed"]["profit"], 102.5)
        self.assertEqual(rows["hiro"]["profit"], 102.5)
        self.assertEqual(sum(row["profit"] for row in rows.values()), 0)
        self.assertEqual(self.audit_event(event), [])

    def test_audit_rejects_a_one_cent_profit_error(self):
        event = copy.deepcopy(self.event)
        next(row for row in event["players"] if row["slug"] == "hiro")["profit"] += 0.01
        failures = self.audit_event(event)
        self.assertTrue(any("event is not zero-sum" in error for error in failures))
        self.assertTrue(any("hiro: profit mismatch" in error for error in failures))

    def test_combined_mtt_receipts_split_bounties_from_tournament_profit(self):
        bounty_config = {
            "version": 1,
            "events": {
                "2026-10-11": {
                    "entryAmount": 40,
                    "tournamentPayouts": {
                        "1": 330,
                        "2": 200,
                        "3": 135,
                        "4": 100,
                        "5": 75,
                        "6": 40,
                    },
                    "bounty": {
                        "amount": 10,
                        "firstEntryOnly": True,
                        "retainIfUnbusted": True,
                    },
                }
            },
        }
        event = parser.parse_report_file(
            parser.RAW_EVENTS_DIR / "SAMPLE Event Report.html",
            parser.build_alias_map(self.metadata),
            self.metadata,
            self.config["buy_in_amount"],
            bounty_config,
        )
        rows = {row["slug"]: row for row in event["players"]}

        self.assertEqual(event["summary"]["bounty"]["pool"], 130)
        self.assertEqual(event["summary"]["bounty"]["bountiesWon"], 10)
        self.assertEqual(event["summary"]["bounty"]["bountiesRetained"], 3)
        self.assertEqual(rows["the-architect"]["bountiesWon"], 3)
        self.assertEqual(rows["the-architect"]["bountyCollected"], 30)
        self.assertEqual(rows["the-architect"]["bountyRetained"], 10)
        self.assertEqual(rows["ahmed"]["bountyRetained"], 10)
        self.assertEqual(rows["red"]["bountyRetained"], 10)
        self.assertEqual(rows["bostnmike"]["bountiesWon"], 3)
        self.assertEqual(rows["griffin"]["bountiesWon"], 2)
        self.assertEqual(sum(row["bountiesWon"] for row in rows.values()), 10)
        self.assertEqual(sum(row["bountyWinnings"] for row in rows.values()), 130)
        self.assertEqual(sum(row["bountyNet"] for row in rows.values()), 0)
        self.assertEqual(sum(row["profit"] for row in rows.values()), 0)
        self.assertEqual(
            {winner["slug"]: winner["payout"] for winner in event["winners"]},
            {
                "the-architect": 330,
                "red": 200,
                "ahmed": 135,
                "nasa-al": 100,
                "bostnmike": 75,
                "hiro": 40,
            },
        )

        audit = RecordingAudit()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "2026-10-11.json"
            path.write_text(json.dumps(event))
            integrity.audit_events(
                audit,
                [path],
                self.metadata,
                self.config,
                bounty_config,
            )
        self.assertEqual(audit.failures, [])

    def test_raw_report_entry_amount_must_match_event_financial_rule(self):
        mismatched = {
            "version": 1,
            "events": {"2026-10-09": {"entryAmount": 40}},
        }
        with self.assertRaisesRegex(RuntimeError, "financial configuration expects"):
            parser.parse_report_file(
                parser.RAW_EVENTS_DIR / "Event Report 2026-10-09.html",
                parser.build_alias_map(self.metadata),
                self.metadata,
                self.config["buy_in_amount"],
                mismatched,
            )

    def test_sample_reports_are_not_added_to_live_history(self):
        names = [path.name for path in parser.production_raw_files()]
        self.assertNotIn("SAMPLE Event Report.html", names)


if __name__ == "__main__":
    unittest.main()
