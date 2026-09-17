import { describe, expect, it } from "vitest";
import {
  BIO_MARKDOWN_ACTIONS,
  formatMarkdownSelection,
  POST_MARKDOWN_ACTIONS,
} from "../../app/components/product/MarkdownToolbar";

describe("shared Markdown toolbar", () => {
  it("preserves selected text while applying supported post syntax", () => {
    expect(formatMarkdownSelection("hello", 0, 5, "bold")).toMatchObject({
      value: "**hello**",
      selectionStart: 9,
      selectionEnd: 9,
    });
    expect(formatMarkdownSelection("hello", 0, 5, "heading2").value).toBe("## hello");
    expect(formatMarkdownSelection("one\ntwo", 0, 7, "bulletList").value).toBe("- one\n- two");
    expect(formatMarkdownSelection("source", 0, 6, "link")).toMatchObject({
      value: "[source](https://)",
      selectionStart: 9,
      selectionEnd: 17,
    });
  });

  it("keeps the post action set complete and the bio set compact", () => {
    expect(POST_MARKDOWN_ACTIONS).toEqual([
      "bold",
      "italic",
      "heading1",
      "heading2",
      "heading3",
      "quote",
      "bulletList",
      "numberedList",
      "code",
      "link",
      "emote",
    ]);
    expect(BIO_MARKDOWN_ACTIONS).toEqual(["bold", "italic", "link", "emote"]);
  });
});
