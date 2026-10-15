CREATE TABLE `folder` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `folder_name_unique` ON `folder` (`name`);--> statement-breakpoint
ALTER TABLE `job` ADD `folder_id` integer REFERENCES folder(id) ON UPDATE no action ON DELETE set null;