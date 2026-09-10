from pathlib import Path


def edit(path_name: str, replacements: list[tuple[str, str]]) -> None:
    path = Path(path_name)
    text = path.read_text()
    for old, new in replacements:
        if new in text:
            continue
        if old not in text:
            raise SystemExit(f"anchor not found in {path_name}: {old[:80]!r}")
        text = text.replace(old, new, 1)
    path.write_text(text)


edit(
    "worker/comments/types.ts",
    [
        (
            "export interface CommentWithAuthor {\n  comment: CommentRecord;\n",
            "export interface CommentWithAuthor {\n  comment: CommentRecord;\n  linkPreview: CommentLinkPreviewSnapshot | null;\n",
        ),
    ],
)

edit(
    "worker/comments/richtext.ts",
    [
        (
            "  attachment?: unknown;\n}): NormalizedCommentBody {",
            "  attachment?: unknown;\n  allowEmpty?: boolean;\n}): NormalizedCommentBody {",
        ),
        (
            '  if (nodes.length > MAX_NODES || (!nodes.length && input.attachment == null))\n    invalid("A comment must contain text or an attachment.");',
            '  if (\n    nodes.length > MAX_NODES ||\n    (!nodes.length && input.attachment == null && !input.allowEmpty)\n  )\n    invalid("A comment must contain text or an attachment.");',
        ),
        (
            '  if (!plaintext && !attachment) invalid("A comment must contain text or an attachment.");',
            '  if (!plaintext && !attachment && !input.allowEmpty)\n    invalid("A comment must contain text or an attachment.");',
        ),
        (
            "export function parseStoredCommentBody(\n  richtextJson: string,\n  attachmentJson: string | null,\n): NormalizedCommentBody {",
            "export function parseStoredCommentBody(\n  richtextJson: string,\n  attachmentJson: string | null,\n  allowEmpty = false,\n): NormalizedCommentBody {",
        ),
        (
            "      attachment: attachmentJson ? JSON.parse(attachmentJson) : null,\n    });",
            "      attachment: attachmentJson ? JSON.parse(attachmentJson) : null,\n      allowEmpty,\n    });",
        ),
    ],
)

edit(
    "worker/comments/store.ts",
    [
        (
            'import type { CommentCursor, CommentRecord, CommentSort, CommentWithAuthor } from "./types";',
            'import type {\n  CommentCursor,\n  CommentLinkPreviewSnapshot,\n  CommentRecord,\n  CommentSort,\n  CommentWithAuthor,\n} from "./types";',
        ),
        (
            "    attachmentJson: string | null;\n  }): Promise<void>;",
            "    attachmentJson: string | null;\n    linkPreview?: CommentLinkPreviewSnapshot | null;\n  }): Promise<void>;",
        ),
        (
            "  hidden_at: number | null;\n  author_username: string;",
            "  hidden_at: number | null;\n  link_preview_canonical_url: string | null;\n  link_preview_site_name: string | null;\n  link_preview_title: string | null;\n  link_preview_description: string | null;\n  link_preview_image_url: string | null;\n  link_preview_fetched_at: number | null;\n  link_preview_metadata_status: string | null;\n  author_username: string;",
        ),
        (
            "  c.updated_at, c.edit_deadline_at, c.deleted_at, c.hidden_at,\n  u.username AS author_username, up.display_name AS author_display_name,",
            "  c.updated_at, c.edit_deadline_at, c.deleted_at, c.hidden_at,\n  lp.canonical_url AS link_preview_canonical_url, lp.site_name AS link_preview_site_name,\n  lp.title AS link_preview_title, lp.description AS link_preview_description,\n  lp.image_url AS link_preview_image_url, lp.fetched_at AS link_preview_fetched_at,\n  lp.metadata_status AS link_preview_metadata_status,\n  u.username AS author_username, up.display_name AS author_display_name,",
        ),
        (
            "    LEFT JOIN user_profiles up ON up.user_id = c.author_id\n    JOIN posts p ON p.id = c.post_id",
            "    LEFT JOIN user_profiles up ON up.user_id = c.author_id\n    LEFT JOIN comment_link_previews lp ON lp.comment_id = c.id\n    JOIN posts p ON p.id = c.post_id",
        ),
        (
            "function toRecord(row: CommentRow): CommentWithAuthor {\n  const body = parseStoredCommentBody(row.body_richtext_json, row.attachment_json);",
            "function toRecord(row: CommentRow): CommentWithAuthor {\n  const hasLinkPreview = Boolean(row.link_preview_canonical_url);\n  const body = parseStoredCommentBody(\n    row.body_richtext_json,\n    row.attachment_json,\n    hasLinkPreview,\n  );",
        ),
        (
            "  return {\n    comment,\n    author:",
            "  const linkPreview: CommentLinkPreviewSnapshot | null = row.link_preview_canonical_url\n    ? {\n        canonicalUrl: row.link_preview_canonical_url,\n        siteName: row.link_preview_site_name,\n        title: row.link_preview_title,\n        description: row.link_preview_description,\n        imageUrl: row.link_preview_image_url,\n        fetchedAt: row.link_preview_fetched_at ?? row.created_at,\n        metadataStatus:\n          row.link_preview_metadata_status === \"COMPLETE\" ||\n          row.link_preview_metadata_status === \"PARTIAL\"\n            ? row.link_preview_metadata_status\n            : \"URL_ONLY\",\n      }\n    : null;\n  return {\n    comment,\n    linkPreview,\n    author:",
        ),
    ],
)

