import { useEffect } from "react";
import { useLoaderData, useRouteError } from "react-router";
import type { ShareLinkRecord } from "../../worker/share-links/types";
import { createD1ShareLinkStore } from "../../worker/share-links/store";
import { createShareLinkService } from "../../worker/share-links/service";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createD1PostStore } from "../../worker/posts/store";
import { createPostService } from "../../worker/posts/service";
import { createD1CommentStore } from "../../worker/comments/store";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";

const SHARE_LOCALES = ["en", "es", "pt", "fr", "ru", "de"] as const;
type ShareLocale = (typeof SHARE_LOCALES)[number];

export interface ShareResolverData {
  targetUrl: string;
  canonicalUrl: string;
  title: string;
  description: string;
  imageUrl?: string;
  resourceType: "POST" | "COMMENT";
  locale: ShareLocale;
}

interface ResolverPost {
  id: string;
  slug?: string;
  title: string;
  description?: string;
  imageUrl?: string;
}

interface ResolverComment {
  id: string;
  postId: string;
  plaintext: string;
  state: string;
  deletedAt: number | null;
  hiddenAt: number | null;
}

export interface ShareResolverDependencies {
  resolveShortId(shortId: string): Promise<ShareLinkRecord | null>;
  loadPublicPost(postId: string): Promise<ResolverPost | null>;
  loadComment(commentId: string): Promise<ResolverComment | null>;
}

function notFound(): never {
  throw new Response("Shared content not found", { status: 404 });
}

function boundedDescription(value: string | undefined, fallback: string): string {
  const normalized = (value?.trim() || fallback).replace(/\s+/g, " ");
  if (normalized.length <= 180) return normalized;
  return `${normalized.slice(0, 179).trimEnd()}…`;
}

function postCanonicalUrl(post: ResolverPost, requestUrl: URL): URL {
  const path = post.slug
    ? `/posts/${encodeURIComponent(post.id)}/${encodeURIComponent(post.slug)}`
    : `/posts/${encodeURIComponent(post.id)}`;
  return new URL(path, requestUrl.origin);
}

function localeFromRequest(requestUrl: URL): { locale: ShareLocale; explicit: boolean } {
  const candidate = requestUrl.searchParams.get("lang");
  if (candidate && (SHARE_LOCALES as readonly string[]).includes(candidate)) {
    return { locale: candidate as ShareLocale, explicit: true };
  }
  return { locale: "en", explicit: false };
}

function applyLocale(canonicalUrl: URL, locale: ShareLocale, explicit: boolean): URL {
  const targetUrl = new URL(canonicalUrl.toString());
  if (explicit) targetUrl.searchParams.set("lang", locale);
  return targetUrl;
}

export async function resolveShareTarget(
  input: { shortId: string; requestUrl: URL },
  dependencies: ShareResolverDependencies,
): Promise<ShareResolverData> {
  const mapping = await dependencies.resolveShortId(input.shortId);
  if (!mapping) return notFound();
  const { locale, explicit } = localeFromRequest(input.requestUrl);

  if (mapping.resourceType === "POST") {
    const post = await dependencies.loadPublicPost(mapping.resourceId);
    if (!post) return notFound();
    const canonical = postCanonicalUrl(post, input.requestUrl);
    const target = applyLocale(canonical, locale, explicit);
    return {
      targetUrl: target.toString(),
      canonicalUrl: canonical.toString(),
      title: post.title,
      description: boundedDescription(
        post.description,
        "Find the original source of this image with SourceBoard.",
      ),
      imageUrl: post.imageUrl
        ? new URL(post.imageUrl, input.requestUrl.origin).toString()
        : undefined,
      resourceType: "POST",
      locale,
    };
  }

  const comment = await dependencies.loadComment(mapping.resourceId);
  if (
    !comment ||
    comment.state !== "VISIBLE" ||
    comment.deletedAt !== null ||
    comment.hiddenAt !== null
  ) {
    return notFound();
  }
  const post = await dependencies.loadPublicPost(comment.postId);
  if (!post) return notFound();

  const canonical = postCanonicalUrl(post, input.requestUrl);
  canonical.hash = `comment-${encodeURIComponent(comment.id)}`;
  const target = applyLocale(canonical, locale, explicit);
  return {
    targetUrl: target.toString(),
    canonicalUrl: canonical.toString(),
    title: `Comment on ${post.title}`,
    description: boundedDescription(comment.plaintext, "View this SourceBoard comment."),
    imageUrl: post.imageUrl
      ? new URL(post.imageUrl, input.requestUrl.origin).toString()
      : undefined,
    resourceType: "COMMENT",
    locale,
  };
}

