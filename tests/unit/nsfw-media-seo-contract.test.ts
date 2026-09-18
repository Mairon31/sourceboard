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

  it("uses a versioned safe share-image URL for public NSFW posts", () => {
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
    const twitterImage = entries.find((entry) => entry.name === "twitter:image");
    const jsonLd = entries.find((entry) => "script:ld+json" in entry)?.["script:ld+json"] as Record<
      string,
      unknown
    >;
    const metadata = JSON.stringify(entries);

    expect(robots?.content).toBe(
      "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    );
    expect(ogImage?.content).toContain("/api/share-image/post-nsfw?v=");
    expect(twitterImage?.content).toBe(ogImage?.content);
    expect(entries.find((entry) => entry.property === "og:image:width")?.content).toBe("1200");
    expect(entries.find((entry) => entry.property === "og:image:height")?.content).toBe("630");
    expect(metadata).not.toContain("/api/media/post/asset-nsfw");
    expect(jsonLd.contentRating).toBe("adult");
    expect(jsonLd.isFamilyFriendly).toBe(false);
  });

  it("keeps normal images direct and provides a safe fallback when a post has no image", () => {
    const base = {
      id: "post-normal",
      title: "Normal source request",
      description: "Description",
      categorySlug: "other",
      author: { mode: "ANONYMOUS", displayName: "Anonymous Author" },
      createdAt: new Date(1).toISOString(),
      updatedAt: new Date(2).toISOString(),
      status: "OPEN",
      visibility: "PUBLIC",
      isNsfw: false,
      nsfwPresentation: "VISIBLE",
      reaction: { type: "LIKE", count: 0, viewerReacted: false },
      commentCount: 0,
      imageAlt: "Normal source request",
      comments: [],
      permissions: {},
    };
    const withImage = (meta({
      loaderData: {
        post: { ...base, imageUrl: "/api/media/post/asset-normal" },
        unavailable: false,
        canonicalUrl: "https://srcboard.me/posts/post-normal/normal-source-request",
      },
    } as never) ?? []) as Array<Record<string, unknown>>;
    const withoutImage = (meta({
      loaderData: {
        post: base,
        unavailable: false,
        canonicalUrl: "https://srcboard.me/posts/post-normal/normal-source-request",
      },
    } as never) ?? []) as Array<Record<string, unknown>>;

    expect(withImage.find((entry) => entry.property === "og:image")?.content).toBe(
      "https://srcboard.me/api/media/post/asset-normal",
    );
    expect(withImage.find((entry) => entry.name === "twitter:image")?.content).toBe(
      "https://srcboard.me/api/media/post/asset-normal",
    );
    expect(withoutImage.find((entry) => entry.property === "og:image")?.content).toBe(
      "https://srcboard.me/sourceboard-brand-banner.jpg",
    );

    const invalidImage = (meta({
      loaderData: {
        post: { ...base, isNsfw: true, imageUrl: "https://attacker.test/original.jpg" },
        unavailable: false,
        canonicalUrl: "https://srcboard.me/posts/post-normal/normal-source-request",
      },
    } as never) ?? []) as Array<Record<string, unknown>>;
    expect(invalidImage.find((entry) => entry.property === "og:image")?.content).toBe(
      "https://srcboard.me/sourceboard-brand-banner.jpg",
    );
    expect(JSON.stringify(invalidImage)).not.toContain("attacker.test");
  });

  it("publishes crawler-compatible public image metadata and a canonical Yandex host", () => {
    const profileRoute = read("app/routes/profile.tsx");
    const storeRoute = read("app/routes/store.tsx");
    const officialSeo = read("shared/seo/official-pages.ts");
    const publicSeo = read("worker/seo/public.ts");

    expect(profileRoute).toContain('name: "twitter:image"');
    expect(profileRoute).toContain('property: "og:image:alt"');
    expect(storeRoute).toContain("localizedPageMeta");
    expect(officialSeo).toContain('name: "robots"');
    expect(publicSeo).toContain("Host: srcboard.me");
    expect(publicSeo).toContain("User-agent: *");
  });
});
