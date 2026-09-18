# Sensitive social previews

Public post metadata uses the normal post-media URL for ordinary images. For a
public NSFW post it uses `/api/share-image/:postId?v=<post.updatedAt>` instead.
The same helper is used by `/sh/:shortId` metadata, including links anchored to
comments.
The Worker resolves the post and its D1-owned media row; it never accepts a
remote image URL from the request.

The share-image handler applies Cloudflare Image Transformations through the
Worker `fetch()` `cf.image` option (`scale-down`, `1200x630`, strong blur,
quality reduction, and animation disabled). The transformed bytes are returned
directly and are not written to R2. Cloudflare caches the transformed variant;
the short response cache lifetime plus the `updatedAt` URL version prevent an
old classification or replacement from being treated as permanent.

If the sensitive transform or media origin fails, the handler returns the
existing safe `sourceboard-og.png` asset. It never falls back to the original
NSFW image. Missing, private, deleted, or hidden posts return no image. Local
Wrangler only approximates some image options, so production verification must
be done on the deployed zone with Image Transformations enabled.