store = Path("worker/comments/store.ts")
text = store.read_text()
start = text.index("    async createComment(")
end = text.index("\n\n    async updateComment", start)
replacement = """    async createComment({ comment, richtextJson, attachmentJson, linkPreview }) {
      const statements = [
        db
          .prepare(
            `INSERT INTO comments
              (id, post_id, author_id, parent_comment_id, body_richtext_json, body_plaintext,
               attachment_json, state, like_count, created_at, updated_at, edit_deadline_at,
               deleted_at, hidden_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'VISIBLE', 0, ?, ?, ?, NULL, NULL)`,
          )
          .bind(
            comment.id,
            comment.postId,
            comment.authorId,
            comment.parentCommentId,
            richtextJson,
            comment.plaintext,
            attachmentJson,
            comment.createdAt,
            comment.updatedAt,
            comment.editDeadlineAt,
          ),
        db
          .prepare(
            `UPDATE posts SET comment_count = comment_count + 1, updated_at = ? WHERE id = ?`,
          )
          .bind(comment.createdAt, comment.postId),
      ];
      if (linkPreview) {
        statements.push(
          db
            .prepare(
              `INSERT INTO comment_link_previews
                (comment_id, canonical_url, site_name, title, description, image_url, fetched_at,
                 metadata_status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              comment.id,
              linkPreview.canonicalUrl,
              linkPreview.siteName,
              linkPreview.title,
              linkPreview.description,
              linkPreview.imageUrl,
              linkPreview.fetchedAt,
              linkPreview.metadataStatus,
            ),
        );
      }
      await db.batch(statements);
    }"""
text = text[:start] + replacement + text[end:]
store.write_text(text)

edit(
    "worker/comments/service.ts",
    [
        (
            'import type { CommentSort, CommentWithAuthor } from "./types";',
            'import type { CommentLinkPreviewSnapshot, CommentSort, CommentWithAuthor } from "./types";',
        ),
        (
            "  assertEntitlements?: (\n    userId: string,\n    body: ReturnType<typeof normalizeCommentBody>,\n  ) => Promise<void>;\n  now?: () => number;",
            "  assertEntitlements?: (\n    userId: string,\n    body: ReturnType<typeof normalizeCommentBody>,\n  ) => Promise<void>;\n  previewLink?: (value: unknown) => Promise<CommentLinkPreviewSnapshot>;\n  now?: () => number;",
        ),
        (
            "    attachment?: unknown;\n  }): Promise<CommentView>;",
            "    attachment?: unknown;\n    linkPreviewUrl?: unknown;\n  }): Promise<CommentView>;",
        ),
        (
            "    attachment: record.comment.attachment\n      ? {",
            "    linkPreview:\n      record.comment.state !== \"DELETED\" && record.linkPreview\n        ? {\n            canonicalUrl: record.linkPreview.canonicalUrl,\n            ...(record.linkPreview.siteName ? { siteName: record.linkPreview.siteName } : {}),\n            ...(record.linkPreview.title ? { title: record.linkPreview.title } : {}),\n            ...(record.linkPreview.description\n              ? { description: record.linkPreview.description }\n              : {}),\n            ...(record.linkPreview.imageUrl\n              ? { imageUrl: `/api/comments/${encodeURIComponent(record.comment.id)}/link-preview-image` }\n              : {}),\n            metadataStatus: record.linkPreview.metadataStatus,\n          }\n        : undefined,\n    attachment: record.comment.attachment\n      ? {",
        ),
        (
            "      const body = normalizeCommentBody(input);\n      await dependencies.assertEntitlements?.(input.authorId, body);",
            "      const hasLinkPreview =\n        input.linkPreviewUrl !== undefined &&\n        input.linkPreviewUrl !== null &&\n        input.linkPreviewUrl !== \"\";\n      const body = normalizeCommentBody({ ...input, allowEmpty: hasLinkPreview });\n      if (hasLinkPreview && body.attachment) {\n        throw new PostError(\n          400,\n          \"LINK_PREVIEW_ATTACHMENT_CONFLICT\",\n          \"A link preview cannot be combined with a GIF or sticker.\",\n        );\n      }\n      let linkPreview: CommentLinkPreviewSnapshot | null = null;\n      if (hasLinkPreview) {\n        if (!dependencies.previewLink) {\n          throw new PostError(\n            503,\n            \"LINK_PREVIEW_UNAVAILABLE\",\n            \"Link previews are temporarily unavailable.\",\n          );\n        }\n        linkPreview = await dependencies.previewLink(input.linkPreviewUrl);\n      }\n      await dependencies.assertEntitlements?.(input.authorId, body);",
        ),
        (
            "        attachmentJson: body.attachment ? JSON.stringify(body.attachment) : null,\n      });",
            "        attachmentJson: body.attachment ? JSON.stringify(body.attachment) : null,\n        linkPreview,\n      });",
        ),
    ],
)

