from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:180]!r}")
    file.write_text(text.replace(old, new, 1))


Path("worker/catalog/image.ts").write_text(r'''import {
  assertPostImage,
  PostImageError,
  type PostImageContentType,
} from "../posts/image";

export type CatalogImageContentType = Exclude<PostImageContentType, "image/avif"> | "image/gif";

export interface CatalogImageMetadata {
  contentType: CatalogImageContentType;
  width: number;
  height: number;
  animated: boolean;
}

const MAX_CATALOG_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_CATALOG_DIMENSION = 10_000;
const STATIC_TYPES = new Set<CatalogImageContentType>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function isGif(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 10) return false;
  const signature = String.fromCharCode(...bytes.slice(0, 6));
  return signature === "GIF87a" || signature === "GIF89a";
}

function gifFrameCount(bytes: Uint8Array): number {
  let frames = 0;
  for (let index = 13; index < bytes.length; index += 1) {
    if (bytes[index] === 0x2c) frames += 1;
  }
  return frames;
}

export function assertCatalogImage(
  bytes: Uint8Array,
  declaredContentType: string,
): CatalogImageMetadata {
  if (bytes.byteLength === 0)
    throw new PostImageError(400, "EMPTY_IMAGE", "The image file is empty.");
  if (bytes.byteLength > MAX_CATALOG_IMAGE_BYTES)
    throw new PostImageError(413, "IMAGE_TOO_LARGE", "Catalog images must be 10 MB or smaller.");

  if (isGif(bytes)) {
    if (declaredContentType !== "image/gif")
      throw new PostImageError(
        415,
        "IMAGE_MIME_MISMATCH",
        "The declared MIME type does not match the GIF file signature.",
      );
    const width = (bytes[6] ?? 0) | ((bytes[7] ?? 0) << 8);
    const height = (bytes[8] ?? 0) | ((bytes[9] ?? 0) << 8);
    if (!width || !height || width > MAX_CATALOG_DIMENSION || height > MAX_CATALOG_DIMENSION)
      throw new PostImageError(400, "INVALID_IMAGE", "The GIF dimensions are invalid.");
    return { contentType: "image/gif", width, height, animated: gifFrameCount(bytes) > 1 };
  }

  if (!STATIC_TYPES.has(declaredContentType as CatalogImageContentType)) {
    throw new PostImageError(
      415,
      "UNSUPPORTED_IMAGE_TYPE",
      "Catalog images must be JPEG, PNG, WebP, or GIF.",
    );
  }
  const staticMetadata = assertPostImage(bytes, declaredContentType as PostImageContentType);
  if (staticMetadata.contentType === "image/avif")
    throw new PostImageError(415, "UNSUPPORTED_IMAGE_TYPE", "AVIF catalog images are not supported.");
  return { ...staticMetadata, contentType: staticMetadata.contentType as CatalogImageContentType, animated: false };
}
''')

Path("migrations/0023_catalog_media_metadata.sql").write_text('''ALTER TABLE emote_catalog ADD COLUMN content_type TEXT;\nALTER TABLE emote_catalog ADD COLUMN media_width INTEGER;\nALTER TABLE emote_catalog ADD COLUMN media_height INTEGER;\nALTER TABLE emote_catalog ADD COLUMN is_animated INTEGER NOT NULL DEFAULT 0;\n\nALTER TABLE sticker_catalog ADD COLUMN content_type TEXT;\nALTER TABLE sticker_catalog ADD COLUMN media_width INTEGER;\nALTER TABLE sticker_catalog ADD COLUMN media_height INTEGER;\nALTER TABLE sticker_catalog ADD COLUMN is_animated INTEGER NOT NULL DEFAULT 0;\n''')

replace_once(
    "worker/db/schema.ts",
    '    assetKey: text("asset_key").notNull(),\n    packId: text("pack_id"),',
    '    assetKey: text("asset_key").notNull(),\n    contentType: text("content_type"),\n    mediaWidth: integer("media_width"),\n    mediaHeight: integer("media_height"),\n    isAnimated: integer("is_animated", { mode: "boolean" }).notNull().default(false),\n    packId: text("pack_id"),',
)
# Apply the same metadata fields to sticker_catalog (second occurrence).
text = Path("worker/db/schema.ts").read_text()
needle = '    assetKey: text("asset_key").notNull(),\n    packId: text("pack_id"),'
if needle not in text:
    raise SystemExit("sticker catalog assetKey target not found")
