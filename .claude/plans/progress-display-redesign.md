# Progress Display Redesign

## Objective

Redesign the progress display system to show:
1. **Thinking messages** with token counts: `* Germinating… (↓ 279 tokens)`
2. **Tool calls** with args and results: `⏺ research(query: "Home Depot...") ⎿ 🔍 Search Results...`
3. **Parallel tools** with tree structure and individual progress
4. **Sub-agents** with their own execution summaries
5. **Final debug footer** in `<blockquote expandable>` format

## Current Issues

1. **Thinking text shows**: `[~] Thinking. ...` instead of `* Germinating… (↓ 279 tokens)`
2. **Tool params missing**: Shows `...` checkbox instead of actual args/results
3. **No parallel tool tree**: Missing `├─ └─ │` structure for concurrent executions
4. **No sub-agent rendering**: Sub-agent spawns not shown with their token/tool summaries

## Target Format

### Live Progress (During Execution)

```
* Germinating… (↓ 279 tokens)
```

Then as tools execute:

```
⏺ Let me search for information...

* research(query: "Home Depot GitHub token exposed...")
  ⎿ Running…
```

After tool completes:

```
⏺ Let me search for information...

⏺ research(query: "Home Depot GitHub token exposed for a ye...")
  ⎿ 🔍 Search Results (current events and news) | Query: "Home Depot..." | Source: news...

* Synthesizing…
```

### Parallel Tools (During Execution)

```
⏺ Running 3 tools in parallel...
   ├─ research(query: "Home Depot GitHub token...") · 27 tool uses · 52.0k tokens
   │  ⎿ 🔍 Search Results (current events) | Query: "..."
   ├─ Explore(agentic-loop architecture) · 17 tool uses · 67.3k tokens
   │  ⎿ Running…
   └─ research(query: "https://readhacker.news/s/6Hm9i")
      ⎿ Running…
```

### Sub-Agent (After Completion)

```
⏺ Plan(Design cloudflare-agent refactoring)
  ⎿ Done (20 tool uses · 119.1k tokens · 1m 58s)
```

### Final Debug Footer

```
<response text here>

<blockquote expandable>
⏺ Let me search for information...

⏺ research(query: "Home Depot GitHub token exposed for a ye...")
  ⎿ 🔍 Search Results (current events and news) | Query: "Home Depot..." | Source: news...

⏺ Analyzing the security implications...

⏺ web_fetch(url: "https://example.com/article")
  ⎿ 🔍 Article content about security breach...

⏱️ 7.6s | 📊 5.4k tokens | 🤖 sonnet-3.5
</blockquote>
```

## Architecture Changes

### Phase 1: New Step Types (packages/progress/src/types.ts)

Add new step types for parallel tools and sub-agents:

```typescript
// New: Parallel tools execution group
export interface ParallelToolsStep extends BaseStep {
  type: 'parallel_tools';
  tools: Array<{
    id: string;
    toolName: string;
    args: Record<string, unknown>;
    status: 'running' | 'completed' | 'error';
    result?: string;
    error?: string;
    durationMs?: number;
  }>;
}

// New: Sub-agent execution
export interface SubAgentStep extends BaseStep {
  type: 'subagent';
  agentName: string;
  description: string;
  status: 'running' | 'completed' | 'error';
  toolUses?: number;
  tokenCount?: number;
  result?: string;
  error?: string;
}

// Update Step union
export type Step =
  | ThinkingStep
  | ToolStartStep
  | ToolCompleteStep
  | ToolErrorStep
  | RoutingStep
  | LlmIterationStep
  | PreparingStep
  | ParallelToolsStep  // NEW
  | SubAgentStep;       // NEW
```

### Phase 2: Enhanced Progress Renderer (packages/progress/src/renderer/progress-renderer.ts)

Update render logic for new step types:

```typescript
// Add case for parallel tools
case 'parallel_tools': {
  lines.push(`⏺ Running ${step.tools.length} tools in parallel...`);
  step.tools.forEach((tool, i) => {
    const isLast = i === step.tools.length - 1;
    const prefix = isLast ? '└─' : '├─';
    const connector = isLast ? '   ' : '│  ';

    const argsStr = formatToolArgs(tool.args, 40);
    const stats = tool.status === 'completed'
      ? ` · ${formatDuration(tool.durationMs || 0)}`
      : '';

    lines.push(`   ${prefix} ${tool.toolName}(${argsStr})${stats}`);

    if (tool.status === 'running') {
      lines.push(`   ${connector}⎿ Running…`);
    } else if (tool.status === 'completed' && tool.result) {
      const preview = formatToolResult(tool.result, 1, 60);
      lines.push(`   ${connector}⎿ 🔍 ${preview}`);
    } else if (tool.status === 'error') {
      lines.push(`   ${connector}⎿ ❌ ${tool.error?.slice(0, 50)}...`);
    }
  });
  break;
}

// Add case for sub-agents
case 'subagent': {
  const argsStr = step.description ? `(${step.description})` : '';
  if (step.status === 'running') {
    lines.push(`* ${step.agentName}${argsStr}`);
    lines.push('  ⎿ Running…');
  } else {
    lines.push(`⏺ ${step.agentName}${argsStr}`);
    const stats: string[] = [];
    if (step.toolUses) stats.push(`${step.toolUses} tool uses`);
    if (step.tokenCount) stats.push(`${formatCompactNumber(step.tokenCount)} tokens`);
    if (step.durationMs) stats.push(formatDuration(step.durationMs));

    if (step.status === 'completed') {
      lines.push(`  ⎿ Done (${stats.join(' · ')})`);
    } else if (step.status === 'error') {
      lines.push(`  ⎿ ❌ ${step.error?.slice(0, 50)}...`);
    }
  }
  break;
}
```

### Phase 3: Enhanced Footer Renderer (packages/progress/src/renderer/footer-renderer.ts)

Update chain rendering for new step types with same logic.

### Phase 4: Enhanced Format Utilities (packages/progress/src/utils/format.ts)

Update `formatToolArgs` to show more context:

```typescript
/**
 * Format tool arguments with priority keys and truncation
 * @param args Tool arguments object
 * @param maxLength Maximum length for values (default: 50)
 * @returns Formatted string like: query: "Home Depot GitHub token..."
 */
export function formatToolArgs(
  args?: Record<string, unknown>,
  maxLength = 50
): string {
  if (!args || Object.keys(args).length === 0) return '';

  // Priority order for displaying args
  const priorityKeys = ['query', 'url', 'prompt', 'search', 'question', 'input', 'text', 'path'];

  for (const key of priorityKeys) {
    if (args[key] !== undefined) {
      const value = String(args[key]);
      const truncated = value.length > maxLength
        ? `${value.slice(0, maxLength - 3)}...`
        : value;
      return `${key}: "${truncated}"`;
    }
  }

  // Fallback: show first key-value
  const firstKey = Object.keys(args)[0];
  if (firstKey) {
    const value = String(args[firstKey]);
    const truncated = value.length > maxLength
      ? `${value.slice(0, maxLength - 3)}...`
      : value;
    return `${firstKey}: "${truncated}"`;
  }

  return '';
}
```

### Phase 5: Update StepProgressTracker (packages/cloudflare-agent/src/workflow/step-tracker.ts)

Add methods for new step types:

```typescript
// Add parallel tools tracking
async addParallelTools(tools: ParallelToolInfo[]): Promise<void> {
  const step: StepEvent = {
    type: 'parallel_tools',
    tools: tools.map(t => ({
      id: t.id,
      toolName: t.toolName,
      args: t.args,
      status: 'running',
    })),
  };
  await this.addStep(step);
}

async updateParallelTool(
  toolId: string,
  update: { status: 'completed' | 'error'; result?: string; error?: string; durationMs?: number }
): Promise<void> {
  // Find and update the tool in the current parallel_tools step
  const parallelStep = this.steps.findLast(s => s.type === 'parallel_tools');
  if (parallelStep && 'tools' in parallelStep) {
    const tool = parallelStep.tools.find(t => t.id === toolId);
    if (tool) {
      Object.assign(tool, update);
      await this.update();
    }
  }
}

// Add sub-agent tracking
async addSubAgent(
  agentName: string,
  description: string
): Promise<string> {
  const id = crypto.randomUUID();
  const step: StepEvent = {
    type: 'subagent',
    id,
    agentName,
    description,
    status: 'running',
  };
  await this.addStep(step);
  return id;
}

async completeSubAgent(
  id: string,
  result: { toolUses?: number; tokenCount?: number; durationMs?: number; error?: string }
): Promise<void> {
  // Find and update the sub-agent step
  const subagentStep = this.steps.find(s => s.type === 'subagent' && s.id === id);
  if (subagentStep) {
    Object.assign(subagentStep, {
      status: result.error ? 'error' : 'completed',
      ...result,
    });
    await this.update();
  }
}
```

