---
title: Cloudflare Deploy
desc: One-command deploys. `bun run deploy` for all. Wrangler + Docker alts. Zero-config scaling.
sidebar_position: 1.2
keywords: [deploy, wrangler, cloudflare, docker, bun-run-deploy, turbo]
slug: getting-started/cloudflare-deploy
---

# Cloudflare Deploy

**TL;DR**: `bun run deploy` deploys everything. Or `bun run deploy:telegram`. Scales globally. Free idle.

Deploy edge AI agents to Cloudflare Workers + DOs. Fire-and-forget.

## 🚀 One-Command Deploys

```bash
# All bots + agents + memory
bun run deploy

# Specific
bun run deploy:telegram     # Telegram bot
bun run deploy:github       # GitHub bot
bun run deploy:shared-agents # 8 DO agents
bun run deploy:memory-mcp   # D1 memory
```

**✅ Live in 60s!** Global edge network.

## 🐳 Docker Alt (Heavy Compute)

For agent-server (Tier 2 future):

```bash
docker-compose up -d agent-server
```

Ports: 3000 (HTTP), 8080 (WS). See [`docker-compose.yml`](docker-compose.yml).

## 📋 Prerequisites ✅

- [ ] Env setup: [← Env Setup](/getting-started/env-setup)
- [ ] `bun install`
- [ ] `bunx wrangler login`
- [ ] Config: `bun scripts/config.ts telegram`

## 🎯 Deploy Flow

1. **Build**: `bun run build` (turbo)
2. **Secrets**: `bun scripts/config.ts *`
3. **Deploy**: `bun run deploy:*`
4. **Verify**: Check Cloudflare dashboard

**Quiz**: Deploys all?  
A: `bun run deploy` ✅

## 🚀 Next

[Checklists →](/getting-started/checklists)  
**Deploy now**: `bun run deploy:telegram`! {{t('deploy.live')}}