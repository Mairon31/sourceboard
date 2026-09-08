import { decodePostCursor, encodePostCursor } from "../posts/pagination";
import { isPostError } from "../posts/errors";
import type { EquippedCosmetics, ProfileStore } from "../profile/store";
import type {
  AcceptedSourceView,
  PostSummary,
  VerifiedSourceView,
} from "../../shared/ui/contracts";
import { SearchError } from "./errors";

export type SearchKind = "posts" | "profiles" | "sources" | "all";
export type SearchFilter = "recent" | "relevant" | "open" | "unanswered" | "answered" | "verified";

export interface SearchInput {
  viewerId: string | null;
  query: string;
  kind: SearchKind;
  filter: SearchFilter;
  postCursor: string | null;
  profileCursor: string | null;
  limit: number;
}

export interface ProfileSearchResult {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  cosmetics?: EquippedCosmetics;
}

export interface SearchResult {
  query: string;
  kind: SearchKind;
  filter: SearchFilter;
  posts: PostSummary[];
  profiles: ProfileSearchResult[];
  nextPostCursor: string | null;
  nextProfileCursor: string | null;
}

export interface SearchService {
  search(input: SearchInput): Promise<SearchResult>;
}

export interface SearchServiceDependencies {
  db: D1Database;
  profileStore: Pick<ProfileStore, "getPreferences" | "getEquippedCosmetics">;
  now?: () => number;
}

interface PostSearchRow {
  id: string;
  author_id: string;
  author_mode: string;
  author_profile_visible: number;
  author_username: string;
  author_display_name: string | null;
  author_avatar_asset_id: string | null;
  is_nsfw: number;
  title: string;
  slug: string;
  description: string;
  visibility: string;
  status: string;
  comment_count: number;
  like_count: number;
  created_at: number;
  media_id: string;
  media_width: number | null;
  media_height: number | null;
  accepted_comment_id: string | null;
  accepted_canonical_url: string | null;
  accepted_created_at: number | null;
  verified_comment_id: string | null;
  verified_canonical_url: string | null;
  verified_evidence_note: string | null;
  verified_created_at: number | null;
  verified_by_username: string | null;
}

interface ProfileSearchRow {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_asset_id: string | null;
  profile_updated_at: number;
}

const MAX_QUERY_LENGTH = 120;
const MAX_SEARCH_LIMIT = 30;
const MAX_FTS_TOKENS = 8;

export function sanitizeSearchQuery(value: string): { display: string; fts: string | null } {
  const display = value.normalize("NFKC").trim().slice(0, MAX_QUERY_LENGTH);
  const tokens = display.match(/[\p{L}\p{N}_-]+/gu)?.slice(0, MAX_FTS_TOKENS) ?? [];
  if (!tokens.length) return { display, fts: null };
  return {
    display,
    fts: tokens.map((token) => `"${token.replaceAll('"', '""')}"*`).join(" AND "),
  };
}

function safeLimit(value: number): number {
  if (!Number.isFinite(value)) return 20;
  return Math.min(Math.max(1, Math.floor(value)), MAX_SEARCH_LIMIT);
}

function decodeCursor(value: string | null) {
  if (!value) return null;
  try {
    return decodePostCursor(value);
  } catch (error) {
    if (isPostError(error)) {
      throw new SearchError(400, "INVALID_CURSOR", "The search cursor is invalid.");
    }
    throw error;
  }
}

function postStatus(value: string): PostSummary["status"] {
  if (value === "ANSWERED" || value === "VERIFIED" || value === "ARCHIVED" || value === "LOCKED") {
    return value;
  }
  return "OPEN";
}

function postVisibility(value: string): PostSummary["visibility"] {
  if (value === "FRIENDS_ONLY" || value === "UNLISTED" || value === "PRIVATE") return value;
  return "PUBLIC";
}

function acceptedSource(row: PostSearchRow): AcceptedSourceView | undefined {
  if (!row.accepted_comment_id) return undefined;
  return {
    commentId: row.accepted_comment_id,
    canonicalUrl: row.accepted_canonical_url ?? undefined,
    acceptedAt: new Date(row.accepted_created_at ?? row.created_at).toISOString(),
    label: "Accepted Source",
  };
}

