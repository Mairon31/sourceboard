import { useState } from "react";
import type { CommentView } from "../../../shared/ui/contracts";
import { Avatar, Badge, Button, Textarea } from "../ui";

function CommentItem({ comment, depth = 0 }: { comment: CommentView; depth?: number }) {
  const [showReplies, setShowReplies] = useState(depth === 0);
  const hidden = comment.state !== "VISIBLE";

  return (
    <article className={`product-comment${depth ? " product-comment--reply" : ""}`}>
      <Avatar name={comment.author.displayName} size="sm" />
      <div className="product-comment__body">
        <div className="product-comment__heading">
          <strong>{comment.author.displayName}</strong>
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
          <p>{comment.body}</p>
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
          <button type="button">Like · {comment.reaction.count}</button>
          <button type="button">Reply</button>
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
                  <CommentItem key={reply.id} comment={reply} depth={Math.min(depth + 1, 2)} />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
}

export function CommentThread({ comments }: { comments: CommentView[] }) {
  const [sent, setSent] = useState(false);

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
        <Avatar name="Aurora Vale" size="sm" />
        <div className="product-comment-composer__field">
          <Textarea
            label="Add a comment"
            placeholder="Add context, a source link, or explain how you verified it…"
          />
          <div className="product-comment-composer__toolbar">
            <div>
              <button type="button">Emoji</button>
              <button type="button">Emote</button>
              <button type="button">GIF</button>
              <button type="button">Sticker</button>
              <button type="button">Link</button>
            </div>
            <Button size="sm" onClick={() => setSent(true)}>
              Comment
            </Button>
          </div>
          {sent ? <small>Presentation only — this comment was not persisted.</small> : null}
        </div>
      </div>

      <div className="product-comments__list">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>
    </section>
  );
}
