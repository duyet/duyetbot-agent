# DuyetBot Web Deployment Guide

This guide covers deploying the DuyetBot Web application to Cloudflare Workers.

## Prerequisites

- [Bun](https://bun.sh/) v1.0+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) v3+
- Cloudflare account with Workers plan
- OpenRouter API key

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Configure secrets
bun run config

# 3. Deploy
bun run deploy
```

## Environment Setup

### Required Secrets

Configure these secrets using Wrangler:

```bash
# Session signing key (generate a random 32+ character string)
wrangler secret put SESSION_SECRET

# OpenRouter API key for LLM access
wrangler secret put OPENROUTER_API_KEY

# Optional: GitHub OAuth (for social login)
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

### Cloudflare Resources

The application requires these Cloudflare resources (auto-created on first deploy):

| Resource | Name | Purpose |
|----------|------|---------|
| D1 Database | `duyetbot` | User data, chats, messages |
| KV Namespace | `RATE_LIMIT_KV` | Distributed rate limiting |
| R2 Bucket | `duyetbot-web-uploads` | File uploads storage |

### wrangler.toml Configuration

```toml
name = "duyetbot-web"
main = "worker/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

# Static assets from Next.js export
assets = { directory = "./out", binding = "ASSETS" }

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "duyetbot"
database_id = "your-database-id"

# KV for rate limiting
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-kv-id"

# R2 for file uploads
[[r2_buckets]]
binding = "UPLOADS_BUCKET"
bucket_name = "duyetbot-web-uploads"

# AI binding for gateway
[ai]
binding = "AI"

# Environment variables
[vars]
ENVIRONMENT = "production"
AI_GATEWAY_NAME = "duyetbot"
```

## Deployment Commands

### Development

```bash
# Start local dev server
bun dev

# Run local preview with Wrangler
bun run preview
```

### Production

```bash
# Full build and deploy
bun run deploy

# Deploy without rebuilding
wrangler deploy

# Deploy to specific environment
wrangler deploy --env staging
```

### Database Migrations

```bash
# Generate migration from schema changes
bun run db:generate

# Apply migrations to local D1
bun run db:migrate

# Apply migrations to production
wrangler d1 migrations apply duyetbot --remote

# Open Drizzle Studio for database inspection
bun run db:studio
```

## CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Build
        run: bun run build

      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          command: deploy
```

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `CF_API_TOKEN` | Cloudflare API token with Workers edit permission |

## Post-Deployment Verification

### Health Check

```bash
curl https://your-worker.workers.dev/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Run Production E2E Tests

```bash
# Set production URL
export PRODUCTION_URL=https://your-worker.workers.dev

# Run tests
bun run test:production
```

### Verify API Documentation

Visit `https://your-worker.workers.dev/api/docs` to see Swagger UI.

## Rollback

```bash
# List recent deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback
```

## Monitoring

### View Logs

```bash
# Tail live logs
wrangler tail

# Filter by status
wrangler tail --status error
```

### Analytics

Access Worker analytics in the Cloudflare dashboard:
- Request count and latency
- Error rates
- CPU time usage
- Geographic distribution

## Troubleshooting

### Common Issues

#### 1. D1 Connection Errors

```
Error: D1_ERROR: no such table: User
```

**Solution**: Run migrations on production:
```bash
wrangler d1 migrations apply duyetbot --remote
```

#### 2. KV Rate Limit Errors

```
Error: KV GET failed
```

**Solution**: Verify KV namespace is bound in wrangler.toml and exists:
```bash
wrangler kv:namespace list
```

#### 3. R2 Upload Failures

```
Error: R2 bucket not found
```

**Solution**: Create the bucket:
```bash
wrangler r2 bucket create duyetbot-web-uploads
```

#### 4. Static Assets 404

**Solution**: Ensure `out/` directory exists after build:
```bash
bun run build
ls out/
```

### Debug Mode

Enable verbose logging:
```bash
wrangler deploy --log-level debug
```

## Performance Optimization

### Cache Headers

Static assets are served with optimal cache headers:
- Hashed assets (`/_next/*`): `immutable, max-age=31536000`
- HTML pages: `stale-while-revalidate`
- API responses: `no-store` (dynamic)

### Bundle Size

Monitor worker bundle size:
```bash
wrangler deploy --dry-run
# Shows: Total Upload: XXX KiB / gzip: XXX KiB
```

Target: < 1MB compressed for fast cold starts.

## Security Checklist

- [ ] SESSION_SECRET is a strong random value (32+ chars)
- [ ] GitHub OAuth credentials are production values
- [ ] CORS is configured appropriately for production domain
- [ ] Rate limiting is enabled and tested
- [ ] No sensitive data in environment variables (use secrets)

## Support

- **API Docs**: `/api/docs`
- **Health Check**: `/health`
- **GitHub Issues**: https://github.com/duyet/duyetbot-agent/issues
