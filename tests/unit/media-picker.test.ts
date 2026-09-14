import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const picker = read("../../app/components/product/MediaPicker.tsx");
const thread = read("../../app/components/product/CommentThread.tsx");
const commentsApi = read("../../worker/comments/api.ts");
const entitlements = read("../../worker/store/entitlements.ts");
const commentStore = read("../../worker/comments/store.ts");
const commentRichtext = read("../../worker/comments/richtext.ts");
const markdown = read("../../shared/richtext/markdown.ts");
const richText = read("../../app/components/product/RichText.tsx");
const overlays = read("../../app/components/ui/overlays.tsx");
const icons = read("../../app/components/ui/icons.tsx");
const css = read("../../app/components/product/profile-klipy.css");
const commentActionsCss = read("../../app/components/product/comment-actions.css");

describe("responsive GIF, sticker and emote picker", () => {
  it("extracts one picker with abortable debounced cached KLIPY search", () => {
    expect(picker).toContain('export type MediaPickerKind = "GIF" | "STICKER" | "EMOTE"');
    expect(picker).toContain("AbortController");
    expect(picker).toContain("250");
    expect(picker).toContain("mediaCache");
    expect(picker).toContain('role="tablist"');
    expect(picker).toContain('t("mediaPicker.emotes")');
    expect(thread).toContain('from "./MediaPicker"');
    expect(thread).not.toContain("function MediaPicker(");
  });

  it("paginates KLIPY results with an observer, deduplication and opaque next positions", () => {
    expect(commentsApi).toContain('url.searchParams.get("pos")');
    expect(commentsApi).toContain('upstream.searchParams.set("pos"');
    expect(commentsApi).toContain("next:");
    expect(picker).toContain("IntersectionObserver");
    expect(picker).toContain("nextPos");
    expect(picker).toContain("loadMore");
    expect(picker).toContain("new Map");
    expect(picker).toContain('t("mediaPicker.loadingMore")');
    expect(picker).toContain('t("mediaPicker.retry")');
  });

  it("stops stalled KLIPY cursors and keeps pack navigation scoped to the picker", () => {
    expect(picker).toContain("rawNextPosition === position ? null : rawNextPosition");
    expect(picker).toContain("activeButton.offsetLeft");
    expect(picker).toContain("packBarRef.current.scrollTo");
    expect(picker).not.toContain("activeButton?.scrollIntoView");
    expect(picker).toContain(
      "section.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop",
    );
  });

  it("keeps the emote picker open and uses observer-based pack scroll spy", () => {
    expect(picker).toContain("packObserverRef");
    expect(picker).toContain("IntersectionObserver");
    expect(picker).not.toContain("onScroll={(event) =>");
    expect(thread).toContain('if (item.type !== "EMOTE") changeMediaKind(null)');
  });

  it("selects the final pack when the scroll container reaches its boundary", () => {
    expect(picker).toContain("root.scrollTop + root.clientHeight >= root.scrollHeight - 1");
    expect(picker).toContain("lastPack");
  });

  it("renders an accessible attachment-preview remove control without clearing composer text", () => {
    expect(thread).toContain("onRemove?: () => void");
    expect(thread).toContain("product-comment-attachment__remove");
    expect(thread).toContain('attachment.type === "GIF"');
    expect(thread).toContain('"comments.composer.removeGif"');
    expect(thread).toContain('"comments.composer.removeSticker"');
    expect(thread).toContain("onRemove={() => setAttachment(null)}");
  });

  it("loads only entitled emote packs and keeps server entitlement enforcement", () => {
    expect(commentsApi).toContain('url.pathname === "/api/comments/emotes"');
    expect(commentsApi).toContain("listEntitledEmotePacks");
    expect(entitlements).toContain("user_inventory");
    expect(entitlements).toContain("moderation_state NOT IN ('HIDDEN', 'REMOVED')");
    expect(entitlements).toContain("listEntitledEmotePacks");
    expect(thread).toContain('item.type === "EMOTE"');
  });

  it("uses canonical colon syntax in Markdown, storage and comment editing", () => {
    expect(markdown).toContain("normalizeEmoteShortcode");
    expect(markdown).toContain("formatEmoteMarkdown");
    expect(markdown).toContain("serializeInlineRichTextMarkdown");
    expect(commentRichtext).toContain("normalizeEmoteShortcode");
    expect(commentRichtext).toContain("formatEmoteMarkdown(shortcode)");
    expect(commentRichtext).toContain("upgradeLegacyEmoteNodes");
    expect(thread).toContain("formatEmoteMarkdown(item.shortcode)");
    expect(thread).toContain("serializeInlineRichTextMarkdown(comment.richtext)");
    expect(thread).toContain("commentPreviewNodes(editBody, comment.richtext)");
    expect(thread).not.toContain("}${item.shortcode}`");
  });

  it("resolves published emotes for existing comments without N+1 client requests", () => {
    expect(commentStore).toContain("getEmoteAssets");
    expect(commentStore).toContain("shortcode IN");
    expect(richText).toContain("product-richtext__emote-image");
    expect(richText).toContain("node.url");
  });

  it("renders compact icon actions and an icon-only ellipsis menu", () => {
    for (const icon of [
      "HeartIcon",
      "MessageIcon",
      "CheckIcon",
      "ShareIcon",
      "MoreIcon",
      "EditIcon",
      "TrashIcon",
      "FlagIcon",
    ]) {
      expect(icons).toContain(`function ${icon}`);
    }
    expect(overlays).toContain("triggerIcon");
    expect(overlays).toContain("iconOnly");
    expect(thread).toContain('ariaLabel={t("comments.actions.moreAria")}');
    expect(thread).toContain("<HeartIcon");
    expect(thread).toContain("<MessageIcon");
    expect(thread).toContain("<CheckIcon");
    expect(commentActionsCss).toContain("product-comment__action");
  });

  it("uses accessible localized Discord-style icon controls for GIF, sticker and emote", () => {
    for (const icon of ["GifIcon", "StickerIcon", "SmileIcon"]) {
      expect(icons).toContain(`function ${icon}`);
      expect(thread).toContain(`<${icon}`);
    }
    expect(thread).toContain('aria-label="GIF"');
    expect(thread).toContain('aria-label={t("comments.composer.sticker")}');
    expect(thread).toContain('aria-label={t("comments.composer.emote")}');
    expect(thread).toContain('title="GIF"');
    expect(thread).toContain('title={t("comments.composer.sticker")}');
    expect(thread).toContain('title={t("comments.composer.emote")}');
    expect(thread).toContain("product-comment-composer__media-action");
    expect(commentActionsCss).toContain(".product-comment-composer__media-action");
    expect(commentActionsCss).toContain("min-width: 40px");
    expect(commentActionsCss).toContain("min-height: 40px");
  });

  it("uses media-specific renderers with safe viewport containment", () => {
    expect(picker).toContain('data-media-kind="gif"');
    expect(picker).toContain('data-media-kind="sticker"');
    expect(picker).toContain('data-media-kind="emote"');
    expect(css).toContain("object-fit: contain");
    expect(css).toContain("aspect-ratio: 1 / 1");
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toContain("overflow-y: auto");
  });

  it("keeps animated media URLs and applies the requested compact comment sizes", () => {
    expect(picker).toContain("item.url");
    expect(css).toContain("width: min(100%, 220px)");
    expect(css).toContain("width: min(154px, 68vw)");
    expect(css).toContain("product-comment-media-picker__packbar");
    expect(css).toContain("product-comment-media-picker__emote-grid");
  });
});
