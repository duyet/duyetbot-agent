# Overall Architecture: duyetbot-action Transformation

## Overview

This document provides the **complete architecture diagram** for the transformed duyetbot-action, integrating all designed systems (skills, modes, context enrichment, error handling, retry/circuit breaker, dead letter queue, and verification).

## High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         duyetbot-action Architecture                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

GitHub Event (Issue/PR/Comment)
        │
        ▼
┌───────────────────────┐
│   Event Ingestion     │
│   • Parse payload    │
│   • Extract context │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│   Mode Detection      │
│   • Check triggers   │
│   • Select mode     │
└───────────┬───────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                          Mode Execution Layer                            │
├───────────────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                          Skill System                                 │  │
│  │                                                                       │  │
│  │  ┌───────────────────────────────────────────────────────────────────────┐ │  │
│  │  │                    Skill Registry                             │ │  │
│  │  │  ┌────────────────────────────────────────────────────────────────┐ │  │
│  │  │  │  .claude/skills/                                   │ │  │
│  │  │  │  ├── self-improvement/                              │ │  │
│  │  │  │  │   ├── error-analyzer.md                          │ │  │
│  │  │  │  │   ├── error-recovery.md                         │ │  │
│  │  │  │  │   ├── error-reporting.md                        │ │  │
│  │  │  │  │   ├── verification-loop.md                       │ │  │
│  │  │  │  │   └── ...                                        │ │  │
│  │  │  │  │  ├── modes/                                         │ │  │
│  │  │  │  │   ├── agent-mode.md                              │ │  │
│  │  │  │  │   ├── tag-mode.md                                │ │  │
│  │  │  │  │   └── continuous-mode.md                        │ │  │
│  │  │  │  │  └── custom/                                       │ │  │
│  │  │  │  │       └── *.md                                     │ │  │
│  │  │  │  └────────────────────────────────────────────────────────┘ │  │
│  │  │  │                                                               │ │  │
│  │  │  │  ┌───────────────────────────────────────────────────────────┐ │  │
│  │  │  │  │  SkillLoader • SkillParser • SkillValidator          │ │  │
│  │  │  │  │  SkillRegistry • SkillExecutor                     │ │  │
│  │  │  │  │  SubagentLoader • SubagentRegistry                │ │  │
│  │  │  │  └───────────────────────────────────────────────────────────┘ │  │
│  │  └───────────────────────────────────────────────────────────────────────┘ │  │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         Agent Execution Layer                              │
├───────────────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                    Context Enrichment                              │  │
│  │  ┌───────────────────────────────────────────────────────────────────────┐ │  │
│  │  │  ContextEnricher • ContextCache • ContextFilters            │ │  │
│  │  │  ContextProfiles • ContextEstimator • ContextMetrics          │ │  │
│  │  │  Profiles: default • minimal • verbose • fast • comprehensive  │ │  │
│  │  └───────────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                       │  │
│  │  Features:                                                            │  │
│  │  • Declarative enrichment rules                                     │  │
│  │  • LRU cache with TTL                                               │  │
│  │  • Smart filtering (labels, age, authors)                            │  │
│  │  • Priority-based context                                           │  │
│  │  • Token usage estimation                                           │  │
│  │  └───────────────────────────────────────────────────────────────────────┘ │  │
│                                                                               │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                    Error Handling                                 │  │
│  │  ┌───────────────────────────────────────────────────────────────────────┐ │  │
│  │  │  ErrorDetector • ErrorCategorizer • ErrorRecovery            │ │  │
│  │  │  ErrorAggregator • ErrorReporter • ProfileManager            │ │  │
│  │  │  ErrorContextEnricher                                     │ │  │
│  │  └───────────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                       │  │
│  │  Features:                                                            │  │
│  │  • 20+ error categories (LLM, GitHub, tool, verification)           │  │
│  │  • Automatic severity and recoverability detection                  │  │
│  │  • 7+ recovery strategies                                          │  │
│  │  • Error aggregation and grouping                                   │  │
│  │  • 5 error profiles (default, strict, lenient, fast, thorough)    │  │
│  │  └───────────────────────────────────────────────────────────────────────┘ │  │
│                                                                               │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                    Retry & Circuit Breaker                         │  │
│  │  ┌───────────────────────────────────────────────────────────────────────┐ │  │
│  │  │  RetryEngine • CircuitBreaker • PolicyManager                 │ │  │
│  │  │  RetryMetrics • CircuitMetrics                              │ │  │
│  │  └───────────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                       │  │
│  │  Features:                                                            │  │
│  │  • Exponential/linear/fixed/custom retry strategies               │  │
│  │  • Jitter for backoff                                                │  │
│  │  • Circuit states: CLOSED • OPEN • HALF-OPEN                      │  │
│  │  • Automatic recovery detection                                       │  │
│  │  • Per-service policies (LLM, GitHub, tool, verification)         │  │
│  │  └───────────────────────────────────────────────────────────────────────┘ │  │
│                                                                               │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                    Dead Letter Queue                               │  │
│  │  ┌───────────────────────────────────────────────────────────────────────┐ │  │
│  │  │  DeadLetterQueue • DLQProcessor • DLQStorage                │ │  │
│  │  │  DLQMetrics                                                 │ │  │
│  │  └───────────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                       │  │
│  │  Features:                                                            │  │
│  │  • Queue failed operations for retry                                 │  │
│  │  • Exponential backoff with priority levels                           │  │
│  │  • 4 priorities: critical • high • medium • low                        │  │
│  │  • Max retry limit to prevent infinite loops                           │  │
│  │  • Manual intervention support                                        │  │
│  │  • Persistent storage (file/database)                               │  │
│  │  └───────────────────────────────────────────────────────────────────────┘ │  │
│                                                                               │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                    Verification                                   │  │
│  │  ┌───────────────────────────────────────────────────────────────────────┐ │  │
│  │  │  VerificationExecutor • VerificationReporter • VerificationMetrics │  │
│  │  │  VerificationConfig                                          │ │  │
│  │  └───────────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                       │  │
│  │  Features:                                                            │  │
│  │  • Declarative checks in skill metadata                              │  │
│  │  • 5+ check types: command • test • lint • type-check • build      │  │
│  │  • Parallel/sequential execution with dependency management            │  │
│  │  • Per-check and overall timeouts                                 │  │
│  │  • Error parsing (TypeScript, lint, test, build)                   │  │
│  │  • Retry on failure                                               │  │
│  │  • Fail-fast support                                               │  │
│  │  • Multiple output formats (text, JSON, HTML)                         │  │
│  │  └───────────────────────────────────────────────────────────────────────┘ │  │
│                                                                               │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                    Chat Loop (Core)                              │  │
│  │  ┌───────────────────────────────────────────────────────────────────────┐ │  │
│  │  │  LLM Reasoning • Tool Iterations • Response Handling       │ │  │
│  │  └───────────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                       │  │
│  │  Tools:                                                               │  │
│  │  ├── Built-in: bash • git • github • read • write • research • plan │  │
│  │  └── MCP Tools: duyet-mcp • github-mcp • custom servers       │  │
│  │  └───────────────────────────────────────────────────────────────────────┘ │  │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────┐
│   Output             │
│   • Create comment  │
│   • Create PR       │
│   • Report results  │
└───────────────────────┘
```

## Data Flow

### Normal Execution Flow (Success Path)

```text
GitHub Event
    ↓
