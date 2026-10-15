CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`details` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`payer` text NOT NULL,
	`player` text DEFAULT '' NOT NULL,
	`cents` integer NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`method` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`received_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_source_id_unique` ON `payments` (`source_id`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`last_check` text NOT NULL,
	`matched` integer NOT NULL,
	`rejected` integer NOT NULL
);
