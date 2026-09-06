CREATE TABLE `comment_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text NOT NULL,
	`body_richtext_json` text NOT NULL,
	`body_plaintext` text NOT NULL,
	`attachment_json` text,
	`editor_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`editor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `comment_revisions_comment_created_index` ON `comment_revisions` (`comment_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`author_id` text NOT NULL,
	`parent_comment_id` text,
	`body_richtext_json` text NOT NULL,
	`body_plaintext` text NOT NULL,
	`attachment_json` text,
	`state` text DEFAULT 'VISIBLE' NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`edit_deadline_at` integer NOT NULL,
	`deleted_at` integer,
	`hidden_at` integer,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "comments_state_check" CHECK("comments"."state" IN ('VISIBLE', 'HIDDEN', 'DELETED'))
);
--> statement-breakpoint
CREATE INDEX `comments_post_created_index` ON `comments` (`post_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `comments_post_parent_created_index` ON `comments` (`post_id`,`parent_comment_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `comments_author_created_index` ON `comments` (`author_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `emote_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`shortcode` text NOT NULL,
	`label` text NOT NULL,
	`asset_key` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "emote_catalog_status_check" CHECK("emote_catalog"."status" IN ('ACTIVE', 'DISABLED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `emote_catalog_shortcode_unique` ON `emote_catalog` (`shortcode`);--> statement-breakpoint
CREATE TABLE `reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reaction_type` text DEFAULT 'LIKE' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reactions_target_type_check" CHECK("reactions"."target_type" IN ('POST', 'COMMENT')),
	CONSTRAINT "reactions_reaction_type_check" CHECK("reactions"."reaction_type" = 'LIKE')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reactions_user_target_type_unique` ON `reactions` (`user_id`,`target_type`,`target_id`,`reaction_type`);--> statement-breakpoint
CREATE INDEX `reactions_target_index` ON `reactions` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `sticker_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	`asset_key` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "sticker_catalog_status_check" CHECK("sticker_catalog"."status" IN ('ACTIVE', 'DISABLED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sticker_catalog_slug_unique` ON `sticker_catalog` (`slug`);