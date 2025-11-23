# Memory MCP Server Deployment

**Back to:** [Deployment Overview](README.md)

Deploy the MCP memory server on Cloudflare Workers for session persistence.

## Overview

The Memory MCP server provides:
- Session storage (D1 database)
- Message history persistence
- Text-based search across sessions
- GitHub token authentication

## Prerequisites

1. Cloudflare account with Workers enabled
2. Wrangler CLI: `npm install -g wrangler`
3. GitHub OAuth App (optional, for OAuth flow)

## Quick Start

```bash
cd apps/memory-mcp

# Login to Cloudflare
wrangler login

# Create D1 database
bun run db:create
# Copy the database_id from output

# Update wrangler.toml with the database_id

# Run migrations
bun run db:migrate

# Deploy
bun run deploy
```

## Step-by-Step Setup

### 1. Create D1 Database

```bash
cd apps/memory-mcp

# Production database
wrangler d1 create duyetbot-memory
# Output: database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Staging database (optional)
wrangler d1 create duyetbot-memory-staging
```

### 2. Update wrangler.toml

Replace placeholder IDs with actual database IDs:

```toml
[[d1_databases]]
binding = "DB"
database_name = "duyetbot-memory"
database_id = "YOUR_ACTUAL_DATABASE_ID"  # From step 1
```

### 3. Run Migrations

```bash
# Production
bun run db:migrate

# Staging
bun run db:migrate:staging

# Local development
bun run db:migrate:local
```

### 4. Set Secrets (Optional)

For GitHub OAuth flow:

```bash
# Set secrets
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET

# For staging
wrangler secret put GITHUB_CLIENT_ID --env staging
wrangler secret put GITHUB_CLIENT_SECRET --env staging
```

### 5. Deploy

```bash
# Production
bun run deploy

# Staging
bun run deploy:staging
```

## Configuration

### wrangler.toml

```toml
name = "duyetbot-memory"
main = "src/index.ts"
compatibility_date = "2024-11-20"

[vars]
ENVIRONMENT = "production"

[[d1_databases]]
binding = "DB"
database_name = "duyetbot-memory"
database_id = "YOUR_D1_DATABASE_ID"
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ENVIRONMENT` | Runtime environment | Yes (set in wrangler.toml) |
| `GITHUB_CLIENT_ID` | OAuth client ID | No (for OAuth flow) |
| `GITHUB_CLIENT_SECRET` | OAuth client secret | No (for OAuth flow) |

## API Endpoints

### Public

- `GET /health` - Health check
- `POST /api/authenticate` - Authenticate with GitHub token

### Protected (requires Bearer token)

- `POST /api/memory/get` - Get session messages
- `POST /api/memory/save` - Save messages to session
- `POST /api/memory/search` - Search across sessions
- `POST /api/sessions/list` - List user sessions

## Available Scripts

```bash
# Development
bun run dev              # Start local dev server

# Deployment
bun run deploy           # Deploy to production
bun run deploy:staging   # Deploy to staging

# Database
bun run db:create        # Create production D1 database
bun run db:create:staging # Create staging D1 database
bun run db:migrate       # Run production migrations
bun run db:migrate:staging # Run staging migrations
bun run db:migrate:local # Run local migrations

# Monitoring
bun run logs             # Tail production logs

# Testing
bun run test             # Run tests
bun run test:watch       # Run tests in watch mode
```

## Monitoring

```bash
# Tail logs
wrangler tail duyetbot-memory

# Check database
wrangler d1 execute duyetbot-memory --command "SELECT COUNT(*) FROM users"
```

## Troubleshooting

### Database not found

```bash
# Verify database exists
wrangler d1 list

# Ensure database_id in wrangler.toml matches
```

### Migration errors

```bash
# Check migration status
wrangler d1 migrations list duyetbot-memory

# Re-run migrations
bun run db:migrate
```

### Authentication errors

1. Verify GitHub token has correct scopes
2. Check token hasn't expired
3. Verify user exists in database

## Next Steps

- [GitHub Bot Deployment](github-bot.md)
- [Telegram Bot Deployment](telegram-bot.md)
- [Deployment Overview](README.md)
