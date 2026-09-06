import { useState } from "react";
import { Link } from "react-router";
import type { PostSummary } from "../../../shared/ui/contracts";
import { Avatar, Badge, Button, Card } from "../ui";

function statusTone(status: PostSummary["status"]) {
  if (status === "VERIFIED") return "success" as const;
  if (status === "ANSWERED") return "accent" as const;
  if (status === "LOCKED") return "warning" as const;
  return "neutral" as const;
}

export function PostCard({ post, compact = false }: { post: PostSummary; compact?: boolean }) {
  const [showNsfw, setShowNsfw] = useState(post.nsfwPresentation === "VISIBLE");
  const [liked, setLiked] = useState(post.reaction.viewerReacted);
  const [likes, setLikes] = useState(post.reaction.count);
  const [reactionStatus, setReactionStatus] = useState<string | null>(null);

  async function toggleLike() {
    setReactionStatus(null);
    const csrf = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("__Host-sourceboard_csrf="));
    try {
      const response = await fetch(`/api/reactions/POST/${encodeURIComponent(post.id)}`, {
        method: liked ? "DELETE" : "POST",
        headers: {
          "x-csrf-token": csrf
            ? decodeURIComponent(csrf.slice("__Host-sourceboard_csrf=".length))
            : "",
        },
      });
      if (!response.ok) {
        setReactionStatus(response.status === 401 ? "Sign in to like posts." : "Like unavailable.");
        return;
      }
      const result = (await response.json()) as { liked: boolean };
      setLiked(result.liked);
      setLikes((count) => count + (result.liked ? 1 : -1));
    } catch {
      setReactionStatus("Like unavailable.");
    }
  }

  return (
    <Card className={`product-post${compact ? " product-post--compact" : ""}`}>
      <header className="product-post__header">
        {post.author.mode === "ANONYMOUS" ? (
          <Avatar name="Anonymous Author" />
        ) : (
          <Avatar name={post.author.displayName} src={post.author.avatarUrl} />
        )}
        <div className="product-post__author">
          {post.author.mode === "ANONYMOUS" ? (
            <strong>Anonymous Author</strong>
          ) : (
            <Link to={post.author.profileUrl ?? `/u/${post.author.username ?? "aurora"}`}>
              {post.author.displayName}
            </Link>
          )}
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
        <Link to={`/posts/${post.id}`} className="product-post__title">
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
        <div className="product-post__media">
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

      <div className="product-post__meta">
        <span>{likes} likes</span>
        <span>{post.commentCount} comments</span>
        {post.acceptedSource ? <span className="product-meta-success">Source accepted</span> : null}
        {post.verifiedSource ? <span className="product-meta-success">Verified</span> : null}
      </div>

      <footer className="product-post__actions">
        <Button
          variant={liked ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={liked}
          onClick={() => void toggleLike()}
        >
          {liked ? "Liked" : "Like"}
        </Button>
        <Link className="product-text-action" to={`/posts/${post.id}`}>
          Comment
        </Link>
        <button type="button" className="product-text-action" disabled>
          Share
        </button>
      </footer>
      {reactionStatus ? <span role="status">{reactionStatus}</span> : null}
    </Card>
  );
}
