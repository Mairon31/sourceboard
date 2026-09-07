import { useState } from "react";
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
import { createD1ProfileStore } from "../../worker/profile/store";
import { createD1PostStore } from "../../worker/posts/store";
import { createPostService } from "../../worker/posts/service";
import { createD1CommentStore } from "../../worker/comments/store";
import { createCommentService } from "../../worker/comments/service";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";
import { PostCard } from "../components/product/PostCard";
import { CommentThread } from "../components/product/CommentThread";
import { ProductShell, PageHeader } from "../components/product/ProductShell";
import { Badge, Button, Card, Input, Textarea } from "../components/ui";
import { SourceResolution } from "../components/product/SourceResolution";

interface LoaderArgs extends ServerLoaderArgs {
  params: { postId?: string; slug?: string };
}

export async function loader({ params, request, context }: LoaderArgs) {
  const requested = new URL(request.url);
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
      const post = await service.getPost(params.postId ?? "", userId);
      const comments = post
        ? await createCommentService({
            store: createD1CommentStore(runtime.db),
            postStore: createD1PostStore(runtime.db),
            profileStore: createD1ProfileStore(runtime.db),
          }).listForPost(post.id, userId, null, 50)
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
  const canonicalUrl = new URL(canonicalPath, request.url).toString();
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

function PostOwnerControls({ post }: { post: NonNullable<LoaderData["post"]> }) {
  const revalidator = useRevalidator();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [description, setDescription] = useState(post.description ?? "");
  const [status, setStatus] = useState<string | null>(null);

  async function update(input: RequestInit, success: string) {
    setStatus(null);
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, {
        ...input,
        headers: {
          "content-type": "application/json",
          "x-csrf-token": readCsrfToken(),
          ...(input.headers ?? {}),
        },
      });
      setStatus(response.ok ? success : "Could not save this post.");
      if (response.ok) {
        setEditing(false);
        revalidator.revalidate();
      }
    } catch {
      setStatus("Could not save this post.");
    }
  }

  return (
    <Card className="product-form-card">
      <div className="product-section-heading">
        <div>
          <span className="product-eyebrow">Your post</span>
          <h2>Manage request</h2>
        </div>
        <Badge>{post.permissions.canEdit ? "Editable" : "Edit window closed"}</Badge>
      </div>
      {editing && post.permissions.canEdit ? (
        <form
          className="product-form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void update(
              {
                method: "PATCH",
                body: JSON.stringify({
                  title,
                  description,
                  visibility: post.visibility,
                  authorMode: post.author.mode,
                  isNsfw: post.isNsfw,
                }),
              },
              "Post updated.",
            );
          }}
        >
          <Input
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="product-chip-row">
            <Button type="submit" size="sm">
              Save changes
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="product-chip-row">
          <Button
            size="sm"
            variant="secondary"
            disabled={!post.permissions.canEdit}
            onClick={() => setEditing(true)}
          >
            Edit details
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!post.permissions.canArchive}
            onClick={() =>
              void fetch(`/api/posts/${encodeURIComponent(post.id)}/archive`, {
                method: "POST",
                headers: { "x-csrf-token": readCsrfToken() },
              }).then((response) => {
                setStatus(response.ok ? "Post archived." : "Could not archive this post.");
                if (response.ok) revalidator.revalidate();
              })
            }
          >
            Archive
          </Button>
        </div>
      )}
      {status ? (
        <p className="product-store-preview-status" role="status">
          {status}
        </p>
      ) : null}
    </Card>
  );
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
  if (!post) return <UnavailablePost unavailable={unavailable} />;
  const currentPost = post;
  const focusComments = location.hash === "#comments";

  async function acceptSource(commentId: string) {
    const response = await fetch(`/api/posts/${encodeURIComponent(currentPost.id)}/source/accept`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
      body: JSON.stringify({ commentId }),
    });
    if (response.ok) window.location.reload();
  }

  return (
    <ProductShell>
      <PageHeader
        eyebrow="Source request"
        title={post.title}
        description="One image, one focused question and an auditable path to the original source."
      />
      <PostCard post={post} />
      <SourceResolution accepted={post.acceptedSource} verified={post.verifiedSource} />
      {post.permissions.canEdit || post.permissions.canArchive ? (
        <PostOwnerControls post={post} />
      ) : null}
      <CommentThread
        postId={post.id}
        comments={post.comments}
        authenticated={authenticated}
        focusComposer={focusComments}
        canAcceptSource={post.permissions.canAcceptSource}
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
