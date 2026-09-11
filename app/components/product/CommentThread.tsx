import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import type {
  CommentAttachmentView,
  CommentLinkPreviewView,
  CommentView,
  PublicPostAuthor,
} from "../../../shared/ui/contracts";
import {
  classifyCommentContent,
  hasSourceEligibleCommentContent,
} from "../../../shared/richtext/comment-content";
import {
  formatEmoteMarkdown,
  normalizeEmoteShortcode,
  renderMarkdownPreview,
  serializeInlineRichTextMarkdown,
  type SafeInlineRichTextNode,
  type SafeRichTextNode,
} from "../../../shared/richtext/markdown";
import type { CommentSort } from "../../../worker/comments/types";
import { readCsrfToken } from "../../data/csrf";
import { AuthRequiredCard } from "./AuthRequiredCard";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { RichText } from "./RichText";
import { ShareAction } from "./ShareAction";
import { MediaPicker, type MediaPickerKind } from "./MediaPicker";
import { LinkPreviewCard } from "./LinkPreviewCard";
import {
  Avatar,
  Badge,
  Button,
  CheckIcon,
  ConfirmDialog,
  Dropdown,
  EditIcon,
  FlagIcon,
  GifIcon,
  HeartIcon,
  Input,
  LinkIcon,
  MessageIcon,
  MoreIcon,
  SmileIcon,
  StickerIcon,
  Textarea,
  TrashIcon,
} from "../ui";

function CommentAttachment({ attachment }: { attachment: CommentAttachmentView }) {
  const imageUrl = attachment.url ?? attachment.preview;
  if (!imageUrl) return null;
  return (
    <div
      className={`product-comment-attachment product-comment-attachment--${attachment.type.toLowerCase()}`}
    >
      <img src={imageUrl} alt={attachment.label} loading="lazy" />
    </div>
  );
}

function commentNodes(comment: CommentView): SafeRichTextNode[] {
  return [
    { type: "paragraph", children: comment.richtext ?? [{ type: "text", text: comment.body }] },
  ];
}

function editableCommentMarkdown(comment: CommentView): string {
  return comment.richtext?.length
    ? serializeInlineRichTextMarkdown(comment.richtext)
    : comment.body;
}

function commentPreviewNodes(
  input: string,
  sourceRichtext?: CommentView["richtext"],
): SafeRichTextNode[] {
  try {
    const assets = new Map(
      (sourceRichtext ?? [])
        .filter(
          (
            node,
          ): node is Extract<NonNullable<CommentView["richtext"]>[number], { type: "emote" }> =>
            node.type === "emote" && Boolean(node.url),
        )
        .map((node) => [normalizeEmoteShortcode(node.shortcode), node] as const)
        .filter((entry): entry is [string, (typeof entry)[1]] => Boolean(entry[0])),
    );
    const hydrateInline = (nodes: SafeInlineRichTextNode[]): SafeInlineRichTextNode[] =>
      nodes.map((node) => {
        if (node.type !== "emote") return node;
        const shortcode = normalizeEmoteShortcode(node.shortcode);
        const asset = shortcode ? assets.get(shortcode) : undefined;
        return asset ? { ...node, id: asset.id, label: asset.label, url: asset.url } : node;
      });
    const hydrateBlock = (node: SafeRichTextNode): SafeRichTextNode => {
      if (node.type === "paragraph") return { ...node, children: hydrateInline(node.children) };
      if (node.type === "quote") return { ...node, children: node.children.map(hydrateBlock) };
      if (node.type === "list") {
        return {
          ...node,
          items: node.items.map((item) => ({ ...item, children: hydrateInline(item.children) })),
        };
      }
      return node;
    };
    return renderMarkdownPreview(input).map(hydrateBlock);
  } catch {
    return [{ type: "paragraph", children: [{ type: "text", text: input }] }];
  }
}