function verifiedSource(row: PostSearchRow): VerifiedSourceView | undefined {
  if (!row.verified_comment_id || !row.verified_canonical_url) return undefined;
  return {
    commentId: row.verified_comment_id,
    canonicalUrl: row.verified_canonical_url,
    evidenceSummary: row.verified_evidence_note ?? "Verified source",
    verifiedAt: new Date(row.verified_created_at ?? row.created_at).toISOString(),
    verifierLabel: row.verified_by_username ?? "Source verifier",
    label: "Verified Source",
  };
}

function toPostSummary(
  row: PostSearchRow,
  blurNsfw: boolean,
  cosmetics?: EquippedCosmetics,
): PostSummary {
  const anonymous = row.author_mode === "ANONYMOUS";
  const profileVisible = !anonymous && row.author_profile_visible === 1;
  const author = anonymous
    ? { mode: "ANONYMOUS" as const, displayName: "Anonymous Author" }
    : !profileVisible
      ? { mode: "IDENTIFIED" as const, displayName: "SourceBoard member" }
      : {
          mode: "IDENTIFIED" as const,
          displayName: row.author_display_name ?? row.author_username,
          username: row.author_username,
          avatarUrl: row.author_avatar_asset_id
            ? `/api/media/profile/${encodeURIComponent(row.author_avatar_asset_id)}`
            : undefined,
          profileUrl: `/u/${encodeURIComponent(row.author_username)}`,
          avatarFrame: cosmetics?.avatarFrame,
          profileEffect: cosmetics?.profileEffect,
          nameFont: cosmetics?.nameFont,
          nameEffect: cosmetics?.nameEffect,
          visuals: cosmetics?.visuals,
        };
  const nsfwPresentation = row.is_nsfw === 1 && blurNsfw ? "BLURRED" : "VISIBLE";
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || undefined,
    author,
    createdAt: new Date(row.created_at).toISOString(),
    status: postStatus(row.status),
    visibility: postVisibility(row.visibility),
    isNsfw: row.is_nsfw === 1,
    nsfwPresentation,
    reaction: { type: "LIKE", count: row.like_count, viewerReacted: false },
    commentCount: row.comment_count,
    imageAlt: row.title,
    imageUrl: `/api/media/post/${encodeURIComponent(row.media_id)}`,
    imageWidth: row.media_width ?? undefined,
    imageHeight: row.media_height ?? undefined,
    acceptedSource: acceptedSource(row),
    verifiedSource: verifiedSource(row),
  };
}

function sourceJoins(): string {
  return `
    LEFT JOIN source_resolutions accepted_source
      ON accepted_source.post_id = p.id
     AND accepted_source.resolution_type = 'ACCEPTED'
     AND accepted_source.state = 'ACTIVE'
    LEFT JOIN source_resolutions verified_source
      ON verified_source.post_id = p.id
     AND verified_source.resolution_type = 'VERIFIED'
     AND verified_source.state = 'ACTIVE'
    LEFT JOIN users verifier ON verifier.id = verified_source.actor_user_id`;
}

