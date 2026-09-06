# SourceBoard

SourceBoard is a Cloudflare-native social forum for finding the public source or origin of images. The repository is implemented phase-by-phase from the canonical `plan-foro-fuentes-imagenes-cloudflare.md` specification.

## Current status

Phase 0B is complete as the pre-backend product and UI/UX experience pass. The repository now has
typed adapter-backed product surfaces, responsive navigation, accessibility coverage and fixture-only
presentation states. Authentication, D1/R2 bindings, persistence and other later-phase backend
functionality are intentionally not implemented yet.

See [`docs/IMPLEMENTATION_PROGRESS.md`](docs/IMPLEMENTATION_PROGRESS.md) for the authoritative implementation status.

## Stack

- TypeScript
- React 19
- React Router v8 framework mode with SSR
- Vite 8
- Cloudflare Vite Plugin
- Cloudflare Workers + Static Assets
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
  "requestId": "..."
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

Phase 0 deliberately does not create D1, R2, KV, Queue, Durable Object, Turnstile, Email, or Rate Limiting resource identifiers. Those bindings are introduced in the phases defined by the canonical plan.

## Architecture decisions

See [`docs/adr/0001-cloudflare-service-boundaries.md`](docs/adr/0001-cloudflare-service-boundaries.md).
