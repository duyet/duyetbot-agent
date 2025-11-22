# Telegram Bot Deployment

**Back to:** [Deployment Overview](README.md)

Deploy the Telegram bot for chat interface.

## Overview

The Telegram bot provides:
- Chat interface via Telegram
- Notifications
- Same agent capabilities as GitHub bot

## Prerequisites

1. Telegram Bot Token from [@BotFather](https://t.me/botfather)
2. Server with public URL for webhook

## Environment Variables

```env
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_WEBHOOK_URL=https://your-domain/telegram/webhook

# LLM Provider
ANTHROPIC_API_KEY=xxx

# Optional MCP Memory
MCP_SERVER_URL=https://memory.duyetbot.workers.dev
MCP_AUTH_TOKEN=xxx
```

## Deploy

The Telegram bot can be deployed alongside the GitHub bot or separately.

### With Docker

```bash
cd apps/telegram-bot
docker build -t duyetbot-telegram .
docker run -d \
  -e TELEGRAM_BOT_TOKEN=xxx \
  -e ANTHROPIC_API_KEY=xxx \
  -p 3002:3002 \
  duyetbot-telegram
```

### Set Webhook

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain/telegram/webhook"}'
```

## Deploy to Cloudflare Workers

Deploy the Telegram bot as a serverless webhook handler on Cloudflare Workers.

### 1. Set Secrets

```bash
cd apps/telegram-bot

# Login to Cloudflare
wrangler login

# Set required secrets
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put TELEGRAM_WEBHOOK_SECRET

# Optional secrets
wrangler secret put MCP_AUTH_TOKEN
```

### 2. Deploy to Cloudflare

```bash
cd apps/telegram-bot

# Deploy
wrangler deploy

# Note the deployed URL, e.g.:
# https://duyetbot-telegram.<your-subdomain>.workers.dev
```

### 3. Configure Telegram Webhook

Set the webhook URL with Telegram API:

```bash
# Set webhook with secret token
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://duyetbot-telegram.<your-subdomain>.workers.dev",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message", "edited_message", "callback_query"]
  }'

# Verify webhook is set
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

### 4. Test the Bot

1. Open Telegram and find your bot
2. Send `/start` to begin
3. Send a message to test the agent

### Webhook Commands Reference

```bash
# Set webhook
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-worker.workers.dev" \
  -d "secret_token=your-secret"

# Get webhook info
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# Delete webhook (switch to polling)
curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"

# Get bot info
curl "https://api.telegram.org/bot<TOKEN>/getMe"
```

### Environment Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `TELEGRAM_WEBHOOK_SECRET` | Yes | Secret for webhook verification |
| `ALLOWED_USERS` | No | Comma-separated Telegram user IDs |
| `MCP_SERVER_URL` | No | Memory MCP server URL |
| `MCP_AUTH_TOKEN` | No | MCP authentication token |

### Monitoring

```bash
# View logs
wrangler tail

# Filter for errors
wrangler tail --filter "error"
```

### Troubleshooting

#### Webhook not receiving updates
1. Check webhook info: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`
2. Verify `last_error_message` field
3. Ensure secret token matches

#### 401 Unauthorized errors
- Verify `TELEGRAM_WEBHOOK_SECRET` matches the `secret_token` in setWebhook

#### Bot not responding
- Check Cloudflare Workers logs with `wrangler tail`
- Verify `TELEGRAM_BOT_TOKEN` and `ANTHROPIC_API_KEY` are set correctly

## Next Steps

- [GitHub Bot Deployment](github-bot.md) - Deploy the main bot
- [Deployment Overview](README.md) - Other components
