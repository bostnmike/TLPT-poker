CREATE TABLE `deleted_payment_sources` (
	`source_id` text PRIMARY KEY NOT NULL,
	`event_id` text,
	`candidate_event_ids` text DEFAULT '[]' NOT NULL
);
