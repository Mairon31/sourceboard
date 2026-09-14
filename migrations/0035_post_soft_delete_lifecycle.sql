ALTER TABLE posts ADD COLUMN deleted_previous_status TEXT;
--> statement-breakpoint
CREATE INDEX posts_soft_delete_retention_index ON posts (deleted_at) WHERE deleted_at IS NOT NULL;
