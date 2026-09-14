import { describe, expect, it } from "vitest";
import { hydrateProfileBio } from "../../worker/profile/service";
import { parseMarkdown } from "../../shared/richtext/markdown";

describe("profile bio emotes", () => {
  it("hydrates only known entitled emotes while preserving Markdown structure", () => {
    const nodes = parseMarkdown("Hello :wave:\n\n**welcome**");
    const hydrated = hydrateProfileBio(
      nodes,
      new Map([
        [
          "wave",
          {
            id: "emote-wave",
            label: "Wave",
            shortcode: "wave",
            url: "/api/media/catalog/emote/emote-wave",
          },
        ],
      ]),
    );

    expect(hydrated[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", text: "Hello " },
        { type: "emote", url: expect.any(String) },
      ],
    });
    expect(hydrated[1]).toMatchObject({ type: "paragraph" });
  });

  it("leaves an unavailable emote as a safe shortcode fallback", () => {
    const [node] = hydrateProfileBio(parseMarkdown(":private_pack:"), new Map());
    expect(node).toMatchObject({
      type: "paragraph",
      children: [{ type: "emote", shortcode: ":private_pack:" }],
    });
  });
});