Event Ingestion
    ↓
Mode Detection
    ↓
Load Mode Skill
    ↓
Enrich Context
    ├─► Fetch from GitHub (issues, comments, labels, status)
    ├─► Apply filters (exclude labels, age, authors)
    ├─► Prioritize (high/medium/low priority)
    └─► Cache results (LRU with TTL)
    ↓
Execute Skill
    ├─► Call LLM with tools
    ├─► Execute tool iterations
    └─► Collect results
    ↓
Verification
    ├─► Run checks (type-check, lint, test, build)
    ├─► Parse errors
    ├─► Generate report
    └─► All checks passed?
        ├─► YES: Create PR ✓
        └─► NO: Start Recovery
    ↓
Success
```

### Error Recovery Flow

```text
Error Detected
    ↓
Error Handling
    ├─► Detect error (20+ categories)
    ├─► Categorize (severity, recoverability)
    ├─► Report error (aggregation, metrics)
    └─► Check recoverability
        ├─► RETRYABLE: Start Retry
        ├─► RECOVERABLE: Apply Recovery
        └─► PERMANENT: Enqueue to DLQ
    ↓
Retry (if retryable)
    ├─► Check circuit breaker state
    ├─► Circuit CLOSED? → Execute with retry
    │   └─► Exponential backoff with jitter
    ├─► Circuit OPEN? → Reject immediately
    └─► Circuit HALF-OPEN? → Allow limited calls
    ↓
