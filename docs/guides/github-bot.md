---
title: GitHub Bot
description: Deploy GitHub bot as webhook handler on Cloudflare Workers. GitHub App setup, @mention handling, PR/issue integration.
---

# GitHub Bot

Deploy the GitHub Bot as a serverless webhook handler on Cloudflare Workers with Durable Objects for session persistence.

## Overview

- Webhook handler for @mentions and PR reviews
- AI agent powered by OpenRouter via Cloudflare Workers
- Session persistence via Durable Objects
- Built with Hono + Cloudflare Agents SDK

## Prerequisites

1. **Cloudflare account** with Workers enabled
2. **GitHub account** for creating GitHub App
3. **LLM API key** (OpenRouter or Anthropic)

---

## Step 1: Configure Environment

Create `.env.local` at project root:

```bash
# Required
GITHUB_TOKEN=ghp_your_personal_access_token
OPENROUTER_API_KEY=sk-or-v1-xxx
# or
ANTHROPIC_API_KEY=sk-ant-xxx

# Optional
MODEL=x-ai/grok-4.1-fast
GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

### Getting API Keys

**GitHub Token:**
1. Go to https://github.com/settings/tokens
2. Generate new token (classic) with scopes: `repo`, `issues:write`, `pull_requests:write`

**OpenRouter API Key:**
1. Go to https://openrouter.ai/keys
2. Create new key

---

## Step 2: Deploy

```bash
# Login to Cloudflare (first time only)
npx wrangler login

# Deploy and configure secrets
bun run deploy:github
```

Note the deployed URL:
```
https://duyetbot-github.<your-subdomain>.workers.dev
```

---

## Step 3: Register GitHub App

1. Go to https://github.com/settings/apps/new

2. Fill in basic info:
   - **GitHub App name**: `duyetbot`
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

6. Click **Create GitHub App**

---

## Step 4: Install GitHub App

1. Go to your GitHub App settings page
2. Click **Install App** in the left sidebar
3. Select your account
4. Choose repositories (all or select)
5. Click **Install**

---

## Step 5: Test

1. Go to an installed repository
2. Create a new issue or open an existing one
3. Comment: `@duyetbot hello`
4. The bot should respond within seconds

### Verify Webhook Delivery

1. Go to your GitHub App settings → **Advanced** → **Recent Deliveries**
2. Check that deliveries show green checkmarks

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

## Webhook Security

The webhook endpoint verifies GitHub's HMAC signature:

```http
POST /webhook
X-Hub-Signature-256: sha256=6931...
X-GitHub-Event: issue_comment
Content-Type: application/json
```

Response:
- `200 OK` - Accepted
- `401 Unauthorized` - Invalid signature

Signature verification code:
```typescript
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;
  return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}
```

---

## Monitoring

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
3. Verify LLM API key is set
4. Ensure bot is installed on the repository

### 401 Unauthorized

- Webhook secret mismatch
- Re-run `bun run deploy:github` to update secrets

---

## Architecture

```
@mention → GitHub Webhook → Hono App → GitHubAgent DO → RouterAgent → AI → Comment
                                              ↓
                                       SQLite State
```

---

## Related

- [Telegram Bot](/guides/telegram-bot)
- [Cloudflare Deployment](/guides/cloudflare-deploy)
