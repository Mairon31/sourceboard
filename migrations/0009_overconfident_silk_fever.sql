CREATE TABLE `store_items` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`price_points` integer NOT NULL,
	`asset_id` text,
	`config_json` text DEFAULT '{}' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "store_items_type_check" CHECK("store_items"."type" IN ('AVATAR_FRAME', 'PROFILE_BANNER', 'PROFILE_EFFECT', 'NAME_FONT', 'EMOTE_PACK', 'STICKER_PACK')),
	CONSTRAINT "store_items_price_check" CHECK("store_items"."price_points" >= 0)
);
--> statement-breakpoint
CREATE INDEX `store_items_active_order_index` ON `store_items` (`is_active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `store_purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`store_item_id` text NOT NULL,
	`price_paid` integer NOT NULL,
	`ledger_debit_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_item_id`) REFERENCES `store_items`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_purchases_idempotency_unique` ON `store_purchases` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `store_purchases_user_created_index` ON `store_purchases` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_cosmetics` (
	`user_id` text NOT NULL,
	`slot` text NOT NULL,
	`store_item_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `slot`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_item_id`) REFERENCES `store_items`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "user_cosmetics_slot_check" CHECK("user_cosmetics"."slot" IN ('AVATAR_FRAME', 'PROFILE_BANNER', 'PROFILE_EFFECT', 'NAME_FONT'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_cosmetics_item_unique` ON `user_cosmetics` (`user_id`,`store_item_id`);--> statement-breakpoint
CREATE TABLE `user_inventory` (
	`user_id` text NOT NULL,
	`store_item_id` text NOT NULL,
	`acquired_at` integer NOT NULL,
	`source` text NOT NULL,
	PRIMARY KEY(`user_id`, `store_item_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_item_id`) REFERENCES `store_items`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "user_inventory_source_check" CHECK("user_inventory"."source" IN ('PURCHASE', 'ACHIEVEMENT', 'ADMIN_GRANT'))
);
--> statement-breakpoint
CREATE INDEX `user_inventory_user_acquired_index` ON `user_inventory` (`user_id`,`acquired_at`);