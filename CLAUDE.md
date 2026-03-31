# Letterbox

Email newsletter reader that connects to Office 365 via Microsoft Graph API. Renders messages one at a time in a focused, paginated UI.

## Architecture

pnpm monorepo with three packages:

- **`packages/shared/`** — TypeScript types shared between web and worker
- **`web/`** — Solid.js SPA (Vite)
- **`worker/`** — Cloudflare Worker API + static asset server (itty-router)

The worker handles OAuth with Azure AD, proxies Microsoft Graph API calls, and serves the built frontend as static assets. Sessions and user preferences are stored in Cloudflare KV. No email content is persisted.

## Commands

```bash
pnpm dev          # Worker on https://localhost:8787 + web on https://localhost:3000
pnpm build        # Vite build (web/dist/, embedded in worker)
pnpm deploy       # Wrangler deploy (worker + assets)
```

Local dev requires self-signed certs in `/certs/`. The Vite dev server proxies `/auth` and `/api` routes to the worker.

## Tech Stack

- **Frontend**: Solid.js, TypeScript, DOMPurify, Lucide icons
- **Backend**: Cloudflare Workers, itty-router, Cloudflare KV
- **Auth**: OAuth 2.0 with Microsoft Azure AD, AES-GCM encrypted refresh tokens
- **Build**: Vite, Wrangler, pnpm workspaces

## Key Patterns

- Solid.js signals (`createSignal`, `createMemo`, `createEffect`) for all reactive state — not React, no hooks
- Client-side message cache (`Map<index, message>`) invalidated on filter changes; fetch generation counter prevents races
- Worker is stateless except for KV (sessions + preferences); Graph API calls are batched in groups of 4 to avoid MailboxConcurrency throttling
- `withAuth` middleware transparently refreshes expired tokens
- `sanitize.ts` transforms HTML email content for dark mode rendering via DOMPurify

## Worker Secrets (production)

`MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `ALLOWED_ORIGIN`

## Verification

No test suite. To verify API changes, curl the worker endpoint directly before testing in the UI.
