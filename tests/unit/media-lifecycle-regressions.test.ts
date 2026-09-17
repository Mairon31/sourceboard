import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  cleanOrphanMedia,
  cleanMarkedMedia,
  cleanPendingCommentMedia,
  purgeExpiredPosts,
} from "../../worker/maintenance/service";

function createD1(
  sqlite: DatabaseSync,
  options: {
    beforeConditionalPostDelete?: () => void;
    inflateConditionalPostDeleteChanges?: boolean;
  } = {},
): D1Database {
  function prepare(query: string) {
    let values: unknown[] = [];
    const statement = {
      bind(...next: unknown[]) {
        values = next;
        return statement;
      },
      async first<T>() {
        return (sqlite.prepare(query).get(...(values as never[])) ?? null) as T | null;
      },
      async all<T>() {
        return { results: sqlite.prepare(query).all(...(values as never[])) as T[] } as D1Result<T>;
      },
      async run() {
        if (
          /DELETE FROM posts WHERE id = \? AND deleted_at = \? AND deleted_at <= \?/i.test(query)
        ) {
          options.beforeConditionalPostDelete?.();
        }
        const result = sqlite.prepare(query).run(...(values as never[]));
        const changes =
          options.inflateConditionalPostDeleteChanges &&
          /DELETE FROM posts WHERE id = \? AND deleted_at = \? AND deleted_at <= \?/i.test(query)
            ? Number(result.changes) + 2
            : result.changes;
        return { meta: { changes } } as D1Result<unknown>;
      },
    };
    return statement;
  }
  return {
    prepare,
    async batch(statements: D1PreparedStatement[]) {
      return Promise.all(statements.map((statement) => statement.run()));
    },
  } as unknown as D1Database;
}

function createBucket(
  options: {
    failDelete?: boolean;
    objects?: Array<{
      key: string;
      uploaded: Date;
      customMetadata?: Record<string, string>;
    }>;
  } = {},
) {
  const deleted: string[] = [];
  return {
    deleted,
    bucket: {
      async delete(keys: string | string[]) {
        if (options.failDelete) throw new Error("R2 unavailable");
        deleted.push(...(Array.isArray(keys) ? keys : [keys]));
      },
      async list() {
        return { objects: options.objects ?? [], truncated: false };
      },
    } as unknown as R2Bucket,
  };
}