function postSearchQuery(
  ftsQuery: string,
  viewerId: string | null,
  kind: SearchKind,
  filter: SearchFilter,
  cursor: ReturnType<typeof decodeCursor>,
  limit: number,
  hideNsfw: boolean,
): { sql: string; bindings: unknown[] } {
  const profileVisibility = viewerId
    ? `CASE
         WHEN up.profile_visibility = 'PUBLIC'
           OR p.author_id = ?
           OR EXISTS (
             SELECT 1 FROM friendships f
             WHERE f.status = 'ACCEPTED'
               AND ((f.requester_id = ? AND f.addressee_id = p.author_id)
                 OR (f.addressee_id = ? AND f.requester_id = p.author_id))
           )
         THEN 1 ELSE 0 END`
    : `CASE WHEN up.profile_visibility = 'PUBLIC' THEN 1 ELSE 0 END`;
  const conditions = [
    "public_post_search MATCH ?",
    "p.visibility = 'PUBLIC'",
    "p.deleted_at IS NULL",
    "p.hidden_at IS NULL",
    "p.status <> 'ARCHIVED'",
    "m.status = 'ACTIVE'",
    "m.purpose = 'POST_IMAGE'",
    "u.status NOT IN ('DELETED', 'BANNED')",
  ];
  const bindings: unknown[] = viewerId ? [viewerId, viewerId, viewerId, ftsQuery] : [ftsQuery];
  if (kind === "sources") conditions.push("accepted_source.comment_id IS NOT NULL");
  if (filter === "open" || filter === "unanswered") conditions.push("p.status = 'OPEN'");
  if (filter === "answered") conditions.push("p.status IN ('ANSWERED', 'VERIFIED')");
  if (filter === "verified") conditions.push("p.status = 'VERIFIED'");
  if (hideNsfw) conditions.push("p.is_nsfw = 0");
  if (viewerId) {
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM user_blocks b
      WHERE (b.blocker_id = ? AND b.blocked_id = p.author_id)
         OR (b.blocker_id = p.author_id AND b.blocked_id = ?)
    )`);
    bindings.push(viewerId, viewerId);
  }
  if (cursor && filter !== "relevant") {
    conditions.push("(p.created_at < ? OR (p.created_at = ? AND p.id < ?))");
    bindings.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  bindings.push(limit + 1);
  const orderBy =
    filter === "relevant"
      ? "bm25(public_post_search) ASC, p.created_at DESC, p.id DESC"
      : "p.created_at DESC, p.id DESC";
  return {
    sql: `SELECT
      p.id,
      p.author_id,
      p.author_mode,
      ${profileVisibility} AS author_profile_visible,
      u.username AS author_username,
      up.display_name AS author_display_name,
      up.avatar_asset_id AS author_avatar_asset_id,
      p.is_nsfw,
      p.title,
      p.slug,
      p.description,
      p.visibility,
      p.status,
      p.comment_count,
      p.like_count,
      p.created_at,
      m.id AS media_id,
      m.width AS media_width,
      m.height AS media_height,
      accepted_source.comment_id AS accepted_comment_id,
      accepted_source.canonical_source_url AS accepted_canonical_url,
      accepted_source.created_at AS accepted_created_at,
      verified_source.comment_id AS verified_comment_id,
      verified_source.canonical_source_url AS verified_canonical_url,
      verified_source.evidence_note AS verified_evidence_note,
      verified_source.created_at AS verified_created_at,
      verifier.username AS verified_by_username
    FROM public_post_search
    JOIN posts p ON p.id = public_post_search.post_id
    JOIN users u ON u.id = p.author_id
    LEFT JOIN user_profiles up ON up.user_id = p.author_id
    JOIN media_assets m ON m.id = p.image_asset_id
    ${sourceJoins()}
    WHERE ${conditions.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT ?`,
    bindings,
  };
}

function profileSearchQuery(
  ftsQuery: string,
  viewerId: string | null,
  cursor: ReturnType<typeof decodeCursor>,
  limit: number,
  relevant: boolean,
): { sql: string; bindings: unknown[] } {
  const conditions = [
    "public_profile_search MATCH ?",
    "u.status NOT IN ('DELETED', 'BANNED')",
    "p.profile_visibility = 'PUBLIC'",
  ];
  const bindings: unknown[] = [ftsQuery];
  if (viewerId) {
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM user_blocks b
      WHERE (b.blocker_id = ? AND b.blocked_id = u.id)
         OR (b.blocker_id = u.id AND b.blocked_id = ?)
    )`);
    bindings.push(viewerId, viewerId);
  }
  if (cursor && !relevant) {
    conditions.push("(p.updated_at < ? OR (p.updated_at = ? AND u.id < ?))");
    bindings.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  bindings.push(limit + 1);
  const orderBy = relevant
    ? "bm25(public_profile_search) ASC, p.updated_at DESC, u.id DESC"
    : "p.updated_at DESC, u.id DESC";
  return {
    sql: `SELECT
      u.id,
      u.username,
      COALESCE(p.display_name, u.username) AS display_name,
      COALESCE(p.bio, '') AS bio,
      a.id AS avatar_asset_id,
      p.updated_at AS profile_updated_at
    FROM public_profile_search
    JOIN users u ON u.id = public_profile_search.user_id
    JOIN user_profiles p ON p.user_id = u.id
    LEFT JOIN media_assets a
      ON a.id = p.avatar_asset_id
     AND a.purpose = 'AVATAR'
     AND a.status = 'ACTIVE'
     AND a.deleted_at IS NULL
    WHERE ${conditions.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT ?`,
    bindings,
  };
}

