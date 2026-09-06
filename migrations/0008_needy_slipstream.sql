CREATE TABLE `achievement_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`icon` text NOT NULL,
	`verified_source_threshold` integer NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "achievement_catalog_status_check" CHECK("achievement_catalog"."status" IN ('ACTIVE', 'DISABLED')),
	CONSTRAINT "achievement_catalog_threshold_check" CHECK("achievement_catalog"."verified_source_threshold" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `achievement_catalog_slug_version_unique` ON `achievement_catalog` (`slug`,`version`);--> statement-breakpoint
CREATE TABLE `point_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`entry_type` text NOT NULL,
	`reward_type` text,
	`source_event` text,
	`source_event_id` text,
	`idempotency_key` text NOT NULL,
	`metadata_json` text,
	`created_by_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "point_ledger_entry_type_check" CHECK("point_ledger"."entry_type" IN ('AWARD', 'REVERSAL', 'MANUAL_ADJUSTMENT')),
	CONSTRAINT "point_ledger_amount_nonzero_check" CHECK("point_ledger"."amount" <> 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_idempotency_unique` ON `point_ledger` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `point_ledger_user_created_index` ON `point_ledger` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `point_ledger_source_event_index` ON `point_ledger` (`source_event`,`source_event_id`);--> statement-breakpoint
CREATE TABLE `reputation_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`signal_type` text NOT NULL,
	`post_id` text,
	`actor_user_id` text,
	`target_user_id` text,
	`idempotency_key` text NOT NULL,
	`metadata_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reputation_signals_idempotency_unique` ON `reputation_signals` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `reputation_signals_post_created_index` ON `reputation_signals` (`post_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_achievements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`achievement_id` text NOT NULL,
	`earned_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`achievement_id`) REFERENCES `achievement_catalog`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_achievements_user_achievement_unique` ON `user_achievements` (`user_id`,`achievement_id`);--> statement-breakpoint
CREATE INDEX `user_achievements_user_earned_index` ON `user_achievements` (`user_id`,`earned_at`);
--> statement-breakpoint
INSERT OR IGNORE INTO achievement_catalog (id, slug, version, name, description, icon, verified_source_threshold, status, created_at) VALUES
('achievement-first-verified-source-v1', 'first-verified-source', 1, 'First verified source', 'Verify your first source for the community.', '◎', 1, 'ACTIVE', unixepoch('now') * 1000),
('achievement-five-verified-sources-v1', 'five-verified-sources', 1, 'Five verified sources', 'Help verify five community sources.', '✦', 5, 'ACTIVE', unixepoch('now') * 1000),
('achievement-twenty-five-verified-sources-v1', 'twenty-five-verified-sources', 1, 'Twenty-five verified sources', 'Help verify twenty-five community sources.', '✧', 25, 'ACTIVE', unixepoch('now') * 1000),
('achievement-one-hundred-verified-sources-v1', 'one-hundred-verified-sources', 1, 'One hundred verified sources', 'Help verify one hundred community sources.', '◈', 100, 'ACTIVE', unixepoch('now') * 1000);
