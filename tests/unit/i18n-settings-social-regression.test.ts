import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settings = readFileSync("app/routes/settings.tsx", "utf8");
const postCard = readFileSync("app/components/product/PostCard.tsx", "utf8");
const commentThread = readFileSync("app/components/product/CommentThread.tsx", "utf8");

describe("production i18n and settings regressions", () => {
  it("localizes Settings and exposes language plus every existing settings section", () => {
    expect(settings).toContain('import { useI18n } from "../i18n/I18nProvider"');
    expect(settings).toContain('import { LanguageSelector } from "../components/layout/LanguageSelector"');
    expect(settings).toContain("<LanguageSelector");
    for (const id of [
      "settings-general",
      "settings-profile",
      "settings-content",
      "settings-notifications",
      "settings-appearance",
      "settings-language",
      "settings-privacy",
      "settings-accessibility",
      "settings-security",
      "settings-sessions",
    ]) {
      expect(settings).toContain(`"${id}"`);
    }
    expect(settings).toContain('t("settings.title")');
    expect(settings).toContain('t("settings.language.title")');
  });

  it("localizes post and comment chrome without translating user-authored content", () => {
    expect(postCard).toContain('useI18n');
    expect(commentThread).toContain('useI18n');
    expect(postCard).toContain('t("post.like")');
    expect(commentThread).toContain('t("comments.reply")');
    expect(postCard).toContain("{displayTitle}");
    expect(postCard).toContain("{displayDescription}");
    expect(commentThread).toContain("comment.body");
  });

  it("submits an entered comment link even when advisory Preview link was not clicked", () => {
    expect(commentThread).toContain("linkPreviewUrl: linkPreview?.canonicalUrl ?? linkUrl.trim()");
  });
});
