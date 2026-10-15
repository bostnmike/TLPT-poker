ALTER TABLE `payments` ADD `linked_to` text;--> statement-breakpoint
CREATE UNIQUE INDEX `payments_linked_to_unique` ON `payments` (`linked_to`);