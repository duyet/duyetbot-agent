---
title: Telegram Bot
description: Deploy Telegram bot on Cloudflare Workers. BotFather setup, webhook configuration, troubleshooting.
---

# Telegram Bot

Deploy the Telegram bot as a serverless webhook on Cloudflare Workers with Durable Objects for session persistence.

## Overview

- Chat interface via Telegram
- AI agent powered by OpenRouter via Cloudflare AI Gateway
- Session persistence via Durable Objects
- Built with Hono + Cloudflare Agents SDK

## Prerequisites

1. **Cloudflare account** with Workers enabled
2. **Telegram account** for creating bot
3. **Cloudflare AI Gateway** configured with OpenRouter

---

## Step 1: Create Bot with BotFather

1. Open Telegram and message [@BotFather](https://t.me/botfather)
2. Send `/newbot` command
3. Enter a display name (e.g., "Duyetbot Agent")
4. Enter a username ending in `bot` (e.g., `duyetbot_agent_bot`)
5. **Save the HTTP API token** - this is your `TELEGRAM_BOT_TOKEN`

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

---

## Step 2: Create Cloudflare AI Gateway

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → AI → AI Gateway
2. Click "Create Gateway"
3. Name it (e.g., `duyetbot`) - **Save this name** as `AI_GATEWAY_NAME`
4. Configure the gateway:
   - Add OpenRouter as a provider
   - Set your OpenRouter API key in the gateway settings

---

## Step 3: Configure Environment

Create `.env.local` at project root:

```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
AI_GATEWAY_NAME=duyetbot
AI_GATEWAY_API_KEY=your_ai_gateway_api_key

# Optional
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
TELEGRAM_ALLOWED_USERS=123456789  # Comma-separated user IDs (empty = all allowed)
```

---

## Step 4: Deploy

```bash
# Login to Cloudflare (first time only)
npx wrangler login

# Deploy and configure secrets
bun run deploy:telegram
```

Note the deployed URL:
```
https://duyetbot-telegram.<your-subdomain>.workers.dev
```

---

## Step 5: Set Webhook

The deploy script sets the webhook automatically. To verify or set manually:

```bash
# Check webhook status
curl "https://api.telegram.org/bot$TOKEN/getWebhookInfo"

# Set webhook manually
curl -X POST "https://api.telegram.org/bot$TOKEN/setWebhook?url=https://YOUR_WORKER.workers.dev/webhook"
```

Or via BotFather: `/setwebhook` → paste your URL.

---

## Step 6: Test

1. Open Telegram and find your bot by username
2. Send `/start`
3. Send "Hello, what can you do?"
4. Bot should respond with AI-generated content

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `AI_GATEWAY_NAME` | Yes | Cloudflare AI Gateway name |
| `AI_GATEWAY_API_KEY` | No | API key for authenticated gateway access |
| `TELEGRAM_WEBHOOK_SECRET` | No | Secret for webhook verification |
| `TELEGRAM_ALLOWED_USERS` | No | Comma-separated Telegram user IDs |
| `MODEL` | No | Model name (default: `x-ai/grok-4.1-fast`) |

---

## Webhook Security

The webhook endpoint verifies requests using the Telegram secret token:

```http
POST /webhook
X-Telegram-Bot-Api-Secret-Token: your_webhook_secret
Content-Type: application/json
```

Response:
- `200 OK` - Accepted
- `401 Unauthorized` - Invalid token

---

## Monitoring

```bash
# Stream live logs
npx wrangler tail --name duyetbot-telegram

# Filter for errors
npx wrangler tail --name duyetbot-telegram --search "error"
```

---

## Troubleshooting

### Webhook not receiving updates

1. Check webhook status: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`
2. Look at `last_error_message` in response
3. Verify URL is correct and accessible
4. Re-run `bun run deploy:telegram` to reconfigure webhook

### Bot not responding

1. Check logs: `npx wrangler tail --name duyetbot-telegram`
2. Verify `AI_GATEWAY_NAME` matches your gateway name in Cloudflare
3. Verify `TELEGRAM_BOT_TOKEN` is correct
4. Check if user is in `TELEGRAM_ALLOWED_USERS` (if configured)

### 401 Unauthorized

- `TELEGRAM_WEBHOOK_SECRET` must match the secret configured in webhook
- Re-run `bun run deploy:telegram` to update secrets

### AI Gateway errors

1. Check your AI Gateway is created in Cloudflare Dashboard
2. Verify `AI_GATEWAY_NAME` matches exactly (case-sensitive)
3. Check OpenRouter API key is configured in AI Gateway settings

---

## Architecture

```
Telegram → Webhook → Hono App → TelegramAgent DO → RouterAgent → AI Gateway → Response
                                       ↓
                                SQLite State (messages, user context)
```

---

## Local Development

```bash
cd apps/telegram-bot

# Copy example file
cp .dev.vars.example .dev.vars

# Start dev server
bun run dev
```

> **Note:** Local development requires a tunnel (like ngrok) to receive webhooks.

---

## Related

- [GitHub Bot](/guides/github-bot)
- [Cloudflare Deployment](/guides/cloudflare-deploy)