Path("worker/db/schema.ts").write_text(text.replace(
    needle,
    '    assetKey: text("asset_key").notNull(),\n    contentType: text("content_type"),\n    mediaWidth: integer("media_width"),\n    mediaHeight: integer("media_height"),\n    isAnimated: integer("is_animated", { mode: "boolean" }).notNull().default(false),\n    packId: text("pack_id"),',
    1,
))

replace_once(
    "worker/catalog/api.ts",
    'import { assertPostImage, sha256Hex } from "../posts/image";',
    'import { sha256Hex } from "../posts/image";\nimport { assertCatalogImage } from "./image";',
)
replace_once(
    "worker/catalog/api.ts",
    '["lifecycle_state", "is_enabled", "is_featured", "moderation_state", "updated_at"]',
    '[\n      "lifecycle_state",\n      "is_enabled",\n      "is_featured",\n      "moderation_state",\n      "updated_at",\n      "content_type",\n      "media_width",\n      "media_height",\n      "is_animated",\n    ]',
)
# Both create and replacement must use catalog media validation.
api = Path("worker/catalog/api.ts")
text = api.read_text().replace("assertPostImage(bytes, file.type)", "assertCatalogImage(bytes, file.type)")
# Legacy DTOs expose safe defaults.
text = text.replace(
    "asset_key AS assetKey, status, CASE WHEN status = 'ACTIVE'",
    "asset_key AS assetKey, NULL AS contentType, NULL AS mediaWidth, NULL AS mediaHeight, 0 AS isAnimated, status, CASE WHEN status = 'ACTIVE'",
    1,
)
text = text.replace(
    "asset_key AS assetKey, pack_id AS packId, sort_order AS sortOrder, status,\n            CASE WHEN status = 'ACTIVE'",
    "asset_key AS assetKey, NULL AS contentType, NULL AS mediaWidth, NULL AS mediaHeight, 0 AS isAnimated, pack_id AS packId, sort_order AS sortOrder, status,\n            CASE WHEN status = 'ACTIVE'",
    1,
)
# Modern list/detail include persisted media metadata.
text = text.replace(
    "asset_key AS assetKey, status, lifecycle_state AS lifecycleState, is_enabled AS isEnabled,",
    "asset_key AS assetKey, content_type AS contentType, media_width AS mediaWidth, media_height AS mediaHeight, is_animated AS isAnimated, status, lifecycle_state AS lifecycleState, is_enabled AS isEnabled,",
    1,
)
text = text.replace(
    "asset_key AS assetKey, pack_id AS packId, sort_order AS sortOrder, status, lifecycle_state AS lifecycleState,",
    "asset_key AS assetKey, content_type AS contentType, media_width AS mediaWidth, media_height AS mediaHeight, is_animated AS isAnimated, pack_id AS packId, sort_order AS sortOrder, status, lifecycle_state AS lifecycleState,",
    1,
)
# Create emote with metadata.
text = text.replace(
    '''(id, shortcode, label, asset_key, pack_id, status, sort_order, lifecycle_state,
            is_enabled, moderation_state, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, 'PUBLISHED', 1, 'CLEAR', ?, ?)''',
    '''(id, shortcode, label, asset_key, content_type, media_width, media_height, is_animated, pack_id, status, sort_order, lifecycle_state,
            is_enabled, moderation_state, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0, 'PUBLISHED', 1, 'CLEAR', ?, ?)''',
    1,
)
text = text.replace(
    ".bind(id, key, label, assetKey, packId, now, now)\n          .run();",
    ".bind(id, key, label, assetKey, metadata.contentType, metadata.width, metadata.height, metadata.animated ? 1 : 0, packId, now, now)\n          .run();",
    1,
)
# Sticker create also persists media metadata when the migration exists.
text = text.replace(
    "`INSERT INTO sticker_catalog (id, slug, label, asset_key, pack_id, status, sort_order, created_at)\n         VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, ?)`",
    "`INSERT INTO sticker_catalog (id, slug, label, asset_key, content_type, media_width, media_height, is_animated, pack_id, status, sort_order, created_at)\n         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0, ?)`",
    1,
)
text = text.replace(
    ".bind(id, key, label, assetKey, packId, now)\n        .run();",
    ".bind(id, key, label, assetKey, metadata.contentType, metadata.width, metadata.height, metadata.animated ? 1 : 0, packId, now)\n        .run();",
    1,
)
# Create response includes authoritative media metadata.
text = text.replace(
    "      checksumSha256: await sha256Hex(bytes.buffer as ArrayBuffer),",
    "      contentType: metadata.contentType,\n      mediaWidth: metadata.width,\n      mediaHeight: metadata.height,\n      isAnimated: metadata.animated,\n      checksumSha256: await sha256Hex(bytes.buffer as ArrayBuffer),",
    1,
)
# Replacement updates persisted metadata and response/audit.
text = text.replace(
    'await env.DB.prepare("UPDATE emote_catalog SET asset_key = ?, updated_at = ? WHERE id = ?")\n        .bind(newAssetKey, Date.now(), id)',
    'await env.DB.prepare("UPDATE emote_catalog SET asset_key = ?, content_type = ?, media_width = ?, media_height = ?, is_animated = ?, updated_at = ? WHERE id = ?")\n        .bind(newAssetKey, metadata.contentType, metadata.width, metadata.height, metadata.animated ? 1 : 0, Date.now(), id)',
    1,
)
text = text.replace(
    "    newAssetKey,\n  });",
    "    newAssetKey,\n    contentType: metadata.contentType,\n    mediaWidth: metadata.width,\n    mediaHeight: metadata.height,\n    isAnimated: metadata.animated,\n  });",
    1,
)
# Replacement response is the second checksum occurrence.
marker = "        assetKey: newAssetKey,\n        checksumSha256: await sha256Hex(bytes.buffer as ArrayBuffer),"
if marker not in text:
    raise SystemExit("replacement response marker not found")
