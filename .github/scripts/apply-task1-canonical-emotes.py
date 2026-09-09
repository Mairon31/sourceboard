from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "shared/richtext/markdown.ts",
    '          nodes.push({ type: "emote", shortcode });',
    '          nodes.push({ type: "emote", shortcode: formatEmoteMarkdown(shortcode) });',
)

replace_once(
    "worker/comments/richtext.ts",
    'import {\n  normalizeEmoteShortcode,',
    'import {\n  formatEmoteMarkdown,\n  normalizeEmoteShortcode,',
)
replace_once(
    "worker/comments/richtext.ts",
    '    return { type: "emote", shortcode, ...(marks ? { marks } : {}) };',
    '    return { type: "emote", shortcode: formatEmoteMarkdown(shortcode), ...(marks ? { marks } : {}) };',
)

replace_once(
    "worker/comments/service.ts",
    'import type { CommentView, PublicPostAuthor } from "../../shared/ui/contracts";',
    'import { normalizeEmoteShortcode } from "../../shared/richtext/markdown";\nimport type { CommentView, PublicPostAuthor } from "../../shared/ui/contracts";',
)
replace_once(
    "worker/comments/service.ts",
    '            const asset = emoteAssets.get(node.shortcode);',
    '            const lookupShortcode = normalizeEmoteShortcode(node.shortcode);\n            const asset = lookupShortcode ? emoteAssets.get(lookupShortcode) : undefined;',
)
replace_once(
    "worker/comments/service.ts",
    '              .filter((node) => node.type === "emote")\n              .map((node) => node.shortcode),',
    '              .filter((node) => node.type === "emote")\n              .map((node) => normalizeEmoteShortcode(node.shortcode))\n              .filter((shortcode): shortcode is string => Boolean(shortcode)),',
)
replace_once(
    "worker/comments/service.ts",
    '            body.richtext.filter((node) => node.type === "emote").map((node) => node.shortcode),',
    '            body.richtext\n              .filter((node) => node.type === "emote")\n              .map((node) => normalizeEmoteShortcode(node.shortcode))\n              .filter((shortcode): shortcode is string => Boolean(shortcode)),',
)
replace_once(
    "worker/comments/service.ts",
    '            body.richtext.filter((node) => node.type === "emote").map((node) => node.shortcode),',
    '            body.richtext\n              .filter((node) => node.type === "emote")\n              .map((node) => normalizeEmoteShortcode(node.shortcode))\n              .filter((shortcode): shortcode is string => Boolean(shortcode)),',
)

replace_once(
    "worker/store/entitlements.ts",
    'import { PostError } from "../posts/errors";',
    'import { normalizeEmoteShortcode } from "../../shared/richtext/markdown";\nimport { PostError } from "../posts/errors";',
)
replace_once(
    "worker/store/entitlements.ts",
    '        body.richtext.filter((node) => node.type === "emote").map((node) => node.shortcode),',
    '        body.richtext\n          .filter((node) => node.type === "emote")\n          .map((node) => normalizeEmoteShortcode(node.shortcode))\n          .filter((shortcode): shortcode is string => Boolean(shortcode)),',
)

replace_once(
    "tests/unit/comment-richtext.test.ts",
    '    ).toMatchObject({ plaintext: "Found it sourcesource https://example.com/source" });',
    '    ).toMatchObject({ plaintext: "Found it :source:source https://example.com/source" });',
)

replace_once(
    "tests/unit/media-picker.test.ts",
    '  it("uses colon syntax in Markdown but canonical bare shortcodes in stored richtext", () => {',
    '  it("uses canonical colon syntax in Markdown and stored richtext", () => {',
)
replace_once(
    "tests/unit/media-picker.test.ts",
    '    expect(commentRichtext).toContain("normalizeEmoteShortcode");\n    expect(commentRichtext).toContain("upgradeLegacyEmoteNodes");',
    '    expect(commentRichtext).toContain("normalizeEmoteShortcode");\n    expect(commentRichtext).toContain("formatEmoteMarkdown(shortcode)");\n    expect(commentRichtext).toContain("upgradeLegacyEmoteNodes");',
)
