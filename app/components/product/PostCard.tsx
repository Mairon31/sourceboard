import {
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Link, useNavigate } from "react-router";
import type { PostSummary } from "../../../shared/ui/contracts";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { Avatar, Badge, Button, Card, HeartIcon, MessageIcon, ShareIcon } from "../ui";

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

export function PostCard({ post, compact = false }: { post: PostSummary; compact?: boolean }) {
  const navigate = useNavigate();
  const [showNsfw, setShowNsfw] = useState(post.nsfwPresentation === "VISIBLE");
  const [liked, setLiked] = useState(post.reaction.viewerReacted);
  const [likes, setLikes] = useState(post.reaction.count);
  const [reactionStatus, setReactionStatus] = useState<string | null>(null);
  const detailHref = postDetailHref(post);
  const mediaClass = post.imageUrl
    ? "product-post__media product-post__media--image"
    : "product-post__media";

  function openPostDetail() {
    navigate(detailHref);
  }

  function handleCardClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (isInteractivePostTarget(event.target)) return;
    openPostDetail();
  }

  function handleCardKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.key !== "Enter") return;
    event.preventDefault();
    openPostDetail();
  }

  async function toggleLike() {
    setReactionStatus(null);
    const previousLiked = liked;
    const previousLikes = likes;
    const nextLiked = !previousLiked;
    setLiked(nextLiked);
    setLikes(Math.max(0, previousLikes + (nextLiked ? 1 : -1)));

    const csrf = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("__Host-sourceboard_csrf="));
    try {
      const response = await fetch(`/api/reactions/POST/${encodeURIComponent(post.id)}`, {
        method: previousLiked ? "DELETE" : "POST",
        headers: {
          "x-csrf-token": csrf
            ? decodeURIComponent(csrf.slice("__Host-sourceboard_csrf=".length))
            : "",
        },
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

  return (
    <Card
      className={`product-post product-post--clickable${compact ? " product-post--compact" : ""}`}
      role="link"
      tabIndex={0}
      aria-label={`Open post: ${post.title}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
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
        </div>
      </header>

      <div className="product-post__copy">
        <Link to={detailHref} className="product-post__title">
          {post.title}
        </Link>
        {post.description ? <p>{post.description}</p> : null}
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
        <div className={mediaClass}>
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
        </div>
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
          <button type="button" className="product-post__action" disabled aria-label="Share post">
            <ShareIcon />
            <span>Share</span>
          </button>
        </footer>
        {reactionStatus ? (
          <small className="product-post__reaction-status" role="status">
            {reactionStatus}
          </small>
        ) : null}
      </div>
    </Card>
  );
}