describe("media lifecycle compensation and purge", () => {
  it("does not delete an old unowned R2 object based only on its managed-looking prefix", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE media_assets (r2_key TEXT);
        CREATE TABLE emote_catalog (asset_key TEXT);
        CREATE TABLE sticker_catalog (asset_key TEXT);
      `);
      const { bucket, deleted } = createBucket({
        objects: [
          {
            key: "posts/legacy-object",
            uploaded: new Date(1),
          },
        ],
      });

      await expect(
        cleanOrphanMedia(createD1(sqlite), bucket, 24 * 60 * 60 * 1000 + 1),
      ).resolves.toBe(0);
      expect(deleted).toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  it("deletes only an old object whose server metadata proves its generated identity", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE media_assets (r2_key TEXT);
        CREATE TABLE emote_catalog (asset_key TEXT);
        CREATE TABLE sticker_catalog (asset_key TEXT);
      `);
      const { bucket, deleted } = createBucket({
        objects: [
          {
            key: "posts/asset-ownership-1",
            uploaded: new Date(1),
            customMetadata: {
              sourceboardManaged: "1",
              mediaId: "asset-ownership-1",
              purpose: "POST",
              ownerUserId: "user-1",
            },
          },
        ],
      });

      await expect(
        cleanOrphanMedia(createD1(sqlite), bucket, 24 * 60 * 60 * 1000 + 1),
      ).resolves.toBe(1);
      expect(deleted).toEqual(["posts/asset-ownership-1"]);
    } finally {
      sqlite.close();
    }
  });

  it("keeps orphan cleanup retryable when R2 deletion fails", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE media_assets (r2_key TEXT);
        CREATE TABLE emote_catalog (asset_key TEXT);
        CREATE TABLE sticker_catalog (asset_key TEXT);
      `);
      const { bucket, deleted } = createBucket({
        failDelete: true,
        objects: [
          {
            key: "posts/temporarily-unavailable",
            uploaded: new Date(1),
            customMetadata: {
              sourceboardManaged: "1",
              mediaId: "temporarily-unavailable",
              purpose: "POST",
              ownerUserId: "user-1",
            },
          },
        ],
      });

      await expect(
        cleanOrphanMedia(createD1(sqlite), bucket, 24 * 60 * 60 * 1000 + 1),
      ).resolves.toBe(0);
      expect(deleted).toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  it("removes a purged post media row only after the conditional post delete", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE posts (id TEXT PRIMARY KEY, image_asset_id TEXT NOT NULL, deleted_at INTEGER);
        CREATE TABLE user_profiles (avatar_asset_id TEXT, banner_asset_id TEXT);
        CREATE TABLE comments (id TEXT, post_id TEXT, attachment_json TEXT);
        CREATE TABLE reactions (target_type TEXT, target_id TEXT);
        CREATE TABLE emote_catalog (asset_key TEXT);
        CREATE TABLE sticker_catalog (asset_key TEXT);
        CREATE TABLE media_assets (
          id TEXT PRIMARY KEY, r2_key TEXT NOT NULL, status TEXT NOT NULL,
          deleted_at INTEGER, purpose TEXT NOT NULL
        );
        INSERT INTO media_assets VALUES ('post-media', 'posts/user/post-media', 'ACTIVE', NULL, 'POST_IMAGE');
        INSERT INTO posts VALUES ('post-1', 'post-media', 1);
      `);
      const { bucket, deleted } = createBucket();

      await expect(
        purgeExpiredPosts(createD1(sqlite), bucket, 24 * 60 * 60 * 1000 + 1),
      ).resolves.toBe(1);

      expect(sqlite.prepare("SELECT id FROM posts").all()).toEqual([]);
      expect(sqlite.prepare("SELECT id FROM media_assets").all()).toEqual([]);
      expect(deleted).toEqual(["posts/user/post-media"]);
    } finally {
      sqlite.close();
    }
  });

  it("counts a post purge when search triggers inflate D1 delete changes", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE posts (id TEXT PRIMARY KEY, image_asset_id TEXT NOT NULL, deleted_at INTEGER);
        CREATE TABLE user_profiles (avatar_asset_id TEXT, banner_asset_id TEXT);
        CREATE TABLE comments (id TEXT, post_id TEXT, attachment_json TEXT);
        CREATE TABLE reactions (target_type TEXT, target_id TEXT);
        CREATE TABLE emote_catalog (asset_key TEXT);
        CREATE TABLE sticker_catalog (asset_key TEXT);
        CREATE TABLE media_assets (
          id TEXT PRIMARY KEY, r2_key TEXT NOT NULL, status TEXT NOT NULL,
          deleted_at INTEGER, purpose TEXT NOT NULL
        );
        INSERT INTO media_assets VALUES ('post-media', 'posts/user/post-media', 'ACTIVE', NULL, 'POST_IMAGE');
        INSERT INTO posts VALUES ('post-1', 'post-media', 1);
      `);
      const { bucket, deleted } = createBucket();

      await expect(
        purgeExpiredPosts(
          createD1(sqlite, { inflateConditionalPostDeleteChanges: true }),
          bucket,
          24 * 60 * 60 * 1000 + 1,
        ),
      ).resolves.toBe(1);
      expect(sqlite.prepare("SELECT id FROM posts").all()).toEqual([]);
      expect(deleted).toEqual(["posts/user/post-media"]);
    } finally {
      sqlite.close();
    }
  });

  it("purges an expired post even when it has no image asset", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE posts (id TEXT PRIMARY KEY, image_asset_id TEXT, deleted_at INTEGER);
        CREATE TABLE user_profiles (avatar_asset_id TEXT, banner_asset_id TEXT);
        CREATE TABLE comments (id TEXT, post_id TEXT, attachment_json TEXT);
        CREATE TABLE reactions (target_type TEXT, target_id TEXT);
        CREATE TABLE emote_catalog (asset_key TEXT);
        CREATE TABLE sticker_catalog (asset_key TEXT);
        CREATE TABLE media_assets (
          id TEXT PRIMARY KEY, r2_key TEXT NOT NULL, status TEXT NOT NULL,
          deleted_at INTEGER, purpose TEXT NOT NULL
        );
        INSERT INTO posts VALUES ('post-without-media', NULL, 1);
      `);
      const { bucket } = createBucket();

      await expect(
        purgeExpiredPosts(createD1(sqlite), bucket, 24 * 60 * 60 * 1000 + 1),
      ).resolves.toBe(1);
      expect(sqlite.prepare("SELECT id FROM posts").all()).toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  it("does not purge media when a concurrent restore wins the conditional delete", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE posts (id TEXT PRIMARY KEY, image_asset_id TEXT NOT NULL, deleted_at INTEGER);
        CREATE TABLE user_profiles (avatar_asset_id TEXT, banner_asset_id TEXT);
        CREATE TABLE comments (id TEXT, post_id TEXT, attachment_json TEXT);
        CREATE TABLE reactions (target_type TEXT, target_id TEXT);
        CREATE TABLE emote_catalog (asset_key TEXT);
        CREATE TABLE sticker_catalog (asset_key TEXT);
        CREATE TABLE media_assets (
          id TEXT PRIMARY KEY, r2_key TEXT NOT NULL, status TEXT NOT NULL,
          deleted_at INTEGER, purpose TEXT NOT NULL
        );
        INSERT INTO media_assets VALUES ('post-media', 'posts/user/post-media', 'ACTIVE', NULL, 'POST_IMAGE');
        INSERT INTO posts VALUES ('post-1', 'post-media', 1);
      `);
      const { bucket, deleted } = createBucket();
      let restored = false;
      const db = createD1(sqlite, {
        beforeConditionalPostDelete: () => {
          if (restored) return;
          restored = true;
          sqlite.prepare("UPDATE posts SET deleted_at = NULL WHERE id = 'post-1'").run();
        },
      });

      await expect(purgeExpiredPosts(db, bucket, 24 * 60 * 60 * 1000 + 1)).resolves.toBe(0);
      expect(sqlite.prepare("SELECT deleted_at FROM posts WHERE id = 'post-1'").get()).toEqual({
        deleted_at: null,
      });
      expect(
        sqlite.prepare("SELECT status FROM media_assets WHERE id = 'post-media'").get(),
      ).toEqual({
        status: "ACTIVE",
      });
      expect(deleted).toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  it("keeps a purge media row as a retry record when R2 deletion fails", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE posts (id TEXT PRIMARY KEY, image_asset_id TEXT NOT NULL, deleted_at INTEGER);
        CREATE TABLE user_profiles (avatar_asset_id TEXT, banner_asset_id TEXT);
        CREATE TABLE comments (id TEXT, post_id TEXT, attachment_json TEXT);
        CREATE TABLE reactions (target_type TEXT, target_id TEXT);
        CREATE TABLE emote_catalog (asset_key TEXT);
        CREATE TABLE sticker_catalog (asset_key TEXT);
        CREATE TABLE media_assets (
          id TEXT PRIMARY KEY, r2_key TEXT NOT NULL, status TEXT NOT NULL,
          deleted_at INTEGER, purpose TEXT NOT NULL
        );
        INSERT INTO media_assets VALUES ('post-media', 'posts/user/post-media', 'ACTIVE', NULL, 'POST_IMAGE');
        INSERT INTO posts VALUES ('post-1', 'post-media', 1);
      `);
      const { bucket } = createBucket({ failDelete: true });
      const now = 24 * 60 * 60 * 1000 + 1;

      await expect(purgeExpiredPosts(createD1(sqlite), bucket, now)).resolves.toBe(1);

      expect(sqlite.prepare("SELECT id FROM posts").all()).toEqual([]);
      expect(sqlite.prepare("SELECT id, status, deleted_at FROM media_assets").all()).toEqual([
        { id: "post-media", status: "DELETED", deleted_at: now },
      ]);
    } finally {
      sqlite.close();
    }
  });

  it("keeps pending comment metadata when R2 cleanup fails so a later run can retry", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE comments (attachment_json TEXT);
        CREATE TABLE media_assets (
          id TEXT PRIMARY KEY, r2_key TEXT NOT NULL, purpose TEXT NOT NULL,
          status TEXT NOT NULL, created_at INTEGER NOT NULL, deleted_at INTEGER
        );
        INSERT INTO media_assets VALUES ('comment-media', 'comments/user/comment-media', 'COMMENT_IMAGE', 'PENDING', 1, NULL);
      `);
      const { bucket } = createBucket({ failDelete: true });

      await expect(
        cleanPendingCommentMedia(createD1(sqlite), bucket, 24 * 60 * 60 * 1000 + 1),
      ).resolves.toBeUndefined();
      expect(sqlite.prepare("SELECT id FROM media_assets").all()).toEqual([
        { id: "comment-media" },
      ]);
    } finally {
      sqlite.close();
    }
  });

  it("keeps deleted media metadata when marked-object cleanup fails", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE posts (image_asset_id TEXT);
        CREATE TABLE user_profiles (avatar_asset_id TEXT, banner_asset_id TEXT);
        CREATE TABLE comments (attachment_json TEXT);
        CREATE TABLE emote_catalog (asset_key TEXT);
        CREATE TABLE sticker_catalog (asset_key TEXT);
        CREATE TABLE media_assets (
          id TEXT PRIMARY KEY, r2_key TEXT NOT NULL, status TEXT NOT NULL,
          deleted_at INTEGER
        );
        INSERT INTO media_assets VALUES ('deleted-media', 'profile/deleted-media', 'DELETED', 1);
      `);
      const { bucket } = createBucket({ failDelete: true });

      await expect(
        cleanMarkedMedia(createD1(sqlite), bucket, 7 * 24 * 60 * 60 * 1000 + 1),
      ).resolves.toBe(0);
      expect(sqlite.prepare("SELECT id FROM media_assets").all()).toEqual([
        { id: "deleted-media" },
      ]);
    } finally {
      sqlite.close();
    }
  });

  it("purges comment image media after the post and its comments are deleted", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE posts (id TEXT PRIMARY KEY, image_asset_id TEXT NOT NULL, deleted_at INTEGER);
        CREATE TABLE user_profiles (avatar_asset_id TEXT, banner_asset_id TEXT);
        CREATE TABLE comments (
          id TEXT PRIMARY KEY,
          post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          attachment_json TEXT
        );
        CREATE TABLE reactions (target_type TEXT, target_id TEXT);
        CREATE TABLE emote_catalog (asset_key TEXT);
        CREATE TABLE sticker_catalog (asset_key TEXT);
        CREATE TABLE media_assets (
          id TEXT PRIMARY KEY, r2_key TEXT NOT NULL, status TEXT NOT NULL,
          deleted_at INTEGER, purpose TEXT NOT NULL
        );
        INSERT INTO media_assets VALUES
          ('post-media', 'posts/post-media', 'ACTIVE', NULL, 'POST_IMAGE'),
          ('comment-media', 'comments/comment-media', 'ACTIVE', NULL, 'COMMENT_IMAGE');
        INSERT INTO posts VALUES ('post-1', 'post-media', 1);
        INSERT INTO comments VALUES ('comment-1', 'post-1', '{"type":"IMAGE","id":"comment-media"}');
        INSERT INTO reactions VALUES
          ('POST', 'post-1'),
          ('COMMENT', 'comment-1'),
          ('COMMENT', 'unrelated-comment');
      `);
      const { bucket, deleted } = createBucket();

      await expect(
        purgeExpiredPosts(createD1(sqlite), bucket, 24 * 60 * 60 * 1000 + 1),
      ).resolves.toBe(1);

      expect(sqlite.prepare("SELECT id FROM posts").all()).toEqual([]);
      expect(sqlite.prepare("SELECT id FROM comments").all()).toEqual([]);
      expect(sqlite.prepare("SELECT target_type, target_id FROM reactions").all()).toEqual([
        { target_type: "COMMENT", target_id: "unrelated-comment" },
      ]);
      expect(sqlite.prepare("SELECT id FROM media_assets").all()).toEqual([]);
      expect(deleted).toEqual(["posts/post-media", "comments/comment-media"]);
    } finally {
      sqlite.close();
    }
  });

  it("does not delete a post image row still referenced by another profile surface", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE posts (id TEXT PRIMARY KEY, image_asset_id TEXT NOT NULL, deleted_at INTEGER);
        CREATE TABLE user_profiles (avatar_asset_id TEXT, banner_asset_id TEXT);
        CREATE TABLE comments (id TEXT, post_id TEXT, attachment_json TEXT);
        CREATE TABLE reactions (target_type TEXT, target_id TEXT);
        CREATE TABLE emote_catalog (asset_key TEXT);
        CREATE TABLE sticker_catalog (asset_key TEXT);
        CREATE TABLE media_assets (
          id TEXT PRIMARY KEY, r2_key TEXT NOT NULL, status TEXT NOT NULL,
          deleted_at INTEGER, purpose TEXT NOT NULL
        );
        INSERT INTO media_assets VALUES ('shared-media', 'posts/shared-media', 'ACTIVE', NULL, 'POST_IMAGE');
        INSERT INTO posts VALUES ('post-1', 'shared-media', 1);
        INSERT INTO user_profiles VALUES ('shared-media', NULL);
      `);
      const { bucket, deleted } = createBucket();

      await expect(
        purgeExpiredPosts(createD1(sqlite), bucket, 24 * 60 * 60 * 1000 + 1),
      ).resolves.toBe(1);

      expect(sqlite.prepare("SELECT id FROM media_assets").all()).toEqual([{ id: "shared-media" }]);
      expect(deleted).toEqual([]);
    } finally {
      sqlite.close();
    }
  });
});
