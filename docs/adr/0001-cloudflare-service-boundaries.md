# ADR 0001: Cloudflare service boundaries

- Status: Accepted
- Date: 2026-09-05

## Context

SourceBoard is designed as a Cloudflare-native full-stack application. The canonical implementation plan requires explicit ownership boundaries so later features do not accidentally use an eventually consistent or object-storage service as authoritative application state.

## Decision

### Workers

Cloudflare Workers owns HTTP execution, SSR, API routing, authentication/authorization enforcement, validation, security headers, SEO responses, and protected media access. React Router framework mode and the Cloudflare Vite Plugin keep the frontend and Worker deployable as one application.

### D1 — source of truth

D1 will be the relational source of truth for users, sessions, permissions, posts, comments, friendships, reactions, moderation, verification, reputation, inventory, and other authoritative application state.

KV must never become the authority for permissions, sessions, ownership, balances, friendships, or roles.

### R2 — media

R2 stores binary media: post images, avatars, banners, emotes, stickers, and cosmetic assets. Protected objects remain private and are served through Worker authorization checks.

### KV — cache/configuration

KV is reserved for high-read cache entries and non-authoritative configuration snapshots. Cache invalidation follows successful changes to the D1 source of truth.

### Queues — asynchronous work

Queues decouple non-critical or retryable work such as notifications, reputation evaluation, cleanup, and index-related events. Consumers must be designed to be idempotent.

### Durable Objects — realtime coordination

Durable Objects are reserved for stateful realtime coordination where their single-threaded ownership model provides value, principally notification WebSockets. They are not the durable source of truth for notifications or social state.

## Consequences

- Phase 0 configures no storage bindings and invents no Cloudflare resource IDs.
- Phase 1 will create and wire D1, R2, KV, Queues, Rate Limiting, Email, and Turnstile configuration.
- Later modules must expose clear domain interfaces rather than directly coupling UI components to Cloudflare storage APIs.
- Realtime delivery may fail without losing authoritative notification data because persistent state remains in D1.
