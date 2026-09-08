import { useEffect } from "react";
import { readCsrfToken } from "../data/csrf";
import {
  isRouteErrorResponse,
  redirect,
  useLoaderData,
  useLocation,
  useRevalidator,
  useRouteError,
  type MetaFunction,
} from "react-router";
import type { CommentView } from "../../shared/ui/contracts";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createD1PostStore } from "../../worker/posts/store";
import { createPostService } from "../../worker/posts/service";
import { createD1CommentStore } from "../../worker/comments/store";
import { createCommentService } from "../../worker/comments/service";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";
import { PostCard } from "../components/product/PostCard";
import { CommentThread } from "../components/product/CommentThread";
import { ProductShell, PageHeader } from "../components/product/ProductShell";
import { Card } from "../components/ui";
import { SourceResolution } from "../components/product/SourceResolution";

interface LoaderArgs extends ServerLoaderArgs {
  params: { postId?: string; slug?: string };
  url: URL;
}

export async function loader({ params, request, context, url }: LoaderArgs) {
  const requested = url;
  const result = await withOptionalServerSession(
    request,
    context,
    (unavailable) => ({
      post: null,
      unavailable,
      authenticated: false,
      canonicalUrl: requested.toString(),
    }),
    async (runtime, userId) => {
      const service = createPostService({
        store: createD1PostStore(runtime.db),
        profileStore: createD1ProfileStore(runtime.db),
      });
      const commentService = createCommentService({
        store: createD1CommentStore(runtime.db),
        postStore: createD1PostStore(runtime.db),
        profileStore: createD1ProfileStore(runtime.db),
      });
      const postId = params.postId ?? "";
      const commentsPromise = commentService.listForPost(postId, userId, null, 50).then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, error }),
      );
      const [post, commentsResult] = await Promise.all([
        service.getPost(postId, userId),
        commentsPromise,
      ]);
      if (post && !commentsResult.ok) throw commentsResult.error;
      const comments = commentsResult.ok
        ? commentsResult.value
        : { comments: [], nextCursor: null };
      return {
        post: post ? { ...post, comments: comments.comments } : post,
        unavailable: false,
        authenticated: Boolean(userId),
        canonicalUrl: requested.toString(),
      };
    },
  );
  if (result.unavailable || !result.post) {
    if (!result.unavailable) throw new Response("Post not found", { status: 404 });
    return result;
  }
  const canonicalPath = `/posts/${encodeURIComponent(result.post.id)}/${encodeURIComponent(result.post.slug ?? "")}`;
  const canonicalUrl = new URL(canonicalPath, requested).toString();
  if (params.slug !== result.post.slug || requested.pathname !== canonicalPath) {
    throw redirect(canonicalUrl, { status: 301 });
  }
  return { ...result, canonicalUrl };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const post = loaderData?.post;
  if (
    !post ||
    loaderData.unavailable ||
    post.visibility !== "PUBLIC" ||
    post.nsfwPresentation === "HIDDEN"
  ) {
    return [
      { title: post ? `${post.title} · SourceBoard` : "Post unavailable · SourceBoard" },
      { name: "robots", content: "noindex, nofollow" },
    ];
  }
  const description = post.description ?? "Find the original source of an image with SourceBoard.";
  const author =
    post.author.mode === "ANONYMOUS"
      ? { "@type": "Person", name: "Anonymous Author" }
      : {
          "@type": "Person",
          name: post.author.displayName,
          ...(post.author.username ? { url: post.author.profileUrl } : {}),
        };
  const imageUrl = post.imageUrl
    ? new URL(post.imageUrl, loaderData.canonicalUrl).toString()
    : undefined;
  return [
    { title: `${post.title} · SourceBoard` },
    { name: "description", content: description.slice(0, 180) },
    { name: "robots", content: "index, follow" },
    { tagName: "link", rel: "canonical", href: loaderData.canonicalUrl },
    { property: "og:type", content: "article" },
    { property: "og:title", content: post.title },
    { property: "og:description", content: description.slice(0, 180) },
    ...(imageUrl ? [{ property: "og:image", content: imageUrl }] : []),
    { name: "twitter:card", content: imageUrl ? "summary_large_image" : "summary" },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "DiscussionForumPosting",
        headline: post.title,
        articleBody: description,
        datePublished: post.createdAt,
        mainEntityOfPage: loaderData.canonicalUrl,
        author,
        ...(imageUrl ? { image: imageUrl } : {}),
      },
    },
  ];
};

function findComment(comments: CommentView[], id?: string): CommentView | undefined {
  if (!id) return undefined;
  for (const comment of comments) {
    if (comment.id === id) return comment;
    const reply = findComment(comment.replies, id);
    if (reply) return reply;
  }
  return undefined;
}

function UnavailablePost({ unavailable }: { unavailable: boolean }) {
  return (
    <ProductShell>
      <Card className="product-empty-state">
        <PageHeader
          eyebrow="Source request"
          title={unavailable ? "Post service unavailable" : "Post not found"}
          description={
            unavailable
              ? "The post service is not configured in this environment yet."
              : "This request may have been deleted, hidden or never existed."
          }
        />
        <p>No private post data was returned to the browser.</p>
      </Card>
    </ProductShell>
  );
}

export default function PostDetailRoute() {
  const { post, unavailable, authenticated } = useLoaderData<LoaderData>();
  const location = useLocation();
  const revalidator = useRevalidator();

  useEffect(() => {
    if (!location.hash) return;
    if (location.hash === "#comments") {
      document.getElementById("comments")?.scrollIntoView({ behavior: "auto", block: "start" });
      if (!authenticated) return;
      window.requestAnimationFrame(() => {
        const composer = document.getElementById("comment-composer");
        if (composer instanceof HTMLElement) composer.focus({ preventScroll: true });
      });
      return;
    }
    if (!location.hash.startsWith("#comment-")) return;
    const id = decodeURIComponent(location.hash.slice(1));
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "auto", block: "center" });
    target.classList.add("product-comment--deeplink-target");
    const timer = window.setTimeout(
      () => target.classList.remove("product-comment--deeplink-target"),
      1800,
    );
    return () => window.clearTimeout(timer);
  }, [authenticated, location.hash]);

  if (!post) return <UnavailablePost unavailable={unavailable} />;
  const currentPost = post;
  const acceptedComment = findComment(currentPost.comments, currentPost.acceptedSource?.commentId);

  async function acceptSource(commentId: string) {
    const response = await fetch(`/api/posts/${encodeURIComponent(currentPost.id)}/source/accept`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
      body: JSON.stringify({ commentId }),
    });
    if (response.ok) revalidator.revalidate();
  }

  return (
    <ProductShell>
      <PageHeader
        eyebrow="Source request"
        title={currentPost.title}
        description="One image, one focused question and an auditable path to the original source."
      />
      <PostCard post={currentPost} manage onChanged={() => revalidator.revalidate()} />
      <SourceResolution
        accepted={currentPost.acceptedSource}
        acceptedComment={acceptedComment}
        verified={currentPost.verifiedSource}
      />
      <CommentThread
        postId={currentPost.id}
        comments={currentPost.comments}
        authenticated={authenticated}
        commentsClosed={currentPost.commentsClosed}
        canAcceptSource={currentPost.permissions.canAcceptSource}
        onAcceptSource={(commentId) => void acceptSource(commentId)}
      />
    </ProductShell>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return <UnavailablePost unavailable={!notFound} />;
}
