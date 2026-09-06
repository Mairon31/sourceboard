# Phase 6 — Admin base, emotes and stickers

Status: **COMPLETED on `phase-6-admin-emotes-stickers`**

Phase 6 establishes the first operational admin boundary without turning the
Phase 0B fixtures into a fake backend.

## Implemented

- `/admin`, `/admin/moderation` and the anonymous-author surface now check the
  server-side `admin.access` capability before rendering privileged content.
- The dashboard no longer displays fixture counts or claims that a privileged
  mutation exists when it does not.
- Migration `0006` adds emote/sticker pack records and catalog ordering while
  preserving the catalog tables introduced by Phase 5.
- `POST /api/admin/catalog/emotes` and `POST /api/admin/catalog/stickers`
  accept multipart image uploads only after same-origin, CSRF and capability
  checks. Image MIME and magic bytes are validated by the Phase 4 image
  validator; failed D1 persistence deletes the private R2 object.
- `GET` catalog listing and `PATCH` active/disabled status are available only
  to the matching management capability. R2 keys are never returned to the
  client.

## Deliberate boundaries

The Phase 6 API does not invent a public catalog delivery policy, external GIF
provider, or store/inventory write path. Public emote/sticker delivery and
packs consumed by comments will be connected when their canonical product
phases define the authorization and caching policy. No Cloudflare resource IDs
or secrets are required by this migration.

## Verification

Local verification completed so far:

- `npm run typecheck`
- `npm run lint`
- `npm test -- --run` — 63 tests passing

GitHub Actions run `#66` (`34037972333`) passed lint/Prettier, strict TypeScript,
63 unit tests, production build, Wrangler deploy dry-run, local D1 migrations
through `0006` and 73 Playwright E2E tests. The preceding run `#65` exposed an
SSR authorization lookup bug for unauthenticated admin requests; the fix was
verified in `#66` without weakening the tests.
