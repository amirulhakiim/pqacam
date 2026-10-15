ALTER TABLE `job` ADD `hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
INSERT INTO `job` (`type`, `name`, `source_key`, `output_key`, `settings`, `status`, `progress`, `created_at`)
SELECT `media`.`type`, `product`.`name`, '', `media`.`r2_key`, '{"compressOnly":true}', 'done', 100, unixepoch() * 1000
FROM `media` JOIN `product` ON `product`.`id` = `media`.`product_id`
WHERE `media`.`r2_key` NOT IN (SELECT `output_key` FROM `job`)
GROUP BY `media`.`r2_key`;
