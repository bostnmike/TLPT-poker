-- Commish-authored broadcasts and one editable vote per canonical player.
CREATE TABLE IF NOT EXISTS broadcasts (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
 options TEXT NOT NULL, created_at INTEGER NOT NULL, closed INTEGER NOT NULL DEFAULT 0,
 devices INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS poll_votes (
 poll_id TEXT NOT NULL REFERENCES broadcasts(id), slug TEXT NOT NULL,
 choice INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 PRIMARY KEY(poll_id,slug)
);
