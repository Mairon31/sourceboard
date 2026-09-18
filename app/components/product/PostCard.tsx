import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Link, useNavigate } from "react-router";
import type { PostDetail, PostSummary } from "../../../shared/ui/contracts";
import { readCsrfToken } from "../../data/csrf";
import { markNavigationStart } from "../../data/performance-metrics";
import { canOpenPostModeration } from "../../data/post-actions";
import { useI18n } from "../../i18n/I18nProvider";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { PostCategoryBadge } from "./PostCategoryBadge";
import { ShareAction } from "./ShareAction";
import { RichText } from "./RichText";
import { renderMarkdownPreview } from "../../../shared/richtext/markdown";
import { MediaLightbox } from "./MediaLightbox";
import { ModerationActionDialog } from "./ModerationActionDialog";
import { handleMarkdownShortcut, MarkdownToolbar } from "./MarkdownToolbar";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dropdown,
  EditIcon,
  GalleryIcon,
  HeartIcon,
  Input,
  MessageIcon,
  MoreIcon,
  Modal,
  Textarea,
  TrashIcon,
} from "../ui";

function statusTone(status: PostSummary["status"]) {
  if (status === "VERIFIED") return "success" as const;
  if (status === "ANSWERED") return "accent" as const;
  if (status === "LOCKED") return "warning" as const;
  return "neutral" as const;
}

function postDescriptionNodes(description: string, richtext?: PostSummary["descriptionRichtext"]) {
  if (richtext) return richtext;
  try {
    return renderMarkdownPreview(description);
  } catch {
    return [
      { type: "paragraph" as const, children: [{ type: "text" as const, text: description }] },
    ];
  }
}

function isInteractivePostTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest("a, button, input, textarea, select, label, [contenteditable='true']"))
  );
}

function postDetailHref(post: PostSummary): string {
  const base = `/posts/${encodeURIComponent(post.id)}`;
  return post.slug ? `${base}/${encodeURIComponent(post.slug)}` : base;
}

