CREATE TABLE `reputation_reward_rules` (
  `id` text PRIMARY KEY NOT NULL,
  `reward_type` text NOT NULL,
  `version` integer NOT NULL,
  `amount` integer NOT NULL,
  `provisional` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'ACTIVE' NOT NULL,
  `created_by_user_id` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT "reputation_reward_rules_type_check" CHECK(`reward_type` IN ('ACCEPTED_SOURCE', 'VERIFIED_SOURCE')),
  CONSTRAINT "reputation_reward_rules_version_check" CHECK(`version` > 0),
  CONSTRAINT "reputation_reward_rules_amount_check" CHECK(`amount` > 0),
  CONSTRAINT "reputation_reward_rules_provisional_check" CHECK(`provisional` IN (0, 1)),
  CONSTRAINT "reputation_reward_rules_status_check" CHECK(`status` IN ('ACTIVE', 'DISABLED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reputation_reward_rules_type_version_unique` ON `reputation_reward_rules` (`reward_type`, `version`);
--> statement-breakpoint
CREATE UNIQUE INDEX `reputation_reward_rules_active_type_unique` ON `reputation_reward_rules` (`reward_type`) WHERE `status` = 'ACTIVE';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `achievement_catalog_active_slug_unique` ON `achievement_catalog` (`slug`) WHERE `status` = 'ACTIVE';
--> statement-breakpoint
INSERT OR IGNORE INTO `reputation_reward_rules`
  (`id`, `reward_type`, `version`, `amount`, `provisional`, `status`, `created_at`)
VALUES
  ('reward-accepted-source-v1', 'ACCEPTED_SOURCE', 1, 10, 1, 'ACTIVE', unixepoch('now') * 1000),
  ('reward-verified-source-v1', 'VERIFIED_SOURCE', 1, 100, 0, 'ACTIVE', unixepoch('now') * 1000);
--> statement-breakpoint
INSERT OR IGNORE INTO `permissions` (`id`, `slug`, `description`)
VALUES ('points.manage', 'points.manage', 'Manage versioned point reward rules');
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 'owner', id FROM permissions WHERE slug = 'points.manage';
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 'admin', id FROM permissions WHERE slug = 'points.manage';