Recovery (if recoverable)
    ├─► Find recovery strategy for error category
    ├─► Execute recovery (e.g., install dependency, apply lint fix)
    ├─► Record recovery attempt
    └─► Recovery successful?
        ├─► YES: Retry original operation
        └─► NO: Increment retry count
    ↓
Max Retries Exceeded?
    ├─► YES: Enqueue to DLQ
    └─► NO: Continue retrying
    ↓
Dead Letter Queue
    ├─► Create DLQ item with error context
    ├─► Set priority (critical/high/medium/low)
    ├─► Calculate retry after (exponential backoff)
    ├─► Save to storage (file/database)
    └─► Schedule for later processing
    ↓
DLQ Processing (background)
    ├─► Find items ready for retry (retryAfter <= now)
    ├─► Execute operation with retry/circuit breaker
    ├─► Success? → Mark success, remove from queue
    ├─► Failed? → Update retry count, check max retries
    └─► Max retries? → Mark abandoned, notify if needed
```

## Component Interactions

### Skill System

```
.claude/skills/
├── self-improvement/
│   ├── error-analyzer.md          → ErrorDetector, ErrorRecovery
│   ├── error-recovery.md          → ErrorRecovery, DLQ
│   ├── error-reporting.md         → ErrorReporter, ErrorAggregator
│   ├── verification-loop.md       → VerificationExecutor, VerificationReporter
│   └── context-enrichment.md    → ContextEnricher
│
├── modes/
│   ├── agent-mode.md             → ModeExecutor, ContextEnricher
│   ├── tag-mode.md               → ModeExecutor, ContextEnricher
│   └── continuous-mode.md         → ModeExecutor, ContextEnricher
│
└── custom/
    └── *.md                       → SkillExecutor
```

### Error Handling Integration

```
All Components → ErrorDetector
                     ↓
               ErrorReporter → ErrorAggregator
                     ↓
               ErrorRecovery → RetryEngine
                     ↓
               CircuitBreaker (if service errors)
                     ↓
               DeadLetterQueue (if max retries)
```

### Context Enrichment Flow

```
Skill Execution Request
        ↓
ContextEnricher.enrich()
        ├─► Check cache (ContextCache)
        │   ├─► Hit → Return cached context
        │   └─► Miss → Continue
        ├─► Apply filters (ContextFilters)
        │   ├─► Exclude labels
        │   ├─► Filter by age
        │   └─► Filter by authors
        ├─► Fetch from GitHub (if needed)
        ├─► Apply prioritization (ContextProfiles)
        └─► Update metrics (ContextMetrics)
        ↓
Return Enriched Context
```

### Retry with Circuit Breaker

```
Operation Request
        ↓
Check Circuit State
        ├─► CLOSED → Execute operation
        │              ├─► Success → Update metrics, return result
        │              └─► Failure → Check retryable?
        │                  ├─► Yes → Retry with backoff
        │                  └─► No → Throw error
        │
        ├─► OPEN → Reject immediately, throw CircuitBreakerOpenError
        │
        └─► HALF-OPEN → Allow limited calls
                      └─► If success → Transition to CLOSED
                      └─► If failure → Transition to OPEN
```

### Verification Flow

```
Pre-PR Creation Request
        ↓
