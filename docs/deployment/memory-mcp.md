# Memory MCP Server Deployment

**Back to:** [Deployment Overview](README.md)

Deploy the MCP memory server on Cloudflare Workers for session persistence.

## Overview

The Memory MCP server provides:
- Session storage (D1 database)
- Message history (KV store)
- Semantic search (Vectorize - future)
- GitHub authentication

## Prerequisites

1. Cloudflare account
2. Wrangler CLI installed: `npm install -g wrangler`

## Environment Variables

```env
# Cloudflare
CLOUDFLARE_API_TOKEN=xxx
CLOUDFLARE_ACCOUNT_ID=xxx

# GitHub OAuth (for user authentication)
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx

# JWT signing
JWT_SECRET=xxx
```

## Deploy to Cloudflare Workers

```bash
cd apps/memory-mcp

# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create duyetbot-memory

# Create KV namespace
wrangler kv:namespace create MESSAGES

# Update wrangler.toml with IDs from above commands

# Deploy
wrangler deploy
```

## Configuration

Update `apps/memory-mcp/wrangler.toml`:

```toml
name = "duyetbot-memory"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "duyetbot-memory"
database_id = "your-database-id"

[[kv_namespaces]]
binding = "MESSAGES"
id = "your-kv-namespace-id"
```

## MCP Tools Available

- `authenticate` - Verify GitHub token
- `get_memory` - Load session messages
- `save_memory` - Persist messages
- `search_memory` - Search across sessions
- `list_sessions` - List user sessions

## Testing

```bash
# Run tests
cd apps/memory-mcp
bun run test
```

## Next Steps

- [GitHub Bot Deployment](github-bot.md) - Deploy the main bot
- [Deployment Overview](README.md) - Other components
