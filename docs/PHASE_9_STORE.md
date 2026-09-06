# Phase 9 — Store, inventory and cosmetics

Status: **IMPLEMENTED — CI green, integration review pending**

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

## Routes

- `GET /api/store`
- `POST /api/store/:itemId/purchase`
- `GET /api/me/inventory`
- `PUT /api/me/cosmetics/:slot`
- `POST /api/admin/store`
- `PATCH /api/admin/store/:itemId`

All writes require same-origin plus CSRF. Admin writes require `store.manage`.

## Deliberate boundaries

No arbitrary CSS, font URLs, scripts or external style values are accepted. Media upload/asset provisioning remains behind the existing private-R2 catalog boundary. Cosmetic rendering in every feed surface remains follow-up integration work before Phase 9 is considered fully closed.

GitHub Actions run `#80` (`34044334540`) passed lint/Prettier, strict TypeScript, 71 unit tests across 23 files, production build, Wrangler deploy dry-run, local D1 migrations through `0009` and 75 Playwright E2E tests.
