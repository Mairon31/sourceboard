import { describe, expect, it } from "vitest";
import { notificationPreviewText } from "../../worker/notifications/preview-text";

describe("notification preview text", () => {
  it("strips markdown decoration and collapses whitespace", () => {
    expect(notificationPreviewText({ bodyPlaintext: "**bold** source" })).toBe("bold source");
    expect(notificationPreviewText({ bodyPlaintext: "hello\n\nworld" })).toBe("hello world");
  });

  it("does not expose internal emote IDs", () => {
    expect(notificationPreviewText({ bodyPlaintext: "hello :emt_abc123: world" })).toBe("hello world");
    expect(notificationPreviewText({ bodyPlaintext: ":emt_abc123:" })).toBeUndefined();
  });

  it("keeps previews bounded by Unicode code points", () => {
    const preview = notificationPreviewText({ bodyPlaintext: "😀".repeat(250) });
    expect(Array.from(preview ?? "").length).toBeLessThanOrEqual(180);
  });

  it("extracts safe text from rich text JSON without returning storage JSON", () => {
    const preview = notificationPreviewText({ bodyRichtextJson: JSON.stringify({ content: [{ text: "hello" }, { text: "world" }] }) });
    expect(preview).toBe("hello world");
    expect(preview).not.toContain("content");
  });
});