VerificationExecutor.execute()
        ├─► Build execution plan (dependency graph)
        ├─► Execute checks (parallel or sequential)
        │   ├─► Run command with timeout
        │   ├─► Collect output (stdout, stderr)
        │   ├─► Parse errors (if custom parser)
        │   └─→ Parse default errors (TS, lint, test, build)
        ├─► All checks passed?
        │   ├─► YES → Create PR
        │   └─► NO → Start recovery
        └─→ Update metrics (VerificationMetrics)
        ↓
Recovery (if failed)
        ├─► Parse errors
        ├─► Check error handler for recovery strategies
        ├─► Apply recovery (if available)
        ├─► Re-run verification after recovery
        └─→ Max retries exceeded? → Enqueue to DLQ
```

## System State Management

### Skill Registry State

```typescript
interface SkillRegistryState {
  skills: Map<string, Skill>;           // All loaded skills
  byTrigger: Map<string, Skill[]>;      // Skills indexed by trigger
  byType: Map<SkillType, Skill[]>;     // Skills indexed by type
  hotReloadEnabled: boolean;              // Hot reload enabled?
  lastReload: number;                    // Last reload timestamp
}
```

### Error Handling State

```typescript
interface ErrorHandlingState {
  errors: ErrorContext[];                 // All errors
  aggregated: ErrorGroup[];                // Aggregated error groups
  metrics: ErrorMetrics;                   // Error metrics
  profiles: Record<string, ErrorProfile>;  // Active error profiles
  circuitStates: Map<string, CircuitBreakerState>; // Circuit breaker states
}
```

### Retry State

```typescript
interface RetryState {
  policies: Map<string, RetryPolicy>;     // Retry policies
  attempts: Map<string, RetryAttempt[]>;  // Retry attempts
  metrics: RetryMetrics;                   // Retry metrics
  circuitStates: Map<string, CircuitState>; // Circuit states
}
```

### Dead Letter Queue State

```typescript
interface DLQState {
  items: Map<string, DLQItem>;          // All DLQ items
  priorityQueues: Map<DLQPriority, string[]>; // Priority queues
  metrics: DLQMetrics;                   // DLQ metrics
  processing: boolean;                     // Currently processing?
  lastProcessed: number;                   // Last processed timestamp
}
```

### Verification State

```typescript
interface VerificationState {
  checks: Map<string, VerificationCheck>;    // All verification checks
  results: Map<string, VerificationResult[]>; // Verification results
  metrics: VerificationMetrics;             // Verification metrics
  lastVerification: number;                // Last verification timestamp
  summary: VerificationSummary | null;      // Last verification summary
}
```

## Metrics Flow

### Metrics Collection Points

```
1. Skill Loading
   └─► SkillMetrics: loaded skills, load time, validation errors

2. Context Enrichment
   └─► ContextMetrics: enrichments, cache hits/misses, avg time

3. Error Handling
   └─► ErrorMetrics: total errors, by category/severity/recoverability
                      recovery rate, retry rate

4. Retry & Circuit Breaker
   └─► RetryMetrics: operations, attempts, success rate, avg delay
   └─► CircuitMetrics: state changes, time in each state, rejection rate

5. Dead Letter Queue
   └─► DLQMetrics: enqueued, retried, succeeded, abandoned
                      avg retry count, by priority/type

6. Verification
   └─► VerificationMetrics: verifications, total checks, passed/failed/skipped
                         avg check duration, check metrics by name
