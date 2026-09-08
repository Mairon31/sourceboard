import { createD1ProfileStore } from "../../worker/profile/store";
import { createD1PostStore } from "../../worker/posts/store";
import { createPostService } from "../../worker/posts/service";
import type { FeedKind } from "../../worker/posts/types";
import { readViewerLikedPostIds } from "../data/viewer-post-likes";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";

interface LoaderArgs extends ServerLoaderArgs {
  params: { kind?: string };
}

function parseFeedKind(value: string | undefined): FeedKind | null {
  return value === "recent" || value === "friends" || value === "answered" || value === "verified"
    ? value
    : null;
}

export async function loader({ request, context, params }: LoaderArgs) {
  const kind = parseFeedKind(params.kind);
  if (!kind) {
    return Response.json({ error: "Invalid feed." }, { status: 400 });
  }

  const result = await withOptionalServerSession(
    request,
    context,
    (unavailable) => ({ unavailable, posts: [] }),
    async (runtime, userId) => {
      const service = createPostService({
        store: createD1PostStore(runtime.db),
        profileStore: createD1ProfileStore(runtime.db),
      });
      const feed = await service.listFeed({ viewerId: userId, kind, cursor: null, limit: 20 });
      const likedIds = await readViewerLikedPostIds(
        runtime.db,
        userId,
        feed.posts.map((post) => post.id),
      );
      return {
        unavailable: false,
        posts: feed.posts.map((post) => ({
          ...post,
          reaction: { ...post.reaction, viewerReacted: likedIds.has(post.id) },
        })),
      };
    },
  );

  return Response.json(result, {
    headers: { "cache-control": "private, no-store" },
  });
}
