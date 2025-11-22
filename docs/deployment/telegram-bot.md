# Telegram Bot Deployment

**Back to:** [Deployment Overview](README.md)

Deploy the Telegram bot as a serverless webhook on Cloudflare Workers.

## Overview

The Telegram bot provides:
- Chat interface via Telegram
- AI agent with same capabilities as GitHub bot
- Session persistence via MCP memory server

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
status - Show bot status
clear - Clear session
chat - Send a message
```

Other settings:
```
/setdescription - Set bot description
/setabouttext - Set about info
/setuserpic - Set profile picture
```

## Step 2: Get Your Telegram User ID

To restrict bot access to specific users:

1. Send a message to [@userinfobot](https://t.me/userinfobot)
2. It will reply with your user ID (e.g., `123456789`)
3. Use this for `ALLOWED_USERS` (comma-separated for multiple users)

## Step 3: Set Cloudflare Secrets

```bash
cd apps/telegram-bot

# Login to Cloudflare
wrangler login

# Required secrets
wrangler secret put TELEGRAM_BOT_TOKEN
# Paste your bot token from BotFather

wrangler secret put ANTHROPIC_API_KEY
# Paste your Anthropic API key

wrangler secret put TELEGRAM_WEBHOOK_SECRET
# Create a random secret (e.g., openssl rand -hex 32)
```

Optional secrets:
```bash
# Restrict to specific users (comma-separated IDs)
wrangler secret put ALLOWED_USERS
# Example: 123456789,987654321

# Enable session persistence
wrangler secret put MCP_SERVER_URL
# Example: https://memory.duyetbot.workers.dev

wrangler secret put MCP_AUTH_TOKEN
# Your MCP auth token
```

## Step 4: Deploy to Cloudflare

```bash
cd apps/telegram-bot

# Install dependencies
bun install

# Deploy
bun run deploy
# or: wrangler deploy

# Note the URL:
# https://duyetbot-telegram.<your-subdomain>.workers.dev
```

## Step 5: Configure Telegram Webhook

Tell Telegram where to send messages:

```bash
# Replace with your values
BOT_TOKEN="your-bot-token"
WORKER_URL="https://duyetbot-telegram.your-subdomain.workers.dev"
WEBHOOK_SECRET="your-webhook-secret"

# Set webhook
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${WORKER_URL}\",
    \"secret_token\": \"${WEBHOOK_SECRET}\",
    \"allowed_updates\": [\"message\", \"edited_message\"]
  }"
```

Verify webhook:
```bash
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

Expected response:
```json
{
  "ok": true,
  "result": {
    "url": "https://duyetbot-telegram.your-subdomain.workers.dev",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

## Step 6: Test the Bot

1. Open Telegram and find your bot by username
2. Send `/start`
3. Send a message like "Hello, what can you do?"
4. The bot should respond with AI-generated content

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `TELEGRAM_WEBHOOK_SECRET` | Yes | Secret for webhook verification |
| `ALLOWED_USERS` | No | Comma-separated Telegram user IDs (empty = all allowed) |
| `MCP_SERVER_URL` | No | Memory MCP server URL for session persistence |
| `MCP_AUTH_TOKEN` | No | MCP authentication token |
| `MODEL` | No | Claude model (default: `sonnet`) |

## Monitoring & Logs

```bash
# Stream live logs
wrangler tail

# Filter for errors
wrangler tail --search "error"
```

## Webhook Management

```bash
# Get current webhook info
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# Delete webhook (disable bot)
curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"

# Get bot info
curl "https://api.telegram.org/bot<TOKEN>/getMe"
```

## Troubleshooting

### Webhook not receiving updates

1. Check webhook status:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```
2. Look at `last_error_message` in response
3. Verify URL is correct and accessible

### 401 Unauthorized errors

- `TELEGRAM_WEBHOOK_SECRET` must match `secret_token` in setWebhook call
- Re-run both `wrangler secret put` and the setWebhook curl

### Bot not responding

1. Check logs: `wrangler tail`
2. Verify `ANTHROPIC_API_KEY` is valid
3. Verify `TELEGRAM_BOT_TOKEN` is correct

### Session not persisting

- Without `MCP_SERVER_URL`, sessions reset per request
- Deploy the [Memory MCP Server](memory-mcp.md) for persistence

## Alternative: Docker Deployment

For long-running server deployment instead of serverless:

```bash
cd apps/telegram-bot
docker build -t duyetbot-telegram .
docker run -d \
  -e TELEGRAM_BOT_TOKEN=xxx \
  -e ANTHROPIC_API_KEY=xxx \
  -p 3002:3002 \
  duyetbot-telegram
```

Then set webhook to your server URL.

## Next Steps

- [Memory MCP Deployment](memory-mcp.md) - Enable session persistence
- [GitHub Bot Deployment](github-bot.md) - Deploy the GitHub bot
- [Deployment Overview](README.md) - All components
