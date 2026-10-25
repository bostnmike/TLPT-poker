-- Attendance cache is deliberately separate from schedule/ledger selection.
CREATE TABLE IF NOT EXISTS live_rsvp_state (id TEXT PRIMARY KEY,body TEXT NOT NULL,fetched_at TEXT NOT NULL,attempted_at TEXT NOT NULL,error TEXT NOT NULL);