const REPORT_CATEGORIES = [
  ["SPAM", "Spam"],
  ["HARASSMENT", "Harassment"],
  ["MISLEADING_SOURCE", "Misleading source"],
  ["NSFW", "Sensitive content"],
  ["PRIVACY", "Privacy"],
  ["COPYRIGHT", "Copyright"],
  ["OTHER", "Other"],
] as const;

function ReportForm({ commentId, onClose }: { commentId: string; onClose: () => void }) {
  const [category, setCategory] = useState<(typeof REPORT_CATEGORIES)[number][0]>("SPAM");
  const [detail, setDetail] = useState("");
  const [status, setStatus] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(undefined);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({ targetType: "COMMENT", targetId: commentId, category, detail }),
      });
      if (!response.ok) {
        setStatus(
          response.status === 409 ? "You already reported this comment." : "Report unavailable.",
        );
        return;
      }
      setStatus("Report sent. Thanks for helping keep SourceBoard useful.");
      setDetail("");
    } catch {
      setStatus("Report unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="product-comment-report" onSubmit={(event) => void submit(event)}>
      <label className="product-field-native">
        <span>Report reason</span>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as typeof category)}
        >
          {REPORT_CATEGORIES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <Textarea
        label="Note (optional)"
        value={detail}
        maxLength={2000}
        onChange={(event) => setDetail(event.target.value)}
      />
      <div className="product-chip-row">
        <Button type="submit" size="sm" loading={busy}>
          Send report
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
      {status ? <small role="status">{status}</small> : null}
    </form>
  );
}

