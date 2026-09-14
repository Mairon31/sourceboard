import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const postComposer = read("app/components/product/PostComposer.tsx");
const categoryPicker = read("app/components/product/CategoryPicker.tsx");
const imageUpload = read("app/components/product/ImageUploadField.tsx");
const mediaPicker = read("app/components/product/MediaPicker.tsx");
const profileEditor = read("app/components/product/ProfileEditor.tsx");
const profileAccount = read("app/components/product/ProfileAccountActions.tsx");

describe("editing surface internationalization", () => {
  it("localizes post creation chrome", () => {
    expect(postComposer).toContain("useI18n");
    expect(postComposer).toContain('t("composer.image.title")');
    expect(postComposer).toContain('t("composer.publish")');
    expect(categoryPicker).toContain("useI18n");
    expect(categoryPicker).toContain('t("categoryPicker.label")');
    expect(imageUpload).toContain("useI18n");
    expect(imageUpload).toContain('t("imageUpload.addTitle")');
  });

  it("localizes media picker chrome", () => {
    expect(mediaPicker).toContain("useI18n");
    expect(mediaPicker).toContain('t("mediaPicker.title")');
    expect(mediaPicker).toContain('t("mediaPicker.loading")');
    expect(mediaPicker).not.toContain('aria-label="Media picker"');
  });

  it("localizes profile editing and account controls", () => {
    expect(profileEditor).toContain("useI18n");
    expect(profileEditor).toContain('t("profileEditor.edit")');
    expect(profileEditor).toContain('t("profileEditor.bioPreview")');
    expect(profileEditor).toContain('t("profileEditor.bioBold")');
    expect(profileEditor).toContain("renderMarkdownPreview");
    expect(profileEditor).toContain('t("profileEditor.social.title")');
    expect(profileAccount).toContain("useI18n");
    expect(profileAccount).toContain('t("profileAccount.title")');
    expect(profileAccount).toContain('t("profileAccount.logout")');
  });
});
