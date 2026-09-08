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
    expect(picker).toContain('"Emotes"');
    expect(thread).toContain('from "./MediaPicker"');
    expect(thread).not.toContain("function MediaPicker(");
  });

  it("loads only entitled emote packs and keeps server entitlement enforcement", () => {
    expect(commentsApi).toContain('url.pathname === "/api/comments/emotes"');
    expect(commentsApi).toContain("listEntitledEmotePacks");
    expect(entitlements).toContain("user_inventory");
    expect(entitlements).toContain("moderation_state NOT IN ('HIDDEN', 'REMOVED')");
    expect(entitlements).toContain("listEntitledEmotePacks");
    expect(thread).toContain('item.type === "EMOTE"');
  });

  it("uses colon syntax in Markdown but canonical bare shortcodes in stored richtext", () => {
    expect(markdown).toContain("normalizeEmoteShortcode");
    expect(markdown).toContain("formatEmoteMarkdown");
    expect(commentRichtext).toContain("normalizeEmoteShortcode");
    expect(commentRichtext).toContain("upgradeLegacyEmoteNodes");
    expect(thread).toContain("formatEmoteMarkdown(item.shortcode)");
    expect(thread).not.toContain("}${item.shortcode}`");
  });

  it("resolves published emotes for existing comments without N+1 client requests", () => {
    expect(commentStore).toContain("getEmoteAssets");
    expect(commentStore).toContain("shortcode IN");
    expect(richText).toContain("product-richtext__emote-image");
    expect(richText).toContain("node.url");
  });

  it("renders compact icon actions and an icon-only ellipsis menu", () => {
    for (const icon of ["HeartIcon", "MessageIcon", "CheckIcon", "ShareIcon", "MoreIcon", "EditIcon", "TrashIcon", "FlagIcon"]) {
      expect(icons).toContain(`function ${icon}`);
    }
    expect(overlays).toContain("triggerIcon");
    expect(overlays).toContain("iconOnly");
    expect(thread).toContain('ariaLabel="More actions"');
    expect(thread).toContain("<HeartIcon");
    expect(thread).toContain("<MessageIcon");
    expect(thread).toContain("<CheckIcon");
    expect(commentActionsCss).toContain("product-comment__action");
  });

  it("keeps animated media URLs and applies the requested compact comment sizes", () => {
    expect(picker).toContain("item.url");
    expect(css).toContain("width: min(100%, 220px)");
    expect(css).toContain("width: min(154px, 68vw)");
    expect(css).toContain("product-comment-media-picker__packbar");
    expect(css).toContain("product-comment-media-picker__emote-grid");
  });
});