link = Path("worker/comments/link-preview.ts")
text = link.read_text()
anchor = "const MAX_HTML_BYTES = 512 * 1024;\n"
if "const MAX_IMAGE_BYTES = 2 * 1024 * 1024;" not in text:
    if anchor not in text:
        raise SystemExit("link preview constant anchor missing")
    text = text.replace(anchor, anchor + "const MAX_IMAGE_BYTES = 2 * 1024 * 1024;\n", 1)
marker = "\nasync function cacheKey(canonicalUrl: string): Promise<string> {"
if "export async function fetchPreviewImage" not in text:
    if marker not in text:
        raise SystemExit("cache key marker missing")
    helper = """

async function readBoundedBytes(response: Response, maximumBytes: number): Promise<ArrayBuffer> {
  if (!response.body) return new ArrayBuffer(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw linkError(413, "LINK_PREVIEW_IMAGE_TOO_LARGE", "The preview image is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

export async function fetchPreviewImage(
  value: unknown,
  dependencies: Pick<LinkPreviewDependencies, "fetchImpl" | "resolveHost">,
): Promise<{ body: ArrayBuffer; contentType: string }> {
  let current = normalizeLinkPreviewUrl(value);
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  for (let redirects = 0; ; redirects += 1) {
    await assertPublicTarget(current, dependencies.resolveHost);
    let response: Response;
    try {
      response = await dependencies.fetchImpl(current.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1",
          "user-agent": "SourceBoard-LinkPreview/1.0",
        },
      });
    } catch (error) {
      if (shouldPropagate(error)) throw error;
      throw linkError(502, "LINK_PREVIEW_IMAGE_UNAVAILABLE", "The preview image is unavailable.");
    }
    if (isRedirect(response.status)) {
      if (redirects >= MAX_REDIRECTS) {
        throw linkError(
          400,
          "LINK_PREVIEW_TOO_MANY_REDIRECTS",
          "The preview image redirects too many times.",
        );
      }
      const location = response.headers.get("location");
      if (!location) {
        throw linkError(502, "LINK_PREVIEW_IMAGE_UNAVAILABLE", "The preview image is unavailable.");
      }
      current = normalizeLinkPreviewUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) {
      throw linkError(502, "LINK_PREVIEW_IMAGE_UNAVAILABLE", "The preview image is unavailable.");
    }
    const contentType = response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (!contentType || !allowedTypes.has(contentType)) {
      throw linkError(
        415,
        "LINK_PREVIEW_IMAGE_UNSUPPORTED",
        "The preview image format is unsupported.",
      );
    }
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      throw linkError(413, "LINK_PREVIEW_IMAGE_TOO_LARGE", "The preview image is too large.");
    }
    return { body: await readBoundedBytes(response, MAX_IMAGE_BYTES), contentType };
  }
}
"""
    text = text.replace(marker, helper + marker, 1)
link.write_text(text)

api = Path("worker/comments/api.ts")
text = api.read_text()
if 'import { canViewPost } from "../posts/service";' not in text:
    text = text.replace(
        'import { createD1PostStore } from "../posts/store";\n',
        'import { createD1PostStore } from "../posts/store";\nimport { canViewPost } from "../posts/service";\n',
        1,
    )