text = text.replace(
    marker,
    "        assetKey: newAssetKey,\n        contentType: metadata.contentType,\n        mediaWidth: metadata.width,\n        mediaHeight: metadata.height,\n        isAnimated: metadata.animated,\n        checksumSha256: await sha256Hex(bytes.buffer as ArrayBuffer),",
    1,
)
api.write_text(text)

replace_once(
    "app/components/admin/store/types.ts",
    "  assetKey: string;\n  packId: string | null;",
    "  assetKey: string;\n  contentType: string | null;\n  mediaWidth: number | null;\n  mediaHeight: number | null;\n  isAnimated: boolean | number;\n  packId: string | null;",
)
manager = Path("app/components/admin/store/AdminEmotePackManager.tsx")
text = manager.read_text().replace(
    'accept="image/png,image/jpeg,image/webp"',
    'accept="image/png,image/jpeg,image/webp,image/gif"',
)
heading_marker = '''            <Badge tone={truthy(emote.isEnabled) ? "success" : "neutral"}>
              {truthy(emote.isEnabled) ? "Enabled" : "Disabled"}
            </Badge>'''
if heading_marker not in text:
    raise SystemExit("Admin emote badge marker not found")
text = text.replace(
    heading_marker,
    heading_marker + '\n            {truthy(emote.isAnimated) ? <Badge>Animated</Badge> : null}',
    1,
)
manager.write_text(text)

# Home filter tabs keep labels only; loaded state remains internal.
home = Path("app/routes/_index.tsx")
text = home.read_text()
pattern = re.compile(r'''\n\s*<span\n\s*className="product-feed-filter-tabs__count"\n\s*aria-label=\{\n\s*loaded \? `\$\{feeds\[option\.value\]\.length\} loaded posts` : "Loads on demand"\n\s*\}\n\s*>\n\s*\{loaded \? feeds\[option\.value\]\.length : "·"\}\n\s*</span>''')
text, count = pattern.subn("", text, count=1)
if count != 1:
    raise SystemExit("Home feed count target not found")
# loaded local becomes unnecessary in map.
text = text.replace("            const loaded = loadedFeeds.has(option.value);\n", "", 1)
home.write_text(text)

# Friends count spacing override.
product_css = Path("app/components/product/product.css")
text = product_css.read_text()
text += '''\n\n/* Community plan: keep friend counters visually separated from their labels. */\n.product-friends-tab-count {\n  display: inline-flex;\n  min-width: 1.5em;\n  justify-content: center;\n  margin-inline-start: 0.45rem;\n}\n'''
product_css.write_text(text)

# Share wrapper fills the same 1fr geometry as Like and Comment.
post_css = Path("app/components/product/post-card-refresh.css")
text = post_css.read_text()
text += '''\n\n.product-post__actions .product-share-action {\n  display: flex;\n  width: 100%;\n  min-width: 0;\n}\n\n.product-post__actions .product-share-action > button {\n  width: 100%;\n  min-height: 42px;\n  justify-content: center;\n}\n\n@media (max-width: 760px) {\n  .product-post__actions .product-share-action > button {\n    min-height: 38px;\n  }\n}\n'''
post_css.write_text(text)
