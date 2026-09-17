# Media and post lifecycle

## Upload pipeline

User-uploaded image purposes share `shared/media/policy.ts` and
`worker/media/upload.ts`. The policy is server-authoritative:

| Purpose          | Original limit | Maximum side | Accepted formats           |
| ---------------- | -------------: | -----------: | -------------------------- |
| Avatar           |         10 MiB |     1,024 px | JPEG, PNG, WebP, AVIF, GIF |
| Profile banner   |         10 MiB |     4,096 px | JPEG, PNG, WebP, AVIF, GIF |
| Post image       |         25 MiB |     4,096 px | JPEG, PNG, WebP, AVIF      |
| Comment image    |          5 MiB |     2,048 px | JPEG, PNG, WebP, AVIF      |
| Achievement icon |          2 MiB |     1,024 px | PNG, GIF                   |

The browser may use `createImageBitmap` and canvas to resize and encode compatible
static images as WebP. This is an optimization hint, not a trust boundary. The
Worker has no `sharp`, image-codec WASM, or Cloudflare Images binding in the
current deployment, so it validates the original/request bytes, MIME signature,
container structure, dimensions and limits and rejects anything outside policy.
AVIF is structurally inspected; it is not decoded by a native Worker codec.

The Worker generates the media ID and key (`posts/`, `comments/`,
`profile/`, or `achievement-icons/`). Filenames, usernames and request paths
never enter a key. `media_assets` stores only ownership, purpose, key, MIME,
dimensions, byte size, checksum and lifecycle timestamps. Ordinary uploads do
not retain a separate original object.

## D1/R2 ordering and cleanup

An upload is `validate -> R2 put -> D1 persist`. If D1 persistence fails, the
new R2 object is deleted. If compensation also fails, the managed key is left
for the bounded orphan sweep after its grace period. Replacement is
`new object -> D1 switch -> old asset marked DELETED -> old R2 delete`; the old
object is never deleted before the new reference is durable. A failed old-object
delete leaves the `DELETED` row for scheduled retry. Shared legacy references
are checked before marking an object deleted.

Profile assets are served only when they are the current, active slot and the
viewer can see the profile. Replacement asset IDs provide deterministic cache
versioning; private profile media is `no-store`. Post and comment gateways
re-check post visibility before serving media.

The existing scheduled Worker handler runs bounded maintenance batches. It
purges expired post records conditionally, marks unreferenced media deleted,
deletes R2 objects, and retains metadata when R2 fails so a later run can
retry. Its orphan sweep requests server-written R2 custom metadata and deletes
only objects whose generated media ID, purpose and key agree exactly and whose
age exceeds the 24-hour grace period. Legacy or unannotated objects are never
deleted automatically; they require an explicit audit decision.

## Post retention

Post deletion sets `posts.deleted_at` and preserves the previous status for
24 hours. Deleted posts are excluded from public feeds and remain visible to
their owner through Recently Deleted. The owner can restore only while
`now - deleted_at < 24h`; the update is conditional on the observed timestamp.

Purge first revalidates that timestamp in the `DELETE FROM posts` predicate.
Only after that delete succeeds are post/comment media candidates considered.
Foreign-key lifecycle rules handle dependent comments, reactions and source
resolution records; audit/report rows keep their target identifiers. R2 media
is deleted only when no remaining database reference exists.

## Comment attachments

Each comment has at most one primary attachment. Image, GIF and Sticker are
mutually exclusive categories; selecting a new category replaces the previous
one in the composer. Inline emotes are independent. An image-only comment is
allowed when the comment contract permits it, but Accepted/Verified source
actions require real text after safe rich-text normalization. The server
rechecks ownership, attachment type and image asset state.

GIF/sticker catalog assets are provider/admin-managed media and use their own
catalog validation/storage path; that path is not a second user-upload
pipeline. New user-uploaded image purposes should call `uploadMediaAsset` and
add a purpose policy rather than copy profile/post/comment validation.
