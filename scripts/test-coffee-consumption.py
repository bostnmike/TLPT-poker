import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("builder", ROOT / "scripts/build-site-data.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class CoffeeConsumptionTests(unittest.TestCase):
    def setUp(self):
        source = builder.load_json(builder.COFFEE_CONSUMPTION_PATH)
        self.opening = {"version": 1, "batches": source["batches"][:3]}
        self.slugs = {player["slug"] for player in builder.load_json(builder.METADATA_PATH)["players"]}

    def test_opening_and_built_totals(self):
        totals = builder.build_coffee_consumption(self.opening, self.slugs)
        self.assertEqual(totals, {
            "hiro": 11, "ahmed": 5, "li-fo": 4, "nasa-al": 2, "providencemike": 1,
            "red": 2, "p": 1, "liam-o": 1, "griffin": 1, "ai-dave": 1, "nitro": 1, "rob-f": 1,
        })
        self.assertEqual(sum(totals.values()), 31)
        self.assertEqual(totals.get("bostnmike", 0), 0)
        built = json.loads(builder.OUTPUT_PATH.read_text())
        source = builder.load_json(builder.COFFEE_CONSUMPTION_PATH)
        correction = next(batch for batch in source["batches"] if batch["id"] == "weekly-tally-2026-11-15")
        updated = builder.build_coffee_consumption(
            {**self.opening, "batches": [*self.opening["batches"], correction]}, self.slugs
        )
        self.assertEqual((updated["hiro"], updated["bostnmike"], sum(updated.values())), (13, 4, 37))
        self.assertEqual(built["coffeeConsumption"], builder.build_coffee_consumption(
            builder.load_json(builder.COFFEE_CONSUMPTION_PATH), self.slugs
        ))

    def test_weekly_addition_and_replay_rejection(self):
        weekly = {
            "id": "weekly-tally-2026-11-22", "date": "2026-11-22", "source": "owner-tally",
            "counts": {"hiro": 2, "bostnmike": 1},
        }
        self.opening["batches"].append(weekly)
        totals = builder.build_coffee_consumption(self.opening, self.slugs)
        self.assertEqual((totals["hiro"], totals["bostnmike"], sum(totals.values())), (13, 1, 34))
        for batch in (weekly, self.opening["batches"][1]):
            replay = {**self.opening, "batches": [*self.opening["batches"], batch]}
            with self.assertRaisesRegex(ValueError, "Duplicate coffee batch"):
                builder.build_coffee_consumption(replay, self.slugs)

    def test_invalid_counts_rejected(self):
        batch = self.opening["batches"][0]
        for counts in ({"tony": 1}, {"li-fo": 1.5}, {"li-fo": True}, {"li-fo": -1}):
            with self.subTest(counts=counts):
                batch["counts"] = counts
                with self.assertRaisesRegex(ValueError, "Invalid coffee count"):
                    builder.build_coffee_consumption(self.opening, self.slugs)


if __name__ == "__main__":
    unittest.main()
