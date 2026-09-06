CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`reason` text,
	`metadata_json` text,
	`request_id` text,
	`ip_prefix_hash` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_logs_actor_user_id_index` ON `audit_logs` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_target_index` ON `audit_logs` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_index` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `email_verification_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_verification_tokens_hash_unique` ON `email_verification_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `email_verification_tokens_user_id_index` ON `email_verification_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `login_failure_counters` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`failures` integer NOT NULL,
	`window_started_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_tokens_hash_unique` ON `password_reset_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `password_reset_tokens_user_id_index` ON `password_reset_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `permissions_slug_unique` ON `permissions` (`slug`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` text NOT NULL,
	`permission_id` text NOT NULL,
	PRIMARY KEY(`role_id`, `permission_id`),
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`rank` integer NOT NULL,
	`is_system` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_slug_unique` ON `roles` (`slug`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`ip_prefix_hash` text,
	`user_agent_hash` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_index` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_credentials` (
	`user_id` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_params_json` text NOT NULL,
	`password_version` text NOT NULL,
	`password_changed_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`granted_at` integer NOT NULL,
	`granted_by_user_id` text,
	PRIMARY KEY(`user_id`, `role_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`username_normalized` text NOT NULL,
	`email_lookup_hash` text NOT NULL,
	`email_encrypted` text NOT NULL,
	`email_key_version` text NOT NULL,
	`status` text DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	`email_verified_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_seen_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_normalized_unique` ON `users` (`username_normalized`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_lookup_hash_unique` ON `users` (`email_lookup_hash`);

INSERT OR IGNORE INTO roles (id, slug, name, rank, is_system) VALUES
  ('owner', 'owner', 'Owner', 100, 1),
  ('admin', 'admin', 'Admin', 80, 1),
  ('moderator', 'moderator', 'Moderator', 60, 1),
  ('source_verifier', 'source_verifier', 'Source Verifier', 40, 1),
  ('user', 'user', 'User', 10, 1);

INSERT OR IGNORE INTO permissions (id, slug, description) VALUES
  ('admin.access', 'admin.access', 'Access administration surfaces'),
  ('user.read_private_admin_fields', 'user.read_private_admin_fields', 'Read private user fields in authorized admin flows'),
  ('user.suspend', 'user.suspend', 'Suspend a user'),
  ('user.ban', 'user.ban', 'Permanently ban a user'),
  ('user.assign_roles', 'user.assign_roles', 'Assign or remove user roles'),
  ('role.manage', 'role.manage', 'Manage role definitions and mappings'),
  ('post.moderate', 'post.moderate', 'Moderate a post'),
  ('post.lock', 'post.lock', 'Lock a post'),
  ('post.hide', 'post.hide', 'Hide a post'),
  ('post.restore', 'post.restore', 'Restore a post'),
  ('comment.moderate', 'comment.moderate', 'Moderate a comment'),
  ('report.review', 'report.review', 'Review reports'),
  ('source.verify', 'source.verify', 'Verify a source'),
  ('source.revoke_verification', 'source.revoke_verification', 'Revoke a source verification'),
  ('points.adjust', 'points.adjust', 'Adjust points'),
  ('store.manage', 'store.manage', 'Manage the store'),
  ('emote.manage', 'emote.manage', 'Manage emotes'),
  ('sticker.manage', 'sticker.manage', 'Manage stickers'),
  ('achievement.manage', 'achievement.manage', 'Manage achievements'),
  ('settings.manage', 'settings.manage', 'Manage site settings'),
  ('audit.read', 'audit.read', 'Read audit logs'),
  ('anonymous_post.deanonymize', 'anonymous_post.deanonymize', 'Resolve an anonymous post author'),
  ('post.nsfw.mark', 'post.nsfw.mark', 'Mark a post NSFW'),
  ('post.nsfw.unmark', 'post.nsfw.unmark', 'Remove an author-applied NSFW mark');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 'owner', id FROM permissions;

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 'admin', id FROM permissions
  WHERE slug NOT IN ('role.manage', 'anonymous_post.deanonymize');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 'moderator', id FROM permissions
  WHERE slug IN (
    'post.moderate', 'post.lock', 'post.hide', 'post.restore',
    'comment.moderate', 'report.review', 'user.suspend',
    'post.nsfw.mark', 'post.nsfw.unmark'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 'source_verifier', id FROM permissions
  WHERE slug = 'source.verify';
