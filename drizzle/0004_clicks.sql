CREATE TABLE `click` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`link_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`platform` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `click_at` ON `click` (`at`);