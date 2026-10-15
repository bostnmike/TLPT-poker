CREATE TABLE `event_payment_formats` (
	`event_id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`bounty_cents` integer NOT NULL,
	`updated_at` text NOT NULL,
	`actor` text NOT NULL
);
