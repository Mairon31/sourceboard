import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../migrations/0013_public_search.sql", import.meta.url),
  "utf8",
);

describe("Phase 12 public search index contract", () => {
  it("defines FTS5 projections and privacy-preserving synchronization triggers", () => {
    expect(migration).toContain("CREATE VIRTUAL TABLE IF NOT EXISTS public_post_search USING fts5");
    expect(migration).toContain(
      "CREATE VIRTUAL TABLE IF NOT EXISTS public_profile_search USING fts5",
    );
    expect(migration).toContain("p.visibility = 'PUBLIC'");
    expect(migration).toContain("p.profile_visibility = 'PUBLIC'");
    expect(migration).toContain("public_post_search_comments_au");
    expect(migration).toContain("public_profile_search_profiles_au");
    expect(migration).toContain("u.status NOT IN ('DELETED', 'BANNED')");
  });

  it("keeps archived public posts in the FTS projection after the forward fix", () => {
    const archivedPostMigration = readFileSync(
      new URL("../../migrations/0037_public_search_archived_posts.sql", import.meta.url),
      "utf8",
    );
    expect(archivedPostMigration).toContain("DELETE FROM public_post_search");
    expect(archivedPostMigration).toContain("CREATE TRIGGER public_post_search_posts_au");
    expect(archivedPostMigration).toContain("CREATE TRIGGER public_post_search_comments_ai");
    expect(archivedPostMigration).not.toContain("status <> 'ARCHIVED'");
    expect(archivedPostMigration).not.toContain("archived_at IS NULL");
  });
});
