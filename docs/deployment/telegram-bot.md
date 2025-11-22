# Telegram Bot Deployment

**Back to:** [Deployment Overview](README.md)

Deploy the Telegram bot as a serverless webhook on Cloudflare Workers with Durable Objects for session persistence.

## Overview

The Telegram bot provides:
- Chat interface via Telegram
- AI agent powered by OpenRouter via Cloudflare AI Gateway
- Session persistence via Durable Objects (no external database needed)
- Built with Hono + Cloudflare Agents SDK

## Prerequisites

1. **Cloudflare account** with Workers enabled
2. **Telegram account** for creating bot
3. **Cloudflare AI Gateway** configured with OpenRouter

---

## Step 1: Create Bot with BotFather

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
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
   - Enable caching (optional, reduces costs)
   - Enable logging (recommended for debugging)

---

## Step 3: Get Your Telegram User ID (Optional)

To restrict bot access to specific users:

1. Send a message to [@userinfobot](https://t.me/userinfobot)
2. It will reply with your user ID (e.g., `123456789`)
3. Use this for `TELEGRAM_ALLOWED_USERS` (comma-separated for multiple users)

---

## Step 4: Configure Environment

All environment variables are configured in a single `.env.local` file at the project root.

```bash
# From project root
cp .env.example .env.local
```

Edit `.env.local` with your values:

```bash
# Required for Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather

# AI Gateway
AI_GATEWAY_NAME=duyetbot
AI_GATEWAY_API_KEY=your_ai_gateway_api_key

# Optional
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
TELEGRAM_ALLOWED_USERS=123456789,987654321
MODEL=x-ai/grok-4.1-fast
GITHUB_TOKEN=ghp_xxx
```

### Environment Variable Groups

The `.env.local` file is organized by prefix:
- `AI_GATEWAY_*` - Cloudflare AI Gateway settings
- `GITHUB_*` - GitHub integration
- `TELEGRAM_*` - Telegram bot settings

---

## Step 5: Deploy to Cloudflare Workers

```bash
# From project root

# Login to Cloudflare (first time only)
npx wrangler login

# Deploy and configure secrets + webhook
bun run deploy:telegram
```

This command will:
1. Build the Telegram bot package
2. Deploy to Cloudflare Workers
3. Set all secrets from `.env.local` via `wrangler secret put`
4. Configure Telegram webhook automatically

Note the deployed URL:
```
https://duyetbot-telegram.<your-subdomain>.workers.dev
```

---

## Step 6: Test the Bot

1. Open Telegram and find your bot by username
2. Send `/start`
3. Send a message like "Hello, what can you do?"
4. The bot should respond with AI-generated content

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `AI_GATEWAY_NAME` | Yes | Cloudflare AI Gateway name |
| `AI_GATEWAY_API_KEY` | No | API key for authenticated gateway access |
| `TELEGRAM_WEBHOOK_SECRET` | No | Secret for webhook verification |
| `TELEGRAM_ALLOWED_USERS` | No | Comma-separated Telegram user IDs (empty = all allowed) |
| `MODEL` | No | Model name (default: `x-ai/grok-4.1-fast`) |
| `GITHUB_TOKEN` | No | GitHub personal access token for github-mcp |

---

## Monitoring & Logs

```bash
# Stream live logs
npx wrangler tail --name duyetbot-telegram

# Filter for errors
npx wrangler tail --name duyetbot-telegram --search "error"
```

---

## Troubleshooting

### Webhook not receiving updates

1. Check webhook status:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```
2. Look at `last_error_message` in response
3. Verify URL is correct and accessible
4. Re-run `bun run deploy:telegram` to reconfigure webhook

### 401 Unauthorized errors

- `TELEGRAM_WEBHOOK_SECRET` must match the secret configured in webhook
- Re-run `bun run deploy:telegram` to update secrets and webhook

### Bot not responding

1. Check logs: `npx wrangler tail --name duyetbot-telegram`
2. Verify `AI_GATEWAY_NAME` matches your gateway name in Cloudflare
3. Verify `TELEGRAM_BOT_TOKEN` is correct
4. Check if user is in `TELEGRAM_ALLOWED_USERS` (if configured)

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

---

## Local Development

For local development with `wrangler dev`:

```bash
cd apps/telegram-bot

# Copy example file
cp .dev.vars.example .dev.vars

# Edit with your values
```

Values in `.dev.vars`:
```bash
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
AI_GATEWAY_NAME=your-gateway-name

# Optional
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
TELEGRAM_ALLOWED_USERS=123456789,987654321
```

Then run:
```bash
bun run dev
```

> **Note:** Local development requires a tunnel (like ngrok) to receive webhooks.

---

## Architecture

```
Telegram → Webhook → Hono App → Durable Object Agent → AI Gateway → OpenRouter
                                      ↓
                               SQLite State (messages, user context)
```

- **Hono**: Lightweight web framework for routing
- **Cloudflare Agents SDK**: Stateful agents with Durable Objects
- **AI Gateway**: Cloudflare's proxy for LLM providers with caching/logging

---

## Updating the Bot

To update after code changes:

```bash
# From project root
bun run deploy:telegram
```

This will rebuild, redeploy, and reconfigure the webhook. Secrets are preserved.

---

## Next Steps

- [GitHub Bot Deployment](github-bot.md) - Deploy the GitHub bot
- [Memory MCP Deployment](memory-mcp.md) - Deploy the memory server
- [Deployment Overview](README.md) - All components
