import { useState } from "react";
import type { CommentView } from "../../../shared/ui/contracts";
import { Avatar, Badge, Button, Textarea } from "../ui";

function csrfToken(): string {
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("__Host-sourceboard_csrf="));
  return entry ? decodeURIComponent(entry.slice("__Host-sourceboard_csrf=".length)) : "";
}

function CommentItem({
  comment,
  depth = 0,
  onReply,
  canAcceptSource,
  onAcceptSource,
}: {
  comment: CommentView;
  depth?: number;
  onReply: (commentId: string) => void;
  canAcceptSource?: boolean;
  onAcceptSource?: (commentId: string) => void;
}) {
  const [showReplies, setShowReplies] = useState(depth === 0);
  const [liked, setLiked] = useState(comment.reaction.viewerReacted);
  const [likes, setLikes] = useState(comment.reaction.count);
  const hidden = comment.state !== "VISIBLE";

  async function toggleLike() {
    const response = await fetch(`/api/reactions/COMMENT/${encodeURIComponent(comment.id)}`, {
      method: liked ? "DELETE" : "POST",
      headers: { "x-csrf-token": csrfToken() },
    });
    if (!response.ok) return;
    const result = (await response.json()) as { liked: boolean };
    setLiked(result.liked);
    setLikes((value) => value + (result.liked ? 1 : -1));
  }

  return (
    <article className={`product-comment${depth ? " product-comment--reply" : ""}`}>
      <Avatar
        name={comment.author.displayName}
        size="sm"
        className={
          comment.author.avatarFrame ? `sb-avatar--frame-${comment.author.avatarFrame}` : undefined
        }
      />
      <div className="product-comment__body">
        <div className="product-comment__heading">
          <strong
            style={comment.author.nameFont ? { fontFamily: comment.author.nameFont } : undefined}
          >
            {comment.author.displayName}
          </strong>
          {comment.author.mode === "ANONYMOUS" ? <Badge>Anonymous Author</Badge> : null}
          <span>
            {new Date(comment.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
        <div
          className={
            hidden
              ? "product-comment__bubble product-comment__bubble--muted"
              : "product-comment__bubble"
          }
        >
          <p>
            {comment.richtext?.map((node, index) =>
              node.type === "link" ? (
                <a
                  key={`${comment.id}-${index}`}
                  href={node.url}
                  rel="ugc nofollow noopener noreferrer"
                >
                  {node.label}
                </a>
              ) : node.type === "emote" ? (
                <span key={`${comment.id}-${index}`} aria-label={node.shortcode}>
                  {node.shortcode}
                </span>
              ) : (
                <span key={`${comment.id}-${index}`}>{node.text}</span>
              ),
            ) ?? comment.body}
          </p>
          {comment.attachment ? (
            <div
              className={`product-comment-attachment product-comment-attachment--${comment.attachment.type.toLowerCase()}`}
            >
              <span>{comment.attachment.type}</span>
              <strong>{comment.attachment.label}</strong>
            </div>
          ) : null}
        </div>
        <div className="product-comment__actions">
          <button type="button" aria-pressed={liked} onClick={() => void toggleLike()}>
            {liked ? "Liked" : "Like"} · {likes}
          </button>
          <button type="button" onClick={() => onReply(comment.id)}>
            Reply
          </button>
          {canAcceptSource && comment.state === "VISIBLE" ? (
            <button type="button" onClick={() => onAcceptSource?.(comment.id)}>
              Accept source
            </button>
          ) : null}
          {comment.editedAt ? <span>Edited</span> : null}
          {hidden ? <span>{comment.state === "HIDDEN" ? "Moderated" : "Deleted"}</span> : null}
        </div>
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

export function CommentThread({
  postId,
  comments,
  canAcceptSource,
  onAcceptSource,
}: {
  postId: string;
  comments: CommentView[];
  canAcceptSource?: boolean;
  onAcceptSource?: (commentId: string) => void;
}) {
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  async function submit() {
    if (!body.trim()) return;
    setStatus(null);
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken() },
        body: JSON.stringify({ plaintext: body, parentCommentId: replyTo }),
      });
      if (!response.ok) {
        setStatus(response.status === 401 ? "Sign in to comment." : "Comment unavailable.");
        return;
      }
      setBody("");
      setReplyTo(null);
      setStatus("Comment posted.");
      window.location.reload();
    } catch {
      setStatus("Comment unavailable.");
    }
  }

  return (
    <section className="product-comments" aria-labelledby="comments-heading">
      <header className="product-section-heading">
        <div>
          <span className="product-eyebrow">Discussion</span>
          <h2 id="comments-heading">Comments</h2>
        </div>
        <span>{comments.length} top-level</span>
      </header>

      <div className="product-comment-composer glass-panel">
        <Avatar name="SourceBoard member" size="sm" />
        <div className="product-comment-composer__field">
          <Textarea
            label={replyTo ? "Add a reply" : "Add a comment"}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add context, a source link, or explain how you verified it…"
          />
          <div className="product-comment-composer__toolbar">
            <div>
              <button type="button" disabled>
                Emoji
              </button>
              <button type="button" disabled>
                Emote
              </button>
              <button type="button" disabled title="GIF provider is not configured">
                GIF
              </button>
              <button type="button" disabled title="Sticker catalog is not configured">
                Sticker
              </button>
              <button type="button" disabled>
                Link
              </button>
            </div>
            <Button size="sm" disabled={!body.trim()} onClick={() => void submit()}>
              {replyTo ? "Reply" : "Comment"}
            </Button>
            {replyTo ? (
              <button type="button" onClick={() => setReplyTo(null)}>
                Cancel reply
              </button>
            ) : null}
          </div>
          {status ? <small role="status">{status}</small> : null}
        </div>
      </div>

      <div className="product-comments__list">
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onReply={setReplyTo}
            canAcceptSource={canAcceptSource}
            onAcceptSource={onAcceptSource}
          />
        ))}
      </div>
    </section>
  );
}
