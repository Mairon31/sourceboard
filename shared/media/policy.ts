export const MEDIA_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export type MediaImageContentType = (typeof MEDIA_IMAGE_CONTENT_TYPES)[number];
export type MediaImageUploadContentType = MediaImageContentType | "image/gif";
export type MediaImagePurpose = "AVATAR" | "BANNER" | "POST" | "COMMENT" | "ACHIEVEMENT";

export interface MediaImagePolicy {
  /** Maximum original bytes accepted by the server before optional client preparation. */
  maxBytes: number;
  /** Maximum width or height accepted by the server. */
  maxDimension: number;
  /** MIME types allowed for this purpose after byte-level detection. */
  allowedContentTypes: readonly MediaImageUploadContentType[];
  /** Browser-side quality hint; the server never trusts this value. */
  clientQuality: number;
  aggressiveQuality: number;
  aggressiveThresholdBytes: number;
}

const STATIC_IMAGE_TYPES: readonly MediaImageUploadContentType[] = MEDIA_IMAGE_CONTENT_TYPES;
const PROFILE_IMAGE_TYPES: readonly MediaImageUploadContentType[] = [
  ...MEDIA_IMAGE_CONTENT_TYPES,
  "image/gif",
];

export const MEDIA_IMAGE_POLICIES: Record<MediaImagePurpose, MediaImagePolicy> = {
  // A 1024px avatar is sufficient for the current 40–160px surfaces and HiDPI displays.
  AVATAR: {
    maxBytes: 10 * 1024 * 1024,
    maxDimension: 1_024,
    allowedContentTypes: PROFILE_IMAGE_TYPES,
    clientQuality: 0.9,
    aggressiveQuality: 0.84,
    aggressiveThresholdBytes: 2 * 1024 * 1024,
  },
  BANNER: {
    maxBytes: 10 * 1024 * 1024,
    maxDimension: 4_096,
    allowedContentTypes: PROFILE_IMAGE_TYPES,
    clientQuality: 0.88,
    aggressiveQuality: 0.8,
    aggressiveThresholdBytes: 6 * 1024 * 1024,
  },
  POST: {
    maxBytes: 25 * 1024 * 1024,
    maxDimension: 4_096,
    allowedContentTypes: STATIC_IMAGE_TYPES,
    clientQuality: 0.9,
    aggressiveQuality: 0.76,
    aggressiveThresholdBytes: 5 * 1024 * 1024,
  },
  COMMENT: {
    maxBytes: 5 * 1024 * 1024,
    maxDimension: 2_048,
    allowedContentTypes: STATIC_IMAGE_TYPES,
    clientQuality: 0.8,
    aggressiveQuality: 0.72,
    aggressiveThresholdBytes: 4 * 1024 * 1024,
  },
  ACHIEVEMENT: {
    maxBytes: 2 * 1024 * 1024,
    maxDimension: 1_024,
    allowedContentTypes: ["image/png", "image/gif"],
    clientQuality: 0.9,
    aggressiveQuality: 0.84,
    aggressiveThresholdBytes: 1 * 1024 * 1024,
  },
};

export function getMediaImagePolicy(purpose: MediaImagePurpose): MediaImagePolicy {
  return MEDIA_IMAGE_POLICIES[purpose];
}
