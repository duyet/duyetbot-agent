# Telegram Bot Deployment

**Back to:** [Deployment Overview](README.md)

Deploy the Telegram bot as a serverless webhook on Cloudflare Workers with Durable Objects for session persistence.

## Overview

The Telegram bot provides:
- Chat interface via Telegram
- AI agent powered by OpenRouter via Cloudflare AI Gateway
- Session persistence via Durable Objects (no external database needed)
- Built with Hono + Cloudflare Agents SDK

## Step 1: Create Bot with BotFather

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` command
3. Enter a display name (e.g., "Duyetbot Agent")
4. Enter a username ending in `bot` (e.g., `duyetbot_agent_bot`)
5. **Save the HTTP API token** → this is your `TELEGRAM_BOT_TOKEN`

### Configure Bot Commands (Optional)

Send to @BotFather:
```
/setcommands
```

Then paste:
```
start - Start the bot
help - Show help
clear - Clear conversation history
```

## Step 2: Create Cloudflare AI Gateway

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → AI → AI Gateway
2. Click "Create Gateway"
3. Name it (e.g., `duyetbot-gateway`) → **Save this name** as `AI_GATEWAY_NAME`
4. Configure the gateway settings:
   - Enable caching (optional, reduces costs)
   - Enable logging (recommended for debugging)
   - Set rate limiting if needed

The bot uses Cloudflare's native AI binding to connect to the gateway, so you only need the gateway name, not the full URL.

## Step 3: Get Your Telegram User ID

To restrict bot access to specific users:

1. Send a message to [@userinfobot](https://t.me/userinfobot)
2. It will reply with your user ID (e.g., `123456789`)
3. Use this for `ALLOWED_USERS` (comma-separated for multiple users)

## Step 4: Configure Environment

```bash
cd apps/telegram-bot

# Copy example env file
cp .env.example .env.local

# Edit with your values
```

Required values in `.env.local`:
```bash
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_WEBHOOK_URL=https://duyetbot-telegram.your-subdomain.workers.dev/webhook
AI_GATEWAY_NAME=your-gateway-name
```

Optional values:
```bash
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
MODEL=x-ai/grok-4.1-fast
ALLOWED_USERS=123456789,987654321
```

> **Note:** Configure your OpenRouter API key directly in the AI Gateway settings in Cloudflare Dashboard.

## Step 5: Set Cloudflare Secrets

### Option A: Using wrangler secret (recommended for production)

```bash
cd apps/telegram-bot

# Login to Cloudflare
wrangler login

# Set required secrets
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put AI_GATEWAY_NAME

# Optional secrets
wrangler secret put TELEGRAM_WEBHOOK_SECRET
wrangler secret put ALLOWED_USERS
```

### Option B: Using .dev.vars (for local development)

```bash
cd apps/telegram-bot

# Copy example file
cp .dev.vars.example .dev.vars

# Edit with your values - these are loaded automatically by wrangler dev
```

> **Note:** `MODEL` is already configured in `wrangler.toml` with a default value. Override with `wrangler secret put MODEL` if needed.

## Step 6: Deploy to Cloudflare

```bash
cd apps/telegram-bot

# Deploy
bun run deploy

# Note the URL:
# https://duyetbot-telegram.<your-subdomain>.workers.dev
```

## Step 7: Configure Telegram Webhook

Use the built-in webhook commands:

```bash
cd apps/telegram-bot

# Check current configuration
bun run webhook:config

# Set webhook
bun run webhook:set

# Verify webhook is configured
bun run webhook:info
```

Or manually with curl:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://duyetbot-telegram.your-subdomain.workers.dev/webhook",
    "secret_token": "your-webhook-secret"
  }'
```

## Step 8: Test the Bot

1. Open Telegram and find your bot by username
2. Send `/start`
3. Send a message like "Hello, what can you do?"
4. The bot should respond with AI-generated content

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `AI_GATEWAY_NAME` | Yes | Cloudflare AI Gateway name (e.g., `duyetbot-gateway`) |
| `TELEGRAM_WEBHOOK_SECRET` | No | Secret for webhook verification |
| `ALLOWED_USERS` | No | Comma-separated Telegram user IDs (empty = all allowed) |
| `MODEL` | No | Model name (default: `x-ai/grok-4.1-fast`) |

## Webhook Commands

```bash
# Show current config from .env.local
bun run webhook:config

# Set webhook URL
bun run webhook:set

# Get webhook info from Telegram
bun run webhook:info

# Delete webhook
bun run webhook:delete
```

## Monitoring & Logs

```bash
# Stream live logs
wrangler tail

# Filter for errors
wrangler tail --search "error"
```

## Troubleshooting

### Webhook not receiving updates

1. Check webhook status:
   ```bash
   bun run webhook:info
   ```
2. Look at `last_error_message` in response
3. Verify URL is correct and accessible

### 401 Unauthorized errors

- `TELEGRAM_WEBHOOK_SECRET` must match `secret_token` in setWebhook call
- Re-run `wrangler secret put TELEGRAM_WEBHOOK_SECRET` and `bun run webhook:set`

### Bot not responding

1. Check logs: `wrangler tail`
2. Verify `AI_GATEWAY_NAME` matches your gateway name in Cloudflare
3. Verify `TELEGRAM_BOT_TOKEN` is correct

### AI Gateway errors

1. Check your AI Gateway is created in Cloudflare Dashboard
2. Verify `AI_GATEWAY_NAME` matches exactly (case-sensitive)
3. Check OpenRouter API key is configured in AI Gateway settings
4. Check the AI Gateway logs in Cloudflare Dashboard for details

### 401 No auth credentials found

This error from AI Gateway means your OpenRouter API key is not configured:
1. Go to Cloudflare Dashboard → AI → AI Gateway
2. Select your gateway and configure authentication
3. Add your OpenRouter API key in the provider settings

### DataCloneError

If you see `Could not serialize object of type "DurableObjectNamespace"`:
- This is fixed in the latest version
- Redeploy with `bun run deploy`

## Architecture

```
Telegram → Webhook → Hono App → Durable Object Agent → AI Gateway → OpenRouter
                                      ↓
                               SQLite State (messages, user context)
```

- **Hono**: Lightweight web framework for routing
- **Cloudflare Agents SDK**: Stateful agents with Durable Objects
- **AI Gateway**: Cloudflare's proxy for LLM providers with caching/logging

## Next Steps

- [Memory MCP Deployment](memory-mcp.md) - Deploy the memory server
- [GitHub Bot Deployment](github-bot.md) - Deploy the GitHub bot
- [Deployment Overview](README.md) - All components