```

### Metrics Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    duyetbot-action Metrics Dashboard            │
├───────────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │ Error Metrics  │  │ Retry Metrics  │  │ DLQ Metrics    │ │
│  │                │  │                │  │                │ │
│  │ Total: 1,234   │  │ Operations:    │  │ Enqueued: 56   │ │
│  │ By Category:   │  │ 5,678          │  │ Retried: 123   │ │
│  │ • LLM: 456     │  │ Success: 96%   │  │ Succeeded: 89  │ │
│  │ • GitHub: 234   │  │ Avg Attempts:  │  │ Abandoned: 12   │ │
│  │ • Tool: 345    │  │  1.7            │  │ Avg Retries: 2.3│ │
│  │ • Verify: 199  │  │ Avg Delay:     │  │ By Priority:    │ │
│  │                │  │ 1.2s            │  │ • Critical: 5   │ │
│  │ Severity:      │  │                 │  │ • High: 12     │ │
│  │ • Low: 345      │  │ Circuit:        │  │ • Medium: 22    │ │
│  │ • Medium: 567   │  │ State Changes:  │  │ • Low: 17      │ │
│  │ • High: 234     │  │ 23              │  │ By Type:       │ │
│  │ • Critical: 88   │  │ Time in State:  │  │ • LLM: 15      │ │
│  │                │  │ • CLOSED: 85%   │  │ • GitHub: 21    │ │
│  │ Recoverability: │  │ • OPEN: 12%     │  │ • Tool: 12      │ │
│  │ • Retryable: 456│  │ • HALF-OPEN: 3% │  │ • Verify: 8     │ │
│  │ • Recoverable: │  │ Rejection: 2%  │  │                │ │
│  │   345          │  │                 │  │                │ │
│  │ • Permanent: 234│  │                 │  │                │ │
│  └────────────────┘  └────────────────┘  └────────────────┘ │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │              Verification Metrics                            │   │
│  │                                                             │   │
│  │ Total Verifications: 89                                   │   │
│  │ Success Rate: 87.6%                                        │   │
│  │                                                             │   │
│  │ Total Checks: 89 * 4 = 356                               │   │
│  │ Passed: 312 (87.6%)                                       │   │
│  │ Failed: 38 (10.7%)                                        │   │
│  │ Skipped: 6 (1.7%)                                         │   │
│  │                                                             │   │
│  │ Avg Verification Duration: 15.2s                            │   │
│  │ Avg Check Duration: 3.8s                                   │   │
│  │                                                             │   │
│  │ Check Metrics:                                             │   │
│  │ • type-check: 89 runs, 95% pass, 2.1s avg               │   │
│  │ • lint: 89 runs, 92% pass, 1.8s avg                    │   │
│  │ • test: 89 runs, 85% pass, 4.5s avg                     │   │
│  │ • build: 89 runs, 88% pass, 6.8s avg                   │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                   │
└───────────────────────────────────────────────────────────────────────────┘
```

## Storage Layer

### File System

```
duyetbot-action/
├── .claude/
│   ├── skills/                    # Skill definitions (read-only at runtime)
│   │   ├── self-improvement/
│   │   ├── modes/
│   │   └── custom/
│   └── subagents/                 # Subagent definitions
│
├── .duyetbot-state/               # Runtime state (gitignored)
│   ├── dlq.json                 # Dead letter queue
│   ├── cache.json                # Context cache
│   ├── metrics.json               # Metrics data
│   └── checkpoints/              # Checkpoint data
│
└── workspace/                    # Git workspace (temp clone)
    └── {repo-owner}/
        └── {repo-name}/
```

### In-Memory State

```typescript
// Runtime state (not persisted)
interface RuntimeState {
  // Skill system
  skillRegistry: SkillRegistryState;

  // Context enrichment
  contextCache: Map<string, any>;

  // Error handling
  errorHandling: ErrorHandlingState;

  // Retry & circuit breaker
  resilience: RetryState;

  // Dead letter queue
  dlq: DLQState;

  // Verification
  verification: VerificationState;

  // Agent execution
  agentSession: AgentSessionState;
}
```

## Configuration

### Environment Variables

```bash
# Required
GITHUB_TOKEN                      # GitHub API token
OPENROUTER_API_KEY               # LLM provider API key
AI_GATEWAY_BASE_URL              # AI Gateway endpoint

# Optional
DUYETBOT_ERROR_PROFILE=default    # Error handling profile
DUYETBOT_RETRY_ENABLED=true     # Enable/disable retries
DUYETBOT_DLQ_ENABLED=true       # Enable/disable DLQ
DUYETBOT_VERIFICATION_ENABLED=true # Enable/disable verification
DUYETBOT_CACHE_TTL=300          # Cache TTL in seconds

# Development
DUYETBOT_DEBUG=false            # Debug mode
DUYETBOT_LOG_LEVEL=info         # Log level (debug, info, warn, error)
```

### Skill Configuration

