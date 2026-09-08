import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { Link, useNavigate } from "react-router";
import type { PostDetail, PostSummary } from "../../../shared/ui/contracts";
import { readCsrfToken } from "../../data/csrf";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { ShareAction } from "./ShareAction";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dropdown,
  EditIcon,
  HeartIcon,
  Input,
  MessageIcon,
  MoreIcon,
  Textarea,
  TrashIcon,
} from "../ui";

function statusTone(status: PostSummary["status"]) {
  if (status === "VERIFIED") return "success" as const;
  if (status === "ANSWERED") return "accent" as const;
  if (status === "LOCKED") return "warning" as const;
  return "neutral" as const;
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
  const [showNsfw, setShowNsfw] = useState(post.nsfwPresentation === "VISIBLE");
  const [liked, setLiked] = useState(post.reaction.viewerReacted);
  const [likes, setLikes] = useState(post.reaction.count);
  const [reactionStatus, setReactionStatus] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editDescription, setEditDescription] = useState(post.description ?? "");
  const [displayTitle, setDisplayTitle] = useState(post.title);
  const [displayDescription, setDisplayDescription] = useState(post.description ?? "");
  const [saving, setSaving] = useState(false);
  const [manageStatus, setManageStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const detailHref = postDetailHref(post);
  const mediaClass = post.imageUrl
    ? "product-post__media product-post__media--image"
    : "product-post__media";
  const permissions = "permissions" in post ? post.permissions : undefined;

  function openPostDetail() {
    if (!editing) navigate(detailHref);
  }

  function handleCardClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (isInteractivePostTarget(event.target)) return;
    openPostDetail();
  }

  async function toggleLike() {
    setReactionStatus(null);
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
        setReactionStatus(response.status === 401 ? "Sign in to like posts." : "Like unavailable.");
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
      setReactionStatus("Like unavailable.");
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
      if (!response.ok) throw new Error("Could not save this post.");
      setDisplayTitle(editTitle.trim());
      setDisplayDescription(editDescription);
      setEditing(false);
      setManageStatus("Post updated.");
      onChanged?.();
    } catch (error) {
      setManageStatus(error instanceof Error ? error.message : "Could not save this post.");
    } finally {
      setSaving(false);
    }
  }

  async function archivePost() {
    const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}/archive`, {
      method: "POST",
      headers: { "x-csrf-token": readCsrfToken() },
    });
    if (!response.ok) throw new Error("Could not archive this post.");
    setManageStatus("Post archived.");
    setConfirmArchive(false);
    onChanged?.();
  }

  async function deletePost() {
    const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, {
      method: "DELETE",
      headers: { "x-csrf-token": readCsrfToken() },
    });
    if (!response.ok) throw new Error("Could not delete this post.");
    setConfirmDelete(false);
    navigate("/");
  }

  const menuItems = manage
    ? [
        ...(permissions?.canEdit
          ? [
              {
                label: "Edit post",
                icon: <EditIcon width="16" height="16" />,
                onSelect: () => setEditing(true),
              },
            ]
          : []),
        ...(permissions?.canArchive
          ? [
              {
                label: "Archive post",
                onSelect: () => setConfirmArchive(true),
              },
            ]
          : []),
        ...(permissions?.canDelete
          ? [
              {
                label: "Delete post",
                icon: <TrashIcon width="16" height="16" />,
                destructive: true,
                onSelect: () => setConfirmDelete(true),
              },
            ]
          : []),
      ]
    : [];

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
          <Avatar name="Anonymous Author" />
        ) : (
          <Link to={post.author.profileUrl ?? `/u/${post.author.username ?? "aurora"}`}>
            <CosmeticIdentity
              displayName={post.author.displayName}
              avatarUrl={post.author.avatarUrl}
              avatarFrame={post.author.avatarFrame}
              profileEffect={post.author.profileEffect}
              nameFont={post.author.nameFont}
              mode="compact"
              nameAs="strong"
            />
          </Link>
        )}
        <div className="product-post__author">
          {post.author.mode === "ANONYMOUS" ? <strong>Anonymous Author</strong> : null}
          <span>
            {new Date(post.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
        <div className="product-post__badges">
          {post.author.mode === "ANONYMOUS" ? <Badge>Anonymous</Badge> : null}
          {post.isNsfw ? <Badge tone="danger">NSFW</Badge> : null}
          <Badge tone={statusTone(post.status)}>{post.status.toLowerCase()}</Badge>
          {menuItems.length ? (
            <Dropdown
              label="More"
              ariaLabel="More post actions"
              triggerIcon={<MoreIcon width="18" height="18" />}
              iconOnly
              items={menuItems}
            />
          ) : null}
        </div>
      </header>

      <div className="product-post__copy">
        {editing ? (
          <div className="product-post__inline-editor" onClick={(event) => event.stopPropagation()}>
            <Input
              label="Title"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              required
            />
            <Textarea
              label="Description"
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
            />
            <div className="product-chip-row">
              <Button size="sm" loading={saving} onClick={() => void saveEdit()}>
                Save changes
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
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Link to={detailHref} className="product-post__title">
              {displayTitle}
            </Link>
            {displayDescription ? <p>{displayDescription}</p> : null}
          </>
        )}
      </div>

      {post.isNsfw && (post.nsfwPresentation === "HIDDEN" || !showNsfw) ? (
        <div className="product-nsfw-gate">
          <div>
            <Badge tone="danger">NSFW</Badge>
            <strong>
              {post.nsfwPresentation === "HIDDEN"
                ? "Content hidden by your NSFW preference"
                : "Sensitive media blurred by your preference"}
            </strong>
            <p>
              {post.nsfwPresentation === "HIDDEN"
                ? "This presentation does not load or expose sensitive imagery."
                : "Reveal it for this view if your server-side preference allows access."}
            </p>
          </div>
          {post.nsfwPresentation === "BLURRED" ? (
            <Button variant="secondary" size="sm" onClick={() => setShowNsfw(true)}>
              Show once
            </Button>
          ) : null}
        </div>
      ) : (
        <Link to={detailHref} className={mediaClass} aria-label={`Open post: ${displayTitle}`}>
          {post.imageUrl ? (
            <img
              src={post.imageUrl}
              alt={post.imageAlt}
              width={post.imageWidth}
              height={post.imageHeight}
              loading="lazy"
            />
          ) : (
            <div className="product-post__media-frame" role="img" aria-label={post.imageAlt}>
              <span />
              <span />
              <span />
            </div>
          )}
        </Link>
      )}

      <div className="product-post__engagement">
        <div className="product-post__meta">
          <span>
            <strong>{likes}</strong> {likes === 1 ? "like" : "likes"}
          </span>
          <span>
            <strong>{post.commentCount}</strong> {post.commentCount === 1 ? "comment" : "comments"}
          </span>
          {post.acceptedSource ? (
            <span className="product-meta-success">Source accepted</span>
          ) : null}
          {post.verifiedSource ? <span className="product-meta-success">Verified</span> : null}
        </div>

        <footer className="product-post__actions">
          <button
            type="button"
            className={`product-post__action${liked ? " product-post__action--liked" : ""}`}
            aria-pressed={liked}
            aria-label={liked ? "Unlike post" : "Like post"}
            onClick={() => void toggleLike()}
          >
            <HeartIcon />
            <span>{liked ? "Liked" : "Like"}</span>
          </button>
          <Link className="product-post__action" to={`${detailHref}#comments`}>
            <MessageIcon />
            <span>Comment</span>
          </Link>
          <ShareAction url={shareUrl} title={displayTitle} text={displayDescription || undefined} />
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
      </div>
      <ConfirmDialog
        title="Archive this post?"
        description="The post will no longer appear as an active source request."
        confirmLabel="Archive post"
        open={confirmArchive}
        onConfirm={() => void archivePost()}
        onOpenChange={setConfirmArchive}
      />
      <ConfirmDialog
        title="Delete this post?"
        description="This permanently removes the post from SourceBoard."
        confirmLabel="Delete post"
        destructive
        open={confirmDelete}
        onConfirm={() => void deletePost()}
        onOpenChange={setConfirmDelete}
      />
    </Card>
  );
}
