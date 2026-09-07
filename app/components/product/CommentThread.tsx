import { useState } from "react";
import type { CommentAttachmentView, CommentView } from "../../../shared/ui/contracts";
import { readCsrfToken } from "../../data/csrf";
import { AuthRequiredCard } from "./AuthRequiredCard";
import { Avatar, Badge, Button, Input, Textarea } from "../ui";

interface KlipyMediaItem {
  id: string;
  title: string;
  label: string;
  url: string;
  preview: string;
  type: "GIF" | "STICKER";
  provider: "klipy";
}

function CommentAttachment({ attachment }: { attachment: CommentAttachmentView }) {
  const imageUrl = attachment.preview ?? attachment.url;
  return (
    <div
      className={`product-comment-attachment product-comment-attachment--${attachment.type.toLowerCase()}`}
    >
      {imageUrl ? (
        <div className="product-comment-attachment__media">
          <img src={imageUrl} alt={attachment.label} loading="lazy" />
          {attachment.provider === "klipy" ? <small>Powered by KLIPY</small> : null}
        </div>
      ) : null}
      <div>
        <span>{attachment.type}</span>
        <strong>{attachment.label}</strong>
      </div>
    </div>
  );
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
      headers: { "x-csrf-token": readCsrfToken() },
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
        src={comment.author.avatarUrl}
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
          {comment.attachment ? <CommentAttachment attachment={comment.attachment} /> : null}
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

function MediaPicker({
  kind,
  onSelect,
  onClose,
}: {
  kind: "GIF" | "STICKER";
  onSelect: (item: KlipyMediaItem) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<KlipyMediaItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search() {
    const value = query.trim();
    if (!value) {
      setStatus("Enter a search term.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(
        `/api/comments/media/search?type=${kind}&q=${encodeURIComponent(value)}`,
      );
      const body = (await response.json().catch(() => null)) as {
        items?: KlipyMediaItem[];
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setStatus(body?.error?.message ?? "Media search is unavailable.");
        setItems([]);
        return;
      }
      setItems(Array.isArray(body?.items) ? body.items : []);
      if (!body?.items?.length) setStatus("No results found.");
    } catch {
      setStatus("Media search is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="product-comment-media-picker">
      <div className="product-comment-media-picker__controls">
        <Input
          label="Search KLIPY"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search KLIPY"
          type="search"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void search();
            }
          }}
        />
        <Button size="sm" loading={busy} onClick={() => void search()}>
          Search
        </Button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      {items.length ? (
        <div className="product-comment-media-picker__results" aria-label={`${kind} results`}>
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => onSelect(item)}>
              <img src={item.preview || item.url} alt={item.title} loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
      {status ? <small role="status">{status}</small> : null}
      <small>Powered by KLIPY</small>
    </div>
  );
}

export function CommentThread({
  postId,
  comments,
  authenticated = true,
  canAcceptSource,
  onAcceptSource,
}: {
  postId: string;
  comments: CommentView[];
  authenticated?: boolean;
  canAcceptSource?: boolean;
  onAcceptSource?: (commentId: string) => void;
}) {
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"GIF" | "STICKER" | null>(null);
  const [attachment, setAttachment] = useState<CommentAttachmentView | null>(null);

  async function submit() {
    if (!body.trim() && !attachment) return;
    setStatus(null);
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({
          plaintext: body,
          parentCommentId: replyTo,
          attachment: attachment
            ? {
                type: attachment.type,
                id: attachment.id,
                label: attachment.label,
                provider: attachment.provider,
                url: attachment.url,
                preview: attachment.preview,
              }
            : undefined,
        }),
      });
      if (!response.ok) {
        setStatus(response.status === 401 ? "Sign in to comment." : "Comment unavailable.");
        return;
      }
      setBody("");
      setAttachment(null);
      setMediaKind(null);
      setReplyTo(null);
      setStatus("Comment posted.");
      window.location.reload();
    } catch {
      setStatus("Comment unavailable.");
    }
  }

  function selectMedia(item: KlipyMediaItem) {
    setAttachment({
      type: item.type,
      id: item.id,
      label: item.label,
      provider: item.provider,
      url: item.url,
      preview: item.preview,
    });
    setMediaKind(null);
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

      {!authenticated ? (
        <AuthRequiredCard
          title="Sign in to join the discussion"
          description="Create an account or sign in to comment, reply and react to source requests."
        />
      ) : (
        <div className="product-comment-composer glass-panel">
          <Avatar name="SourceBoard member" size="sm" />
          <div className="product-comment-composer__field">
            <Textarea
              label={replyTo ? "Add a reply" : "Add a comment"}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Add context, a source link, or explain how you verified it…"
            />
            {attachment ? <CommentAttachment attachment={attachment} /> : null}
            <div className="product-comment-composer__toolbar">
              <div>
                <button
                  type="button"
                  aria-expanded={mediaKind === "GIF"}
                  onClick={() => setMediaKind(mediaKind === "GIF" ? null : "GIF")}
                >
                  GIF
                </button>
                <button
                  type="button"
                  aria-expanded={mediaKind === "STICKER"}
                  onClick={() => setMediaKind(mediaKind === "STICKER" ? null : "STICKER")}
                >
                  Sticker
                </button>
                {attachment ? (
                  <button type="button" onClick={() => setAttachment(null)}>
                    Remove media
                  </button>
                ) : null}
              </div>
              <Button
                size="sm"
                disabled={!body.trim() && !attachment}
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
                onSelect={selectMedia}
                onClose={() => setMediaKind(null)}
              />
            ) : null}
            {status ? <small role="status">{status}</small> : null}
          </div>
        </div>
      )}

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
