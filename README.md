# SourceBoard

SourceBoard is a Cloudflare-native social forum for finding the public source or origin of images. The repository is implemented phase-by-phase from the canonical `plan-foro-fuentes-imagenes-cloudflare.md` specification.

## Current status

Phase 0B, Phase 1, Phase 2, Phase 3 and Phase 4 are complete on their stacked branches.
Phase 4A is next; production secrets/resources remain operator-supplied and no
fixture data is being promoted to persistence.

See [`docs/IMPLEMENTATION_PROGRESS.md`](docs/IMPLEMENTATION_PROGRESS.md) for the authoritative implementation status.

## Stack

- TypeScript
- React 19
- React Router v8 framework mode with SSR
- Vite 8
- Cloudflare Vite Plugin
- Cloudflare Workers + Static Assets
- Drizzle ORM + Drizzle Kit for typed SQLite schema/migrations
- Zod
- Vitest
- Playwright
- ESLint + Prettier

## Requirements

- Node.js 22.22.0 or newer
- npm
- A Cloudflare account only when deploying remotely

## Local development

```bash
npm install
npm run typegen
npm run dev
```

The development server is normally available at `http://localhost:5173`.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run deploy:dry-run
npm run test:e2e
```

Or run the non-browser checks together:

```bash
npm run check
```

Playwright requires Chromium before the first E2E run:

```bash
npx playwright install chromium
```

## Endpoints

### `GET /api/health`

Returns the Phase 0 health payload and propagates a valid `x-request-id` header. Requests without a valid request id receive a generated UUID.

Example response:

```json
{
  "status": "ok",
  "service": "sourceboard",
  "requestId": "...",
  "bindings": {
    "db": false,
    "media": false,
    "cache": false,
    "events": false,
    "rateLimits": {
      "auth": false,
      "content": false,
      "reactions": false,
      "uploads": false
    },
    "email": false,
    "turnstile": false
  }
}
```

## Cloudflare deployment

Generate Worker types whenever `wrangler.jsonc` changes:

```bash
npm run typegen
```

Preview the production build locally:

```bash
npm run preview
```

Validate Worker packaging without publishing:

```bash
npm run deploy:dry-run
```

Deploy the Worker and static assets:

```bash
npm run deploy
```

Phase 1 keeps local-safe binding declarations in `wrangler.jsonc` and the complete real-resource shape in
[`wrangler.phase1.example.jsonc`](wrangler.phase1.example.jsonc). No Cloudflare IDs or secrets are
invented. Provisioning and migration commands are documented in
[`docs/PHASE_1_INFRASTRUCTURE.md`](docs/PHASE_1_INFRASTRUCTURE.md).

Authentication, security secrets, API endpoints and Phase 2 boundaries are documented in
[`docs/PHASE_2_AUTH.md`](docs/PHASE_2_AUTH.md).

## Architecture decisions

See [`docs/adr/0001-cloudflare-service-boundaries.md`](docs/adr/0001-cloudflare-service-boundaries.md).
