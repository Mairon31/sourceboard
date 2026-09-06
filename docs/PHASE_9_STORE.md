# Phase 9 — Store, inventory and cosmetics

Status: **COMPLETE — CI green, ready for review**

Phase 9 adds points-backed personalization without moving the balance authority to the client.

## Delivered

- D1 `store_items`, `store_purchases`, `user_inventory` and `user_cosmetics` tables;
- scheduled active catalog reads for AVATAR_FRAME, PROFILE_BANNER, PROFILE_EFFECT, NAME_FONT, EMOTE_PACK and STICKER_PACK;
- idempotent purchases using a request key, catalog-owned price, and an atomic D1 batch containing the conditional ledger debit, purchase row and inventory entitlement;
- historical `price_paid` and ledger debit linkage;
- inventory-only equip operations for the four cosmetic slots;
- safe structured catalog configuration with allowlisted font families and profile-effect presets;
- `store.manage` admin create/update routes with audit log entries;
- pack inventory data and server-side entitlement checks for the composer.
- allowlisted cosmetic rendering in public profiles, post authors and comments;

## Routes

- `GET /api/store`
- `POST /api/store/:itemId/purchase`
- `GET /api/me/inventory`
- `PUT /api/me/cosmetics/:slot`
- `POST /api/admin/store`
- `PATCH /api/admin/store/:itemId`

All writes require same-origin plus CSRF. Admin writes require `store.manage`.

## Deliberate boundaries

No arbitrary CSS, font URLs, scripts or external style values are accepted. Media upload/asset provisioning remains behind the existing private-R2 catalog boundary. Cosmetic rendering consumes only server-filtered presets and font families; anonymous and privacy-hidden authors never receive cosmetic identity data.

GitHub Actions run `#82` (`34044939144`) passed lint/Prettier, strict TypeScript, 71 unit tests across 23 files, production build, Wrangler deploy dry-run, local D1 migrations through `0009` and 75 Playwright E2E tests.
