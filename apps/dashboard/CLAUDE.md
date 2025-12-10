# Dashboard CLAUDE.md

Guidance for Claude Code when working in the dashboard app.

## Overview

Analytics dashboard for duyetbot-agent built with **Next.js 15 + React 19 + Cloudflare D1**.

Uses [OpenNext.js for Cloudflare](https://opennext.js.org/cloudflare) to deploy Next.js on Cloudflare Workers.

## Development Modes

### Next.js + Cloudflare D1 Binding Behavior

| Mode | Command | Cloudflare Bindings | Use Case |
|------|---------|---------------------|----------|
| `dev` | `bun run dev` | ❌ Not available | Fast UI/styling work |
| `dev:remote` | `bun run dev:remote` | ✅ Remote D1 | Testing with real data |
| `preview` | `bun run preview` | ✅ Local emulated | Pre-deploy testing |

**Key insight**: `next dev` runs vanilla Next.js with no Cloudflare bindings. The `opennextjs-cloudflare preview` command uses wrangler under the hood which provides bindings. Adding `--remote` tells wrangler to proxy bindings to production instead of local state.

### Recommended Workflow

```bash
cd apps/dashboard

# Standard dev (no D1 access - faster, for UI work)
bun run dev

# Dev with remote D1 access (slower build, but real data)
bun run dev:remote
```

### Trade-offs

| Mode | Hot Reload | Build Step | D1 Access | Speed |
|------|------------|------------|-----------|-------|
| `dev` | ✅ Fast | None | ❌ | Fastest |
| `dev:remote` | ⚠️ Slower | Required | ✅ Remote | Slower |
| `preview` | ⚠️ Slower | Required | ✅ Local | Slower |

The build step in `dev:remote` is required because OpenNext transpiles your Next.js app for the Workers runtime before it can access Cloudflare bindings.

## Scripts

### Local (from `apps/dashboard/`)

```bash
bun run dev          # Next.js dev server (port 3001, no bindings)
bun run dev:remote   # Build + preview with remote D1 bindings
bun run preview      # Build + preview with local emulated bindings
bun run deploy       # Build + deploy to Cloudflare
bun run deploy:branch # Deploy to preview worker (duyetbot-dashboard-preview)
bun run cf-typegen   # Generate Cloudflare env types
```

### Root Level (from monorepo root)

```bash
# Development (with Turbo caching + dependency builds)
bun run build:dashboard         # Build dashboard + dependencies
bun run deploy:dashboard        # Production deploy
bun run deploy:dashboard:branch # Branch/preview deploy

# CI Scripts (single app, no dependency rebuild)
bun run ci:build:dashboard          # Build only dashboard
bun run ci:deploy:dashboard         # Deploy only dashboard
bun run ci:deploy-version:dashboard # Branch deploy for CI
```

**Turbo vs CI scripts**: Root-level `build:dashboard` and `deploy:dashboard` use Turbo to rebuild dependencies (`@duyetbot/analytics`, etc.) if changed. CI scripts (`ci:*`) skip this and deploy only the dashboard app - useful when dependencies are pre-built.

## Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19 + Tailwind CSS
- **Charts**: Recharts
- **Data Fetching**: TanStack Query
- **Database**: Cloudflare D1 (via `@duyetbot/analytics`)
- **Deployment**: OpenNext.js for Cloudflare Workers
