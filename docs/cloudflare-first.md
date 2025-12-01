---
title: Cloudflare First
desc: Deploy DO/D1 edges. Shared agents pattern. Zero-config scaling. Global low-latency.
sidebar_position: 1.4
keywords: [cloudflare, durable-objects, d1, bindings, script_name, shared-agents, edge]
slug: getting-started/cloudflare-first
---

# Cloudflare First

**TL;DR**: `bun run deploy:shared-agents`. Deploys 8 DOs + D1. Binds via `script_name`. Edge everywhere.

Run agents on Durable Objects + D1. No servers. Global replication.

## 🏗️ DO/D1 Edges

**Durable Objects**: Stateful. Per-user sessions. Batch queues. Heartbeats.

**D1**: Memory MCP. Cross-session. User-isolated.

From [`wrangler.toml`](apps/shared-agents/[`wrangler.toml`](apps/shared-agents/wrangler.toml)):

- Local: `TelegramAgent`
- Shared: `RouterAgent` via `script_name = "duyetbot-agents"`

## 🔗 DO Binding Mermaid

```mermaid
graph LR
    A[telegram-bot Worker] --> B[TelegramAgent DO<br/>Local]
    A --> C[RouterAgent DO<br/>script_name=duyetbot-agents]
    A --> D[SimpleAgent DO<br/>script_name=duyetbot-agents]
    E[github-bot Worker] --> F[GitHubAgent DO<br/>Local]
    E --> C
    E --> D
    G[shared-agents Worker] --> C
    G --> H[OrchestratorAgent]
    G --> I[CodeWorker]
    G --> J[ResearchWorker]
    G --> K[GitHubWorker]
    G --> L[DuyetInfoAgent]
    G --> M[OBSERVABILITY_DB D1]
```

**One deploy scales all bots.**

## 🚀 Simple Flow

```bash
bun run deploy:shared-agents  # 8 DOs + D1
bun run deploy:telegram       # Binds shared DOs
```
**✅ Agents live!** Test: Ping Telegram.

**Quiz**: Shared DOs via?  
A: `script_name` ✅

## 🚀 Next

[Build Agent →](/guides/build-custom-agent)  
**Deploy edges**: `bun run deploy:shared-agents`! {{t('cf.edges_ready')}}