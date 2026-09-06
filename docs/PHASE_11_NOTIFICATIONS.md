# Phase 11 — Notificaciones persistentes y tiempo real

Status: **READY FOR VERIFICATION — canonical Phase 11 implementation complete**

## Implemented

- persisted notifications with unread count;
- mark one/all read endpoints;
- activity and friendship notification preferences in D1;
- idempotent Queue event consumer keyed by `eventId + recipientUserId`;
- preference-aware persistence for activity and friendship events;
- per-user `NotificationHub` Durable Object using WebSocket Hibernation API;
- authenticated WebSocket upgrade bound to the current session user;
- reconnect handshake carries `lastSeen`, while the client reconciles from D1 on connect, delivery, and reconnect;
- server-backed notifications page, unread badge, accessible dropdown, and deep links where the entity supports them;
- comment and reply producers;
- friend request and acceptance producers that preserve the existing domain notification IDs;
- accepted and verified source producers;
- achievement producers emitted only after a new `user_achievements` row is inserted;
- purchase and capability-gated admin-grant producers;
- moderation-action producers with actor, target, action, reason, and expiry metadata;
- idempotent inventory grants with audit logging.

## Deliberate boundaries

- Like notifications remain optional and are deliberately not emitted to avoid notification spam.
- D1 remains the source of truth; a missing socket never drops a notification.
- Push notifications and external delivery channels remain outside this phase.

## Verification

Local verification passed lint/Prettier, strict TypeScript, unit tests, production build, Wrangler deploy dry-run, and local D1 migration checks. Playwright is executed by the pull-request workflow; the local container cannot start the Cloudflare Vite dev server because `uv_interface_addresses` is unavailable in this environment.
