CREATE TABLE `emote_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "emote_packs_status_check" CHECK("emote_packs"."status" IN ('ACTIVE', 'DISABLED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `emote_packs_slug_unique` ON `emote_packs` (`slug`);--> statement-breakpoint
CREATE TABLE `sticker_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "sticker_packs_status_check" CHECK("sticker_packs"."status" IN ('ACTIVE', 'DISABLED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sticker_packs_slug_unique` ON `sticker_packs` (`slug`);--> statement-breakpoint
ALTER TABLE `emote_catalog` ADD `pack_id` text;--> statement-breakpoint
ALTER TABLE `emote_catalog` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sticker_catalog` ADD `pack_id` text;--> statement-breakpoint
ALTER TABLE `sticker_catalog` ADD `sort_order` integer DEFAULT 0 NOT NULL;