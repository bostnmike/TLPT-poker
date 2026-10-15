CREATE TABLE `venmo_player_aliases` (
	`payer_key` text PRIMARY KEY NOT NULL,
	`payer_name` text NOT NULL,
	`player_slug` text NOT NULL,
	`player_name` text NOT NULL,
	`updated_at` text NOT NULL,
	`actor` text NOT NULL
);
