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

## Next Steps

- [GitHub Bot Deployment](github-bot.md) - Deploy the main bot
- [Deployment Overview](README.md) - Other components