function CommentItem({
  comment,
  depth = 0,
  onReply,
  canAcceptSource,
  onAcceptSource,
  onUpdated,
  onDeleted,
}: {
  comment: CommentView;
  depth?: number;
  onReply: (commentId: string) => void;
  canAcceptSource?: boolean;
  onAcceptSource?: (commentId: string) => void;
  onUpdated: (comment: CommentView) => void;
  onDeleted: (commentId: string) => void;
}) {
  const [showReplies, setShowReplies] = useState(depth === 0);
  const [liked, setLiked] = useState(comment.reaction.viewerReacted);
  const [likes, setLikes] = useState(comment.reaction.count);
  const [likeBusy, setLikeBusy] = useState(false);
  const likeInFlightRef = useRef(false);
  const likeReactionVersionRef = useRef(0);
  const authoritativeLikeRef = useRef({
    liked: comment.reaction.viewerReacted,
    count: comment.reaction.count,
  });
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(() => editableCommentMarkdown(comment));
  const [previewingEdit, setPreviewingEdit] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const hidden = comment.state !== "VISIBLE";
  const content = classifyCommentContent({
    richtext: comment.richtext,
    body: comment.body,
    attachment: comment.attachment,
  });
  const sourceEligible = hasSourceEligibleCommentContent(
    comment.richtext?.length ? comment.richtext : undefined,
    comment.body,
    comment.linkPreview?.canonicalUrl,
  );
  const bubbleClassName = [
    "product-comment__bubble",
    hidden ? "product-comment__bubble--muted" : "",
    !hidden && content.visualOnly ? "product-comment__bubble--visual-only" : "",
    !hidden && content.emoteOnly ? "product-comment__bubble--emote-only" : "",
    !hidden && content.mixed ? "product-comment__bubble--mixed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    authoritativeLikeRef.current = {
      liked: comment.reaction.viewerReacted,
      count: comment.reaction.count,
    };
    likeReactionVersionRef.current += 1;
    if (!likeInFlightRef.current) {
      setLiked(comment.reaction.viewerReacted);
      setLikes(comment.reaction.count);
    }
  }, [comment.reaction.count, comment.reaction.viewerReacted]);

  useEffect(() => {
    if (!editing) setEditBody(editableCommentMarkdown(comment));
  }, [comment, editing]);

  async function toggleLike() {
    if (likeInFlightRef.current) return;
    likeInFlightRef.current = true;
    setLikeBusy(true);
    const versionAtStart = likeReactionVersionRef.current;
    const previousLiked = liked;
    const previousLikes = likes;
    const nextLiked = !previousLiked;
    setLiked(nextLiked);
    setLikes(Math.max(0, previousLikes + (nextLiked ? 1 : -1)));
    try {
      const response = await fetch(`/api/reactions/COMMENT/${encodeURIComponent(comment.id)}`, {
        method: nextLiked ? "POST" : "DELETE",
        headers: { "x-csrf-token": readCsrfToken() },
      });
      if (!response.ok) throw new Error();
      const result = (await response.json()) as { liked: boolean };
      if (result.liked !== nextLiked) {
        setLiked(result.liked);
        setLikes(Math.max(0, previousLikes + (result.liked ? 1 : 0) - (previousLiked ? 1 : 0)));
      }
    } catch {
      setLiked(previousLiked);
      setLikes(previousLikes);
      setStatus("Like unavailable.");
    } finally {
      likeInFlightRef.current = false;
      setLikeBusy(false);
      if (likeReactionVersionRef.current !== versionAtStart) {
        setLiked(authoritativeLikeRef.current.liked);
        setLikes(authoritativeLikeRef.current.count);
      }
    }
  }

  async function saveEdit() {
    if (!editBody.trim()) return;
    setBusy(true);
    setStatus(undefined);
    try {
      const response = await fetch(`/api/comments/${encodeURIComponent(comment.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({ markdown: editBody }),
      });
      if (!response.ok) throw new Error("Could not save this comment.");
      const payload = (await response.json()) as { comment: CommentView };
      onUpdated(payload.comment);
      setEditing(false);
      setPreviewingEdit(false);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Could not save this comment.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment() {
    setDeleteBusy(true);
    setStatus(undefined);
    try {
      const response = await fetch(`/api/comments/${encodeURIComponent(comment.id)}`, {
        method: "DELETE",
        headers: { "x-csrf-token": readCsrfToken() },
      });
      if (!response.ok) throw new Error("Could not delete this comment.");
      setDeleting(false);
      onDeleted(comment.id);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Could not delete this comment.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const hasMenuActions = Boolean(comment.canEdit || comment.canDelete || comment.canReport);

  return (
    <article
      id={`comment-${comment.id}`}
      tabIndex={-1}
      className={`product-comment${depth ? " product-comment--reply" : ""}`}
    >
      <div className="product-comment__body">
        <div className="product-comment__heading">
          <div className="product-comment__identity">
            {comment.author.mode === "ANONYMOUS" ? (
              <>
                <Avatar name="Anonymous Author" size="sm" />
                <strong>Anonymous Author</strong>
                <Badge>Anonymous</Badge>
              </>
            ) : (
              <CosmeticIdentity
                displayName={comment.author.displayName}
                avatarUrl={comment.author.avatarUrl}
                avatarFrame={comment.author.avatarFrame}
                nameFont={comment.author.nameFont}
                nameEffect={comment.author.nameEffect}
                visuals={comment.author.visuals}
                mode="compact"
                avatarSize="sm"
                nameAs="strong"
              />
            )}
            {comment.isPostAuthor ? <Badge tone="accent">Author</Badge> : null}
          </div>
          <a
            className="product-comment__date"
            href={comment.commentHref ?? `#comment-${comment.id}`}
          >
            {new Date(comment.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}
          </a>
          {hasMenuActions ? (
            <Dropdown
              label="More"
              ariaLabel="More actions"
              triggerIcon={<MoreIcon width="18" height="18" />}
              iconOnly
              items={[
                ...(comment.canEdit
                  ? [
                      {
                        label: "Edit",
                        icon: <EditIcon width="16" height="16" />,
                        onSelect: () => {
                          setEditBody(editableCommentMarkdown(comment));
                          setPreviewingEdit(false);
                          setEditing(true);
                        },
                      },
                    ]
                  : []),
                ...(comment.canDelete
                  ? [
                      {
                        label: "Delete",
                        icon: <TrashIcon width="16" height="16" />,
                        destructive: true,
                        onSelect: () => setDeleting(true),
                      },
                    ]
                  : []),
                ...(comment.canReport
                  ? [
                      {
                        label: "Report",
                        icon: <FlagIcon width="16" height="16" />,
                        onSelect: () => setReporting(true),
                      },
                    ]
                  : []),
              ]}
              className="product-comment__menu"
            />
          ) : null}
        </div>
        <div className={bubbleClassName}>
          {editing ? (
            <>
              <div
                className="product-comment-editor-tabs"
                role="tablist"
                aria-label="Comment editor"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={!previewingEdit}
                  className={!previewingEdit ? "is-active" : undefined}
                  onClick={() => setPreviewingEdit(false)}
                >
                  Write
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewingEdit}
                  className={previewingEdit ? "is-active" : undefined}
                  onClick={() => setPreviewingEdit(true)}
                >
                  Preview
                </button>
              </div>
              {previewingEdit ? (
                <div className="product-comment-editor-preview" role="tabpanel">
                  {editBody.trim() ? (
                    <RichText nodes={commentPreviewNodes(editBody, comment.richtext)} />
                  ) : (
                    <span>Nothing to preview yet.</span>
                  )}
                </div>
              ) : (
                <Textarea
                  label="Edit comment"
                  value={editBody}
                  onChange={(event) => setEditBody(event.target.value)}
                />
              )}
              <div className="product-chip-row">
                <Button size="sm" loading={busy} onClick={() => void saveEdit()}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditBody(editableCommentMarkdown(comment));
                    setPreviewingEdit(false);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : hidden ? (
            <p>{comment.body}</p>
          ) : (
            <RichText nodes={commentNodes(comment)} />
          )}
          {comment.linkPreview ? <LinkPreviewCard preview={comment.linkPreview} /> : null}
          {comment.attachment ? <CommentAttachment attachment={comment.attachment} /> : null}
        </div>
        {reporting ? (
          <ReportForm commentId={comment.id} onClose={() => setReporting(false)} />
        ) : null}
        <div className="product-comment__actions">
          <button
            className={`product-comment__action product-comment__action--like${liked ? " is-active" : ""}`}
            type="button"
            aria-pressed={liked}
            aria-label={liked ? "Unlike comment" : "Like comment"}
            disabled={likeBusy}
            onClick={() => void toggleLike()}
          >
            <HeartIcon width="15" height="15" fill={liked ? "currentColor" : "none"} />
            <span className="product-comment__action-count">{likes}</span>
          </button>
          <button
            className="product-comment__action"
            type="button"
            onClick={() => onReply(comment.id)}
          >
            <MessageIcon width="15" height="15" />
            <span>Reply</span>
          </button>
          {canAcceptSource && comment.state === "VISIBLE" && sourceEligible ? (
            <button
              className="product-comment__action product-comment__action--accept"
              type="button"
              onClick={() => onAcceptSource?.(comment.id)}
            >
              <CheckIcon width="15" height="15" />
              <span>Accept source</span>
            </button>
          ) : null}
          <ShareAction
            url={comment.commentHref ?? `#comment-${comment.id}`}
            title="SourceBoard comment"
          />
          {comment.editedAt ? (
            <span className="product-comment__edited" title="This comment was edited">
              <EditIcon width="13" height="13" />
              <span>Edited</span>
            </span>
          ) : null}
          {hidden ? (
            <span className="product-comment__action-meta">
              {comment.state === "HIDDEN" ? "Moderated" : "Deleted"}
            </span>
          ) : null}
        </div>
        <ConfirmDialog
          title="Delete this comment?"
          description="This removes the comment from the discussion."
          confirmLabel="Delete comment"
          destructive
          open={deleting}
          busy={deleteBusy}
          onConfirm={() => void deleteComment()}
          onOpenChange={setDeleting}
        />
        {status ? <small role="status">{status}</small> : null}
        {comment.replies.length ? (
          <>
            <button
              className="product-comment__replies-toggle"
              type="button"
              aria-expanded={showReplies}
              onClick={() => setShowReplies((value) => !value)}
            >
              {showReplies ? "Hide replies" : `View ${comment.replies.length} replies`}
            </button>
            {showReplies ? (
              <div className="product-comment__replies">
                {comment.replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    depth={Math.min(depth + 1, 2)}
                    onReply={onReply}
                    canAcceptSource={canAcceptSource}
                    onAcceptSource={onAcceptSource}
                    onUpdated={onUpdated}
                    onDeleted={onDeleted}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
}

function replaceComment(comments: CommentView[], next: CommentView): CommentView[] {
  return comments.map((comment) =>
    comment.id === next.id
      ? { ...next, replies: comment.replies }
      : { ...comment, replies: replaceComment(comment.replies, next) },
  );
}

function removeComment(comments: CommentView[], id: string): CommentView[] {
  return comments
    .filter((comment) => comment.id !== id)
    .map((comment) => ({ ...comment, replies: removeComment(comment.replies, id) }));
}

function appendComment(comments: CommentView[], next: CommentView): CommentView[] {
  if (!next.parentCommentId) return [...comments, next];
  return comments.map((comment) =>
    comment.id === next.parentCommentId
      ? { ...comment, replies: [...comment.replies, next] }
      : { ...comment, replies: appendComment(comment.replies, next) },
  );
}

function insertRootComment(
  items: CommentView[],
  next: CommentView,
  sort: CommentSort,
): CommentView[] {
  if (next.parentCommentId) return appendComment(items, next);
  if (sort === "oldest") return [...items, next];
  if (sort === "recent") return [next, ...items];
  return [...items, next].sort(
    (a, b) =>
      b.reaction.count - a.reaction.count ||
      b.createdAt.localeCompare(a.createdAt) ||
      b.id.localeCompare(a.id),
  );
}

const COMPOSER_FALLBACK_NAME = "SourceBoard member";

export function CommentThread({
  postId,
  comments,
  sort,
  authenticated = true,
  viewerIdentity,
  commentsClosed = false,
  canAcceptSource,
  onAcceptSource,
}: {
  postId: string;
  comments: CommentView[];
  sort: CommentSort;
  authenticated?: boolean;
  viewerIdentity?: PublicPostAuthor | null;
  commentsClosed?: boolean;
  canAcceptSource?: boolean;
  onAcceptSource?: (commentId: string) => void;
}) {
  const submitInFlightRef = useRef(false);
  const pendingFocusIdRef = useRef<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState(comments);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string>();
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<MediaPickerKind | null>(null);
  const [attachment, setAttachment] = useState<CommentAttachmentView | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPreview, setLinkPreview] = useState<CommentLinkPreviewView | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkStatus, setLinkStatus] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => setItems(comments), [comments]);

  function changeSort(nextSort: CommentSort) {
    if (nextSort === sort) return;
    const params = new URLSearchParams(location.search);
    params.set("comments", nextSort);
    navigate(`${location.pathname}?${params.toString()}`);
  }

  useEffect(() => {
    const id = pendingFocusIdRef.current;
    if (!id) return;

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const target = document.getElementById(`comment-${id}`);
        if (!(target instanceof HTMLElement)) return;
        pendingFocusIdRef.current = null;
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        target.focus({ preventScroll: true });
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${window.location.search}#comment-${encodeURIComponent(id)}`,
        );
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [items]);

  function clearLinkPreview() {
    setLinkPreview(null);
    setLinkUrl("");
    setLinkStatus(undefined);
  }

  function changeMediaKind(nextKind: MediaPickerKind | null) {
    if (nextKind && nextKind !== "EMOTE") {
      clearLinkPreview();
      setLinkOpen(false);
    }
    setMediaKind(nextKind);
  }

  async function previewLink() {
    const candidate = linkUrl.trim();
    if (!candidate) {
      setLinkStatus("Enter a link to preview.");
      return;
    }
    setLinkBusy(true);
    setLinkStatus(undefined);
    try {
      const response = await fetch("/api/comments/link-preview", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({ url: candidate }),
      });
      const payload = (await response.json().catch(() => null)) as {
        preview?: CommentLinkPreviewView;
      } | null;
      if (!response.ok || !payload?.preview) {
        if (response.status === 429) throw new Error("Too many link previews. Try again later.");
        if (response.status === 400) throw new Error("That link is invalid or not allowed.");
        throw new Error("Link metadata is unavailable right now.");
      }
      setLinkPreview(payload.preview);
      setLinkUrl(payload.preview.canonicalUrl);
      setAttachment(null);
      setMediaKind(null);
    } catch (cause) {
      setLinkPreview(null);
      setLinkStatus(cause instanceof Error ? cause.message : "Link preview unavailable.");
    } finally {
      setLinkBusy(false);
    }
  }

  async function submit() {
    if (submitInFlightRef.current || (!body.trim() && !attachment && !linkPreview)) return;
    submitInFlightRef.current = true;
    setSubmitting(true);
    setStatus(undefined);
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({
          markdown: body,
          parentCommentId: replyTo,
          attachment,
          linkPreviewUrl: linkPreview?.canonicalUrl,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { comment?: CommentView } | null;
      if (!response.ok || !payload?.comment)
        throw new Error(response.status === 401 ? "Sign in to comment." : "Comment unavailable.");
      const created = payload.comment;
      pendingFocusIdRef.current = created.id;
      setItems((current) => insertRootComment(current, created, sort));
      setBody("");
      setAttachment(null);
      setMediaKind(null);
      setLinkOpen(false);
      setLinkUrl("");
      setLinkPreview(null);
      setLinkStatus(undefined);
      setReplyTo(null);
      setStatus("Comment posted.");
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Comment unavailable.");
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section id="comments" className="product-comments" aria-labelledby="comments-heading">
      <header className="product-section-heading">
        <div>
          <span className="product-eyebrow">Discussion</span>
          <h2 id="comments-heading">Comments</h2>
        </div>
        <div className="product-comments__heading-actions">
          <span>{items.length} top-level</span>
          <select
            className="product-comments__sort"
            aria-label="Sort comments"
            value={sort}
            onChange={(event) => changeSort(event.target.value as CommentSort)}
          >
            <option value="recent">Recent</option>
            <option value="popular">Popular</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </header>
      {!authenticated ? (
        <AuthRequiredCard
          title="Sign in to join the discussion"
          description="Create an account or sign in to comment, reply and react to source requests."
        />
      ) : commentsClosed ? (
        <div className="product-comment-locked glass-panel" role="status">
          <strong>Comments are closed</strong>
          <span>
            The author accepted a source and closed this discussion. Existing comments remain
            visible.
          </span>
        </div>
      ) : (
        <div className="product-comment-composer glass-panel">
          {viewerIdentity?.mode === "IDENTIFIED" ? (
            <CosmeticIdentity
              displayName={viewerIdentity.displayName}
              avatarUrl={viewerIdentity.avatarUrl}
              avatarFrame={viewerIdentity.avatarFrame}
              nameFont={viewerIdentity.nameFont}
              nameEffect={viewerIdentity.nameEffect}
              visuals={viewerIdentity.visuals}
              mode="compact"
              avatarSize="sm"
              nameAs="strong"
            />
          ) : (
            <Avatar name={viewerIdentity?.displayName ?? COMPOSER_FALLBACK_NAME} size="sm" />
          )}
          <div className="product-comment-composer__field">
            <Textarea
              id="comment-composer"
              label={replyTo ? "Add a reply" : "Add a comment"}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Add context, a source link, or explain how you verified it…"
            />
            {attachment ? <CommentAttachment attachment={attachment} /> : null}
            <div className="product-comment-composer__toolbar">
              <div>
                <button
                  className={`product-comment-composer__media-action${mediaKind === "GIF" ? " is-active" : ""}`}
                  type="button"
                  aria-label="GIF"
                  title="GIF"
                  aria-expanded={mediaKind === "GIF"}
                  onClick={() => changeMediaKind(mediaKind === "GIF" ? null : "GIF")}
                >
                  <GifIcon width="20" height="20" />
                </button>
                <button
                  className={`product-comment-composer__media-action${mediaKind === "STICKER" ? " is-active" : ""}`}
                  type="button"
                  aria-label="Sticker"
                  title="Sticker"
                  aria-expanded={mediaKind === "STICKER"}
                  onClick={() => changeMediaKind(mediaKind === "STICKER" ? null : "STICKER")}
                >
                  <StickerIcon width="20" height="20" />
                </button>
                <button
                  className={`product-comment-composer__media-action${mediaKind === "EMOTE" ? " is-active" : ""}`}
                  type="button"
                  aria-label="Emote"
                  title="Emote"
                  aria-expanded={mediaKind === "EMOTE"}
                  onClick={() => changeMediaKind(mediaKind === "EMOTE" ? null : "EMOTE")}
                >
                  <SmileIcon width="20" height="20" />
                </button>
                <button
                  className={`product-comment-composer__media-action${linkOpen ? " is-active" : ""}`}
                  type="button"
                  aria-label="Link"
                  title="Link"
                  aria-expanded={linkOpen}
                  onClick={() => {
                    const nextOpen = !linkOpen;
                    setLinkOpen(nextOpen);
                    if (nextOpen) setMediaKind(null);
                  }}
                >
                  <LinkIcon width="20" height="20" />
                </button>
                {attachment ? (
                  <button type="button" onClick={() => setAttachment(null)}>
                    Remove media
                  </button>
                ) : null}
              </div>
              <Button
                size="sm"
                loading={submitting}
                disabled={submitting || (!body.trim() && !attachment && !linkPreview)}
                onClick={() => void submit()}
              >
                {replyTo ? "Reply" : "Comment"}
              </Button>
              {replyTo ? (
                <button type="button" onClick={() => setReplyTo(null)}>
                  Cancel reply
                </button>
              ) : null}
            </div>
            {mediaKind ? (
              <MediaPicker
                kind={mediaKind}
                onKindChange={changeMediaKind}
                onSelect={(item) => {
                  if (item.type === "EMOTE") {
                    setBody(
                      (current) =>
                        `${current}${current && !/\s$/.test(current) ? " " : ""}${formatEmoteMarkdown(item.shortcode)}`,
                    );
                  } else {
                    clearLinkPreview();
                    setLinkOpen(false);
                    setAttachment({
                      type: item.type,
                      id: item.id,
                      label: item.label,
                      provider: item.provider,
                      url: item.url,
                      preview: item.preview,
                    });
                  }
                  changeMediaKind(null);
                }}
                onClose={() => changeMediaKind(null)}
              />
            ) : null}
            {linkOpen ? (
              <div className="product-comment-composer__link-panel">
                <Input
                  label="Link URL"
                  type="url"
                  inputMode="url"
                  placeholder="https://example.com/source"
                  value={linkUrl}
                  onChange={(event) => {
                    setLinkUrl(event.target.value);
                    setLinkPreview(null);
                    setLinkStatus(undefined);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void previewLink();
                    }
                  }}
                />
                <div className="product-comment-composer__link-actions">
                  <Button size="sm" loading={linkBusy} onClick={() => void previewLink()}>
                    Preview link
                  </Button>
                  {linkPreview ? (
                    <Button size="sm" variant="ghost" onClick={clearLinkPreview}>
                      Remove link
                    </Button>
                  ) : null}
                </div>
                {linkPreview ? <LinkPreviewCard preview={linkPreview} /> : null}
                {linkStatus ? <small role="status">{linkStatus}</small> : null}
              </div>
            ) : null}
            {status ? <small role="status">{status}</small> : null}
          </div>
        </div>
      )}
      <div className="product-comments__list">
        {items.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onReply={setReplyTo}
            canAcceptSource={canAcceptSource}
            onAcceptSource={onAcceptSource}
            onUpdated={(next) => setItems((current) => replaceComment(current, next))}
            onDeleted={(id) => setItems((current) => removeComment(current, id))}
          />
        ))}
      </div>
    </section>
  );
}