if "  fetchPreviewImage,\n" not in text:
    text = text.replace(
        "  createLinkPreviewService,\n  createWorkersLinkPreviewCache,\n  resolveLinkPreviewHost,",
        "  createLinkPreviewService,\n  createWorkersLinkPreviewCache,\n  fetchPreviewImage,\n  resolveLinkPreviewHost,",
        1,
    )
image_route_guard = "    /^\\/api\\/comments\\/[^/]+\\/link-preview-image$/.test(pathname) ||\n"
if image_route_guard not in text:
    text = text.replace(
        '    /^\\/api\\/comments\\/[^/]+$/.test(pathname) ||\n',
        '    /^\\/api\\/comments\\/[^/]+$/.test(pathname) ||\n' + image_route_guard,
        1,
    )
old_service = """function service(env: SourceBoardEnvironment) {
  const db = database(env);
  return createCommentService({
    store: createD1CommentStore(db),
    postStore: createD1PostStore(db),
    profileStore: createD1ProfileStore(db),
    assertEntitlements: createEntitlementChecker(db),
  });
}"""
new_service = """function createProductionLinkPreviewService() {
  return createLinkPreviewService({
    fetchImpl: fetch,
    resolveHost: (hostname) => resolveLinkPreviewHost(hostname),
    cache: createWorkersLinkPreviewCache((caches as CacheStorage & { default: Cache }).default),
  });
}

function service(env: SourceBoardEnvironment) {
  const db = database(env);
  const previewService = createProductionLinkPreviewService();
  return createCommentService({
    store: createD1CommentStore(db),
    postStore: createD1PostStore(db),
    profileStore: createD1ProfileStore(db),
    assertEntitlements: createEntitlementChecker(db),
    previewLink: (value) => previewService.preview(value),
  });
}"""
if new_service not in text:
    if old_service not in text:
        raise SystemExit("API service anchor missing")
    text = text.replace(old_service, new_service, 1)
old_preview = """      const preview = await createLinkPreviewService({
        fetchImpl: fetch,
        resolveHost: (hostname) => resolveLinkPreviewHost(hostname),
        cache: createWorkersLinkPreviewCache((caches as CacheStorage & { default: Cache }).default),
      }).preview(input.url);"""
if old_preview in text:
    text = text.replace(
        old_preview,
        "      const preview = await createProductionLinkPreviewService().preview(input.url);",
        1,
    )
marker = "    const commentService = service(env);\n"
if "const previewImageMatch = url.pathname.match" not in text:
    if marker not in text:
        raise SystemExit("comment service marker missing")
    image_route = """    const previewImageMatch = url.pathname.match(
      /^\/api\/comments\/([^/]+)\/link-preview-image$/,
    );
    if (previewImageMatch && request.method === "GET") {
      const db = database(env);
      const comment = await createD1CommentStore(db).getComment(
        decodeURIComponent(previewImageMatch[1] ?? ""),
      );
      if (!comment?.linkPreview?.imageUrl) {
        throw new PostError(404, "LINK_PREVIEW_IMAGE_NOT_FOUND", "The preview image was not found.");
      }
      const postStore = createD1PostStore(db);
      const profileStore = createD1ProfileStore(db);
      const post = await postStore.getPost(comment.comment.postId);
      const viewer = await viewerId(request, env);
      const policy = { profileStore, store: postStore, now: () => Date.now() };
      if (!post || !(await canViewPost(viewer, post.post, policy))) {
        throw new PostError(404, "LINK_PREVIEW_IMAGE_NOT_FOUND", "The preview image was not found.");
      }
      const publiclyViewable = await canViewPost(null, post.post, policy);
      const image = await fetchPreviewImage(comment.linkPreview.imageUrl, {
        fetchImpl: fetch,
        resolveHost: (hostname) => resolveLinkPreviewHost(hostname),
      });
      return new Response(image.body, {
        status: 200,
        headers: {
          "content-type": image.contentType,
          "cache-control": publiclyViewable ? "public, max-age=3600" : "private, no-store",
          [REQUEST_ID_HEADER]: requestId,
        },
      });
    }
"""
    text = text.replace(marker, image_route + marker, 1)
if "        linkPreviewUrl: input.linkPreviewUrl,\n" not in text:
    text = text.replace(
        "        attachment: input.attachment,\n      });",
        "        attachment: input.attachment,\n        linkPreviewUrl: input.linkPreviewUrl,\n      });",
        1,
    )
api.write_text(text)
