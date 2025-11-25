# Deployment Runbook

**Last Updated**: 2025-11-25
**Audience**: DevOps, Platform Engineers, and Maintainers

This runbook provides step-by-step deployment instructions for the duyetbot-agent system, including both Cloudflare Workers (Telegram/GitHub bots) and the agent server.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Prerequisites](#prerequisites)
3. [Environment Configuration](#environment-configuration)
4. [Deployment Procedures](#deployment-procedures)
5. [Rollback Procedures](#rollback-procedures)
6. [Monitoring & Observability](#monitoring--observability)
7. [Troubleshooting](#troubleshooting)
8. [Post-Deployment Validation](#post-deployment-validation)

---

## System Overview

### Architecture Components

The duyetbot-agent system consists of three main deployment units:

1. **Telegram Bot** (`apps/telegram-bot`) - Cloudflare Workers + Durable Objects
2. **GitHub Bot** (`apps/github-bot`) - Cloudflare Workers + Durable Objects
3. **Memory MCP Server** (`apps/memory-mcp`) - Cloudflare Workers + D1 + KV

### Deployment Model

```
┌─────────────────────────────────────────────────────┐
│           Cloudflare Global Network                  │
├─────────────────┬───────────────────┬───────────────┤
│  Telegram Bot   │   GitHub Bot      │  Memory MCP   │
│  (Worker + DO)  │  (Worker + DO)    │  (Worker)     │
└────────┬────────┴─────────┬─────────┴───────┬───────┘
         │                  │                  │
         └──────────────────┴──────────────────┘
                            │
                    ┌───────▼────────┐
                    │   AI Gateway   │
                    │   (Providers)  │
                    └────────────────┘
```

---

## Prerequisites

### Required Tools

- **Bun**: v1.0.0+ (runtime and package manager)
- **Wrangler CLI**: v3.0.0+ (Cloudflare deployment tool)
- **Git**: For version control
- **jq**: For JSON processing (optional, for scripts)

### Required Accounts & Access

- **Cloudflare Account** with Workers Paid plan (for Durable Objects)
- **Cloudflare API Token** with permissions:
  - Workers Scripts: Edit
  - Workers KV Storage: Edit
  - D1: Edit
  - Durable Objects: Edit
- **GitHub App** registration (for github-bot)
- **Telegram Bot Token** (for telegram-bot)
- **AI Provider API Keys**:
  - Anthropic API key (for Claude)
  - OpenRouter API key (for multi-model support)
  - X.AI API key (for Grok models)

### Environment Setup

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Authenticate with Cloudflare
bunx wrangler login

# Verify authentication
bunx wrangler whoami
```

---

## Environment Configuration

### Cloudflare Secrets

Set secrets via Wrangler CLI (never commit secrets to git):

```bash
# Telegram Bot secrets
cd apps/telegram-bot
bunx wrangler secret put TELEGRAM_BOT_TOKEN
bunx wrangler secret put ANTHROPIC_API_KEY
bunx wrangler secret put OPENROUTER_API_KEY

# GitHub Bot secrets
cd apps/github-bot
bunx wrangler secret put GITHUB_APP_ID
bunx wrangler secret put GITHUB_APP_PRIVATE_KEY
bunx wrangler secret put GITHUB_WEBHOOK_SECRET
bunx wrangler secret put ANTHROPIC_API_KEY
bunx wrangler secret put OPENROUTER_API_KEY

# Memory MCP secrets (if needed)
cd apps/memory-mcp
bunx wrangler secret put GITHUB_CLIENT_ID
bunx wrangler secret put GITHUB_CLIENT_SECRET
```

### Environment Variables (wrangler.toml)

Public configuration variables are set in `wrangler.toml`:

#### Telegram Bot (`apps/telegram-bot/wrangler.toml`)

```toml
[vars]
ENVIRONMENT = "production"
MODEL = "x-ai/grok-4.1-fast"
AI_GATEWAY_NAME = "duyetbot"
AI_GATEWAY_PROVIDER = "openrouter"
TELEGRAM_ADMIN = "duyet"
TELEGRAM_ALLOWED_USERS = ""  # Empty = allow all
```

#### GitHub Bot (`apps/github-bot/wrangler.toml`)

```toml
[vars]
ENVIRONMENT = "production"
MODEL = "x-ai/grok-4.1-fast"
AI_GATEWAY_NAME = "duyetbot"
AI_GATEWAY_PROVIDER = "openrouter"
BOT_USERNAME = "duyetbot"
```

### Routing Configuration (Optional)

Enable/disable routing features via environment variables:

```bash
# Disable routing (emergency fallback)
bunx wrangler secret put ROUTER_ENABLED --text "false"

# Enable debug logging
bunx wrangler secret put ROUTER_DEBUG --text "true"
```

**Default Behavior**: Routing is **enabled** by default. Only set these if you need to override.

---

## Deployment Procedures

### Pre-Deployment Checklist

Before deploying, ensure:

- [ ] All tests pass: `bun run test`
- [ ] Type checking passes: `bun run type-check`
- [ ] Linting passes: `bun run lint`
- [ ] Git branch is up to date with main
- [ ] Environment secrets are configured
- [ ] Deployment target is verified (staging vs production)

### Full System Deployment

Deploy all components in the correct order:

```bash
# 1. Deploy Memory MCP Server first (dependency)
cd apps/memory-mcp
bun run deploy

# 2. Deploy Telegram Bot
cd ../telegram-bot
bun run deploy

# 3. Deploy GitHub Bot
cd ../github-bot
bun run deploy
```

### Individual Component Deployment

#### Telegram Bot

```bash
cd apps/telegram-bot

# Build and deploy
bun run deploy

# Deploy with specific environment
bunx wrangler deploy --env production

# Tail logs during deployment
bunx wrangler tail
```

#### GitHub Bot

```bash
cd apps/github-bot

# Build and deploy
bun run deploy

# Deploy with specific environment
bunx wrangler deploy --env production

# Tail logs during deployment
bunx wrangler tail
```

#### Memory MCP Server

```bash
cd apps/memory-mcp

# Deploy
bun run deploy

# Create D1 database (first time only)
bunx wrangler d1 create duyetbot-memory

# Run migrations
bunx wrangler d1 migrations apply duyetbot-memory
```

### Durable Objects Migrations

When deploying changes to Durable Objects:

```toml
# wrangler.toml - Add new migration tag
[[migrations]]
tag = "v3"  # Increment version
new_sqlite_classes = ["NewAgentClass"]
# deleted_classes = ["OldAgentClass"]  # If removing
```

**Important**: Never delete DO classes that have production data without backing up.

### Deployment Verification

After deployment, verify each component:

```bash
# 1. Check deployment status
bunx wrangler deployments list

# 2. Test Telegram bot
# Send a message to your bot on Telegram

# 3. Test GitHub bot
# Create a test issue and mention @duyetbot

# 4. Check logs
bunx wrangler tail --format pretty
```

---

## Rollback Procedures

### Quick Rollback (Last Deployment)

```bash
# List recent deployments
bunx wrangler deployments list

# Rollback to previous version
bunx wrangler rollback [DEPLOYMENT_ID]
```

### Rollback with Git

```bash
# 1. Identify the last working commit
git log --oneline

# 2. Checkout that commit
git checkout [COMMIT_HASH]

# 3. Redeploy
cd apps/telegram-bot && bun run deploy
cd apps/github-bot && bun run deploy

# 4. Return to main branch (after verification)
git checkout main
```

### Emergency Routing Disable

If routing system is causing issues:

```bash
# Disable routing immediately
cd apps/telegram-bot
bunx wrangler secret put ROUTER_ENABLED --text "false"

cd apps/github-bot
bunx wrangler secret put ROUTER_ENABLED --text "false"

# Verify change by tailing logs
bunx wrangler tail
```

### Durable Objects Rollback

**Warning**: DO state cannot be rolled back. If DO schema changes cause issues:

1. Deploy a fix forward (preferred)
2. Or delete and recreate DO instances (loses state)

```bash
# Delete specific DO instance (loses all state!)
bunx wrangler durable-objects:delete [NAMESPACE] [ID]

# List DO instances
bunx wrangler durable-objects:list [NAMESPACE]
```

---

## Monitoring & Observability

### Cloudflare Dashboard

Access monitoring at: `https://dash.cloudflare.com/`

Navigate to:
- **Workers & Pages** → Select worker → **Logs & Analytics**
- **Durable Objects** → Select namespace → **Instances**

### Real-Time Log Tailing

```bash
# Tail logs for a specific worker
cd apps/telegram-bot
bunx wrangler tail --format pretty

# Filter logs by log level
bunx wrangler tail --filter error

# Tail logs for Durable Objects
bunx wrangler tail --do TelegramAgent
```

### Observability Configuration

All workers have observability enabled in `wrangler.toml`:

```toml
[observability]
enabled = true

[observability.logs]
enabled = true
invocation_logs = true
head_sampling_rate = 1  # 100% of requests

[observability.traces]
enabled = true
head_sampling_rate = 1  # 100% of requests
```

### Key Metrics to Monitor

1. **Request Volume**: Requests per second/minute
2. **Error Rate**: HTTP 5xx and 4xx responses
3. **Latency**: P50, P95, P99 response times
4. **DO Instance Count**: Monitor growth and churn
5. **Memory Usage**: Per worker and per DO instance
6. **CPU Time**: Execution duration per request

### Alerts (Recommended Setup)

Configure alerts in Cloudflare dashboard for:

- Error rate > 5% for 5 minutes
- P95 latency > 2000ms
- Worker failures > 10/minute
- DO instance count > expected threshold

---

## Troubleshooting

### Common Issues

#### 1. Deployment Fails with "Exceeded CPU Limit"

**Symptom**: Wrangler deployment fails with CPU exceeded error

**Solution**:
```bash
# Check bundle size
bunx wrangler deploy --dry-run --outdir=dist

# Reduce bundle size by:
# - Splitting large dependencies
# - Using dynamic imports
# - Enabling tree-shaking
```

#### 2. Durable Object Not Responding

**Symptom**: Requests to DO timeout or fail

**Solution**:
```bash
# 1. Check DO instances
bunx wrangler durable-objects:list TelegramAgent

# 2. Tail DO logs
bunx wrangler tail --do TelegramAgent

# 3. Delete stuck instance (loses state!)
bunx wrangler durable-objects:delete TelegramAgent [INSTANCE_ID]
```

#### 3. Secrets Not Loading

**Symptom**: API calls fail with authentication errors

**Solution**:
```bash
# 1. List secrets (values not shown)
bunx wrangler secret list

# 2. Re-set the secret
bunx wrangler secret put ANTHROPIC_API_KEY

# 3. Verify by checking logs
bunx wrangler tail
```

#### 4. Migration Errors

**Symptom**: DO migration fails or data is lost

**Solution**:
```bash
# Check migration status
bunx wrangler deployments list

# If migration is stuck, may need to:
# 1. Increment migration tag
# 2. Deploy again
# 3. Contact Cloudflare support if persists
```

#### 5. High Latency / Slow Responses

**Symptom**: Response times > 2 seconds

**Diagnosis**:
```bash
# Enable debug logging
bunx wrangler secret put ROUTER_DEBUG --text "true"

# Tail logs to see routing decisions
bunx wrangler tail --format pretty

# Check AI Gateway metrics
# Visit: https://dash.cloudflare.com/ → AI → Gateway
```

**Solutions**:
- Enable smart placement: `mode = "smart"` in wrangler.toml
- Optimize routing logic
- Cache frequent queries
- Use faster AI models (e.g., haiku instead of opus)

### Debug Mode

Enable comprehensive debug logging:

```bash
# Set debug flags
bunx wrangler secret put ROUTER_DEBUG --text "true"
bunx wrangler secret put LOG_LEVEL --text "debug"

# Tail logs with timestamp
bunx wrangler tail --format pretty | tee debug-$(date +%Y%m%d-%H%M%S).log
```

### Log Analysis

Search logs for specific patterns:

```bash
# Find errors
bunx wrangler tail | grep -i error

# Find routing decisions
bunx wrangler tail | grep -i "routing to"

# Find slow requests (> 1000ms)
bunx wrangler tail | grep -E "duration: [0-9]{4,}"
```

---

## Post-Deployment Validation

### Smoke Tests

#### Telegram Bot

```bash
# 1. Send test message to bot
# Message: "Hello, are you working?"

# 2. Verify response within 5 seconds

# 3. Check logs for errors
bunx wrangler tail --filter error
```

#### GitHub Bot

```bash
# 1. Create test issue in a repository
# Title: "Test: Deployment validation"
# Body: "@duyetbot please acknowledge this test"

# 2. Verify bot responds within 30 seconds

# 3. Close test issue
```

#### Memory MCP Server

```bash
# Test via CLI (requires authentication)
bunx duyetbot memory stats

# Or via API
curl -X POST https://memory.duyetbot.workers.dev/rpc \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list"}'
```

### Health Check Endpoints

Currently, workers don't expose health endpoints. Monitor via:

```bash
# Check worker is responding
curl https://telegram-bot.duyetbot.workers.dev/

# Expected: 404 or valid response (not timeout)
```

### Performance Validation

```bash
# 1. Check P95 latency in dashboard
# Target: < 1000ms

# 2. Check error rate
# Target: < 1%

# 3. Verify routing is working
# Look for "routing to:" in logs
bunx wrangler tail | grep "routing to"
```

### Rollout Completion Checklist

- [ ] All deployments successful (no errors)
- [ ] Smoke tests pass for all components
- [ ] Error rate < 1% after 15 minutes
- [ ] P95 latency < 1000ms
- [ ] No critical logs in past 15 minutes
- [ ] Routing decisions appear in logs (if enabled)
- [ ] DO migrations applied successfully
- [ ] User-facing functionality verified

---

## Additional Resources

### Documentation

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Durable Objects Guide](https://developers.cloudflare.com/durable-objects/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Project CLAUDE.md](../CLAUDE.md) - Development guidelines
- [Project PLAN.md](../PLAN.md) - Implementation roadmap

### Useful Commands

```bash
# List all workers
bunx wrangler deployments list

# View worker logs
bunx wrangler tail

# Deploy specific worker
bunx wrangler deploy --env production

# Manage secrets
bunx wrangler secret list
bunx wrangler secret put [NAME]
bunx wrangler secret delete [NAME]

# D1 database operations
bunx wrangler d1 list
bunx wrangler d1 execute [DB] --command "SELECT * FROM sessions"

# KV operations
bunx wrangler kv:namespace list
bunx wrangler kv:key list --namespace-id=[ID]
```

### Support Contacts

- **Cloudflare Support**: https://support.cloudflare.com/
- **Project Issues**: https://github.com/duyet/duyetbot-agent/issues
- **Emergency Contacts**: [Add your team contacts]

---

## Maintenance Windows

### Recommended Deployment Times

- **Preferred**: Off-peak hours (UTC 00:00-04:00)
- **Avoid**: Business hours in user time zones
- **Frequency**: As needed, no scheduled maintenance required

### Zero-Downtime Deployments

Cloudflare Workers support zero-downtime deployments:

1. New version deployed alongside old version
2. Traffic gradually shifted to new version
3. Old version drained and removed
4. Rollback available if issues detected

**Note**: Durable Objects may experience brief initialization delay on first request after deployment.

---

**Document Version**: 1.0
**Last Reviewed**: 2025-11-25
**Next Review**: 2026-01-25