export function PostCard({
  post,
  compact = false,
  manage = false,
  onChanged,
}: {
  post: PostSummary | PostDetail;
  compact?: boolean;
  manage?: boolean;
  onChanged?: () => void;
}) {
  const navigate = useNavigate();
  const { t, tp, date } = useI18n();
  const [showNsfw, setShowNsfw] = useState(post.nsfwPresentation === "VISIBLE");
  const [liked, setLiked] = useState(post.reaction.viewerReacted);
  const [likes, setLikes] = useState(post.reaction.count);
  const [commentsClosed, setCommentsClosedState] = useState(Boolean(post.commentsClosed));
  const [reactionStatus, setReactionStatus] = useState<string | null>(null);
  const [reactionBusy, setReactionBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editDescription, setEditDescription] = useState(post.description ?? "");
  const editDescriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const [displayTitle, setDisplayTitle] = useState(post.title);
  const [displayDescription, setDisplayDescription] = useState(post.description ?? "");
  const [saving, setSaving] = useState(false);
  const [manageStatus, setManageStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<string>();
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string>();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState("SPAM");
  const [reportDetail, setReportDetail] = useState("");
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const mediaTriggerRef = useRef<HTMLElement | null>(null);
  const mediaRef = useRef<HTMLImageElement>(null);
  const editingRef = useRef(editing);
  const reactionInFlightRef = useRef(false);
  const reactionVersionRef = useRef(0);
  const authoritativeReactionRef = useRef({
    liked: post.reaction.viewerReacted,
    count: post.reaction.count,
  });
  editingRef.current = editing;
  const detailHref = postDetailHref(post);
  const archived = post.status === "ARCHIVED";
  const blurredNsfw = post.isNsfw && post.nsfwPresentation === "BLURRED" && !showNsfw;
  const statusLabel = {
    OPEN: t("post.status.open"),
    ANSWERED: t("post.status.answered"),
    VERIFIED: t("post.status.verified"),
    ARCHIVED: t("post.status.archived"),
    LOCKED: t("post.status.locked"),
  }[post.status];

  useEffect(() => {
    setMediaFailed(false);
  }, [post.imageUrl]);

  useEffect(() => {
    setCommentsClosedState(Boolean(post.commentsClosed));
  }, [post.commentsClosed]);

  useEffect(() => {
    setDisplayTitle(post.title);
    setDisplayDescription(post.description ?? "");
    if (!editingRef.current) {
      setEditTitle(post.title);
      setEditDescription(post.description ?? "");
    }
  }, [post.description, post.title]);

  useEffect(() => {
    authoritativeReactionRef.current = {
      liked: post.reaction.viewerReacted,
      count: post.reaction.count,
    };
    reactionVersionRef.current += 1;
    if (!reactionInFlightRef.current) {
      setLiked(post.reaction.viewerReacted);
      setLikes(post.reaction.count);
    }
  }, [post.reaction.count, post.reaction.viewerReacted]);

  useEffect(() => {
    const image = mediaRef.current;
    if (!image || !post.imageUrl || mediaFailed) return;
    const markFailed = () => setMediaFailed(true);
    if (image.complete && image.naturalWidth === 0) markFailed();
    image.addEventListener("error", markFailed);
    return () => image.removeEventListener("error", markFailed);
  }, [mediaFailed, post.imageUrl]);

  const mediaClass =
    post.imageUrl && !mediaFailed
      ? "product-post__media product-post__media--image"
      : "product-post__media";
  const permissions = "permissions" in post ? post.permissions : undefined;
  const canManageComments = Boolean(
    permissions?.canCloseComments || permissions?.canReopenComments,
  );

  function openPostDetail() {
    if (!editing) {
      markNavigationStart(detailHref);
      navigate(detailHref);
    }
  }

  function handleCardClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (isInteractivePostTarget(event.target)) return;
    openPostDetail();
  }

  async function toggleLike() {
    if (reactionInFlightRef.current) return;
    reactionInFlightRef.current = true;
    setReactionBusy(true);
    setReactionStatus(null);
    const versionAtStart = reactionVersionRef.current;
    const previousLiked = liked;
    const previousLikes = likes;
    const nextLiked = !previousLiked;
    setLiked(nextLiked);
    setLikes(Math.max(0, previousLikes + (nextLiked ? 1 : -1)));

    try {
      const response = await fetch(`/api/reactions/POST/${encodeURIComponent(post.id)}`, {
        method: previousLiked ? "DELETE" : "POST",
        headers: { "x-csrf-token": readCsrfToken() },
      });
      if (!response.ok) {
        setLiked(previousLiked);
        setLikes(previousLikes);
        setReactionStatus(
          response.status === 401 ? t("post.error.signInLike") : t("post.error.likeUnavailable"),
        );
        return;
      }
      const result = (await response.json()) as { liked: boolean };
      if (result.liked !== nextLiked) {
        setLiked(result.liked);
        setLikes(Math.max(0, previousLikes + (result.liked ? 1 : 0) - (previousLiked ? 1 : 0)));
      }
    } catch {
      setLiked(previousLiked);
      setLikes(previousLikes);
      setReactionStatus(t("post.error.likeUnavailable"));
    } finally {
      reactionInFlightRef.current = false;
      setReactionBusy(false);
      if (reactionVersionRef.current !== versionAtStart) {
        setLiked(authoritativeReactionRef.current.liked);
        setLikes(authoritativeReactionRef.current.count);
      }
    }
  }

  async function saveEdit() {
    if (!permissions?.canEdit || !editTitle.trim()) return;
    setSaving(true);
    setManageStatus(null);
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription,
          visibility: post.visibility,
          authorMode: post.author.mode,
          isNsfw: post.isNsfw,
        }),
      });
      if (!response.ok) throw new Error(t("post.error.save"));
      setDisplayTitle(editTitle.trim());
      setDisplayDescription(editDescription);
      setEditing(false);
      setManageStatus(t("post.statusMessage.updated"));
      onChanged?.();
    } catch (error) {
      setManageStatus(error instanceof Error ? error.message : t("post.error.save"));
    } finally {
      setSaving(false);
    }
  }

  async function archivePost() {
    if (archiveBusy) return;
    setArchiveBusy(true);
    setArchiveError(undefined);
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}/archive`, {
        method: "POST",
        headers: { "x-csrf-token": readCsrfToken() },
      });
      if (!response.ok) throw new Error(t("post.error.archive"));
      setManageStatus(t("post.statusMessage.archived"));
      setConfirmArchive(false);
      onChanged?.();
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : t("post.error.archive"));
    } finally {
      setArchiveBusy(false);
    }
  }

  async function deletePost() {
    if (deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(undefined);
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, {
        method: "DELETE",
        headers: { "x-csrf-token": readCsrfToken() },
      });
      if (!response.ok) throw new Error(t("post.error.delete"));
      setConfirmDelete(false);
      navigate("/");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : t("post.error.delete"));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function restorePost() {
    if (restoreBusy) return;
    setRestoreBusy(true);
    setRestoreError(undefined);
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}/restore`, {
        method: "POST",
        headers: { "x-csrf-token": readCsrfToken() },
      });
      if (!response.ok) throw new Error(t("post.error.restore"));
      setManageStatus(t("post.statusMessage.restored"));
      onChanged?.();
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : t("post.error.restore"));
    } finally {
      setRestoreBusy(false);
    }
  }

  async function setCommentsClosed(closed: boolean) {
    setManageStatus(null);
    const previous = commentsClosed;
    setCommentsClosedState(closed);
    try {
      const response = await fetch(
        `/api/posts/${encodeURIComponent(post.id)}/${closed ? "close-comments" : "reopen-comments"}`,
        { method: "POST", headers: { "x-csrf-token": readCsrfToken() } },
      );
      if (!response.ok) throw new Error(t("post.error.commentsUpdate"));
      setManageStatus(
        closed ? t("post.statusMessage.commentsClosed") : t("post.statusMessage.commentsReopened"),
      );
      onChanged?.();
    } catch (error) {
      setCommentsClosedState(previous);
      setManageStatus(error instanceof Error ? error.message : t("post.error.commentsUpdate"));
    }
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReportBusy(true);
    setReportStatus(null);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({
          targetType: "POST",
          targetId: post.id,
          category: reportCategory,
          detail: reportDetail,
        }),
      });
      if (!response.ok) {
        setReportStatus(
          response.status === 409 ? t("post.report.already") : t("post.report.unavailable"),
        );
        return;
      }
      setReportStatus(t("post.report.sent"));
      setReportDetail("");
    } catch {
      setReportStatus(t("post.report.unavailable"));
    } finally {
      setReportBusy(false);
    }
  }

  const menuItems = [
    ...(manage && (permissions?.canRestore || post.restoreAvailable)
      ? [{ label: t("post.menu.restore"), onSelect: () => void restorePost() }]
      : []),
    ...(permissions?.canReport
      ? [{ label: t("post.menu.report"), onSelect: () => setReportOpen(true) }]
      : []),
    ...(canOpenPostModeration(permissions)
      ? [
          {
            label: t("post.menu.moderate"),
            onSelect: () => setModerationOpen(true),
          },
        ]
      : []),
    ...(manage
      ? [
          ...(permissions?.canEdit
            ? [
                {
                  label: t("post.menu.edit"),
                  icon: <EditIcon width="16" height="16" />,
                  onSelect: () => setEditing(true),
                },
              ]
            : []),
          ...(permissions?.canArchive
            ? [
                {
                  label: t("post.menu.archive"),
                  onSelect: () => {
                    setArchiveError(undefined);
                    setConfirmArchive(true);
                  },
                },
              ]
            : []),
          ...(canManageComments && !commentsClosed
            ? [
                {
                  label: t("post.menu.closeComments"),
                  onSelect: () => void setCommentsClosed(true),
                },
              ]
            : []),
          ...(canManageComments && commentsClosed
            ? [
                {
                  label: t("post.menu.reopenComments"),
                  onSelect: () => void setCommentsClosed(false),
                },
              ]
            : []),
          ...(permissions?.canDelete
            ? [
                {
                  label: t("post.menu.delete"),
                  icon: <TrashIcon width="16" height="16" />,
                  destructive: true,
                  onSelect: () => {
                    setDeleteError(undefined);
                    setConfirmDelete(true);
                  },
                },
              ]
            : []),
        ]
      : []),
  ];

  const shareUrl =
    typeof window === "undefined"
      ? detailHref
      : new URL(detailHref, window.location.origin).toString();

  return (
    <Card
      className={`product-post product-post--clickable${compact ? " product-post--compact" : ""}`}
      onClick={handleCardClick}
    >
      <header className="product-post__header">
        {post.author.mode === "ANONYMOUS" ? (
          <CosmeticIdentity anonymous mode="compact" nameAs="strong" />
        ) : (
          <Link
            to={post.author.profileUrl ?? `/u/${post.author.username ?? "aurora"}`}
            onClick={() => markNavigationStart("/u/:username")}
          >
            <CosmeticIdentity
              displayName={post.author.displayName}
              avatarUrl={post.author.avatarUrl}
              avatarFrame={post.author.avatarFrame}
              nameFont={post.author.nameFont}
              nameEffect={post.author.nameEffect}
              visuals={post.author.visuals}
              mode="compact"
              nameAs="strong"
            />
          </Link>
        )}
        <div className="product-post__author">
          <span>
            {date(new Date(post.createdAt), {
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}
          </span>
        </div>
        <div className="product-post__badges">
          {post.author.mode === "ANONYMOUS" ? <Badge>{t("post.badges.anonymous")}</Badge> : null}
          {post.isNsfw ? <Badge tone="danger">NSFW</Badge> : null}
          <PostCategoryBadge
            slug={post.categorySlug}
            linked={post.visibility === "PUBLIC" && post.status !== "ARCHIVED"}
          />
          <Badge tone={statusTone(post.status)}>{statusLabel}</Badge>
          {menuItems.length ? (
            <Dropdown
              label={t("post.actions.more")}
              ariaLabel={t("post.actions.moreAria")}
              triggerIcon={<MoreIcon width="18" height="18" />}
              iconOnly
              className="product-post__menu"
              items={menuItems}
            />
          ) : null}
        </div>
      </header>

      <div className="product-post__copy">
        {editing ? (
          <div className="product-post__inline-editor" onClick={(event) => event.stopPropagation()}>
            <Input
              label={t("post.editor.title")}
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              required
            />
            <MarkdownToolbar
              value={editDescription}
              onChange={setEditDescription}
              inputRef={editDescriptionRef}
              labels={{
                toolbar: t("composer.description.toolbar"),
                bold: t("composer.description.bold"),
                italic: t("composer.description.italic"),
                heading1: t("composer.description.heading1"),
                heading2: t("composer.description.heading2"),
                heading3: t("composer.description.heading3"),
                quote: t("composer.description.quote"),
                bulletList: t("composer.description.bulletList"),
                numberedList: t("composer.description.numberedList"),
                code: t("composer.description.code"),
                link: t("composer.description.link"),
                emote: t("composer.description.emote"),
                linkText: t("composer.description.linkText"),
              }}
              disabled={saving}
            />
            <Textarea
              ref={editDescriptionRef}
              label={t("post.editor.description")}
              value={editDescription}
              maxLength={10_000}
              onChange={(event) => setEditDescription(event.target.value)}
              onKeyDown={(event) =>
                handleMarkdownShortcut(
                  event,
                  editDescription,
                  editDescriptionRef,
                  setEditDescription,
                )
              }
            />
            <div className="product-chip-row">
              <Button size="sm" loading={saving} onClick={() => void saveEdit()}>
                {t("post.editor.save")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditTitle(displayTitle);
                  setEditDescription(displayDescription);
                  setEditing(false);
                }}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Link
              to={detailHref}
              className="product-post__title"
              onClick={() => markNavigationStart(detailHref)}
            >
              {displayTitle}
            </Link>
            {displayDescription ? (
              <RichText
                className="product-post__description"
                nodes={postDescriptionNodes(
                  displayDescription,
                  displayDescription === (post.description ?? "")
                    ? post.descriptionRichtext
                    : undefined,
                )}
              />
            ) : null}
          </>
        )}
      </div>

      {post.isNsfw && post.nsfwPresentation === "HIDDEN" ? (
        <div className="product-nsfw-gate">
          <div>
            <Badge tone="danger">NSFW</Badge>
            <strong>{t("post.nsfw.hiddenTitle")}</strong>
            <p>{t("post.nsfw.hiddenDescription")}</p>
          </div>
        </div>
      ) : (
        <div className={`${mediaClass}${blurredNsfw ? " product-post__media--nsfw-blurred" : ""}`}>
          <Link
            to={detailHref}
            className="product-post__media-link"
            aria-label={t("post.openAria", { title: displayTitle })}
            onClick={(event) => {
              if (post.imageUrl && !mediaFailed) {
                event.preventDefault();
                event.stopPropagation();
                mediaTriggerRef.current = event.currentTarget;
                setLightboxOpen(true);
                return;
              }
              markNavigationStart(detailHref);
            }}
          >
            {post.imageUrl && !mediaFailed ? (
              <img
                ref={mediaRef}
                src={post.imageUrl}
                alt={post.imageAlt}
                width={post.imageWidth}
                height={post.imageHeight}
                loading="lazy"
                onError={() => setMediaFailed(true)}
              />
            ) : mediaFailed ? (
              <div
                className="product-post__media-unavailable"
                role="img"
                aria-label={post.imageAlt}
              >
                <strong>{t("post.media.unavailable")}</strong>
                <span>{t("post.media.loadError")}</span>
              </div>
            ) : (
              <div className="product-post__media-frame" role="img" aria-label={post.imageAlt}>
                <span />
                <span />
                <span />
              </div>
            )}
          </Link>
          {post.imageUrl && !mediaFailed && !blurredNsfw ? (
            <button
              type="button"
              className="product-post__media-expand"
              ref={(element) => {
                if (element && (!mediaTriggerRef.current || !mediaTriggerRef.current.isConnected)) {
                  mediaTriggerRef.current = element;
                }
              }}
              aria-label={t("post.media.previewTitle")}
              title={t("post.media.previewTitle")}
              onClick={(event) => {
                mediaTriggerRef.current = event.currentTarget;
                setLightboxOpen(true);
              }}
            >
              <GalleryIcon width="18" height="18" />
            </button>
          ) : null}
          {blurredNsfw ? (
            <div className="product-nsfw-media-overlay">
              <Badge tone="danger">NSFW</Badge>
              <strong>{t("post.nsfw.blurredTitle")}</strong>
              <p>{t("post.nsfw.blurredDescription")}</p>
              <Button variant="secondary" size="sm" onClick={() => setShowNsfw(true)}>
                {t("post.nsfw.showOnce")}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <div className="product-post__engagement">
        <div className="product-post__meta">
          <Link
            className="product-post__comment-count"
            to={`${detailHref}#comments`}
            onClick={() => markNavigationStart(detailHref)}
          >
            {tp("comments.summary", post.commentCount)}
          </Link>
          {post.verifiedSource || post.acceptedSource ? (
            <span className="product-meta-success">
              {post.verifiedSource ? t("post.meta.verified") : t("post.meta.acceptedSource")}
            </span>
          ) : null}
          {commentsClosed ? (
            <span className="product-meta-success">{t("post.meta.commentsClosed")}</span>
          ) : null}
        </div>

        <footer className="product-post__actions">
          <button
            type="button"
            className={`product-post__action product-post__action--like${liked ? " product-post__action--liked" : ""}`}
            aria-pressed={liked}
            aria-label={liked ? t("post.actions.unlike") : t("post.actions.like")}
            disabled={reactionBusy}
            onClick={() => void toggleLike()}
          >
            <HeartIcon fill={liked ? "currentColor" : "none"} />
            {!post.likeCountHidden ? <span>{likes}</span> : null}
          </button>
          {archived ? (
            <button
              type="button"
              className="product-post__action product-post__action--disabled"
              aria-label={t("post.actions.commentDisabled")}
              title={t("post.actions.commentDisabled")}
              disabled
            >
              <MessageIcon />
              <span>{t("post.actions.comment")}</span>
            </button>
          ) : (
            <Link
              className="product-post__action"
              to={`${detailHref}#comments`}
              onClick={() => markNavigationStart(detailHref)}
            >
              <MessageIcon />
              <span>{t("post.actions.comment")}</span>
            </Link>
          )}
          <ShareAction
            url={shareUrl}
            title={displayTitle}
            text={displayDescription || undefined}
            target={{ resourceType: "POST", resourceId: post.id }}
          />
        </footer>
        {reactionStatus ? (
          <small className="product-post__reaction-status" role="status">
            {reactionStatus}
          </small>
        ) : null}
        {manageStatus ? (
          <small className="product-post__reaction-status" role="status">
            {manageStatus}
          </small>
        ) : null}
        {restoreError ? (
          <small className="product-post__reaction-status" role="alert">
            {restoreError}
          </small>
        ) : null}
      </div>
      <ModerationActionDialog
        open={moderationOpen}
        target={{ targetType: "POST", post }}
        onOpenChange={setModerationOpen}
        onApplied={() => {
          setManageStatus(t("post.statusMessage.updated"));
          onChanged?.();
        }}
      />
      <ConfirmDialog
        title={t("post.dialog.archiveTitle")}
        description={t("post.dialog.archiveDescription")}
        confirmLabel={t("post.menu.archive")}
        open={confirmArchive}
        busy={archiveBusy}
        error={archiveError}
        onConfirm={() => void archivePost()}
        onOpenChange={setConfirmArchive}
      />
      <Modal
        title={t("post.report.title")}
        description={t("post.report.description")}
        open={reportOpen}
        onOpenChange={setReportOpen}
      >
        <form className="product-comment-report" onSubmit={(event) => void submitReport(event)}>
          <label className="product-field-native">
            <span>{t("post.report.reason")}</span>
            <select
              value={reportCategory}
              onChange={(event) => setReportCategory(event.target.value)}
            >
              <option value="SPAM">{t("comments.report.category.spam")}</option>
              <option value="HARASSMENT">{t("comments.report.category.harassment")}</option>
              <option value="MISLEADING_SOURCE">
                {t("comments.report.category.misleadingSource")}
              </option>
              <option value="NSFW">{t("comments.report.category.nsfw")}</option>
              <option value="PRIVACY">{t("comments.report.category.privacy")}</option>
              <option value="COPYRIGHT">{t("comments.report.category.copyright")}</option>
              <option value="OTHER">{t("comments.report.category.other")}</option>
            </select>
          </label>
          <Textarea
            label={t("post.report.note")}
            value={reportDetail}
            maxLength={2000}
            onChange={(event) => setReportDetail(event.target.value)}
          />
          <div className="product-chip-row">
            <Button type="submit" size="sm" loading={reportBusy}>
              {t("post.report.send")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setReportOpen(false)}>
              {t("common.cancel")}
            </Button>
          </div>
          {reportStatus ? <small role="status">{reportStatus}</small> : null}
        </form>
      </Modal>
      <ConfirmDialog
        title={t("post.dialog.deleteTitle")}
        description={t("post.dialog.deleteDescription")}
        confirmLabel={t("post.menu.delete")}
        destructive
        open={confirmDelete}
        busy={deleteBusy}
        error={deleteError}
        onConfirm={() => void deletePost()}
        onOpenChange={setConfirmDelete}
      />
      {post.imageUrl ? (
        <MediaLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          src={post.imageUrl}
          alt={post.imageAlt}
          width={post.imageWidth}
          height={post.imageHeight}
          returnFocusRef={mediaTriggerRef}
        />
      ) : null}
    </Card>
  );
}
