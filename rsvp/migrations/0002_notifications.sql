-- Device subscriptions are private; never part of public feeds or RSVP backups.
CREATE TABLE IF NOT EXISTS push_subscriptions (
 id TEXT PRIMARY KEY, endpoint TEXT NOT NULL UNIQUE, subscription TEXT NOT NULL,
 slug TEXT NOT NULL, binding TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS push_jobs (
 id TEXT PRIMARY KEY, subscription_id TEXT NOT NULL, binding TEXT NOT NULL,
 payload TEXT NOT NULL, created_at INTEGER NOT NULL, next_attempt INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS push_jobs_due ON push_jobs(next_attempt,lease_until);