async function cosmeticsForUsers(
  store: Pick<ProfileStore, "getEquippedCosmetics">,
  userIds: string[],
): Promise<Map<string, EquippedCosmetics>> {
  const uniqueIds = [...new Set(userIds)];
  return new Map(
    await Promise.all(
      uniqueIds.map(async (userId) => [
        userId,
        await store.getEquippedCosmetics(userId).catch(() => ({})),
      ] as const),
    ),
  );
}

export function createSearchService(dependencies: SearchServiceDependencies): SearchService {
  const now = dependencies.now ?? (() => Date.now());

  return {
    async search(input) {
      const { display, fts } = sanitizeSearchQuery(input.query);
      const result: SearchResult = {
        query: display,
        kind: input.kind,
        filter: input.filter,
        posts: [],
        profiles: [],
        nextPostCursor: null,
        nextProfileCursor: null,
      };
      if (!fts) return result;

      const limit = safeLimit(input.limit);
      const postCursor = decodeCursor(input.postCursor);
      const profileCursor = decodeCursor(input.profileCursor);
      const preferences = input.viewerId
        ? await dependencies.profileStore.getPreferences(input.viewerId, now())
        : null;
      const hideNsfw =
        !input.viewerId || Boolean(preferences?.hideNsfw && !preferences.allowNsfwDirectOverride);
      const blurNsfw = Boolean(preferences?.blurNsfw);

      const postQuery = postSearchQuery(
        fts,
        input.viewerId,
        input.kind,
        input.filter,
        postCursor,
        limit,
        hideNsfw,
      );
      const profileQuery = profileSearchQuery(
        fts,
        input.viewerId,
        profileCursor,
        limit,
        input.filter === "relevant",
      );

      const postPromise =
        input.kind === "profiles"
          ? Promise.resolve({ results: [] as PostSearchRow[] })
          : dependencies.db
              .prepare(postQuery.sql)
              .bind(...postQuery.bindings)
              .all<PostSearchRow>();
      const profilePromise =
        input.kind === "posts" || input.kind === "sources"
          ? Promise.resolve({ results: [] as ProfileSearchRow[] })
          : dependencies.db
              .prepare(profileQuery.sql)
              .bind(...profileQuery.bindings)
              .all<ProfileSearchRow>();
      const [postRows, profileRows] = await Promise.all([postPromise, profilePromise]);
      const cosmetics = await cosmeticsForUsers(dependencies.profileStore, [
        ...postRows.results
          .filter((row) => row.author_mode !== "ANONYMOUS" && row.author_profile_visible === 1)
          .map((row) => row.author_id),
        ...profileRows.results.map((row) => row.id),
      ]);

      const postHasNext = postRows.results.length > limit;
      const visiblePostRows = postHasNext ? postRows.results.slice(0, limit) : postRows.results;
      const lastPost = visiblePostRows.at(-1);
      result.posts = visiblePostRows.map((row) =>
        toPostSummary(row, blurNsfw, cosmetics.get(row.author_id)),
      );
      result.nextPostCursor =
        input.filter !== "relevant" && postHasNext && lastPost
          ? encodePostCursor({ createdAt: lastPost.created_at, id: lastPost.id })
          : null;

      const profileHasNext = profileRows.results.length > limit;
      const visibleProfileRows = profileHasNext
        ? profileRows.results.slice(0, limit)
        : profileRows.results;
      const lastProfile = visibleProfileRows.at(-1);
      result.profiles = visibleProfileRows.map((row) => ({
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        bio: row.bio,
        avatarUrl: row.avatar_asset_id
          ? `/api/media/profile/${encodeURIComponent(row.avatar_asset_id)}`
          : undefined,
        ...(Object.keys(cosmetics.get(row.id) ?? {}).length
          ? { cosmetics: cosmetics.get(row.id) }
          : {}),
      }));
      result.nextProfileCursor =
        input.filter !== "relevant" && profileHasNext && lastProfile
          ? encodePostCursor({ createdAt: lastProfile.profile_updated_at, id: lastProfile.id })
          : null;
      return result;
    },
  };
}
