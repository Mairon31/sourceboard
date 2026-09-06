import { useState } from "react";
import {
  isRouteErrorResponse,
  redirect,
  useLoaderData,
  useRevalidator,
  useRouteError,
  type MetaFunction,
} from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createD1PostStore } from "../../worker/posts/store";
import { createPostService } from "../../worker/posts/service";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";
import { PostCard } from "../components/product/PostCard";
import { ProductShell, PageHeader } from "../components/product/ProductShell";
import { Badge, Button, Card, Input, Textarea } from "../components/ui";

interface LoaderArgs extends ServerLoaderArgs {
  params: { postId?: string; slug?: string };
}

export async function loader({ params, request, context }: LoaderArgs) {
  const requested = new URL(request.url);
  const result = await withOptionalServerSession(
    request,
    context,
    (unavailable) => ({ post: null, unavailable, canonicalUrl: requested.toString() }),
    async (runtime, userId) => {
      const service = createPostService({
        store: createD1PostStore(runtime.db),
        profileStore: createD1ProfileStore(runtime.db),
      });
      const post = await service.getPost(params.postId ?? "", userId);
      return {
        post,
        unavailable: false,
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

function readCsrfToken(): string {
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("__Host-sourceboard_csrf="));
  return entry ? decodeURIComponent(entry.slice("__Host-sourceboard_csrf=".length)) : "";
}

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
  const { post, unavailable } = useLoaderData<LoaderData>();
  if (!post) return <UnavailablePost unavailable={unavailable} />;

  return (
    <ProductShell>
      <PageHeader
        eyebrow="Source request"
        title={post.title}
        description="One image, one focused question and an auditable path to the original source."
      />
      <PostCard post={post} />
      {post.permissions.canEdit || post.permissions.canArchive ? (
        <PostOwnerControls post={post} />
      ) : null}
      <Card className="product-empty-state">
        <span className="product-eyebrow">Conversation boundary</span>
        <h2>Comments arrive in Phase 5</h2>
        <p>
          Post metadata and media are live. Comments, replies and reactions are intentionally not
          persisted yet.
        </p>
      </Card>
    </ProductShell>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return <UnavailablePost unavailable={!notFound} />;
}