export function buildShareResolverMeta(data?: ShareResolverData) {
  if (!data) {
    return [
      { title: "Shared content unavailable · SourceBoard" },
      { name: "robots", content: "noindex, nofollow" },
    ];
  }
  return [
    { title: `${data.title} · SourceBoard` },
    { name: "description", content: data.description },
    { name: "robots", content: "noindex, follow" },
    { tagName: "link", rel: "canonical", href: data.canonicalUrl },
    { property: "og:type", content: "article" },
    { property: "og:title", content: data.title },
    { property: "og:description", content: data.description },
    ...(data.imageUrl ? [{ property: "og:image", content: data.imageUrl }] : []),
    {
      name: "twitter:card",
      content: data.imageUrl ? "summary_large_image" : "summary",
    },
  ];
}

function createResolverDependencies(db: D1Database): ShareResolverDependencies {
  const profileStore = createD1ProfileStore(db);
  const postStore = createD1PostStore(db);
  const postService = createPostService({ store: postStore, profileStore });
  const commentStore = createD1CommentStore(db);
  const shareService = createShareLinkService({
    store: createD1ShareLinkStore(db),
  });

  return {
    resolveShortId: (shortId) => shareService.resolve(shortId),
    async loadPublicPost(postId) {
      const post = await postService.getPost(postId, null);
      if (!post) return null;
      return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        description: post.description,
        imageUrl: post.imageUrl,
      };
    },
    async loadComment(commentId) {
      const record = await commentStore.getComment(commentId);
      if (!record) return null;
      return {
        id: record.comment.id,
        postId: record.comment.postId,
        plaintext: record.comment.plaintext,
        state: record.comment.state,
        deletedAt: record.comment.deletedAt,
        hiddenAt: record.comment.hiddenAt,
      };
    },
  };
}

interface LoaderArgs extends ServerLoaderArgs {
  params: { shortId?: string };
}

export async function loader({ params, request, context }: LoaderArgs): Promise<ShareResolverData> {
  return withOptionalServerSession(
    request,
    context,
    () => {
      throw new Response("Share service unavailable", { status: 503 });
    },
    async (runtime) =>
      resolveShareTarget(
        {
          shortId: params.shortId ?? "",
          requestUrl: new URL(request.url),
        },
        createResolverDependencies(runtime.db),
      ),
  );
}

export const meta = ({ loaderData }: { loaderData?: ShareResolverData }) =>
  buildShareResolverMeta(loaderData);

export default function ShareResolverRoute() {
  const data = useLoaderData<ShareResolverData>();

  useEffect(() => {
    window.location.replace(data.targetUrl);
  }, [data.targetUrl]);

  return (
    <main className="product-share-resolver">
      <h1>Opening shared SourceBoard content</h1>
      <p>If navigation does not continue automatically, use the link below.</p>
      <a href={data.targetUrl}>Continue to SourceBoard</a>
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const unavailable = error instanceof Response && error.status === 503;
  return (
    <main className="product-share-resolver">
      <h1>{unavailable ? "Share service unavailable" : "Shared content unavailable"}</h1>
      <p>
        {unavailable
          ? "SourceBoard could not resolve this shared link right now."
          : "This shared content is not available."}
      </p>
      <a href="/">Go to SourceBoard</a>
    </main>
  );
}
