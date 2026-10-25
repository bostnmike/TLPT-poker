-- Additive: no existing event or payment is cleared by this migration.
CREATE TABLE event_history_clears (event_id TEXT PRIMARY KEY NOT NULL,cleared_at TEXT NOT NULL);
ALTER TABLE register_revision ADD COLUMN history_revision INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER cashier_history_payments_insert AFTER INSERT ON payments
BEGIN UPDATE register_revision SET history_revision=history_revision+1 WHERE id=1; END;
CREATE TRIGGER cashier_history_payments_update AFTER UPDATE ON payments
BEGIN UPDATE register_revision SET history_revision=history_revision+1 WHERE id=1; END;
CREATE TRIGGER cashier_history_payments_delete AFTER DELETE ON payments
BEGIN UPDATE register_revision SET history_revision=history_revision+1 WHERE id=1; END;
CREATE TRIGGER cashier_revision_history_clear AFTER INSERT ON event_history_clears
BEGIN UPDATE register_revision SET revision=revision+1 WHERE id=1; END;
-- Close the race with an importer or stale manual/batch form that read the
-- schedule immediately before clearing. Abort its transaction, so it retries
-- against the current event list rather than resurrecting any records.
CREATE TRIGGER cashier_closed_event_insert BEFORE INSERT ON payments
WHEN EXISTS (SELECT 1 FROM event_history_clears c WHERE c.event_id=NEW.event_id OR (NEW.event_id IS NULL AND EXISTS (SELECT 1 FROM json_each(NEW.candidate_event_ids) WHERE value=c.event_id)))
BEGIN SELECT RAISE(ABORT,'Event history has been cleared'); END;
CREATE TRIGGER cashier_closed_event_update BEFORE UPDATE ON payments
WHEN EXISTS (SELECT 1 FROM event_history_clears c WHERE c.event_id=NEW.event_id OR (NEW.event_id IS NULL AND EXISTS (SELECT 1 FROM json_each(NEW.candidate_event_ids) WHERE value=c.event_id)))
BEGIN SELECT RAISE(ABORT,'Event history has been cleared'); END;
