ALTER TABLE `sync_state` ADD `configured_at` text;--> statement-breakpoint
ALTER TABLE `sync_state` ADD `armed_at` text;--> statement-breakpoint
ALTER TABLE `sync_state` ADD `format_verified` integer DEFAULT 0 NOT NULL;