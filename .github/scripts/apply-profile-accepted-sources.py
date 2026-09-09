from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one replacement target, found {count}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    "worker/posts/store.ts",
    '''  listByAuthor(input: {
    authorId: string;
    cursor: PostCursor | null;
    limit: number;
  }): Promise<{ posts: PostWithAuthor[]; nextCursor: string | null }>;
  updatePost(input: {''',
    '''  listByAuthor(input: {
    authorId: string;
    cursor: PostCursor | null;
    limit: number;
  }): Promise<{ posts: PostWithAuthor[]; nextCursor: string | null }>;
  listAcceptedByContributor(input: {
    contributorId: string;
    cursor: PostCursor | null;
    limit: number;
  }): Promise<{ posts: PostWithAuthor[]; nextCursor: string | null }>;
  updatePost(input: {''',
)

replace_once(
    "worker/posts/store.ts",
    '''    async updatePost({
      postId,''',
    '''    async listAcceptedByContributor({ contributorId, cursor, limit }) {
      const conditions = [
        "p.accepted_comment_id IS NOT NULL",
        "p.deleted_at IS NULL",
        "p.hidden_at IS NULL",
        "m.status = 'ACTIVE'",
        "m.purpose = 'POST_IMAGE'",
        `EXISTS (
          SELECT 1 FROM comments c
          WHERE c.id = p.accepted_comment_id
            AND c.post_id = p.id
            AND c.author_id = ?
            AND c.state = 'VISIBLE'
        )`,
      ];
      const bindings: unknown[] = [contributorId];
      if (cursor) {
        conditions.push("(p.created_at < ? OR (p.created_at = ? AND p.id < ?))");
        bindings.push(cursor.createdAt, cursor.createdAt, cursor.id);
      }
      const result = await db
        .prepare(
          `${postQuery(conditions.join(" AND "))} ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
        )
        .bind(...bindings, limit + 1)
        .all<PostWithAuthorRow>();
      const hasNextPage = result.results.length > limit;
      const rows = hasNextPage ? result.results.slice(0, limit) : result.results;
      const last = rows.at(-1);
      return {
        posts: rows.map(toPost),
        nextCursor:
          hasNextPage && last
            ? encodePostCursor({ createdAt: last.created_at, id: last.id })
            : null,
      };
    },

    async updatePost({
      postId,''',
)

replace_once(
    "worker/posts/service.ts",
    '''  listProfileActivity(input: {
    authorId: string;
    viewerId: string | null;
    limit: number;
  }): Promise<{ posts: PostSummary[] }>;
  updatePost(''',
    '''  listProfileActivity(input: {
    authorId: string;
    viewerId: string | null;
    limit: number;
  }): Promise<{ posts: PostSummary[]; acceptedSources: PostSummary[] }>;
  updatePost(''',
)

replace_once(
    "worker/posts/service.ts",
    '''async function canListPostOnProfile(
  viewerId: string | null,
  post: PostRecord,
  dependencies: { profileStore: ProfileStore; store: PostStore; now: () => number },
): Promise<boolean> {
  const isOwner = viewerId === post.authorId;
  if (!isOwner && (post.authorMode === "ANONYMOUS" || post.visibility === "UNLISTED")) {
    return false;
  }
  return canViewPost(viewerId, post, dependencies);
}

function authorForPost(''',
    '''async function canListPostOnProfile(
  viewerId: string | null,
  post: PostRecord,
  dependencies: { profileStore: ProfileStore; store: PostStore; now: () => number },
): Promise<boolean> {
  const isOwner = viewerId === post.authorId;
  if (!isOwner && (post.authorMode === "ANONYMOUS" || post.visibility === "UNLISTED")) {
    return false;
  }
  return canViewPost(viewerId, post, dependencies);
}

async function canListAcceptedSourceOnProfile(
  profileOwnerId: string,
  viewerId: string | null,
  post: PostRecord,
  dependencies: { profileStore: ProfileStore; store: PostStore; now: () => number },
): Promise<boolean> {
  if (viewerId !== profileOwnerId && post.visibility === "UNLISTED") return false;
  return canViewPost(viewerId, post, dependencies);
}

function authorForPost(''',
)

