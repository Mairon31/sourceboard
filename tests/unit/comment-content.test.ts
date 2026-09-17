import { describe, expect, it } from "vitest";
import {
  classifyCommentContent,
  hasSourceEligibleCommentContent,
} from "../../shared/richtext/comment-content";

describe("comment content classification", () => {
  it("rejects emote-only content as an accepted-source candidate", () => {
    const richtext = [{ type: "emote", shortcode: ":wave:" }];
    const eligible = hasSourceEligibleCommentContent(richtext, ":wave:");
    const presentation = classifyCommentContent({ richtext, body: ":wave:" });

    expect(eligible).toBe(false);
    expect(presentation.visualOnly).toBe(true);
    expect(presentation.emoteOnly).toBe(true);
    expect(presentation.mixed).toBe(false);
  });

  it("rejects attachment-only content as an accepted-source candidate", () => {
    const eligible = hasSourceEligibleCommentContent([], "");
    const presentation = classifyCommentContent({
      richtext: [],
      body: "",
      attachment: { type: "GIF" },
    });

    expect(eligible).toBe(false);
    expect(presentation.visualOnly).toBe(true);
    expect(presentation.emoteOnly).toBe(false);
    expect(presentation.mixed).toBe(false);
  });

  it("keeps text plus an attachment in the normal mixed-content bubble", () => {
    const richtext = [{ type: "text", text: "This is the source" }];
    const eligible = hasSourceEligibleCommentContent(richtext, "This is the source");
    const presentation = classifyCommentContent({
      richtext,
      body: "This is the source",
      attachment: { type: "GIF" },
    });

    expect(eligible).toBe(true);
    expect(presentation.visualOnly).toBe(false);
    expect(presentation.emoteOnly).toBe(false);
    expect(presentation.mixed).toBe(true);
  });

  it("treats a link as substantive source content", () => {
    const richtext = [{ type: "link", url: "https://example.com/source", label: "Source" }];
    const sourceUrl = "Source https://example.com/source";
    const eligible = hasSourceEligibleCommentContent(richtext, sourceUrl);

    expect(eligible).toBe(true);
  });

  it("does not treat an invisible link label as source text", () => {
    expect(
      hasSourceEligibleCommentContent([
        { type: "link", url: "https://example.com/source", label: "   " },
      ]),
    ).toBe(false);
  });

  it("accepts an explicit link preview as source evidence without prose", () => {
    const eligible = hasSourceEligibleCommentContent([], "", "https://example.com/source");

    expect(eligible).toBe(true);
  });

  it("preserves legacy text comments when richtext is absent", () => {
    const eligible = hasSourceEligibleCommentContent(undefined, "Legacy source explanation");
    expect(eligible).toBe(true);
  });

  it("falls back to persisted plaintext when a legacy AST is empty", () => {
    expect(hasSourceEligibleCommentContent([], "Legacy source explanation")).toBe(true);
  });

  it("does not treat a credentialed preview URL as source evidence", () => {
    expect(
      hasSourceEligibleCommentContent([], "", "https://user:password@example.com/source"),
    ).toBe(false);
  });
});
