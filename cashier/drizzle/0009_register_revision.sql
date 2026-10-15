CREATE TABLE register_revision (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL DEFAULT 0);
INSERT INTO register_revision (id,revision) VALUES (1,0);
CREATE TRIGGER cashier_revision_payments_insert AFTER INSERT ON payments
BEGIN UPDATE register_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER cashier_revision_payments_update AFTER UPDATE ON payments
BEGIN UPDATE register_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER cashier_revision_payments_delete AFTER DELETE ON payments
BEGIN UPDATE register_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER cashier_revision_venmo_player_aliases_insert AFTER INSERT ON venmo_player_aliases
BEGIN UPDATE register_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER cashier_revision_venmo_player_aliases_update AFTER UPDATE ON venmo_player_aliases
BEGIN UPDATE register_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER cashier_revision_venmo_player_aliases_delete AFTER DELETE ON venmo_player_aliases
BEGIN UPDATE register_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER cashier_revision_sync_state_insert AFTER INSERT ON sync_state
BEGIN UPDATE register_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER cashier_revision_sync_state_update AFTER UPDATE ON sync_state
BEGIN UPDATE register_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER cashier_revision_sync_state_delete AFTER DELETE ON sync_state
BEGIN UPDATE register_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER cashier_revision_event_payment_formats_insert AFTER INSERT ON event_payment_formats
BEGIN UPDATE register_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER cashier_revision_event_payment_formats_update AFTER UPDATE ON event_payment_formats
BEGIN UPDATE register_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER cashier_revision_event_payment_formats_delete AFTER DELETE ON event_payment_formats
BEGIN UPDATE register_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER cashier_revision_schedule_state_insert AFTER INSERT ON schedule_state
BEGIN UPDATE register_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER cashier_revision_schedule_state_update AFTER UPDATE ON schedule_state
BEGIN UPDATE register_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER cashier_revision_schedule_state_delete AFTER DELETE ON schedule_state
BEGIN UPDATE register_revision SET revision=revision+1 WHERE id=1; END;