### Phase 6: Chat Loop Integration (packages/cloudflare-agent/src/chat/chat-loop.ts)

Update tool execution to use new tracking:

```typescript
// For parallel tool calls
if (toolCalls.length > 1) {
  await stepTracker?.addParallelTools(
    toolCalls.map(tc => ({
      id: tc.id,
      toolName: tc.name,
      args: tc.arguments,
    }))
  );

  // Execute tools in parallel
  const results = await Promise.all(toolCalls.map(async (tc) => {
    const startTime = Date.now();
    try {
      const result = await this.executeTool(tc);
      await stepTracker?.updateParallelTool(tc.id, {
        status: 'completed',
        result: JSON.stringify(result).slice(0, 200),
        durationMs: Date.now() - startTime,
      });
      return result;
    } catch (error) {
      await stepTracker?.updateParallelTool(tc.id, {
        status: 'error',
        error: String(error),
        durationMs: Date.now() - startTime,
      });
      throw error;
    }
  }));
}
```

## Implementation Phases

### Phase 1: Types (0.5 day)
- [ ] Add `ParallelToolsStep` interface to types.ts
- [ ] Add `SubAgentStep` interface to types.ts
- [ ] Update `Step` union type
- [ ] Update `StepType` union
- [ ] Add tests for new types

### Phase 2: Format Utilities (0.5 day)
- [ ] Update `formatToolArgs` with priority keys and better truncation
- [ ] Add `formatToolResult` improvements for search result previews
- [ ] Add tests for format changes

### Phase 3: Progress Renderer (1 day)
- [ ] Add parallel tools rendering with tree structure
- [ ] Add sub-agent rendering with status
- [ ] Update thinking message format to include token count
- [ ] Add tests for new rendering

### Phase 4: Footer Renderer (0.5 day)
- [ ] Add parallel tools to chain rendering
- [ ] Add sub-agent summary to chain
- [ ] Ensure blockquote format is correct
- [ ] Add tests

### Phase 5: Step Tracker (1 day)
- [ ] Add `addParallelTools` method
- [ ] Add `updateParallelTool` method
- [ ] Add `addSubAgent` method
- [ ] Add `completeSubAgent` method
- [ ] Update `update()` rendering logic
- [ ] Add tests

### Phase 6: Chat Loop Integration (0.5 day)
- [ ] Detect parallel tool calls (toolCalls.length > 1)
- [ ] Use new parallel tracking methods
- [ ] Add sub-agent spawn tracking
- [ ] Integration tests

## Files to Modify

| File | Changes |
|------|---------|
| `packages/progress/src/types.ts` | Add ParallelToolsStep, SubAgentStep |
| `packages/progress/src/utils/format.ts` | Improve formatToolArgs |
| `packages/progress/src/renderer/progress-renderer.ts` | Add new step type rendering |
| `packages/progress/src/renderer/footer-renderer.ts` | Add new step type chain rendering |
| `packages/cloudflare-agent/src/workflow/step-tracker.ts` | Add parallel/subagent methods |
| `packages/cloudflare-agent/src/chat/chat-loop.ts` | Use new tracking methods |

## Success Criteria

- [ ] Thinking shows: `* Germinating… (↓ 279 tokens)`
- [ ] Tool calls show: `⏺ research(query: "actual query here...")`
- [ ] Tool results show: `⎿ 🔍 Search Results (type) | Query: "..." | Source: ...`
- [ ] Parallel tools render with tree structure (├─ └─ │)
- [ ] Sub-agents show: `⏺ Plan(desc) ⎿ Done (20 tool uses · 119.1k tokens · 1m 58s)`
- [ ] Final footer is wrapped in `<blockquote expandable>`
- [ ] All existing tests pass
- [ ] New functionality has test coverage
