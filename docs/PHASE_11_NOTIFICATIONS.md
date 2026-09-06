# Phase 11 — Notificaciones persistentes y tiempo real

Status: **IN PROGRESS — D1 and realtime foundation implemented**

## Implemented

- persisted notifications with unread count;
- mark one/all read endpoints;
- activity and friendship notification preferences in D1;
- idempotent Queue event consumer keyed by `eventId + recipientUserId`;
- per-user `NotificationHub` Durable Object using WebSocket Hibernation API;
- authenticated WebSocket upgrade bound to the current session user;
- reconnect handshake carries `lastSeen` so the client can reconcile from D1;
- server-backed notifications page and unread badge.

## Deliberate remaining work

Domain producers still need to be wired for every canonical event (comment, reply, accepted/verified source, achievement, purchase/grant and moderation), and the client-side reconnect/reconciliation loop remains before Phase 11 closure. D1 remains the source of truth; a missing socket never drops a notification.
