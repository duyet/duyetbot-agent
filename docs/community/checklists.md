---
title: Checklists
desc: "Pre/post-deploy checklists. Verify setup, test bots, monitor. Never miss a step."
sidebar_position: 1.3
keywords: [checklist, verify, test, deploy-check, webhook-test, e2e]
slug: getting-started/checklists
---

# Checklists

**TL;DR**: Tick pre-deploy → deploy → post-deploy. Test CLI/Telegram/GitHub. All green? ✅ Live!

Verify every step. From README/PLAN.

## 📋 Pre-Deploy

- [ ] Clone: `git clone https://github.com/duyet/duyetbot-agent`
- [ ] `bun install`
- [ ] `bunx wrangler login`
- [ ] Env: [Env Setup →](/getting-started/env-setup)
- [ ] Tests: `bun run test` (1200+ pass) ✅
- [ ] Lint: `bun run check`

**Run**: `bun run check` → All pass.

## 🚀 Deploy

| App | Command | Verify |
|-----|---------|--------|
| All | `bun run deploy` | Dashboard: Workers live |
| Telegram | `bun run deploy:telegram` | `telegram.duyetbot.workers.dev` responds |
| GitHub | `bun run deploy:github` | Webhook ready |
| Agents | `bun run deploy:shared-agents` | DO bindings active |
| Memory | `bun run deploy:memory-mcp` | D1 tables created |

## 🔍 Post-Deploy Tests

### CLI
```bash
bun run cli chat
> Hello!
```
**Expect**: Agent responds.

### Telegram
1. [@BotFather](https://t.me/botfather) → Set webhook: `https://telegram.duyetbot.workers.dev/webhook`
2. Message bot: "hi"
**Expect**: "Thinking 🧠" → Response.

### GitHub
1. Repo → Comment: `@duyetbot hello`
**Expect**: Bot replies in thread.

**Quiz**: Tests pass?  
A: `bun run test` ✅

## 🛡️ Monitor

- Logs: Cloudflare dashboard
- Stuck batches: `ROUTER_DEBUG=true`
- Tokens: LLM provider dashboard

## 🚀 Next

[Cloudflare First →](/getting-started/cloudflare-first)  
**Test now**: `bun run test`! {{t('checklists.all_green')}}