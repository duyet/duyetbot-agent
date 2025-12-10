---
title: Router Cheatsheet
description: One-page quick reference for hybrid classification, token savings, routing rules, debugging, and key metrics
---

# Router Architecture: Quick Reference Cheatsheet

## 🎯 One-Minute Overview

```
User Message
    ↓
Webhook (6ms) ← Returns immediately
    ↓
TelegramAgent/GitHubAgent (DO) ← Independent 30s timeout
    ↓
Batch Queue (500ms window) ← Collect messages
    ↓
RouterAgent (Hybrid Classifier)
    +- Phase 1: Pattern Match (0 tokens, 80% of queries)
    +- Phase 2: LLM (300 tokens, 20% of queries)
    ↓
Specialized Agent
    +- SimpleAgent (50-150 tokens) -> Direct LLM
    +- OrchestratorAgent (500-2000 tokens) -> Plan + workers
    +- HITLAgent (300-1000 tokens) -> Confirmation
    +- LeadResearcherAgent (1000-3000 tokens) -> Parallel research
    +- DuyetInfoAgent (100-300 tokens) -> MCP info
    ↓
Response to User
```

## 📊 Token Savings: By The Numbers

| Mechanism | Savings | Details |
|-----------|---------|---------|
| **Hybrid Classification** | 60% | 80% pattern match (0 tokens) + 20% LLM (300 tokens) |
| **Batch Queuing** | 55% | 3-5 messages in 1 call vs separate calls |
| **Simple Agent** | 40% | No planning overhead |
| **Deduplication** | 10% | Skip webhook retries (5-10% of requests) |
| **Heartbeat Edits** | 5% | Edit existing message, not send new |
| **TOTAL** | **~75%** | 7,500 tokens vs 30,000 without router |

## 🚦 Classification Rules

### Phase 1: Pattern Match (Zero Tokens)

```regex
/^(hi|hello|hey)/i           -> SimpleAgent
/help|\?/i                   -> SimpleAgent
/^(yes|no|approve)/i         -> HITLAgent
/code|bug|fix/i              -> OrchestratorAgent
/no match/                   -> Phase 2: LLM
```

### Phase 2: LLM Classification (Only 20% of queries)

Returns JSON with:
- `type`: simple | complex
- `category`: code | research | github | duyet | general
- `complexity`: low | medium | high
- `requiresHumanApproval`: boolean
- `reasoning`: string

### Route Determination

```
if requiresHumanApproval -> HITLAgent
if category === 'duyet' -> DuyetInfoAgent
if category === 'research' && complexity >= 'medium' -> LeadResearcherAgent
if complexity === 'high' -> OrchestratorAgent
if type === 'simple' && complexity === 'low' -> SimpleAgent
default -> SimpleAgent
```

## 🤖 Agent vs Worker

| Type | Called By | Tokens | Purpose |
|------|-----------|--------|---------|
| **SimpleAgent** | Router | 50-150 | Direct LLM, no planning |
| **OrchestratorAgent** | Router | 500-2000 | Plan + dispatch workers |
| **HITLAgent** | Router | 300-1000 | Confirmation flow |
| **LeadResearcherAgent** | Router | 1000-3000 | Parallel research agents |
| **DuyetInfoAgent** | Router | 100-300 | MCP info retrieval |
| **CodeWorker** | Orchestrator | N/A | Stateless code execution |
| **ResearchWorker** | Orchestrator | N/A | Stateless web search |
| **GitHubWorker** | Orchestrator | N/A | Stateless GitHub ops |

**🔴 CRITICAL:** Router ONLY dispatches to Agents. Workers are ONLY called by OrchestratorAgent.

## 🔄 Batch Processing Architecture

```
pendingBatch (always collecting, mutable)
+- Receives new messages
+- Never blocks incoming
+- No status = collecting

activeBatch (processing, immutable)
+- Snapshot from pendingBatch
+- Atomic & locked during processing
+- If stuck >30s -> auto-recovery
+- Status = processing

Timeline:
T+0ms:     User sends message
T+5ms:     Added to pendingBatch
T+500ms:   Alarm fires
T+501ms:   activeBatch = pendingBatch
T+502ms:   pendingBatch = empty
T+5000ms:  Response sent
T+5001ms:  Clear activeBatch
T+5002ms:  Ready for next batch
```

## 💰 Token Cost Examples

### Example 1: Simple Query
```
User: "Hi there!"
  -> Pattern: /^hi/i matches ✓
  -> Tokens: 0 (pattern) + 100 (response) = 100
  -> Route: SimpleAgent (direct LLM)
```

### Example 2: Semantic Query
```
User: "What are the latest AI trends?"
  -> Pattern: No match ✗
  -> LLM: Classification (300 tokens)
  -> Route: LeadResearcherAgent (1000+ tokens)
  -> Total: ~1300 tokens
```

### Example 3: 3 Rapid Messages (Without Router)
```
User sends 3 messages in 100ms:
  msg1: "What's the weather?" (150 tokens)
  msg2: "In New York?" (200 tokens)
  msg3: "Thanks" (100 tokens)
  -> 3 LLM calls = 450 tokens total
```

