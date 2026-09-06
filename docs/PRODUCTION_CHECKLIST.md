# SourceBoard production checklist

This checklist is a release gate. Every unchecked item requires an explicit
owner and a recorded exception before production traffic is enabled.

## Cloudflare resources and secrets

- [ ] Approved account, Worker name and custom domain are recorded privately.
- [x] D1 `sourceboard-db` exists and its Cloudflare database ID is bound in
      `wrangler.jsonc`.
- [ ] All forward migrations are applied to a reviewed staging database first.
- [x] Private R2 `sourceboard-media` and the existing `sourceboard-cache` KV
      namespace exist and are bound.
- [x] `sourceboard-events` and `sourceboard-events-dlq` exist.
- [x] Four account-scoped Workers Rate Limiting bindings are attached to the
      top-level and `ssr` configurations.
- [x] Turnstile production site key is configured for `srcboard.me`; its
      secret is present in Cloudflare.
- [x] `EMAIL_FROM`, `EMAIL_LOOKUP_KEY_V1` and `DATA_ENCRYPTION_KEY_V1` are
      supplied as Worker secrets; no secret is in Git.
- [ ] Email Service sender/domain is verified.

## Security and edge controls

- [x] HTTPS custom domain `srcboard.me` and its Worker certificate are active.
- [ ] Cloudflare WAF managed rules are enabled in a monitored mode first, then
      promoted after false-positive review.
- [ ] Login, content, reaction and upload abuse rules have tested thresholds.
- [x] Security headers are present on API, SSR and media responses.
- [ ] Anonymous post, friends-only, private, deleted and NSFW privacy cases are
      tested through public HTML, metadata, JSON-LD, cache and search paths.
- [ ] R2 bucket is not public and direct object access is denied.
- [ ] The remaining CSP inline-style allowance has been reviewed and accepted,
      or all React style attributes have been migrated to a stricter policy.

## Data safety and operations

- [ ] D1 Time Travel retention and restore permissions are verified.
- [ ] A staging restore drill has been completed and data integrity checked.
- [ ] An independent encrypted D1 export/archive exists in private R2, with a
      tested restore reader and retention policy.
- [ ] R2 lifecycle rules are limited to approved temporary/backup prefixes.
- [ ] Cron execution and maintenance counters are observable.
- [ ] Queue retry, DLQ depth, backlog age and consumer errors have alerts.
- [ ] Worker 5xx, latency, 429/503, D1 and R2 dashboards/alerts have owners.
- [ ] [`INCIDENT_RUNBOOK.md`](INCIDENT_RUNBOOK.md) was exercised with a game
      day or tabletop review.

## Verification gate

Run and attach the output/CI link for:

```bash
npm ci
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run deploy:dry-run
npm run db:migrations:apply
npm run test:e2e
```

Run Playwright at 390, 430, 768, 1024, 1280 and 1440+ CSS pixels. Cover auth,
create post, public/friends-only/private visibility, anonymous and NSFW states,
comments/replies/likes, GIF/sticker/emote entitlements, accepted/verified
source, points/store, admin/moderation, logout/all/block, SEO and keyboard
accessibility. Verify loading, empty, error and disabled states rather than only
successful responses.

## Release and rollback

- [ ] Review the exact commit, generated Worker config, migration list and
      changed files.
- [ ] Run Wrangler dry-run with the private production config.
- [x] Production deploy completed from `master` through Workers Build; the
      deployed Worker and migration state were recorded in the progress log.
- [x] Record the deployed version and migration timestamp.
- [ ] Keep the previous Worker version available for rollback.
- [ ] If schema/data incompatibility is suspected, stop traffic changes and
      follow the D1/R2 steps in [`INCIDENT_RUNBOOK.md`](INCIDENT_RUNBOOK.md).