```yaml
# In .claude/skills/{skill-name}.md
---
name: my-custom-skill
type: custom
description: My custom skill

# Error handling configuration
error-handling:
  profile: lenient              # default, strict, lenient, fast, thorough
  enable_automatic_recovery: true
  max_recovery_attempts: 5

# Retry configuration
retry:
  enabled: true
  max_attempts: 5
  initial_delay_ms: 1000
  max_delay_ms: 60000
  backoff_multiplier: 2

# Circuit breaker configuration
circuit-breaker:
  enabled: true
  failure_threshold: 5
  success_threshold: 3
  timeout_ms: 60000

# Context enrichment configuration
context-enrichment:
  profile: verbose             # default, minimal, verbose, fast, comprehensive
  cache_enabled: true
  cache_ttl_seconds: 300

# Verification configuration
verification:
  enabled: true
  fail_fast: true
  parallel: true
  max_parallel: 3
```

## Deployment Architecture

### GitHub Action Workflow

```yaml
name: duyetbot-action

on:
  issues:
    types: [opened, labeled, edited, commented]
  pull_request:
    types: [opened, labeled, edited, synchronize]
  issue_comment:
    types: [created]

jobs:
  duyetbot:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run duyetbot-action
        uses: ./.github/actions/duyetbot-action@main
        with:
          github_token: ${{ github.token }}
          settings: |
            error-handling:
              profile: default
            retry:
              enabled: true
            verification:
              enabled: true
              fail_fast: true
```

