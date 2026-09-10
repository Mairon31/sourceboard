import { describe, expect, it } from "vitest";
import {
  classifyCommentContent,
  hasSourceEligibleCommentContent,
} from "../../shared/richtext/comment-content";

describe("comment content classification", () => {
  it("rejects emote-only content as an accepted-source candidate", () => {
    const richtext = [{ type: "emote", shortcode: ":wave:" }];
    expect(hasSourceEligibleCommentContent(richtext, ":wave:")).toBe(false);
    expect(classifyCommentContent({ richtext, body: ":wave:" })).toMatchObject({
      visualOnly: true,
      emoteOnly: true,
      mixed: false,
    });
  });

  it("rejects attachment-only content as an accepted-source candidate", () => {
    expect(hasSourceEligibleCommentContent([], "")).toBe(false);
    expect(
      classifyCommentContent({ richtext: [], body: "", attachment: { type: "GIF" } }),
    ).toMatchObject({ visualOnly: true, emoteOnly: false, mixed: false });
  });

  it("keeps text plus an attachment in the normal mixed-content bubble", () => {
    const richtext = [{ type: "text", text: "This is the source" }];
    expect(hasSourceEligibleCommentContent(richtext, "This is the source")).toBe(true);
    expect(
      classifyCommentContent({ richtext, body: "This is the source", attachment: { type: "GIF" } }),
    ).toMatchObject({ visualOnly: false, emoteOnly: false, mixed: true });
  });

  it("treats a link as substantive source content", () => {
    const richtext = [{ type: "link", url: "https://example.com/source", label: "Source" }];
    expect(hasSourceEligibleCommentContent(richtext, "Source https://example.com/source")).toBe(true);
  });

  it("preserves legacy text comments when richtext is absent", () => {
    expect(hasSourceEligibleCommentContent(undefined, "Legacy source explanation")).toBe(true);
  });
});
