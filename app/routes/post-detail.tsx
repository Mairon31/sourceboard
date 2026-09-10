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
import type { CommentView, PublicPostAuthor } from "../../shared/ui/contracts";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createD1PostStore } from "../../worker/posts/store";
import { createPostService } from "../../worker/posts/service";
import { createD1CommentStore } from "../../worker/comments/store";
import { createCommentService } from "../../worker/comments/service";
import { parseCommentSort } from "../../worker/comments/types";
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
  const commentSort = parseCommentSort(requested.searchParams.get("comments"));
  const result = await withOptionalServerSession(
    request,
    context,
    (unavailable) => ({
      post: null,
      unavailable,
      authenticated: false,
      viewerIdentity: null as PublicPostAuthor | null,
      commentSort,
      canonicalUrl: requested.toString(),
    }),
    async (runtime, userId) => {
      const profileStore = createD1ProfileStore(runtime.db);
      const postStore = createD1PostStore(runtime.db);
      const service = createPostService({
        store: postStore,
        profileStore,
      });
      const commentService = createCommentService({
        store: createD1CommentStore(runtime.db),
        postStore,
        profileStore,
      });
      const postId = params.postId ?? "";
      const commentsPromise = commentService
        .listForPost(postId, userId, null, 50, commentSort)
        .then(
          (value) => ({ ok: true as const, value }),
          (error: unknown) => ({ ok: false as const, error }),
        );
      const viewerIdentityPromise: Promise<PublicPostAuthor | null> = userId
        ? Promise.all([
            profileStore.getProfileByUserId(userId, Date.now()),
            profileStore.getEquippedCosmetics(userId),
          ]).then(([profile, cosmetics]) =>
            profile
              ? {
                  mode: "IDENTIFIED" as const,
                  displayName: profile.displayName,
                  username: profile.username,
                  avatarUrl: profile.avatarAssetId
                    ? `/api/media/profile/${encodeURIComponent(profile.avatarAssetId)}`
                    : undefined,
                  profileUrl: `/u/${encodeURIComponent(profile.username)}`,
                  avatarFrame: cosmetics.avatarFrame,
                  profileEffect: cosmetics.profileEffect,
                  nameFont: cosmetics.nameFont,
                  nameEffect: cosmetics.nameEffect,
                  visuals: cosmetics.visuals,
                }
              : null,
          )
        : Promise.resolve(null);
      const [post, commentsResult, viewerIdentity] = await Promise.all([
        service.getPost(postId, userId),
        commentsPromise,
        viewerIdentityPromise,
      ]);
      if (post && !commentsResult.ok) throw commentsResult.error;
      const comments = commentsResult.ok
        ? commentsResult.value
        : { comments: [], nextCursor: null };
      return {
        post: post ? { ...post, comments: comments.comments } : post,
        unavailable: false,
        authenticated: Boolean(userId),
        viewerIdentity,
        commentSort,
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
type LoadedPost = NonNullable<LoaderData["post"]>;

function findComment(comments: CommentView[], id?: string): CommentView | undefined {
  if (!id) return undefined;
  for (const comment of comments) {
    if (comment.id === id) return comment;
    const reply = findComment(comment.replies, id);
    if (reply) return reply;
  }
  return undefined;
}

function sourceResolutionJsonLd(post: LoadedPost, pageUrl: string) {
  const resolution = post.verifiedSource ?? post.acceptedSource;
  if (!resolution) return undefined;
  const acceptedComment = findComment(post.comments, resolution.commentId);
  const canonicalSourceUrl = post.verifiedSource?.canonicalUrl ?? post.acceptedSource?.canonicalUrl;
  const verified = Boolean(post.verifiedSource);
  const evidence = post.verifiedSource?.evidenceSummary || acceptedComment?.body;
  const properties: Array<Record<string, unknown>> = [
    {
      "@type": "PropertyValue",
      name: "SourceBoard source status",
      value: verified ? "VERIFIED" : "ACCEPTED",
    },
  ];
  if (post.acceptedSource?.acceptedAt) {
    properties.push({
      "@type": "PropertyValue",
      name: "Accepted at",
      value: post.acceptedSource.acceptedAt,
    });
  }
  if (post.verifiedSource?.verifiedAt) {
    properties.push({
      "@type": "PropertyValue",
      name: "Verified at",
      value: post.verifiedSource.verifiedAt,
    });
  }
  if (post.verifiedSource?.verifierLabel) {
    properties.push({
      "@type": "PropertyValue",
      name: "Verification authority",
      value: post.verifiedSource.verifierLabel,
    });
  }
  const contributor =
    acceptedComment?.author.mode === "IDENTIFIED"
      ? {
          "@type": "Person",
          name: acceptedComment.author.displayName,
          ...(acceptedComment.author.profileUrl ? { url: acceptedComment.author.profileUrl } : {}),
        }
      : undefined;
  return {
    "@type": "CreativeWork",
    "@id": `${pageUrl}#accepted-source`,
    name: verified ? "Verified original-source resolution" : "Accepted source resolution",
    ...(canonicalSourceUrl ? { url: canonicalSourceUrl } : {}),
    ...(evidence ? { description: evidence.slice(0, 1000) } : {}),
    ...(contributor ? { contributor } : {}),
    additionalProperty: properties,
  };
}

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const post = loaderData?.post;
  if (
    !post ||
    loaderData.unavailable ||
    post.isNsfw ||
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
  const sourceResolution = sourceResolutionJsonLd(post, loaderData.canonicalUrl);
  const image = imageUrl
    ? {
        "@type": "ImageObject",
        contentUrl: imageUrl,
        caption: post.imageAlt,
        ...(post.imageWidth ? { width: post.imageWidth } : {}),
        ...(post.imageHeight ? { height: post.imageHeight } : {}),
      }
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
        dateModified: post.updatedAt,
        mainEntityOfPage: loaderData.canonicalUrl,
        author,
        ...(image ? { image } : {}),
        ...(sourceResolution ? { citation: sourceResolution } : {}),
        additionalProperty: [
          {
            "@type": "PropertyValue",
            name: "SourceBoard request status",
            value: post.status,
          },
          ...(post.acceptedSource
            ? [
                {
                  "@type": "PropertyValue",
                  name: "Accepted source",
                  value: "Present",
                },
              ]
            : []),
          ...(post.verifiedSource
            ? [
                {
                  "@type": "PropertyValue",
                  name: "Source verification",
                  value: "Verified",
                },
              ]
            : []),
        ],
      },
    },
  ];
};

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
  const { post, unavailable, authenticated, viewerIdentity } = useLoaderData<LoaderData>();
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
        viewerIdentity={viewerIdentity}
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
