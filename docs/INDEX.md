---
title: Home
description: Autonomous edge AI agents across CLI, Telegram, GitHub. Deploy in 30s. Persistent memory. Multi-LLM.
---

# duyetbot-agent

**TL;DR**: Clone. `bun install`. `bun run cli chat` for local. `bun run deploy:telegram` for prod. Ask anything!

## 🚀 Vision

Build autonomous edge AI agents. Run on Cloudflare DO/D1. Zero-infra. Persistent MCP memory. Multi-platform: CLI/Telegram/GitHub.

> **Why?** Simple loop-based architecture with tool iterations. Scale globally. Cost: free idle.

## 🎯 30s Quickstarts

### CLI (Local)
```bash
git clone https://github.com/duyet/duyetbot-agent
cd duyetbot-agent
bun install
bun run cli chat
```
Try: `> Explain Durable Objects`

**✅ Done!** Chat with loop-based agent + memory.

### Telegram (Prod)
```bash
bun install
bunx wrangler login
bun scripts/config.ts telegram  # Add TELEGRAM_BOT_TOKEN
bun run deploy:telegram
```
Set webhook at [@BotFather](https://t.me/botfather). Ping bot!

## 🏗️ Loop-Based Architecture

```
User → Telegram/GitHub → Transport → CloudflareChatAgent (DO)
                                              │
                                              ▼
                                      ┌──────────────┐
                                      │  Chat Loop   │ ◄─── LLM Provider
                                      │              │
                                      │  ┌────────┐  │
                                      │  │ Tools  │  │ ◄─── Built-in + MCP
                                      │  └────────┘  │
                                      │              │
                                      │  ┌────────┐  │
                                      │  │ Track  │  │ ◄─── Token/cost → D1
                                      │  └────────┘  │
                                      └──────────────┘
                                              │
                                              ▼
                                    Memory MCP (D1 + KV)
```

**Single Durable Object** per bot with tool iterations (bash, git, github, research, plan).

## 📖 Sections

- [Getting Started](/getting-started/env-setup)
- [Guides](/guides/telegram-bot)
- [Architecture](/architecture)
- [Deployment](/deployment)

## 🔍 Search This Doc

**Prompt**: "Quickstart for GitHub bot" -> Jump to guide.

**Quiz**: What deploys Telegram?  
A: `bun run deploy:telegram` ✅

**Next**: [Env Setup](/getting-started/env-setup)  
**⭐ Star** [GitHub](https://github.com/duyet/duyetbot-agent){{t('cta.star')}}