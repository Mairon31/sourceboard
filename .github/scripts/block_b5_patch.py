from pathlib import Path


def replace_once(path_name: str, old: str, new: str) -> None:
    path = Path(path_name)
    text = path.read_text()
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"anchor not found in {path_name}: {old[:100]!r}")
    path.write_text(text.replace(old, new, 1))


icons = Path("app/components/ui/icons.tsx")
text = icons.read_text()
if "export function LinkIcon" not in text:
    anchor = "export function ShareIcon(props: IconProps) {"
    if anchor not in text:
        raise SystemExit("ShareIcon anchor missing")
    link_icon = '''export function LinkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 13a5 5 0 0 0 7.1.1l2-2A5 5 0 0 0 12 4l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" />
    </IconBase>
  );
}

'''
    text = text.replace(anchor, link_icon + anchor, 1)
icons.write_text(text)

card = Path("app/components/product/LinkPreviewCard.tsx")
if not card.exists():
    card.write_text('''import type { CommentLinkPreviewView } from "../../../shared/ui/contracts";

function previewLabel(preview: CommentLinkPreviewView): string {
  if (preview.siteName) return preview.siteName;
  try {
    return new URL(preview.canonicalUrl).hostname;
  } catch {
    return "Link";
  }
}

export function LinkPreviewCard({ preview }: { preview: CommentLinkPreviewView }) {
  return (
    <a
      className="product-link-preview-card"
      href={preview.canonicalUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      {preview.imageUrl ? (
        <img
          className="product-link-preview-card__image"
          src={preview.imageUrl}
          alt=""
          loading="lazy"
        />
      ) : null}
      <span className="product-link-preview-card__body">
        <small className="product-link-preview-card__site">{previewLabel(preview)}</small>
        {preview.title ? <strong>{preview.title}</strong> : null}
        {preview.description ? (
          <span className="product-link-preview-card__description">{preview.description}</span>
        ) : null}
        <span className="product-link-preview-card__url">{preview.canonicalUrl}</span>
      </span>
    </a>
  );
}
''')

thread = Path("app/components/product/CommentThread.tsx")
text = thread.read_text()
text = text.replace(
    "  CommentAttachmentView,\n  CommentView,\n  PublicPostAuthor,",
    "  CommentAttachmentView,\n  CommentLinkPreviewView,\n  CommentView,\n  PublicPostAuthor,",
    1,
)
text = text.replace(
    'import { MediaPicker, type MediaPickerKind } from "./MediaPicker";\n',
    'import { MediaPicker, type MediaPickerKind } from "./MediaPicker";\nimport { LinkPreviewCard } from "./LinkPreviewCard";\n',
    1,
)
text = text.replace(
    "  GifIcon,\n  HeartIcon,",
    "  GifIcon,\n  HeartIcon,\n  Input,\n  LinkIcon,",
    1,
)

render_anchor = "          {comment.attachment ? <CommentAttachment attachment={comment.attachment} /> : null}\n"
render_new = "          {comment.linkPreview ? <LinkPreviewCard preview={comment.linkPreview} /> : null}\n          {comment.attachment ? <CommentAttachment attachment={comment.attachment} /> : null}\n"
if render_new not in text:
    if render_anchor not in text:
        raise SystemExit("comment preview render anchor missing")
    text = text.replace(render_anchor, render_new, 1)

state_anchor = "  const [attachment, setAttachment] = useState<CommentAttachmentView | null>(null);\n  const [submitting, setSubmitting] = useState(false);\n"
state_new = "  const [attachment, setAttachment] = useState<CommentAttachmentView | null>(null);\n  const [linkOpen, setLinkOpen] = useState(false);\n  const [linkUrl, setLinkUrl] = useState(\"\");\n  const [linkPreview, setLinkPreview] = useState<CommentLinkPreviewView | null>(null);\n  const [linkBusy, setLinkBusy] = useState(false);\n  const [linkStatus, setLinkStatus] = useState<string>();\n  const [submitting, setSubmitting] = useState(false);\n"
if state_new not in text:
    if state_anchor not in text:
        raise SystemExit("composer state anchor missing")
    text = text.replace(state_anchor, state_new, 1)

submit_marker = "  async function submit() {\n"
if "  async function previewLink() {" not in text:
    if submit_marker not in text:
        raise SystemExit("submit marker missing")
    helpers = '''  function clearLinkPreview() {
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
      const payload = (await response.json().catch(() => null)) as
        | { preview?: CommentLinkPreviewView }
        | null;
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

'''
    text = text.replace(submit_marker, helpers + submit_marker, 1)

