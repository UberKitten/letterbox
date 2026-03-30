# Letterbox

A focused reading app for email newsletters. Connects to your Office 365 account and presents posts one at a time in a clean, distraction-free interface.

Outlook is great for scanning and triage — Letterbox is for when you're bored and want to read.

## Features

- **One-at-a-time reading** — paginate through posts, not a list view
- **Folder selection** — choose which mail folders to read from (e.g. Posts/Tech, Posts/Science)
- **Multi-folder aggregation** — merge posts from multiple folders, sorted by date
- **Filters** — unread, read, flagged, all; plus Outlook category filtering
- **Reader & Original modes** — sanitized reader view or full original HTML in a sandboxed iframe
- **Article day/night toggle** — override the article background independent of your system theme
- **Wide/narrow layout** — toggle content width per preference
- **Mark read with undo** — mark and advance instantly, undo to go back
- **Keyboard shortcuts** — arrow keys to navigate, `r` to mark read, `z` to undo, `f` to flag
- **Dark mode** — follows system preference automatically
- **Fast navigation** — messages are fetched in pages and cached client-side
- **Multi-tenant** — anyone with an O365 account can sign in

## Architecture

- **Frontend**: [Solid.js](https://www.solidjs.com/) SPA with [Vite](https://vitejs.dev/)
- **Backend**: [Cloudflare Worker](https://workers.cloudflare.com/) with [itty-router](https://github.com/kwhitley/itty-router)
- **Auth**: OAuth 2.0 with Microsoft Graph API
- **Storage**: Cloudflare KV (sessions and preferences only — no email data is stored)
- **Icons**: [Lucide](https://lucide.dev/)

```
packages/shared/   — TypeScript types shared between frontend and backend
web/               — Solid.js frontend
worker/            — Cloudflare Worker API proxy + auth
```

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)
- A [Microsoft Azure](https://portal.azure.com/) app registration with:
  - Redirect URI: `https://localhost:8787/auth/callback` (dev) or your deployed worker URL
  - API permissions: `Mail.ReadWrite`, `User.Read`, `offline_access`

### Install

```bash
pnpm install
```

### Configure secrets

Create `worker/.dev.vars` for local development:

```
MS_CLIENT_ID=your-azure-client-id
MS_CLIENT_SECRET=your-azure-client-secret
TOKEN_ENCRYPTION_KEY=base64-encoded-32-byte-key
ALLOWED_ORIGIN=https://localhost:3000
```

Generate an encryption key:

```bash
openssl rand -base64 32
```

### Local HTTPS certificates

The app requires HTTPS for secure cookies. Generate self-signed certs:

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes -subj '/CN=localhost'
```

### Run

```bash
pnpm dev
```

This starts:
- Worker on `https://localhost:8787`
- Web app on `https://localhost:3000` (proxies API requests to the worker)

### Deploy

```bash
# Set production secrets
wrangler secret put MS_CLIENT_ID
wrangler secret put MS_CLIENT_SECRET
wrangler secret put TOKEN_ENCRYPTION_KEY
wrangler secret put ALLOWED_ORIGIN

# Deploy worker
pnpm deploy:worker

# Build and deploy frontend (to Cloudflare Pages or your preferred host)
pnpm build
```

## Privacy

Letterbox is a proxy — it authenticates with Microsoft on your behalf and passes email data through to your browser. **No email content is stored on the server.** The only data persisted in Cloudflare KV is:

- Session tokens (encrypted, 30-day TTL)
- Your selected folder preferences

## License

MIT
