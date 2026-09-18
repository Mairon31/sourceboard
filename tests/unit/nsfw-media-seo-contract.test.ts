import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { meta } from "../../app/routes/post-detail";

const read = (path: string) => readFileSync(path, "utf8");

describe("NSFW media and SEO contract", () => {
  it("renders the actual preview image with a strong blur instead of replacing it with a gate", () => {
    const postCard = read("app/components/product/PostCard.tsx");
    const searchMedia = read("app/components/product/SearchPostMedia.tsx");
    const styles = `${read("app/components/product/product.css")}\n${read("app/components/product/search-redesign.css")}`;

    expect(postCard).toContain("product-post__media--nsfw-blurred");
    expect(searchMedia).toContain("product-search-media--nsfw-blurred");
    expect(searchMedia).toContain("disabled={blurred}");
    expect(searchMedia).toContain("imageUrl && !blurred");
    expect(styles).toContain("filter: blur(");
  });

  it("changes existing and new preference defaults to show posts while blurring media", () => {
    expect(existsSync("migrations/0038_nsfw_preference_defaults.sql")).toBe(true);
    const migration = read("migrations/0038_nsfw_preference_defaults.sql");
    expect(migration).toContain("hide_nsfw = 0");
    expect(migration).toContain("blur_nsfw = 1");
    expect(read("worker/db/schema.ts")).toContain(
      'hideNsfw: integer("hide_nsfw", { mode: "boolean" }).notNull().default(false)',
    );
    expect(read("worker/auth/store.ts")).toContain("VALUES (?, 0, 1, 0, 1, ?, ?)");
    expect(read("worker/profile/store-core.ts")).toContain("VALUES (?, 0, 1, 0, 1, 1, 1, ?, ?)");
  });

  it("indexes public NSFW posts with sensitive-content metadata and their image", () => {
    const post = {
      id: "post-nsfw",
      title: "Sensitive source request",
      description: "Sensitive description",
      categorySlug: "other",
      author: { mode: "ANONYMOUS", displayName: "Anonymous Author" },
      createdAt: new Date(1).toISOString(),
      updatedAt: new Date(2).toISOString(),
      status: "OPEN",
      visibility: "PUBLIC",
      isNsfw: true,
      nsfwPresentation: "BLURRED",
      reaction: { type: "LIKE", count: 0, viewerReacted: false },
      commentCount: 0,
      imageAlt: "Sensitive source request",
      imageUrl: "/api/media/post/asset-nsfw",
      imageWidth: 1200,
      imageHeight: 800,
      comments: [],
      permissions: {},
    };
    const entries = (meta({
      loaderData: {
        post,
        unavailable: false,
        canonicalUrl: "https://srcboard.me/posts/post-nsfw/sensitive-source-request",
      },
    } as never) ?? []) as Array<Record<string, unknown>>;
    const robots = entries.find((entry) => entry.name === "robots");
    const ogImage = entries.find((entry) => entry.property === "og:image");
    const jsonLd = entries.find((entry) => "script:ld+json" in entry)?.["script:ld+json"] as Record<
      string,
      unknown
    >;

    expect(robots?.content).toBe("index, follow");
    expect(ogImage?.content).toContain("/api/media/post/asset-nsfw");
    expect(jsonLd.contentRating).toBe("adult");
    expect(jsonLd.isFamilyFriendly).toBe(false);
  });
});
