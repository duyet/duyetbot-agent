---
title: DO Patterns
description: "8 Durable Objects: Router/Simple/Orchestrator/HITL/Code/Research/GitHub/DuyetInfo. Bindings via script_name. StateDO watchdog."
---

<!-- i18n: en -->

**TL;DR**: 8 DOs handle routing/execution. Shared via `script_name="duyetbot-agents"`. StateDO tracks sessions/heartbeats. ✅ Deployed.

## Table of Contents
- [Architecture](#architecture)
- [8 DOs Table](#8-dos-table)
- [Bindings](#bindings)
- [StateDO](#statedo)

## Architecture

From [`PLAN.md`](PLAN.md:43):

```
                 Telegram/GitHub Webhook
                         |
                         v
                  Platform Agent DO
                         |
                Memory MCP D1/KV ◀---+
                         |            |
                         v            |
                    RouterAgent       |
              (Hybrid Classifier)     |
                         |◀----------+
              +----------+----------+----------+
              |          |          |          |
              v          v          v          v
           Simple     HITL    Orchestrator   Duyet
           Agent     Agent     Agent         Info
                               |             Agent
                               |
                        +------+------+------+
                        |      |      |      |
                        v      v      v      v
                      Code  Research  GitHub
                      Worker Worker   Worker
```

## 8 DOs Table

| DO | Role | Trigger | Status |
|----|------|---------|--------|
| RouterAgent | Classify + route | All queries | ✅ |
| SimpleAgent | Quick Q&A | Low complexity | ✅ |
| OrchestratorAgent | Task decomposition | High complexity | ✅ |
| HITLAgent | User approvals | Sensitive ops | ✅ |
| CodeWorker | Code analysis | Code tasks | ✅ |
| ResearchWorker | Web research | Research | ✅ |
| GitHubWorker | GitHub ops | GitHub | ✅ |
| DuyetInfoAgent | Personal info | Duyet queries | ✅ |

From [`agents/index.ts`](packages/cloudflare-agent/src/agents/index.ts:11).

## Bindings

`wrangler.toml` [`apps/shared-agents/wrangler.toml`](apps/shared-agents/wrangler.toml):

```
[agents]
script_name = "duyetbot-shared-agents"
```

## StateDO

Watchdog from [`state-do.ts`](packages/cloudflare-agent/src/agents/state-do.ts:8):

- Tracks sessions/heartbeats
- Recovers stuck batches
- Alarms every 30s

**Quiz**: Router triggers?  
A: All queries ✅

**Pro Tip** ✅: 8 DOs scale globally, free idle.

**CTA**: Study [`PLAN.md`](PLAN.md) -> Extend!

**Next**: [Custom Tools ->](../extend/custom-tools.md)