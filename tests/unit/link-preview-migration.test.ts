import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CommentLinkPreviewView } from "../../shared/ui/contracts";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("comment link-preview migration", () => {
  it("adds one persisted preview snapshot per comment", () => {
    const migration = read("../../migrations/0027_comment_link_previews.sql");
    expect(migration).toContain("CREATE TABLE comment_link_previews");
    expect(migration).toContain("comment_id TEXT PRIMARY KEY");
    expect(migration).toContain("CHECK (metadata_status IN ('COMPLETE', 'PARTIAL', 'URL_ONLY'))");
  });

  it("exposes the typed public preview contract", () => {
    const preview: CommentLinkPreviewView = {
      canonicalUrl: "https://example.com/",
      metadataStatus: "URL_ONLY",
    };
    expect(preview.canonicalUrl).toBe("https://example.com/");
  });
});
