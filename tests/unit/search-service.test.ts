import { describe, expect, it, vi } from "vitest";
import { encodePostCursor } from "../../worker/posts/pagination";
import { createSearchService, sanitizeSearchQuery } from "../../worker/search/service";
import type { UserPreferenceRecord } from "../../worker/profile/types";

function preferences(overrides: Partial<UserPreferenceRecord> = {}): UserPreferenceRecord {
  return {
    userId: "viewer-1",
    hideNsfw: true,
    blurNsfw: true,
    allowNsfwDirectOverride: false,
    allowFriendRequests: true,
    notifyActivity: true,
    notifyFriendships: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function fakeDatabase() {
  const prepared: Array<{ sql: string; bindings: unknown[] }> = [];
  const postRows = [
    {
      id: "post-anonymous",
      author_id: "author-1",
      author_mode: "ANONYMOUS",
      author_profile_visible: 1,
      author_username: "private-author",
      author_display_name: "Private Author",
      author_avatar_asset_id: "avatar-1",
      is_nsfw: 0,
      title: "Find this source",
      slug: "find-this-source",
      description: "A public source request.",
      visibility: "PUBLIC",
      status: "OPEN",
      comment_count: 2,
      like_count: 3,
      created_at: 1_000,
      updated_at: 1_100,
      media_id: "asset-1",
      media_width: 640,
      media_height: 480,
      accepted_comment_id: null,
      accepted_canonical_url: null,
      accepted_created_at: null,
      verified_comment_id: null,
      verified_canonical_url: null,
      verified_evidence_note: null,
      verified_created_at: null,
      verified_by_username: null,
    },
  ];
  const profileRows = [
    {
      id: "author-2",
      username: "public-person",
      display_name: "Public Person",
      bio: "Tracing public sources.",
      avatar_asset_id: null,
      profile_updated_at: 900,
    },
  ];
  const db = {
    prepare: vi.fn((sql: string) => {
      const state = { bindings: [] as unknown[] };
      const statement = {
        bind: vi.fn((...bindings: unknown[]) => {
          state.bindings = bindings;
          return statement;
        }),
        all: vi.fn(async <T>() => {
          prepared.push({ sql, bindings: state.bindings });
          return {
            results: (sql.includes("public_profile_search") ? profileRows : postRows) as T[],
          };
        }),
      };
      return statement;
    }),
  };
  return { db, prepared };
}

describe("Phase 12 search service", () => {
  it("quotes FTS tokens and strips operators instead of passing raw syntax to SQLite", () => {
    const query = sanitizeSearchQuery('source OR title author:* "private"');

    expect(query.display).toBe('source OR title author:* "private"');
    expect(query.fts).toBe('"source"* AND "OR"* AND "title"* AND "author"* AND "private"*');
    expect(query.fts).not.toContain(":*");
  });

  it("uses public FTS queries, cursor pagination and server-side NSFW filtering", async () => {
    const { db, prepared } = fakeDatabase();
    const service = createSearchService({
      db: db as unknown as D1Database,
      profileStore: {
        getPreferences: vi.fn(async () => preferences()),
        getEquippedCosmetics: vi.fn(async () => ({})),
      },
      now: () => 2,
    });

    const result = await service.search({
      viewerId: "viewer-1",
      query: "source",
      kind: "all",
      filter: "recent",
      postCursor: encodePostCursor({ createdAt: 900, id: "post-0" }),
      profileCursor: null,
      limit: 20,
    });

    expect(result.posts[0]?.author).toEqual({
      mode: "ANONYMOUS",
      displayName: "Anonymous Author",
    });
    expect(result.posts[0]?.author.username).toBeUndefined();
    expect(result.posts[0]?.updatedAt).toBe(new Date(1_100).toISOString());
    expect(result.profiles[0]?.username).toBe("public-person");
    expect(prepared).toHaveLength(2);
    const postQuery = prepared.find(({ sql }) => sql.includes("public_post_search"));
    const profileQuery = prepared.find(({ sql }) => sql.includes("public_profile_search"));
    expect(postQuery?.sql).toContain("public_post_search MATCH ?");
    expect(postQuery?.sql).toContain("p.visibility = 'PUBLIC'");
    expect(postQuery?.sql).toContain("p.is_nsfw = 0");
    expect(postQuery?.sql).toContain("p.created_at < ?");
    expect(postQuery?.sql).toContain("p.updated_at");
    expect(postQuery?.sql).not.toMatch(/LIKE\s+['"]?%/i);
    expect(profileQuery?.sql).toContain("p.profile_visibility = 'PUBLIC'");
    expect(profileQuery?.sql).toContain("public_profile_search MATCH ?");
    expect(result.posts[0]?.imageUrl).toBe("/api/media/post/asset-1");
  });

  it("keeps NSFW searchable only when the viewer policy allows it", async () => {
    const { db, prepared } = fakeDatabase();
    const getPreferences = vi.fn(async () => preferences({ hideNsfw: false, blurNsfw: true }));
    const service = createSearchService({
      db: db as unknown as D1Database,
      profileStore: {
        getPreferences,
        getEquippedCosmetics: vi.fn(async () => ({})),
      },
      now: () => 2,
    });

    await service.search({
      viewerId: "viewer-1",
      query: "source",
      kind: "posts",
      filter: "recent",
      postCursor: null,
      profileCursor: null,
      limit: 20,
    });

    expect(getPreferences).toHaveBeenCalledWith("viewer-1", 2);
    expect(prepared[0]?.sql).not.toContain("p.is_nsfw = 0");
  });
});
