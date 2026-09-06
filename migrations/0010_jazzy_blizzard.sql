CREATE TABLE `moderation_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`expires_at` integer,
	`metadata_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `moderation_actions_target_index` ON `moderation_actions` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `moderation_appeals` (
	`id` text PRIMARY KEY NOT NULL,
	`sanction_id` text NOT NULL,
	`appellant_user_id` text NOT NULL,
	`detail` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`reviewer_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`sanction_id`) REFERENCES `user_sanctions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`appellant_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `moderation_appeals_queue_index` ON `moderation_appeals` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `moderation_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`category` text NOT NULL,
	`detail` text,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`assignee_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`reporter_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignee_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `moderation_reports_duplicate_index` ON `moderation_reports` (`reporter_user_id`,`target_type`,`target_id`,`category`);--> statement-breakpoint
CREATE INDEX `moderation_reports_queue_index` ON `moderation_reports` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_sanctions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`kind` text NOT NULL,
	`reason` text NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_sanctions_active_index` ON `user_sanctions` (`user_id`,`kind`,`expires_at`);