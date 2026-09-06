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
  const [liked, setLiked] = useState(post.reaction.viewerReacted);
  const [showNsfw, setShowNsfw] = useState(post.nsfwPresentation === "VISIBLE");
  const likes = post.reaction.count + (liked === post.reaction.viewerReacted ? 0 : liked ? 1 : -1);

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
            <Link to={post.author.profileUrl ?? `/profile/${post.author.username ?? "aurora"}`}>
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

      {post.isNsfw && !showNsfw ? (
        <div className="product-nsfw-gate">
          <div>
            <Badge tone="danger">NSFW</Badge>
            <strong>Content hidden by your NSFW preference</strong>
            <p>This presentation does not load or expose sensitive imagery.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowNsfw(true)}>
            Show once
          </Button>
        </div>
      ) : (
        <div className="product-post__media" role="img" aria-label={post.imageAlt}>
          <div className="product-post__media-frame" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
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
          onClick={() => setLiked((value) => !value)}
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
    </Card>
  );
}