### Component Dependencies

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   Component Dependencies                     │
├───────────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Skill System                                                      │
│  ├─► Depends on: Error Handling, Context Enrichment            │
│  └─► Used by: Mode System, Agent Loop                        │
│                                                                   │
│  Mode System                                                       │
│  ├─► Depends on: Skill System, Context Enrichment               │
│  └─► Used by: Agent Loop                                      │
│                                                                   │
│  Context Enrichment                                               │
│  ├─► Depends on: GitHub Tool, Skill System                     │
│  └─► Used by: Skill System, Mode System, Agent Loop              │
│                                                                   │
│  Error Handling                                                   │
│  ├─► Depends on: None (core system)                            │
│  └─► Used by: All components                                    │
│                                                                   │
│  Retry & Circuit Breaker                                          │
│  ├─► Depends on: Error Handling                                 │
│  └─► Used by: All operations (LLM, GitHub, tools)             │
│                                                                   │
│  Dead Letter Queue                                                │
│  ├─► Depends on: Error Handling, Retry                          │
│  └─► Used by: All operations on permanent failure                 │
│                                                                   │
│  Verification                                                    │
│  ├─► Depends on: Error Handling, Retry                          │
│  └─► Used by: Agent Loop (pre-PR creation)                    │
│                                                                   │
│  Agent Loop (Core)                                               │
│  ├─► Depends on: All above systems                            │
│  └─► Used by: Mode System                                      │
│                                                                   │
└───────────────────────────────────────────────────────────────────────────┘
```

## Implementation Status

### Phase 1: Research (10 tasks - COMPLETE ✅)

- ✅ Documented current duyetbot-action architecture
- ✅ Documented Claude Agent SDK proper usage patterns
- ✅ Analyzed current self-improvement implementation
- ✅ Analyzed current mode implementations
- ✅ Documented all direct GitHub API calls
- ✅ Documented task sources and integration
- ✅ Reviewed github tool capabilities
- ✅ Documented error handling and retry logic
- ✅ Documented context building for agent execution
- ✅ Created comprehensive research summary

### Phase 2: Gap Analysis (2 tasks - COMPLETE ✅)

- ✅ Analyzed gaps between current state and target state
- ✅ Prioritized gaps by impact and effort

### Phase 3: Architecture Design (8 tasks - COMPLETE ✅)

- ✅ Designed skill/subagent system (arch-1)
- ✅ Designed mode registry system (arch-2)
- ✅ Designed context enrichment system (arch-3)
- ✅ Designed error handling system (arch-4)
- ✅ Designed retry/circuit breaker system (arch-5)
- ✅ Designed dead letter queue system (arch-6)
- ✅ Designed verification system (arch-7)
- ✅ Created overall architecture diagram (arch-8) ← JUST COMPLETED

### Phase 4: Implementation (157 tasks - NOT STARTED)

- ⏸️ Skill system foundation (7 tasks)
- ⏸️ Skill system integration (7 tasks)
- ⏸️ Mode system foundation (6 tasks)
- ⏸️ Mode system integration (5 tasks)
- ⏸️ Context enrichment implementation (13 tasks)
- ⏸️ Error handling implementation (7 tasks)
- ⏸️ Retry/circuit breaker implementation (10 tasks)
- ⏸️ Dead letter queue implementation (9 tasks)
- ⏸️ Verification implementation (11 tasks)
- ⏸️ Integration with existing code (45 tasks)
- ⏸️ Testing (50 tasks)

### Phase 5: Documentation (10 tasks - NOT STARTED)

- ⏸️ Write skill development guide
- ⏸️ Write mode development guide
- ⏸️ Write error handling guide
- ⏸️ Write retry/circuit breaker guide
- ⏸️ Write DLQ guide
- ⏸️ Write verification guide
- ⏸️ Update main README
- ⏸️ Update CLAUDE.md
- ⏸️ Create migration guide
- ⏸️ Create troubleshooting guide

### Phase 6: Deployment (6 tasks - NOT STARTED)

- ⏸️ Deploy to test environment
- ⏸️ Run integration tests
- ⏸️ Deploy to production
- ⏸️ Monitor initial deployment
- ⏸️ Rollback if needed
- ⏸️ Update documentation

## Key Design Decisions

### 1. Skill System

- **Decision**: Use YAML front matter in `.md` files for skill metadata
- **Rationale**: Human-readable, easy to edit, supports versioning
- **Trade-off**: More verbose than JSON, but better for documentation

### 2. Context Enrichment

- **Decision**: LRU cache with TTL
- **Rationale**: Balance memory usage with cache hit rate
- **Trade-off**: Not as fast as pure in-memory, but more memory-efficient

### 3. Error Handling

- **Decision**: 20+ error categories with automatic detection
- **Rationale**: Fine-grained categorization enables better recovery strategies
- **Trade-off**: More complex error handling logic

### 4. Retry Policy

- **Decision**: Exponential backoff with jitter
- **Rationale**: Prevent thundering herd while ensuring timely retries
- **Trade-off**: Slightly more complex than simple linear backoff

### 5. Circuit Breaker

- **Decision**: 3-state circuit (CLOSED, OPEN, HALF-OPEN)
- **Rationale**: Standard pattern, allows gradual recovery testing
- **Trade-off**: More state management than simple on/off

### 6. Dead Letter Queue

- **Decision**: File-based storage with future database support
- **Rationale**: Simple to start, can upgrade later
- **Trade-off**: Not as scalable as database, but sufficient for GitHub Actions

### 7. Verification

- **Decision**: Declarative checks in skill metadata
- **Rationale**: Easy to customize per project, no code changes needed
- **Trade-off**: More parsing overhead than hardcoded checks

### 8. Integration Strategy

- **Decision**: Incremental migration with feature flags
- **Rationale**: Minimize risk, allow gradual rollout
- **Trade-off**: More complex code with feature flag management

## Conclusion

This overall architecture provides:

✅ **Declarative Skills**: Logic in `.md` files with YAML front matter
✅ **Dynamic Loading**: Runtime skill loading from `.claude/` directories
✅ **Hot Reload**: Support for reloading without restart
✅ **Context Enrichment**: 7 profiles with caching and filtering
✅ **Error Handling**: 20+ categories with 7+ recovery strategies
✅ **Retry & Circuit Breaker**: Configurable policies per service
✅ **Dead Letter Queue**: Priority-based retry with exponential backoff
✅ **Verification**: Declarative checks with parallel/sequential execution
✅ **Metrics**: Comprehensive metrics tracking for all systems
✅ **Integration**: Seamless integration between all systems
✅ **Extensibility**: Easy to add new skills, modes, checks
✅ **Backward Compatibility**: Fallback to existing modes during migration

**Next Steps**: Start Phase 4 - Implementation (157 tasks)
**Estimated Time**: 40-48 hours
**Risk**: MEDIUM
