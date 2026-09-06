CREATE TABLE `source_resolutions` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`comment_id` text NOT NULL,
	`resolution_type` text NOT NULL,
	`state` text DEFAULT 'ACTIVE' NOT NULL,
	`canonical_source_url` text,
	`evidence_note` text,
	`actor_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	`revoked_by_user_id` text,
	`revoke_reason` text,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`revoked_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "source_resolutions_type_check" CHECK("source_resolutions"."resolution_type" IN ('ACCEPTED', 'VERIFIED')),
	CONSTRAINT "source_resolutions_state_check" CHECK("source_resolutions"."state" IN ('ACTIVE', 'REVOKED'))
);
--> statement-breakpoint
CREATE INDEX `source_resolutions_post_created_index` ON `source_resolutions` (`post_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `source_resolutions_active_post_type_unique` ON `source_resolutions` (`post_id`,`resolution_type`) WHERE "source_resolutions"."state" = 'ACTIVE';