#!/usr/bin/env python3
"""Offline, synthetic SQL export/restore rehearsal. Never contacts production."""
import argparse
import json
from pathlib import Path
import sqlite3
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def snapshot(db):
    names = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    return {name: sorted(db.execute(f'SELECT * FROM "{name}"').fetchall(), key=repr) for name in names}


def schema(db):
    return db.execute("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type,name").fetchall()


def rehearse(product):
    migrations = ROOT / ("cashier/drizzle" if product == "cashier" else "rsvp/migrations")
    with tempfile.TemporaryDirectory(prefix="tlpt-recovery-") as folder:
        original = sqlite3.connect(Path(folder) / "synthetic.sqlite")
        for migration in sorted(migrations.glob("*.sql")):
            original.executescript(migration.read_text())
        if product == "cashier":
            for key, status, cents in [("manual", "confirmed", 5000), ("receipt", "linked", 5000)]:
                original.execute("""INSERT INTO payments
                    (id,source_id,payer,player,cents,kind,status,method,received_at,created_at,updated_at,
                     event_id,prize_cents,bounty_cents,food_cents,linked_to)
                    VALUES(?,?,?,?,?,'entry',?,'cash','2026-10-24','2026-10-24','2026-10-24',
                           'mtt:2026-10-24',4000,1000,0,?)""",
                    (key, "synthetic-"+key, "Test Player", "test-player", cents, status,
                     "manual" if key == "receipt" else None))
            original.execute("INSERT INTO receipt_links VALUES('receipt','manual',5000)")
            original.execute("INSERT INTO cashier_batches VALUES('batch','mtt:2026-10-24','fake-hash','{}','2026-10-24')")
            original.execute("INSERT INTO cashier_batch_checks VALUES('check','batch',1)")
            original.execute("INSERT INTO event_history_clears VALUES('friday:2026-10-23','2026-10-24')")
            # Exercise every table so an incomplete export cannot pass on empty tables.
            for name, rows in snapshot(original).items():
                if rows:
                    continue
                columns = list(original.execute(f'PRAGMA table_info("{name}")'))
                values = [0 if "INT" in c[2] else "{}" if c[1] in {"body","details","events_json"}
                          else "synthetic" for c in columns]
                original.execute(f'INSERT INTO "{name}" VALUES({",".join("?" for _ in values)})', values)
        else:
            state = {"revision":7,"players":[{"slug":"test-player","linkHash":"synthetic-not-a-real-secret"}],
                     "events":[{"id":"test-event","responses":{"test-player":{"answer":"yes","order":1}}}],
                     "audit":[{"action":"synthetic-response"}]}
            original.execute("INSERT INTO rsvp_state VALUES(1,7,?)", (json.dumps(state),))
            original.execute("INSERT INTO sessions VALUES('fake','player','test-player',1,1)")
            original.execute("INSERT INTO rate_limits VALUES('fake',1,1)")
            original.execute("INSERT INTO push_subscriptions VALUES('fake','https://push.example.test','{}','test-player','fake',1)")
            original.execute("INSERT INTO push_jobs VALUES('fake','fake','fake','{}',1,1,0,0)")
        original.commit()
        expected, expected_schema = snapshot(original), schema(original)
        export = "\n".join(original.iterdump())
        backup = Path(folder) / "synthetic-export.sql"
        backup.write_text(export)
        restored = sqlite3.connect(Path(folder) / "restored.sqlite")
        restored.executescript(backup.read_text())
        assert snapshot(restored) == expected, "A table, row or value was lost"
        assert schema(restored) == expected_schema, "Indexes/triggers/schema were lost"
        assert restored.execute("PRAGMA integrity_check").fetchone() == ("ok",)
        assert restored.execute("PRAGMA foreign_key_check").fetchall() == []
        if product == "cashier":
            assert restored.execute("SELECT SUM(cents) FROM receipt_links").fetchone()[0] == 5000
            try:
                restored.execute("UPDATE payments SET event_id='friday:2026-10-23' WHERE id='manual'")
            except sqlite3.IntegrityError as exc:
                assert "cleared" in str(exc)
            else:
                raise AssertionError("Restored cleared-event guard is not working")
            before = restored.execute("SELECT history_revision FROM register_revision").fetchone()[0]
            restored.execute("UPDATE payments SET note='Rehearsal only' WHERE id='manual'")
            after = restored.execute("SELECT history_revision FROM register_revision").fetchone()[0]
            assert after == before + 1, "Restored revision trigger is not working"
            restored.rollback()
            # Prove the comparison rejects the old incomplete-backup shape.
            restored.execute("DELETE FROM receipt_links")
            assert snapshot(restored) != expected, "Incomplete export was incorrectly accepted"
        else:
            assert json.loads(restored.execute("SELECT body FROM rsvp_state").fetchone()[0]) == state
        print(f"PASS {product}: {len(expected)} tables, {sum(map(len, expected.values()))} synthetic rows, "
              "schema/indexes/triggers and restore integrity verified; no production access.")
        original.close()
        restored.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--product", choices=["cashier", "rsvp", "all"], default="all")
    args = parser.parse_args()
    for product in (["cashier", "rsvp"] if args.product == "all" else [args.product]):
        rehearse(product)
