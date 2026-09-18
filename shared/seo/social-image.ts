import { SOURCEBOARD_BRAND_ASSETS } from "./brand-assets";

export interface PostSocialImageInput {
  postId: string;
  pageUrl: string;
  imageUrl?: string;
  isNsfw: boolean;
  updatedAt: string;
}

function ownedMediaUrl(input: PostSocialImageInput): string | undefined {
  if (!input.imageUrl) return undefined;
  try {
    const page = new URL(input.pageUrl);
    const candidate = new URL(input.imageUrl, page);
    if (candidate.origin !== page.origin || !candidate.pathname.startsWith("/api/media/post/")) {
      return undefined;
    }
    return candidate.toString();
  } catch {
    return undefined;
  }
}

export function buildPostSocialImageUrl(input: PostSocialImageInput): string {
  const original = ownedMediaUrl(input);
  if (!input.isNsfw && original) return original;
  if (input.isNsfw && original) {
    const shareUrl = new URL(`/api/share-image/${encodeURIComponent(input.postId)}`, input.pageUrl);
    shareUrl.searchParams.set("v", input.updatedAt);
    return shareUrl.toString();
  }
  return new URL(SOURCEBOARD_BRAND_ASSETS.banner, input.pageUrl).toString();
}