text = text.replace(
    "    if (submitInFlightRef.current || (!body.trim() && !attachment)) return;",
    "    if (submitInFlightRef.current || (!body.trim() && !attachment && !linkPreview)) return;",
    1,
)
text = text.replace(
    "        body: JSON.stringify({ markdown: body, parentCommentId: replyTo, attachment }),",
    "        body: JSON.stringify({\n          markdown: body,\n          parentCommentId: replyTo,\n          attachment,\n          linkPreviewUrl: linkPreview?.canonicalUrl,\n        }),",
    1,
)
text = text.replace(
    "      setAttachment(null);\n      setMediaKind(null);\n      setReplyTo(null);",
    "      setAttachment(null);\n      setMediaKind(null);\n      setLinkOpen(false);\n      setLinkUrl(\"\");\n      setLinkPreview(null);\n      setLinkStatus(undefined);\n      setReplyTo(null);",
    1,
)

text = text.replace(
    '                  onClick={() => setMediaKind(mediaKind === "GIF" ? null : "GIF")}\n',
    '                  onClick={() => changeMediaKind(mediaKind === "GIF" ? null : "GIF")}\n',
    1,
)
text = text.replace(
    '                  onClick={() => setMediaKind(mediaKind === "STICKER" ? null : "STICKER")}\n',
    '                  onClick={() => changeMediaKind(mediaKind === "STICKER" ? null : "STICKER")}\n',
    1,
)
text = text.replace(
    '                  onClick={() => setMediaKind(mediaKind === "EMOTE" ? null : "EMOTE")}\n',
    '                  onClick={() => changeMediaKind(mediaKind === "EMOTE" ? null : "EMOTE")}\n',
    1,
)

emote_button_end = '''                </button>
                {attachment ? (
'''
link_button = '''                </button>
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
'''
if "<LinkIcon" not in text:
    if emote_button_end not in text:
        raise SystemExit("toolbar link insertion anchor missing")
    text = text.replace(emote_button_end, link_button, 1)

text = text.replace(
    "                disabled={submitting || (!body.trim() && !attachment)}",
    "                disabled={submitting || (!body.trim() && !attachment && !linkPreview)}",
    1,
)
text = text.replace("                onKindChange={setMediaKind}\n", "                onKindChange={changeMediaKind}\n", 1)
text = text.replace(
    "                  } else {\n                    setAttachment({",
    "                  } else {\n                    clearLinkPreview();\n                    setLinkOpen(false);\n                    setAttachment({",
    1,
)
text = text.replace("                  setMediaKind(null);\n", "                  changeMediaKind(null);\n", 1)
text = text.replace("                onClose={() => setMediaKind(null)}\n", "                onClose={() => changeMediaKind(null)}\n", 1)

picker_end = '''            ) : null}
            {status ? <small role="status">{status}</small> : null}
'''
link_panel = '''            ) : null}
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
'''
if "product-comment-composer__link-panel" not in text:
    if picker_end not in text:
        raise SystemExit("link panel anchor missing")
    text = text.replace(picker_end, link_panel, 1)

thread.write_text(text)

css = Path("app/components/product/comment-actions.css")
text = css.read_text()
if ".product-link-preview-card" not in text:
    text += '''

.product-comment-composer__link-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-solid) 88%, transparent);
}

.product-comment-composer__link-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.product-link-preview-card {
  display: grid;
  grid-template-columns: minmax(0, 128px) minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-solid) 92%, transparent);
  color: inherit;
  text-decoration: none;
}

.product-link-preview-card:not(:has(.product-link-preview-card__image)) {
  grid-template-columns: minmax(0, 1fr);
}

.product-link-preview-card__image {
  width: 100%;
  height: 100%;
  min-height: 104px;
  max-height: 160px;
  object-fit: cover;
}

.product-link-preview-card__body {
  display: grid;
  align-content: center;
  gap: 4px;
  min-width: 0;
  padding: 12px;
}

.product-link-preview-card__site,
.product-link-preview-card__url,
.product-link-preview-card__description {
  overflow-wrap: anywhere;
}

.product-link-preview-card__site,
.product-link-preview-card__url {
  color: var(--text-muted);
}

.product-link-preview-card__url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 560px) {
  .product-link-preview-card {
    grid-template-columns: minmax(0, 96px) minmax(0, 1fr);
  }

  .product-link-preview-card__image {
    min-height: 96px;
  }
}
'''
css.write_text(text)
