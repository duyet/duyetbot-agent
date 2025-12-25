# Local Development Setup

This guide explains how to run the duyetbot-web application locally with both frontend and backend servers.

## Quick Start

```bash
# From the apps/web directory
bun run dev:local
```

This command starts both:
- **Next.js dev server** at `http://localhost:3002` (frontend)
- **Wrangler dev server** at `http://localhost:8787` (backend/API)

Then open `http://localhost:3002` in your browser.

## How It Works

The local development setup uses:

1. **Next.js dev server** (port 3002) - Serves the React UI with hot reload
2. **Wrangler dev server** (port 8787) - Runs Cloudflare Workers API locally
3. **API proxying** - Next.js rewrites `/api/*` requests to the Wrangler server

### Architecture

```
Browser → localhost:3002 (Next.js)
                    │
                    ├─> / (static files)
                    │
                    └─> /api/* → localhost:8787 (Wrangler)
```

## Development Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Next.js dev server only (UI only, no API) |
| `bun run dev:local` | Start both Next.js + Wrangler (full stack) |
| `bun run dev:wrangler` | Start Wrangler dev server only |
| `bun run build` | Build for production (static export) |
| `bun run deploy` | Deploy to Cloudflare Workers |

## Manual Setup (Alternative)

If you prefer to run servers manually in separate terminals:

```bash
# Terminal 1: Start Wrangler backend
cd apps/web
bun run dev:wrangler

# Terminal 2: Start Next.js frontend
cd apps/web
bun run dev
```

## Environment Variables

Optional: Create `.env.local` to configure:

```bash
# Wrangler dev server port (default: 8787)
WRANGLER_PORT=8787
```

See `.env.local.example` for all available options.

## Production Build

To build for production deployment:

```bash
bun run build
bun run deploy
```

This creates a static export in the `out/` directory and deploys to Cloudflare Workers.

## Troubleshooting

### Port already in use

If port 8787 is already in use:

```bash
# Use a different port
WRANGLER_PORT=9999 bun run dev:local
```

### API calls failing

1. Check that Wrangler is running: `curl http://localhost:8787`
2. Check logs in `logs/wrangler.log` and `logs/nextjs.log`
3. Verify the rewrites are working by checking Next.js console output

### Database errors in local development

Wrangler dev uses a local in-memory D1 database by default. Data will be lost when you stop the server. For persistent local data, you need to configure a local D1 database.
