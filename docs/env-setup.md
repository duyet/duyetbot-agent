---
title: Environment Setup
desc: Configure secrets and env vars. Use `bun scripts/config.ts` for one-cmd setup. AI Gateway, Telegram, GitHub.
sidebar_position: 1.1
keywords: [env, secrets, config, ai-gateway, telegram-bot-token, github-token, wrangler]
slug: getting-started/env-setup
---

# Environment Setup

**TL;DR**: `bun install`. `bunx wrangler login`. `bun scripts/config.ts telegram` (prompts for tokens). Deploy!

Set up LLM, bots, memory. Use [config script]([`scripts/config.ts`](scripts/config.ts)) for secrets.

## 📋 Prerequisites

Run these first:

```bash
bun install
bunx wrangler login  # Cloudflare auth
```

**✅ Ready!** Now configure per app.

## 🔑 Required Secrets

| Secret | Apps | Purpose | Set Command |
|--------|------|---------|-------------|
| `AI_GATEWAY_API_KEY` | All | LLM (Grok/Claude) via Cloudflare AI | `bun scripts/config.ts telegram` |
| `TELEGRAM_BOT_TOKEN` | Telegram | Bot API access | `bun scripts/config.ts telegram` |
| `GITHUB_TOKEN` | GitHub | API/PAT for issues/PRs | `bun scripts/config.ts github` |
| `GITHUB_WEBHOOK_SECRET` | GitHub | Webhook signature | `bun scripts/config.ts github` |

**How?** Script prompts securely. Runs `wrangler secret put`.

## ⚙️ Vars (wrangler.toml)

Optional. Set via dashboard or CLI:

| Var | Default | Purpose |
|-----|---------|---------|
| `MODEL` | `x-ai/grok-4.1-fast:free` | LLM model |
| `TELEGRAM_ADMIN` | `duyet` | Debug footer |
| `BOT_USERNAME` | `duyetbot` | GitHub bot name |

## ✅ Setup Checklist

- [ ] `bunx wrangler login`
- [ ] Telegram: `bun scripts/config.ts telegram`
- [ ] GitHub: `bun scripts/config.ts github`
- [ ] Shared: `bun scripts/config.ts agents`
- [ ] Memory: `bun scripts/config.ts memory`
- [ ] Verify: `bun scripts/config.ts show`

**Quiz**: Sets `TELEGRAM_BOT_TOKEN`?  
A: `bun scripts/config.ts telegram` ✅

## 🚀 Next

[Deploy →](/getting-started/cloudflare-deploy)  
**Try**: `bun scripts/config.ts telegram` now! {{t('env.setup_done')}}