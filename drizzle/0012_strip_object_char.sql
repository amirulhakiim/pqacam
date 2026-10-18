UPDATE `product` SET `name` = trim(replace(`name`, char(65532), '')), `short_name` = trim(replace(`short_name`, char(65532), '')), `price` = trim(replace(`price`, char(65532), '')), `review` = trim(replace(`review`, char(65532), ''));
--> statement-breakpoint
UPDATE `link` SET `label` = trim(replace(`label`, char(65532), ''));
--> statement-breakpoint
UPDATE `profile` SET `name` = trim(replace(`name`, char(65532), '')), `handle` = trim(replace(`handle`, char(65532), '')), `bio` = trim(replace(`bio`, char(65532), ''));
