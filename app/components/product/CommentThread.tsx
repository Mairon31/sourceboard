import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
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
import { getMediaImagePolicy } from "../../../shared/media/policy";
import { readCsrfToken } from "../../data/csrf";
import { serializeCommentAttachment } from "../../data/comment-attachment";
import { prepareImageForUpload } from "../../data/media-preparation";
import { localizeApiError } from "../../data/user-facing-errors";
import { useI18n } from "../../i18n/I18nProvider";
import { AuthRequiredCard } from "./AuthRequiredCard";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { RichText } from "./RichText";
import { ShareAction } from "./ShareAction";
import { MediaPicker, type MediaPickerKind } from "./MediaPicker";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { MediaLightbox } from "./MediaLightbox";
import { ModerationActionDialog } from "./ModerationActionDialog";
import {
  Badge,
  Button,
  CheckIcon,
  CloseIcon,
  ConfirmDialog,
  Dropdown,
  EditIcon,
  FlagIcon,
  GifIcon,
  GalleryIcon,
  HeartIcon,
  Input,
  LinkIcon,
  MessageIcon,
  MoreIcon,
  SmileIcon,
  StickerIcon,
  Textarea,
  TrashIcon,
  UndoIcon,
} from "../ui";

const COMMENT_IMAGE_MAX_BYTES = getMediaImagePolicy("COMMENT").maxBytes;