replace_once(
    "worker/posts/service.ts",
    '''    async listProfileActivity({ authorId, viewerId, limit }) {
      const safeLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_FEED_LIMIT);
      let decodedCursor = decodePostCursor(null);
      const visible: PostSummary[] = [];
      for (let page = 0; page < 5 && visible.length < safeLimit; page += 1) {
        const result = await dependencies.store.listByAuthor({
          authorId,
          cursor: decodedCursor,
          limit: safeLimit * 2,
        });
        for (const post of result.posts) {
          if (await canListPostOnProfile(viewerId, post.post, policyDependencies)) {
            visible.push(await toPostSummary(post, viewerId, policyDependencies));
            if (visible.length >= safeLimit) break;
          }
        }
        if (!result.nextCursor) break;
        decodedCursor = decodePostCursor(result.nextCursor);
      }
      return { posts: visible };
    },''',
    '''    async listProfileActivity({ authorId, viewerId, limit }) {
      const safeLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_FEED_LIMIT);
      let decodedCursor = decodePostCursor(null);
      const visible: PostSummary[] = [];
      for (let page = 0; page < 5 && visible.length < safeLimit; page += 1) {
        const result = await dependencies.store.listByAuthor({
          authorId,
          cursor: decodedCursor,
          limit: safeLimit * 2,
        });
        for (const post of result.posts) {
          if (await canListPostOnProfile(viewerId, post.post, policyDependencies)) {
            visible.push(await toPostSummary(post, viewerId, policyDependencies));
            if (visible.length >= safeLimit) break;
          }
        }
        if (!result.nextCursor) break;
        decodedCursor = decodePostCursor(result.nextCursor);
      }

      let acceptedCursor = decodePostCursor(null);
      const acceptedSources: PostSummary[] = [];
      for (let page = 0; page < 5 && acceptedSources.length < safeLimit; page += 1) {
        const result = await dependencies.store.listAcceptedByContributor({
          contributorId: authorId,
          cursor: acceptedCursor,
          limit: safeLimit * 2,
        });
        for (const post of result.posts) {
          if (
            await canListAcceptedSourceOnProfile(
              authorId,
              viewerId,
              post.post,
              policyDependencies,
            )
          ) {
            acceptedSources.push(await toPostSummary(post, viewerId, policyDependencies));
            if (acceptedSources.length >= safeLimit) break;
          }
        }
        if (!result.nextCursor) break;
        acceptedCursor = decodePostCursor(result.nextCursor);
      }

      return { posts: visible, acceptedSources };
    },''',
)

replace_once(
    "app/routes/profile.tsx",
    '''      (unavailable) => ({ profile: null, activityPosts: [], unavailable }),''',
    '''      (unavailable) => ({
        profile: null,
        activityPosts: [],
        acceptedSourcePosts: [],
        unavailable,
      }),''',
)

replace_once(
    "app/routes/profile.tsx",
    '''        if (!profile) return { profile: null, activityPosts: [], unavailable: false };''',
    '''        if (!profile) {
          return {
            profile: null,
            activityPosts: [],
            acceptedSourcePosts: [],
            unavailable: false,
          };
        }''',
)

replace_once(
    "app/routes/profile.tsx",
    '''        return { profile, activityPosts: activity.posts, unavailable: false };''',
    '''        return {
          profile,
          activityPosts: activity.posts,
          acceptedSourcePosts: activity.acceptedSources,
          unavailable: false,
        };''',
)

replace_once(
    "app/routes/profile.tsx",
    '''  const { profile, activityPosts, unavailable, canAccessAdmin } = useLoaderData<LoaderData>();''',
    '''  const { profile, activityPosts, acceptedSourcePosts, unavailable, canAccessAdmin } =
    useLoaderData<LoaderData>();''',
)

replace_once(
    "app/routes/profile.tsx",
    '''          <ProfileActivity posts={activityPosts} />''',
    '''          <ProfileActivity posts={activityPosts} acceptedSources={acceptedSourcePosts} />''',
)

component_path = Path("app/components/product/ProfileActivity.tsx")
component_path.write_text('''import { useState } from "react";
import type { PostSummary } from "../../../shared/ui/contracts";
import { PostCard } from "./PostCard";

type ActivityMode = "posts" | "sources";

export function ProfileActivity({
  posts,
  acceptedSources,
}: {
  posts: PostSummary[];
  acceptedSources: PostSummary[];
}) {
  const [mode, setMode] = useState<ActivityMode>("posts");
  const visible = mode === "sources" ? acceptedSources : posts;

  return (
    <section className="product-profile-activity" aria-labelledby="profile-activity-heading">
      <header className="product-profile-activity__header">
        <div>
          <span className="product-eyebrow">Activity</span>
          <h2 id="profile-activity-heading">
            {mode === "sources" ? "Accepted sources" : "Source requests"}
          </h2>
          <p>
            {mode === "sources"
              ? "Requests where this contributor's comment was accepted as the source."
              : "Recent source requests visible to you."}
          </p>
        </div>
        <nav className="product-profile-activity__tabs" aria-label="Profile activity">
          <button
            type="button"
            className={mode === "posts" ? "is-active" : undefined}
            aria-pressed={mode === "posts"}
            onClick={() => setMode("posts")}
          >
            Posts <span>{posts.length}</span>
          </button>
          <button
            type="button"
            className={mode === "sources" ? "is-active" : undefined}
            aria-pressed={mode === "sources"}
            onClick={() => setMode("sources")}
          >
            Accepted <span>{acceptedSources.length}</span>
          </button>
        </nav>
      </header>

      {visible.length ? (
        <div className="product-profile-activity__list">
          {visible.map((post) => (
            <PostCard key={post.id} post={post} compact />
          ))}
        </div>
      ) : (
        <div className="product-empty-state product-empty-state--compact">
          <strong>{mode === "sources" ? "No Accepted Sources yet" : "No visible posts yet"}</strong>
          <p>
            {mode === "sources"
              ? "Accepted source contributions will appear here when available."
              : "Public source requests and posts visible to you will appear here."}
          </p>
        </div>
      )}
    </section>
  );
}
''')
