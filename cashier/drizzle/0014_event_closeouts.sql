-- Additive only. No event is closed and no payment is deleted on deployment.
-- Contains completion evidence, never payment amounts, players or credentials.
CREATE TABLE event_closeouts (
 event_id TEXT PRIMARY KEY NOT NULL REFERENCES event_history_clears(event_id),
 rsvp_event_id TEXT NOT NULL,
 request_id TEXT NOT NULL UNIQUE,
 results_revision TEXT NOT NULL,
 raw_sha256 TEXT NOT NULL,
 parsed_sha256 TEXT NOT NULL,
 closed_at TEXT NOT NULL
);