function CommentAttachment({
  attachment,
  onRemove,
}: {
  attachment: CommentAttachmentView;
  onRemove?: () => void;
}) {
  const { t } = useI18n();
  const imageUrl = attachment.url ?? attachment.preview;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imageTriggerRef = useRef<HTMLElement | null>(null);
  if (!imageUrl) return null;
  const isImage = attachment.type === "IMAGE";
  const removeLabel = t(
    attachment.type === "IMAGE"
      ? "comments.composer.removeImage"
      : attachment.type === "GIF"
        ? "comments.composer.removeGif"
        : "comments.composer.removeSticker",
  );
  return (
    <div
      className={`product-comment-attachment product-comment-attachment--${attachment.type.toLowerCase()}`}
    >
      {isImage ? (
        <button
          type="button"
          className="product-comment-attachment__image-button"
          aria-label={t("comments.composer.openImage")}
          onClick={(event) => {
            imageTriggerRef.current = event.currentTarget;
            setLightboxOpen(true);
          }}
        >
          <img src={imageUrl} alt={attachment.label} loading="lazy" />
        </button>
      ) : (
        <img src={imageUrl} alt={attachment.label} loading="lazy" />
      )}
      {onRemove ? (
        <button
          type="button"
          className="product-comment-attachment__remove"
          aria-label={removeLabel}
          title={removeLabel}
          onClick={onRemove}
        >
          <CloseIcon width="16" height="16" />
        </button>
      ) : null}
      {isImage ? (
        <MediaLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          src={imageUrl}
          alt={attachment.label}
          returnFocusRef={imageTriggerRef}
        />
      ) : null}
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
  ["SPAM", "comments.report.category.spam"],
  ["HARASSMENT", "comments.report.category.harassment"],
  ["MISLEADING_SOURCE", "comments.report.category.misleadingSource"],
  ["NSFW", "comments.report.category.nsfw"],
  ["PRIVACY", "comments.report.category.privacy"],
  ["COPYRIGHT", "comments.report.category.copyright"],
  ["OTHER", "comments.report.category.other"],
] as const;

function ReportForm({ commentId, onClose }: { commentId: string; onClose: () => void }) {
  const { t } = useI18n();
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
          response.status === 409 ? t("comments.report.already") : t("comments.report.unavailable"),
        );
        return;
      }
      setStatus(t("comments.report.sent"));
      setDetail("");
    } catch {
      setStatus(t("comments.report.unavailable"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="product-comment-report" onSubmit={(event) => void submit(event)}>
      <label className="product-field-native">
        <span>{t("comments.report.reason")}</span>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as typeof category)}
        >
          {REPORT_CATEGORIES.map(([value, labelKey]) => (
            <option key={value} value={value}>
              {t(labelKey)}
            </option>
          ))}
        </select>
      </label>
      <Textarea
        label={t("comments.report.note")}
        value={detail}
        maxLength={2000}
        onChange={(event) => setDetail(event.target.value)}
      />
      <div className="product-chip-row">
        <Button type="submit" size="sm" loading={busy}>
          {t("comments.report.send")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          {t("common.cancel")}
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
  authenticated,
  readOnly = false,
  canAcceptSource,
  acceptedSourceCommentId,
  canUndoAcceptedSource,
  canModerate,
  onAcceptSource,
  onUndoAcceptedSource,
  onUpdated,
  onDeleted,
  onChanged,
}: {
  comment: CommentView;
  depth?: number;
  onReply: (commentId: string) => void;
  authenticated: boolean;
  readOnly?: boolean;
  canAcceptSource?: boolean;
  acceptedSourceCommentId?: string;
  canUndoAcceptedSource?: boolean;
  canModerate?: boolean;
  onAcceptSource?: (commentId: string) => void;
  onUndoAcceptedSource?: (commentId: string, reason: string) => Promise<void>;
  onUpdated: (comment: CommentView) => void;
  onDeleted: (commentId: string) => void;
  onChanged?: () => void;
}) {
  const { t, tp, date } = useI18n();
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
  const [editLinkUrl, setEditLinkUrl] = useState(() => comment.linkPreview?.canonicalUrl ?? "");
  const [editLinkOriginalUrl, setEditLinkOriginalUrl] = useState(
    () => comment.linkPreview?.canonicalUrl ?? "",
  );
  const [previewingEdit, setPreviewingEdit] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const [moderationOpen, setModerationOpen] = useState(false);
  const [undoingAcceptedSource, setUndoingAcceptedSource] = useState(false);
  const [undoReason, setUndoReason] = useState("");
  const [undoBusy, setUndoBusy] = useState(false);
  const [undoError, setUndoError] = useState<string>();
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
    if (!editing) {
      const canonicalUrl = comment.linkPreview?.canonicalUrl ?? "";
      setEditBody(editableCommentMarkdown(comment));
      setEditLinkUrl(canonicalUrl);
      setEditLinkOriginalUrl(canonicalUrl);
    }
  }, [comment, editing]);

  async function toggleLike() {
    if (!authenticated || readOnly || likeInFlightRef.current) return;
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
      setStatus(t("comments.error.likeUnavailable"));
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
    if (!editBody.trim() && !comment.attachment && !comment.linkPreview && !editLinkUrl.trim())
      return;
    setBusy(true);
    setStatus(undefined);
    try {
      const trimmedEditLinkUrl = editLinkUrl.trim();
      const patch = {
        markdown: editBody,
        ...(trimmedEditLinkUrl === editLinkOriginalUrl
          ? {}
          : { linkPreviewUrl: editLinkUrl.trim() || null }),
      };
      const response = await fetch(`/api/comments/${encodeURIComponent(comment.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error(t("comments.error.save"));
      const payload = (await response.json()) as { comment: CommentView };
      onUpdated(payload.comment);
      onChanged?.();
      setEditing(false);
      setPreviewingEdit(false);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : t("comments.error.save"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment() {
    if (deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(undefined);
    setStatus(undefined);
    try {
      const response = await fetch(`/api/comments/${encodeURIComponent(comment.id)}`, {
        method: "DELETE",
        headers: { "x-csrf-token": readCsrfToken() },
      });
      if (!response.ok) throw new Error(t("comments.error.delete"));
      setDeleting(false);
      onDeleted(comment.id);
      onChanged?.();
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : t("comments.error.delete"));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function undoAcceptedSource() {
    const trimmedReason = undoReason.trim();
    if (!trimmedReason || undoBusy || !onUndoAcceptedSource) return;
    setUndoBusy(true);
    setUndoError(undefined);
    try {
      await onUndoAcceptedSource(comment.id, trimmedReason);
      setUndoingAcceptedSource(false);
      setUndoReason("");
      setStatus(t("comments.sourceUndo.done"));
      onChanged?.();
    } catch (cause) {
      setUndoError(cause instanceof Error ? cause.message : t("comments.sourceUndo.error"));
    } finally {
      setUndoBusy(false);
    }
  }

  const canModerateState = Boolean(
    canModerate && (comment.state === "VISIBLE" || comment.state === "HIDDEN"),
  );
  const hasMenuActions = Boolean(
    comment.canEdit || comment.canDelete || comment.canReport || canModerateState,
  );

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
                <CosmeticIdentity anonymous mode="compact" avatarSize="sm" nameAs="strong" />
                <Badge>{t("comments.badges.anonymous")}</Badge>
              </>
            ) : comment.author.profileUrl ? (
              <Link className="product-comment__identity-link" to={comment.author.profileUrl}>
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
              </Link>
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
            {comment.isPostAuthor ? (
              <Badge tone="accent">{t("comments.badges.author")}</Badge>
            ) : null}
          </div>
          <a
            className="product-comment__date"
            href={comment.commentHref ?? `#comment-${comment.id}`}
          >
            {date(new Date(comment.createdAt), {
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}
          </a>
          {hasMenuActions ? (
            <Dropdown
              label={t("comments.actions.more")}
              ariaLabel={t("comments.actions.moreAria")}
              triggerIcon={<MoreIcon width="18" height="18" />}
              iconOnly
              items={[
                ...(comment.canEdit
                  ? [
                      {
                        label: t("comments.actions.edit"),
                        icon: <EditIcon width="16" height="16" />,
                        onSelect: () => {
                          const canonicalUrl = comment.linkPreview?.canonicalUrl ?? "";
                          setEditBody(editableCommentMarkdown(comment));
                          setEditLinkUrl(canonicalUrl);
                          setEditLinkOriginalUrl(canonicalUrl);
                          setPreviewingEdit(false);
                          setEditing(true);
                        },
                      },
                    ]
                  : []),
                ...(comment.canDelete
                  ? [
                      {
                        label: t("comments.actions.delete"),
                        icon: <TrashIcon width="16" height="16" />,
                        destructive: true,
                        onSelect: () => setDeleting(true),
                      },
                    ]
                  : []),
                ...(comment.canReport
                  ? [
                      {
                        label: t("comments.actions.report"),
                        icon: <FlagIcon width="16" height="16" />,
                        onSelect: () => setReporting(true),
                      },
                    ]
                  : []),
                ...(canModerateState
                  ? [
                      {
                        label:
                          comment.state === "HIDDEN"
                            ? t("comments.actions.restore")
                            : t("comments.actions.hide"),
                        onSelect: () => setModerationOpen(true),
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
              <Input
                type="url"
                inputMode="url"
                label={t("comments.composer.linkUrl")}
                value={editLinkUrl}
                onChange={(event) => setEditLinkUrl(event.target.value)}
              />
              <div
                className="product-comment-editor-tabs"
                role="tablist"
                aria-label={t("comments.editor.aria")}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={!previewingEdit}
                  className={!previewingEdit ? "is-active" : undefined}
                  onClick={() => setPreviewingEdit(false)}
                >
                  {t("comments.editor.write")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewingEdit}
                  className={previewingEdit ? "is-active" : undefined}
                  onClick={() => setPreviewingEdit(true)}
                >
                  {t("comments.editor.preview")}
                </button>
              </div>
              {previewingEdit ? (
                <div className="product-comment-editor-preview" role="tabpanel">
                  {editBody.trim() ? (
                    <RichText nodes={commentPreviewNodes(editBody, comment.richtext)} />
                  ) : (
                    <span>{t("comments.editor.empty")}</span>
                  )}
                </div>
              ) : (
                <Textarea
                  label={t("comments.editor.label")}
                  value={editBody}
                  onChange={(event) => setEditBody(event.target.value)}
                />
              )}
              <div className="product-chip-row">
                <Button size="sm" loading={busy} onClick={() => void saveEdit()}>
                  {t("common.save")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const canonicalUrl = comment.linkPreview?.canonicalUrl ?? "";
                    setEditBody(editableCommentMarkdown(comment));
                    setEditLinkUrl(canonicalUrl);
                    setEditLinkOriginalUrl(canonicalUrl);
                    setPreviewingEdit(false);
                    setEditing(false);
                  }}
                >
                  {t("common.cancel")}
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
            aria-label={liked ? t("comments.actions.unlike") : t("comments.actions.like")}
            disabled={!authenticated || likeBusy}
            onClick={() => void toggleLike()}
          >
            <HeartIcon width="15" height="15" fill={liked ? "currentColor" : "none"} />
            <span className="product-comment__action-count">{likes}</span>
          </button>
          <button
            className="product-comment__action"
            type="button"
            disabled={!authenticated || readOnly}
            onClick={() => {
              if (!authenticated || readOnly) return;
              onReply(comment.id);
            }}
          >
            <MessageIcon width="15" height="15" />
            <span>{t("comments.actions.reply")}</span>
          </button>
          {acceptedSourceCommentId === comment.id && canUndoAcceptedSource ? (
            <div
              className={`product-comment__source-undo${undoingAcceptedSource ? " is-open" : ""}`}
            >
              {undoingAcceptedSource ? (
                <>
                  <Textarea
                    label={t("comments.sourceUndo.reason")}
                    value={undoReason}
                    maxLength={500}
                    disabled={undoBusy}
                    onChange={(event) => setUndoReason(event.target.value)}
                  />
                  <div className="product-chip-row">
                    <Button
                      size="sm"
                      loading={undoBusy}
                      disabled={undoReason.trim().length < 10}
                      onClick={() => void undoAcceptedSource()}
                    >
                      {t("comments.sourceUndo.confirm")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={undoBusy}
                      onClick={() => setUndoingAcceptedSource(false)}
                    >
                      {t("common.cancel")}
                    </Button>
                  </div>
                  {undoError ? <small role="alert">{undoError}</small> : null}
                </>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="product-comment__source-undo-trigger"
                  onClick={() => {
                    setUndoError(undefined);
                    setUndoingAcceptedSource(true);
                  }}
                >
                  <UndoIcon width="15" height="15" />
                  {t("comments.actions.undoAcceptedSource")}
                </Button>
              )}
            </div>
          ) : canAcceptSource &&
            comment.id !== acceptedSourceCommentId &&
            comment.state === "VISIBLE" &&
            sourceEligible ? (
            <button
              className="product-comment__action product-comment__action--accept"
              type="button"
              onClick={() => onAcceptSource?.(comment.id)}
            >
              <CheckIcon width="15" height="15" />
              <span>{t("comments.actions.acceptSource")}</span>
            </button>
          ) : null}
          <ShareAction
            url={comment.commentHref ?? `#comment-${comment.id}`}
            title={t("comments.share.title")}
            target={{ resourceType: "COMMENT", resourceId: comment.id }}
          />
          {comment.editedAt ? (
            <span className="product-comment__edited" title={t("comments.editedTitle")}>
              <EditIcon width="13" height="13" />
              <span>{t("comments.edited")}</span>
            </span>
          ) : null}
          {hidden ? (
            <span className="product-comment__action-meta">
              {comment.state === "HIDDEN"
                ? t("comments.state.moderated")
                : t("comments.state.deleted")}
            </span>
          ) : null}
        </div>
        <ConfirmDialog
          title={t("comments.delete.title")}
          description={t("comments.delete.description")}
          confirmLabel={t("comments.delete.confirm")}
          destructive
          open={deleting}
          busy={deleteBusy}
          error={deleteError}
          onConfirm={() => void deleteComment()}
          onOpenChange={(open) => {
            if (!open) setDeleteError(undefined);
            setDeleting(open);
          }}
        />
        <ModerationActionDialog
          open={moderationOpen}
          target={{ targetType: "COMMENT", comment }}
          onOpenChange={setModerationOpen}
          onApplied={(action) => {
            setStatus(
              action === "RESTORE"
                ? t("comments.moderation.restored")
                : t("comments.moderation.hidden"),
            );
            onChanged?.();
          }}
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
              {showReplies
                ? t("comments.replies.hide")
                : t("comments.replies.view", {
                    count: tp("comments.replies", comment.replies.length),
                  })}
            </button>
            {showReplies ? (
              <div className="product-comment__replies">
                {comment.replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    depth={Math.min(depth + 1, 2)}
                    onReply={onReply}
                    authenticated={authenticated}
                    readOnly={readOnly}
                    canAcceptSource={canAcceptSource}
                    acceptedSourceCommentId={acceptedSourceCommentId}
                    canUndoAcceptedSource={canUndoAcceptedSource}
                    canModerate={canModerate}
                    onAcceptSource={onAcceptSource}
                    onUndoAcceptedSource={onUndoAcceptedSource}
                    onUpdated={onUpdated}
                    onDeleted={onDeleted}
                    onChanged={onChanged}
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

function findComment(comments: CommentView[], id: string): CommentView | null {
  for (const comment of comments) {
    if (comment.id === id) return comment;
    const nested = findComment(comment.replies, id);
    if (nested) return nested;
  }
  return null;
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

function countThread(comments: CommentView[]): { comments: number; replies: number } {
  let total = 0;
  let replies = 0;
  const visit = (nodes: CommentView[], depth: number) => {
    for (const node of nodes) {
      total += 1;
      if (depth > 0) replies += 1;
      visit(node.replies, depth + 1);
    }
  };
  visit(comments, 0);
  return { comments: total, replies };
}

export function CommentThread({
  postId,
  comments,
  sort,
  authenticated = true,
  viewerIdentity,
  canChooseCommentIdentity = false,
  commentsClosed = false,
  postArchived = false,
  canAcceptSource,
  acceptedSourceCommentId,
  canUndoAcceptedSource,
  canModerateComments,
  onAcceptSource,
  onUndoAcceptedSource,
  onCommentsChanged,
  onCommentUpdated,
}: {
  postId: string;
  comments: CommentView[];
  sort: CommentSort;
  authenticated?: boolean;
  viewerIdentity?: PublicPostAuthor | null;
  canChooseCommentIdentity?: boolean;
  commentsClosed?: boolean;
  postArchived?: boolean;
  canAcceptSource?: boolean;
  acceptedSourceCommentId?: string;
  canUndoAcceptedSource?: boolean;
  canModerateComments?: boolean;
  onAcceptSource?: (commentId: string) => void;
  onUndoAcceptedSource?: (commentId: string, reason: string) => Promise<void>;
  onCommentsChanged?: () => void;
  onCommentUpdated?: (comment: CommentView) => void;
}) {
  const { t, tp } = useI18n();
  const submitInFlightRef = useRef(false);
  const pendingFocusIdRef = useRef<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
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
  const [commentAuthorMode, setCommentAuthorMode] = useState<"IDENTIFIED" | "ANONYMOUS">(
    canChooseCommentIdentity ? "ANONYMOUS" : "IDENTIFIED",
  );
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const localAttachmentPreviewRef = useRef<string | null>(null);
  const threadCount = countThread(items);
  const replyTarget = replyTo ? findComment(items, replyTo) : null;
  useEffect(() => setItems(comments), [comments]);
  useEffect(() => {
    setCommentAuthorMode(canChooseCommentIdentity ? "ANONYMOUS" : "IDENTIFIED");
  }, [canChooseCommentIdentity]);

  useEffect(() => {
    if (!replyTo) return;
    if (!replyTarget) {
      setReplyTo(null);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const composer = composerRef.current;
      if (!composer) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      composer.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      composer.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [replyTarget, replyTo]);

  function releaseLocalAttachmentPreview() {
    const preview = localAttachmentPreviewRef.current;
    if (!preview) return;
    URL.revokeObjectURL(preview);
    localAttachmentPreviewRef.current = null;
  }

  function clearAttachment() {
    releaseLocalAttachmentPreview();
    setAttachment(null);
  }

  useEffect(() => {
    return () => releaseLocalAttachmentPreview();
  }, []);

  function changeSort(nextSort: CommentSort) {
    if (nextSort === sort) return;
    const params = new URLSearchParams(location.search);
    params.set("comments", nextSort);
    navigate(`${location.pathname}?${params.toString()}`);
  }

  function startReply(commentId: string) {
    if (!authenticated || postArchived || commentsClosed) return;
    setReplyTo(commentId);
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

  async function uploadCommentImage(file: File | undefined) {
    if (!file) return;
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (file.size > COMMENT_IMAGE_MAX_BYTES) {
      setStatus(t("comments.error.imageTooLarge"));
      return;
    }
    setImageUploading(true);
    setStatus(undefined);
    try {
      const form = new FormData();
      const prepared = await prepareImageForUpload(file, { purpose: "COMMENT" });
      form.set("file", prepared, prepared.name);
      const response = await fetch("/api/comments/media", {
        method: "POST",
        headers: { "x-csrf-token": readCsrfToken() },
        body: form,
      });
      const payload = (await response.json().catch(() => null)) as {
        assetId?: string;
        label?: string;
        url?: string;
        error?: { code?: string; message?: string };
      } | null;
      if (!response.ok || !payload?.assetId || !payload.url) {
        setStatus(
          localizeApiError(payload, t, "comments.error.imageUpload", { surface: "COMMENT" }),
        );
        return;
      }
      clearLinkPreview();
      setLinkOpen(false);
      setMediaKind(null);
      releaseLocalAttachmentPreview();
      const localPreview = URL.createObjectURL(prepared);
      localAttachmentPreviewRef.current = localPreview;
      setAttachment({
        type: "IMAGE",
        id: payload.assetId,
        label: payload.label || file.name || t("comments.composer.image"),
        preview: localPreview,
      });
    } catch (cause) {
      setStatus(
        cause instanceof Error && cause.message === "IMAGE_DIMENSIONS_INVALID"
          ? localizeApiError(
              { error: { code: "MEDIA_DIMENSIONS_INVALID" } },
              t,
              "comments.error.imageUpload",
              { surface: "COMMENT" },
            )
          : t("comments.error.imageUpload"),
      );
    } finally {
      setImageUploading(false);
    }
  }

  async function previewLink() {
    const candidate = linkUrl.trim();
    if (!candidate) {
      setLinkStatus(t("comments.link.enter"));
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
        if (response.status === 429) throw new Error(t("comments.link.tooMany"));
        if (response.status === 400) throw new Error(t("comments.link.invalid"));
        throw new Error(t("comments.link.metadataUnavailable"));
      }
      setLinkPreview(payload.preview);
      setLinkUrl(payload.preview.canonicalUrl);
      clearAttachment();
      setMediaKind(null);
    } catch (cause) {
      setLinkPreview(null);
      setLinkStatus(cause instanceof Error ? cause.message : t("comments.link.previewUnavailable"));
    } finally {
      setLinkBusy(false);
    }
  }

  async function submit() {
    if (postArchived) {
      setStatus(t("comments.archived.description"));
      return;
    }
    const linkCandidate = linkPreview?.canonicalUrl ?? linkUrl.trim();
    if (submitInFlightRef.current || (!body.trim() && !attachment && !linkCandidate)) return;
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
          attachment: serializeCommentAttachment(attachment),
          linkPreviewUrl: linkCandidate || undefined,
          authorMode: canChooseCommentIdentity ? commentAuthorMode : undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { comment?: CommentView } | null;
      if (!response.ok || !payload?.comment)
        throw new Error(
          response.status === 401 ? t("comments.error.signIn") : t("comments.error.unavailable"),
        );
      const created = payload.comment;
      pendingFocusIdRef.current = created.id;
      setItems((current) => insertRootComment(current, created, sort));
      setBody("");
      clearAttachment();
      setMediaKind(null);
      setLinkOpen(false);
      setLinkUrl("");
      setLinkPreview(null);
      setLinkStatus(undefined);
      setReplyTo(null);
      setStatus(t("comments.status.posted"));
      onCommentsChanged?.();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : t("comments.error.unavailable"));
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section id="comments" className="product-comments" aria-labelledby="comments-heading">
      <header className="product-section-heading">
        <div>
          <span className="product-eyebrow">{t("comments.heading.eyebrow")}</span>
          <h2 id="comments-heading">{t("comments.heading.title")}</h2>
        </div>
        <div className="product-comments__heading-actions">
          <span>{tp("comments.summary", threadCount.comments)}</span>
          <select
            className="product-comments__sort"
            aria-label={t("comments.sort.aria")}
            value={sort}
            onChange={(event) => changeSort(event.target.value as CommentSort)}
          >
            <option value="recent">{t("comments.sort.recent")}</option>
            <option value="popular">{t("comments.sort.popular")}</option>
            <option value="oldest">{t("comments.sort.oldest")}</option>
          </select>
        </div>
      </header>
      {postArchived ? (
        <div className="product-comment-locked glass-panel" role="status">
          <strong>{t("comments.archived.title")}</strong>
          <span>{t("comments.archived.description")}</span>
        </div>
      ) : !authenticated ? (
        <AuthRequiredCard
          title={t("comments.auth.title")}
          description={t("comments.auth.description")}
        />
      ) : commentsClosed ? (
        <div className="product-comment-locked glass-panel" role="status">
          <strong>{t("comments.closed.title")}</strong>
          <span>{t("comments.closed.description")}</span>
        </div>
      ) : (
        <div className="product-comment-composer glass-panel">
          {replyTarget ? (
            <div className="product-comment-composer__reply-context" role="status">
              <span>
                {t("comments.composer.replyingTo", { name: replyTarget.author.displayName })}
              </span>
              <button type="button" onClick={() => setReplyTo(null)}>
                {t("comments.composer.cancelReply")}
              </button>
            </div>
          ) : null}
          {canChooseCommentIdentity ? (
            <label className="product-comment-composer__identity-picker">
              <span>{t("comments.composer.identity.label")}</span>
              <select
                aria-label={t("comments.composer.identity.label")}
                value={commentAuthorMode}
                onChange={(event) =>
                  setCommentAuthorMode(event.target.value as "IDENTIFIED" | "ANONYMOUS")
                }
              >
                <option value="ANONYMOUS">{t("comments.composer.identity.anonymous")}</option>
                <option value="IDENTIFIED">{t("comments.composer.identity.profile")}</option>
              </select>
            </label>
          ) : null}
          {commentAuthorMode === "ANONYMOUS" && canChooseCommentIdentity ? (
            <CosmeticIdentity anonymous mode="compact" avatarSize="sm" nameAs="strong" />
          ) : viewerIdentity?.mode === "IDENTIFIED" ? (
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
            <CosmeticIdentity anonymous mode="compact" avatarSize="sm" nameAs="strong" />
          )}
          <div className="product-comment-composer__field">
            <Textarea
              ref={composerRef}
              id="comment-composer"
              label={replyTo ? t("comments.composer.addReply") : t("comments.composer.addComment")}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t("comments.composer.placeholder")}
            />
            {attachment ? (
              <CommentAttachment attachment={attachment} onRemove={clearAttachment} />
            ) : null}
            <div className="product-comment-composer__toolbar">
              <div>
                <button
                  className={`product-comment-composer__media-action${mediaKind === "GIF" ? " is-active" : ""}`}
                  type="button"
                  aria-label={t("comments.composer.gif")}
                  title={t("comments.composer.gif")}
                  aria-expanded={mediaKind === "GIF"}
                  onClick={() => changeMediaKind(mediaKind === "GIF" ? null : "GIF")}
                >
                  <GifIcon width="20" height="20" />
                </button>
                <button
                  className={`product-comment-composer__media-action${mediaKind === "STICKER" ? " is-active" : ""}`}
                  type="button"
                  aria-label={t("comments.composer.sticker")}
                  title={t("comments.composer.sticker")}
                  aria-expanded={mediaKind === "STICKER"}
                  onClick={() => changeMediaKind(mediaKind === "STICKER" ? null : "STICKER")}
                >
                  <StickerIcon width="20" height="20" />
                </button>
                <button
                  className={`product-comment-composer__media-action${mediaKind === "EMOTE" ? " is-active" : ""}`}
                  type="button"
                  aria-label={t("comments.composer.emote")}
                  title={t("comments.composer.emote")}
                  aria-expanded={mediaKind === "EMOTE"}
                  onClick={() => changeMediaKind(mediaKind === "EMOTE" ? null : "EMOTE")}
                >
                  <SmileIcon width="20" height="20" />
                </button>
                <button
                  className="product-comment-composer__media-action"
                  type="button"
                  aria-label={t("comments.composer.image")}
                  title={t("comments.composer.image")}
                  disabled={imageUploading}
                  onClick={() => imageInputRef.current?.click()}
                >
                  <GalleryIcon width="20" height="20" />
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  hidden
                  onChange={(event) => void uploadCommentImage(event.target.files?.[0])}
                />
                <button
                  className={`product-comment-composer__media-action${linkOpen ? " is-active" : ""}`}
                  type="button"
                  aria-label={t("comments.composer.link")}
                  title={t("comments.composer.link")}
                  aria-expanded={linkOpen}
                  onClick={() => {
                    const nextOpen = !linkOpen;
                    setLinkOpen(nextOpen);
                    if (nextOpen) setMediaKind(null);
                  }}
                >
                  <LinkIcon width="20" height="20" />
                </button>
              </div>
              <Button
                size="sm"
                loading={submitting}
                disabled={
                  imageUploading ||
                  submitting ||
                  (!body.trim() && !attachment && !linkPreview && !linkUrl.trim())
                }
                onClick={() => void submit()}
              >
                {replyTo ? t("comments.actions.reply") : t("post.actions.comment")}
              </Button>
              {replyTo ? (
                <button type="button" onClick={() => setReplyTo(null)}>
                  {t("comments.composer.cancelReply")}
                </button>
              ) : null}
            </div>
            {mediaKind ? (
              <MediaPicker
                kind={mediaKind}
                onKindChange={changeMediaKind}
                onSelect={(item) => {
                  if (item.type === "EMOTE") {
                    const input = composerRef.current;
                    const token = formatEmoteMarkdown(item.shortcode);
                    const selectionStart = input?.selectionStart;
                    const selectionEnd = input?.selectionEnd;
                    let nextCursor = 0;
                    setBody((current) => {
                      const start = selectionStart ?? current.length;
                      const end = selectionEnd ?? start;
                      const before = current.slice(0, start);
                      const after = current.slice(end);
                      const prefix = before && !/\s$/.test(before) ? " " : "";
                      const suffix = after && !/^\s/.test(after) ? " " : "";
                      const inserted = `${prefix}${token}${suffix}`;
                      nextCursor = before.length + inserted.length - suffix.length;
                      return `${before}${inserted}${after}`;
                    });
                    window.requestAnimationFrame(() => {
                      composerRef.current?.focus();
                      composerRef.current?.setSelectionRange(nextCursor, nextCursor);
                    });
                  } else {
                    clearLinkPreview();
                    setLinkOpen(false);
                    releaseLocalAttachmentPreview();
                    setAttachment({
                      type: item.type,
                      id: item.id,
                      label: item.label,
                      provider: item.provider,
                      url: item.url,
                      preview: item.preview,
                    });
                  }
                  if (item.type !== "EMOTE") changeMediaKind(null);
                }}
                onClose={() => changeMediaKind(null)}
              />
            ) : null}
            {linkOpen ? (
              <div className="product-comment-composer__link-panel">
                <Input
                  label={t("comments.composer.linkUrl")}
                  type="url"
                  inputMode="url"
                  placeholder={t("comments.composer.linkPlaceholder")}
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
                    {t("comments.composer.previewLink")}
                  </Button>
                  {linkPreview ? (
                    <Button size="sm" variant="ghost" onClick={clearLinkPreview}>
                      {t("comments.composer.removeLink")}
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
            onReply={startReply}
            authenticated={authenticated}
            readOnly={postArchived || commentsClosed}
            canAcceptSource={canAcceptSource}
            acceptedSourceCommentId={acceptedSourceCommentId}
            canUndoAcceptedSource={canUndoAcceptedSource}
            canModerate={canModerateComments}
            onAcceptSource={onAcceptSource}
            onUndoAcceptedSource={onUndoAcceptedSource}
            onUpdated={(next) => {
              setItems((current) => replaceComment(current, next));
              onCommentUpdated?.(next);
            }}
            onDeleted={(id) => setItems((current) => removeComment(current, id))}
            onChanged={() => onCommentsChanged?.()}
          />
        ))}
      </div>
      {threadCount.comments > 0 ? (
        <div className="product-comments__summary" aria-label={t("comments.summaryAria")}>
          <span>{tp("comments.summary", threadCount.comments)}</span>
          <span aria-hidden="true">·</span>
          <span>{tp("comments.replies", threadCount.replies)}</span>
        </div>
      ) : null}
    </section>
  );
}
