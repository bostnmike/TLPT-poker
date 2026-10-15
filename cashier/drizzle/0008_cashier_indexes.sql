-- Append-only migration; the original eight migrations are preserved unchanged.
CREATE INDEX IF NOT EXISTS payments_event_received ON payments(event_id, received_at DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_payment_id ON audit(payment_id);
