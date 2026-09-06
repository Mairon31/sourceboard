CREATE TABLE `post_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`visibility` text NOT NULL,
	`author_mode` text NOT NULL,
	`is_nsfw` integer NOT NULL,
	`editor_user_id` text NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`editor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `post_revisions_post_created_index` ON `post_revisions` (`post_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`author_mode` text DEFAULT 'IDENTIFIED' NOT NULL,
	`is_nsfw` integer DEFAULT false NOT NULL,
	`nsfw_marked_by` text,
	`nsfw_marked_at` integer,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`image_asset_id` text NOT NULL,
	`visibility` text DEFAULT 'PUBLIC' NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`accepted_comment_id` text,
	`verified_source_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`edit_deadline_at` integer NOT NULL,
	`archived_at` integer,
	`deleted_at` integer,
	`hidden_at` integer,
	`locked_at` integer,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`nsfw_marked_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`image_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "posts_author_mode_check" CHECK("posts"."author_mode" IN ('IDENTIFIED', 'ANONYMOUS')),
	CONSTRAINT "posts_visibility_check" CHECK("posts"."visibility" IN ('PUBLIC', 'FRIENDS_ONLY', 'UNLISTED', 'PRIVATE')),
	CONSTRAINT "posts_status_check" CHECK("posts"."status" IN ('OPEN', 'ANSWERED', 'VERIFIED', 'ARCHIVED', 'LOCKED'))
);
--> statement-breakpoint
CREATE INDEX `posts_feed_index` ON `posts` (`visibility`,`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `posts_author_created_index` ON `posts` (`author_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `posts_slug_index` ON `posts` (`slug`);--> statement-breakpoint
CREATE INDEX `posts_image_asset_index` ON `posts` (`image_asset_id`);--> statement-breakpoint
ALTER TABLE `media_assets` ADD `width` integer;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `height` integer;