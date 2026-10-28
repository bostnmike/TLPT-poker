-- Separate opt-in from player notifications, even when both use one browser's
-- existing push endpoint. Existing subscriptions and signing keys are retained.
CREATE TABLE IF NOT EXISTS commish_push_subscriptions (
 id TEXT PRIMARY KEY, endpoint TEXT NOT NULL UNIQUE, subscription TEXT NOT NULL,
 slug TEXT NOT NULL, binding TEXT NOT NULL, updated_at INTEGER NOT NULL
);