### Example 3: 3 Rapid Messages (With Router + Batching)
```
User sends 3 messages in 100ms:
  T+0-500ms: Collect all 3
  T+506ms: Combine & send 1 LLM call
  -> 1 LLM call = 200 tokens total
  -> Savings: 55%!
```

## ⚙️ Configuration

```typescript
// Feature flags
{
  enableHybridClassifier: true,    // Pattern + LLM hybrid
  enablePatternMatch: true,        // Use regex patterns
  enableBatching: true,            // Dual-batch queue
  enableDeduplication: true,       // Track request IDs
  batchWindowMs: 500,              // Collect window
  stuckDetectionMs: 30_000,        // Recovery timeout
}

// Batch window guidance
100ms   -> Real-time (fewer savings)
500ms   -> Optimal balance (recommended)
1000ms  -> Batch processing (best savings)
```

## 📈 Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Pattern match latency | <50ms | ✅ |
| LLM classification | 200-500ms | ✅ |
| Webhook to queue | <6ms | ✅ |
| Batch window | 500ms | ✅ |
| Stuck detection | 30s timeout | ✅ |
| Total P95 latency | <2s | ✅ |
| DO success rate | >99.9% | ✅ |

## 🐛 Debugging

```bash
# Enable debug logging
export ROUTER_DEBUG=true

# Watch routing decisions
[ROUTER] Query classified: "hello"
  classificationMethod: pattern
  type: simple
  tokensUsed: 0
  latencyMs: 15

# Watch batch processing
[BATCH] Collected: 3 messages
[BATCH] Promoting: pendingBatch -> activeBatch
[BATCH] Processing: "msg1\n---\nmsg2\n---\nmsg3"
[BATCH] LLM tokens: 200

# Watch stuck detection
[BATCH] Stuck batch detected
  duration: 35000ms
  lastHeartbeat: 4970ms ago
  action: cleared (recovery)
```

## 🚨 Common Mistakes

### ❌ Blocking the webhook
```typescript
// WRONG - DO hangs webhook
c.executionCtx.waitUntil(agent.queueMessage(ctx));

// RIGHT - Independent execution
agent.queueMessage(ctx).catch(() => {});
```

### ❌ Dispatching workers from router
```typescript
// WRONG - Workers aren't agents
const result = await WorkerAgent.execute(query);

// RIGHT - Only orchestrator dispatches workers
const result = await OrchestratorAgent.execute(query);
```

### ❌ Combining messages incorrectly
```typescript
// WRONG - Loses context
const text = batch.messages.map(m => m.text).join(' ');

// RIGHT - Preserve structure
const text = batch.messages.map(m => m.text).join('\n---\n');
```

### ❌ Not recovering from stuck batches
```typescript
// WRONG - User blocked forever
if (activeBatch && !heartbeat) {
  wait(); // Forever!
}

// RIGHT - Automatic recovery
if (activeBatch && noHeartbeatFor(30s)) {
  clearActiveBatch();
  promotePendingBatch();
}
```

## 📋 Monitoring Checklist

- [ ] Pattern match latency <50ms
- [ ] LLM classification only 15-20% of queries
- [ ] Batch size averaging 2-3 messages
- [ ] No stuck batches in past 24h
- [ ] Deduplication catching 5-10% of retries
- [ ] Token usage ~7,500/100 queries (not 30,000)
- [ ] Cost per query <$0.01
- [ ] Routing accuracy >95%

## 🔗 Key Files

| File | Purpose |
|------|---------|
| `packages/cloudflare-agent/src/cloudflare-agent.ts` | Main DO wrapper |
| `packages/cloudflare-agent/src/agents/router-agent.ts` | Hybrid classifier |
| `packages/cloudflare-agent/src/routing/classifier.ts` | Pattern + LLM logic |
| `packages/cloudflare-agent/src/batch-types.ts` | Dual-batch implementation |
| `packages/cloudflare-agent/src/feature-flags.ts` | Configuration |
| `packages/prompts/src/agents/router.ts` | Classification prompt |
| `docs/architecture.md` | Full architecture docs |
| `docs/multiagent-flows.html` | Interactive dashboard |
| `docs/token-optimization-guide.md` | Detailed token guide |

## 🎓 Learning Path

1. **Start here** -> This cheatsheet (5 min read)
2. **Interactive view** -> `docs/multiagent-flows.html` (10 min explore)
3. **Deep dive** -> `docs/token-optimization-guide.md` (20 min read)
4. **Implementation** -> `docs/architecture.md` (30 min study)
5. **Code review** -> `packages/cloudflare-agent/src/` (60 min exploration)

## 💡 Quick Stats

```
100 Queries/Day:
  Without Router:  30,000 tokens -> $0.09
  With Router:     7,500 tokens  -> $0.0225
  Savings:         75% (22,500 tokens)

1,000 Queries/Day:
  Without Router:  300,000 tokens -> $0.90
  With Router:     75,000 tokens  -> $0.225
  Savings:         75% (~$0.675/day)

Annual (1K queries/day):
  Cost without:    $328.50/year
  Cost with:       $82.13/year
  Total savings:   $246.38/year
```

---

**Last Updated:** 2025-11-29
**Router Version:** 2.0 (Hybrid Classifier + Dual-Batch)
**Status:** Production Ready ✅
