CREATE TABLE `event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`product_id` integer,
	`term` text,
	`results` integer,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `event_at` ON `event` (`at`);