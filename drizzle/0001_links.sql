CREATE TABLE `link` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`platform` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`url` text NOT NULL,
	`position` integer NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `link` (`product_id`, `platform`, `url`, `position`, `clicks`)
SELECT `id`, 'shopee', `shopee_url`, 0, `shopee_clicks` FROM `product` WHERE `shopee_url` != ''
UNION ALL SELECT `id`, 'tiktok', `tiktok_url`, 1, `tiktok_clicks` FROM `product` WHERE `tiktok_url` != ''
UNION ALL SELECT `id`, 'whatsapp', `whatsapp_url`, 2, `whatsapp_clicks` FROM `product` WHERE `whatsapp_url` != '';
--> statement-breakpoint
ALTER TABLE `product` DROP COLUMN `shopee_url`;--> statement-breakpoint
ALTER TABLE `product` DROP COLUMN `tiktok_url`;--> statement-breakpoint
ALTER TABLE `product` DROP COLUMN `whatsapp_url`;--> statement-breakpoint
ALTER TABLE `product` DROP COLUMN `shopee_clicks`;--> statement-breakpoint
ALTER TABLE `product` DROP COLUMN `tiktok_clicks`;--> statement-breakpoint
ALTER TABLE `product` DROP COLUMN `whatsapp_clicks`;