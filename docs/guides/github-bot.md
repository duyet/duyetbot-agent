---
title: GitHub Bot
description: Deploy GitHub bot as webhook handler on Cloudflare Workers. GitHub App setup, PAT token, webhook secret, PR/issue integration.
---

# GitHub Bot Deployment

**Back to:** [Deployment Overview](README.md)

Deploy the GitHub Bot as a serverless webhook handler on Cloudflare Workers with Durable Objects for session persistence.

## Overview

The GitHub bot provides:
- Webhook handler for @mentions and PR reviews
- AI agent powered by OpenRouter/Anthropic via Cloudflare Workers
- Session persistence via Durable Objects
- Built with Hono + Cloudflare Agents SDK

**Recommended Approach**: For the most robust and scalable bot, register a GitHub App. You specify the webhook URL and subscribe to specific events during the registration process. This approach supports multiple installations and repositories.

## Prerequisites

1. **Cloudflare account** with Workers enabled
2. **GitHub account** for creating GitHub App
3. **LLM API key** (OpenRouter or Anthropic)

---

## Step 1: Configure Environment

All environment variables are configured in a single `.env.local` file at the project root.

```bash
# From project root
cp .env.example .env.local
```

Edit `.env.local` with your values:

```bash
# Required for GitHub Bot
GITHUB_TOKEN=ghp_your_personal_access_token

# LLM Provider (at least one required)
OPENROUTER_API_KEY=sk-or-v1-xxx
# or
ANTHROPIC_API_KEY=sk-ant-xxx

# Optional
MODEL=x-ai/grok-4.1-fast
GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

### Getting API Keys

**GitHub Token**:
1. Go to https://github.com/settings/tokens
2. Generate new token (classic) with scopes: `repo`, `issues:write`, `pull_requests:write`

**OpenRouter API Key**:
1. Go to https://openrouter.ai/keys
2. Create new key

**Anthropic API Key**:
1. Go to https://console.anthropic.com/settings/keys
2. Create new key

---

## Step 2: Deploy to Cloudflare Workers

```bash
# From project root

# Login to Cloudflare (first time only)
npx wrangler login

# Deploy and configure secrets
bun run deploy:github
```

This command will:
1. Build the GitHub bot package
2. Deploy to Cloudflare Workers
3. Set all secrets from `.env.local` via `wrangler secret put`

Note the deployed URL:
```
https://duyetbot-github.<your-subdomain>.workers.dev
```

---

## Step 3: Register GitHub App

Now that you have your webhook URL, register a GitHub App:

1. Go to https://github.com/settings/apps/new

2. Fill in basic info:
   - **GitHub App name**: `duyetbot` (or your preferred name)
   - **Homepage URL**: `https://github.com/your-username/duyetbot-agent`

3. Configure webhook:
   - **Webhook URL**: `https://duyetbot-github.<your-subdomain>.workers.dev/webhook`
   - **Webhook secret**: Same value as `GITHUB_WEBHOOK_SECRET` in `.env.local`
   - Check **Active**

4. Set permissions:
   - **Repository permissions**:
     - Issues: Read & Write
     - Pull requests: Read & Write
     - Contents: Read
   - **Organization permissions**: None required

5. Subscribe to events:
   - Issue comment
   - Issues
   - Pull request
   - Pull request review comment

6. Where can this GitHub App be installed?
   - Select **Only on this account** for personal use
   - Select **Any account** if you want others to install it

7. Click **Create GitHub App**

---

## Step 4: Install GitHub App

After creating the app:

1. Go to your GitHub App settings page
2. Click **Install App** in the left sidebar
3. Select your account
4. Choose repositories:
   - **All repositories** or
   - **Only select repositories** (recommended for testing)
5. Click **Install**

---

## Step 5: Test the Bot

1. Go to an installed repository
2. Create a new issue or open an existing one
3. Comment: `@duyetbot hello`
4. The bot should respond within seconds

### Verify Webhook Delivery

1. Go to your GitHub App settings → **Advanced** → **Recent Deliveries**
2. Check that deliveries show green checkmarks
3. If red X, click to see error details

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub personal access token |
| `OPENROUTER_API_KEY` | Yes* | OpenRouter API key |
| `ANTHROPIC_API_KEY` | Yes* | Anthropic API key |
| `MODEL` | No | Model name (default: `x-ai/grok-4.1-fast`) |
| `GITHUB_WEBHOOK_SECRET` | No | Secret for webhook verification |

*At least one LLM provider API key is required.

---

## Monitoring & Logs

```bash
# Stream live logs
npx wrangler tail --name duyetbot-github

# Filter for errors
npx wrangler tail --name duyetbot-github --search "error"
```

---

## Troubleshooting

### Webhook not received

1. Check GitHub App settings → Advanced → Recent Deliveries
2. Verify webhook URL matches your deployed Worker URL
3. Verify webhook secret matches `GITHUB_WEBHOOK_SECRET`
4. Ensure webhook is marked as **Active**

### Bot not responding

1. Check logs: `npx wrangler tail --name duyetbot-github`
2. Verify `GITHUB_TOKEN` has correct permissions
3. Verify LLM API key is set (`OPENROUTER_API_KEY` or `ANTHROPIC_API_KEY`)
4. Ensure bot is installed on the repository

### 401 Unauthorized

- Webhook secret mismatch - ensure `GITHUB_WEBHOOK_SECRET` matches the secret in GitHub App settings
- Re-run `bun run deploy:github` to update secrets

### LLM errors

1. Check your API key is valid and has credits
2. Verify `MODEL` is supported by your provider
3. Check Cloudflare Worker logs for detailed errors

---

## Security Best Practices

1. **Never commit secrets** - Use `.env.local` which is gitignored
2. **Use webhook secrets** - Prevents unauthorized webhook calls
3. **Rotate tokens periodically** - Update in `.env.local` and redeploy
4. **Limit app permissions** - Only request necessary scopes
5. **Monitor webhook deliveries** - Check for failed deliveries

---

## Alternative Deployments

For Docker-based deployments (Railway, Fly.io, Render, AWS), see the legacy documentation. Cloudflare Workers is recommended for:
- Lower latency (edge deployment)
- Built-in Durable Objects for state
- Generous free tier
- Simpler deployment

---

## Updating the Bot

To update after code changes:

```bash
# From project root
bun run deploy:github
```

This will rebuild and redeploy. Secrets are preserved.

---

## Next Steps

- [Telegram Bot Deployment](telegram-bot.md) - Deploy the Telegram bot
- [Memory MCP Deployment](memory-mcp.md) - Add session persistence
- [Deployment Overview](README.md) - All components
