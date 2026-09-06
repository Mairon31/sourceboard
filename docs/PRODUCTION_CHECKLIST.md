# SourceBoard production checklist

This checklist is a release gate. Every unchecked item requires an explicit
owner and a recorded exception before production traffic is enabled.

## Cloudflare resources and secrets

- [ ] Approved account, Worker name and custom domain are recorded privately.
- [ ] D1 database exists; its ID is copied from Cloudflare into the private
      deploy config, never guessed.
- [ ] All forward migrations are applied to a reviewed staging database first.
- [ ] Private R2 media bucket and KV namespace exist.
- [ ] `sourceboard-events` and `sourceboard-events-dlq` exist.
- [ ] Four Rate Limiting namespaces are created and attached to the `ssr`
      environment.
- [ ] Turnstile production site key is configured; secret is stored with
      `npx wrangler secret put TURNSTILE_SECRET`.
- [ ] `EMAIL_FROM`, `EMAIL_LOOKUP_KEY_V1` and `DATA_ENCRYPTION_KEY_V1` are
      supplied as Worker secrets; no secret is in Git.
- [ ] Email Service sender/domain is verified.

## Security and edge controls

- [ ] HTTPS custom domain and certificate are active.
- [ ] Cloudflare WAF managed rules are enabled in a monitored mode first, then
      promoted after false-positive review.
- [ ] Login, content, reaction and upload abuse rules have tested thresholds.
- [ ] Security headers are present on API, SSR and media responses.
- [ ] Anonymous post, friends-only, private, deleted and NSFW privacy cases are
      tested through public HTML, metadata, JSON-LD, cache and search paths.
- [ ] R2 bucket is not public and direct object access is denied.
- [ ] CSP `'unsafe-inline'` migration/exception has been reviewed and accepted,
      or the theme bootstrap has been converted to a nonce.

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
- [ ] Obtain approval for the production deploy; this repository does not deploy
      automatically as part of a phase PR.
- [ ] Record the deployed version and migration timestamp.
- [ ] Keep the previous Worker version available for rollback.
- [ ] If schema/data incompatibility is suspected, stop traffic changes and
      follow the D1/R2 steps in [`INCIDENT_RUNBOOK.md`](INCIDENT_RUNBOOK.md).
