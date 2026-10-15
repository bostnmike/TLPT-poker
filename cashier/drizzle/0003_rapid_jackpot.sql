CREATE TABLE `schedule_state` (
	`id` text PRIMARY KEY NOT NULL,
	`events_json` text NOT NULL,
	`source_hash` text NOT NULL,
	`fetched_at` text NOT NULL,
	`attempted_at` text NOT NULL,
	`error` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `payments` ADD `event_id` text DEFAULT 'mtt:2026-10-24';--> statement-breakpoint
ALTER TABLE `payments` ADD `candidate_event_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `prize_cents` integer;--> statement-breakpoint
ALTER TABLE `payments` ADD `bounty_cents` integer;--> statement-breakpoint
ALTER TABLE `payments` ADD `food_cents` integer;--> statement-breakpoint
ALTER TABLE `sync_state` ADD `active_event_id` text;--> statement-breakpoint
ALTER TABLE `sync_state` ADD `reader_mode` text DEFAULT 'event' NOT NULL;