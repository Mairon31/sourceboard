import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createModerationService } from "../../worker/moderation/service";

const route = readFileSync(
  new URL("../../app/routes/admin-moderation.tsx", import.meta.url),
  "utf8",
);

describe("admin moderation queue presentation contract", () => {
  it("exposes direct View navigation and contextual Details without row fetches", () => {
    expect(route).toContain("report.resourceUrl");
    expect(route).toContain("common.view");
    expect(route).toContain("admin.moderation.details");
    expect(route).toContain("reporterUsername");
    expect(route).toContain("reportedUsername");
    expect(route).toContain("moderationHistory");
    expect(route).toContain("<Modal");
  });

  it("keeps comment navigation anchored to the reported comment", () => {
    expect(route).toContain("postTitle");
    expect(route).toContain("commentBody");
  });
});

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  function prepare(query: string) {
    let bindings: unknown[] = [];
    const statement = {
      bind(...values: unknown[]) {
        bindings = values;
        return statement;
      },
      async all<T>() {
        return {
          results: sqlite.prepare(query).all(...(bindings as never[])) as T[],
        } as D1Result<T>;
      },
    };
    return statement;
  }
  return { prepare } as unknown as D1Database;
}

describe("admin moderation history persistence", () => {
  it("includes moderation actions in the single queue read used by Details", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL);
        CREATE TABLE moderation_reports (
          id TEXT PRIMARY KEY, reporter_user_id TEXT NOT NULL, target_type TEXT NOT NULL,
          target_id TEXT NOT NULL, category TEXT NOT NULL, detail TEXT, status TEXT NOT NULL,
          assignee_user_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        );
        CREATE TABLE posts (id TEXT PRIMARY KEY, author_id TEXT NOT NULL, slug TEXT, title TEXT);
        CREATE TABLE comments (id TEXT PRIMARY KEY, author_id TEXT, post_id TEXT, body_plaintext TEXT);
        CREATE TABLE source_resolutions (id TEXT PRIMARY KEY, post_id TEXT, comment_id TEXT, canonical_source_url TEXT);
        CREATE TABLE audit_logs (
          id TEXT PRIMARY KEY, actor_user_id TEXT, action TEXT, reason TEXT,
          target_type TEXT, target_id TEXT, created_at INTEGER
        );
        CREATE TABLE moderation_actions (
          id TEXT PRIMARY KEY, actor_user_id TEXT, action TEXT, reason TEXT,
          target_type TEXT, target_id TEXT, created_at INTEGER
        );
        INSERT INTO users VALUES ('reporter-1', 'reporter'), ('author-1', 'author'), ('moderator-1', 'moderator');
        INSERT INTO posts VALUES ('post-1', 'author-1', 'source-request', 'Find this source');
        INSERT INTO moderation_reports VALUES
          ('report-1', 'reporter-1', 'POST', 'post-1', 'SPAM', 'Repeated spam', 'IN_REVIEW', 'moderator-1', 100, 110);
        INSERT INTO moderation_actions VALUES
          ('action-1', 'moderator-1', 'HIDE', 'Repeated spam', 'POST', 'post-1', 110);
      `);

      const reports = await createModerationService(createSqliteD1(sqlite)).listQueue();

      expect(reports[0]?.moderationHistory).toEqual([
        expect.objectContaining({
          id: "action-1",
          kind: "ACTION",
          action: "HIDE",
          actorUsername: "moderator",
        }),
      ]);
    } finally {
      sqlite.close();
    }
  });
});
