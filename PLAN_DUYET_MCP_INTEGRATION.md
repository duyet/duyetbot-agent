# Implementation Plan: Consolidate Duyet MCP Access into Agentic Loop

## Executive Summary

Consolidate personal information (Duyet MCP) access from the current two-path architecture into a single, unified `duyetMcpTool` in the agentic loop. This eliminates the redundant `memoryTool` (stub) and potentially deprecates `DuyetInfoAgent` (819 LOC DO agent).

## Current Architecture Analysis

### Two Separate Paths (Problematic)

```
Path 1: Direct Agent Routing (DuyetInfoAgent)
┌──────────────────────────────────────────────────────────────┐
│ User: "who is duyet" → RouterAgent → DuyetInfoAgent DO       │
│                                      ├── MCP SSE Connection   │
│                                      ├── Tool Discovery       │
│                                      ├── LLM with MCP Tools   │
│                                      └── Result Caching       │
└──────────────────────────────────────────────────────────────┘

Path 2: Agentic Loop Tool (memoryTool - STUB)
┌──────────────────────────────────────────────────────────────┐
│ User: Complex query → OrchestratorAgent → AgenticLoopWorkflow│
│                                           ├── plan tool      │
│                                           ├── research tool  │
│                                           ├── memoryTool ❌   │ ← Returns stub!
│                                           └── github tool    │
└──────────────────────────────────────────────────────────────┘
```

### Problems with Current Architecture

1. **memoryTool is a stub** - Returns placeholder text, never calls MCP
2. **Duplication** - DuyetInfoAgent implements full MCP integration (~819 LOC)
3. **Inconsistency** - Route through RouterAgent works, agentic loop doesn't
4. **Maintenance burden** - Two systems to maintain for same functionality

## Target Architecture

### Single Unified Path

```
┌──────────────────────────────────────────────────────────────┐
│ All Queries → AgenticLoopWorkflow → duyetMcpTool             │
│                                      ├── MCP SSE Connection   │
│                                      ├── Tool Discovery       │
│                                      ├── Dynamic Tool Calls   │
│                                      └── Error Handling       │
└──────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| MCP Connection | Per-execution | Workflow steps are isolated; no persistent state |
| Tool Discovery | Dynamic with filter | Filter to relevant tools (blog, cv, skills, contact) |
| Error Handling | Graceful fallback | Return helpful message on MCP timeout/failure |
| Caching | None initially | Workflow steps are short; caching adds complexity |
| Timeout | 8s total | Leave room for LLM reasoning in 30s step budget |

## Implementation Plan

### Phase 1: Create duyetMcpTool (Primary Deliverable)

**File**: `packages/cloudflare-agent/src/agentic-loop/tools/duyet-mcp.ts`

#### 1.1 Tool Interface

```typescript
export const duyetMcpTool: LoopTool = {
  name: 'duyet_info',
  description: 'Get information about Duyet including blog posts, CV, skills, experience, and contact info. Use for queries about Duyet, his blog, or personal information.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The information to look up (e.g., "latest blog posts", "skills", "cv", "contact info")'
      },
      toolName: {
        type: 'string',
        description: 'Optional: specific MCP tool to call (e.g., "get_blog_posts", "get_cv")'
      }
    },
    required: ['query']
  },
  execute: async (args, ctx) => { ... }
};
```

#### 1.2 MCP Client Implementation (Inline in Tool)

Since tools execute in workflow context without persistent state, we'll inline a lightweight MCP client:

```typescript
async function callDuyetMcp(toolName: string, args: Record<string, unknown>): Promise<string> {
  const MCP_URL = 'https://mcp.duyet.net/sse';
  const TIMEOUT_MS = 8000;

  // 1. Connect to MCP SSE endpoint
  // 2. List available tools
  // 3. Call specified tool
  // 4. Return result
}
```

#### 1.3 Tool Filter (Reuse from DuyetInfoAgent)

```typescript
function duyetToolFilter(toolName: string): boolean {
  const patterns = [
    /blog/i, /post/i, /article/i, /tag/i, /categor/i,
    /about/i, /cv/i, /contact/i, /info/i, /bio/i,
    /profile/i, /experience/i, /skill/i, /education/i,
  ];
  return patterns.some(p => p.test(toolName));
}
```

#### 1.4 Query-to-Tool Mapping

```typescript
function inferMcpTool(query: string): string {
  const lower = query.toLowerCase();

  if (/blog|post|article|latest|recent/.test(lower)) {
    return 'get_latest_posts';  // or 'search_blog'
  }
  if (/cv|resume|experience|work/.test(lower)) {
    return 'get_cv';
  }
  if (/skill|expertise|know/.test(lower)) {
    return 'get_skills';
  }
  if (/contact|email|reach/.test(lower)) {
    return 'get_contact';
  }
  // Default: search
  return 'search';
}
```

#### 1.5 Error Handling

```typescript
const FALLBACK_RESPONSES = {
  blog: 'I couldn\'t fetch the latest blog posts. Visit blog.duyet.net directly.',
  info: 'I couldn\'t retrieve that information. Visit duyet.net for details.',
  default: 'The personal information service is temporarily unavailable.',
};
```

### Phase 2: Update Tool Registry

**File**: `packages/cloudflare-agent/src/agentic-loop/tools/index.ts`

```typescript
import { duyetMcpTool } from './duyet-mcp.js';
// Remove: import { memoryTool } from './memory.js';

export function createCoreTools(config?: CoreToolsConfig): LoopTool[] {
  const tools: LoopTool[] = [];

  tools.push(planTool);
  tools.push(researchTool);
  tools.push(duyetMcpTool);  // NEW: Replace memoryTool
  // tools.push(memoryTool);  // REMOVED
  tools.push(githubTool);

  if (config?.enableSubagents !== false && !config?.isSubagent) {
    tools.push(subagentTool);
  }

  tools.push(approvalTool);

  return tools;
}
```

### Phase 3: Remove memoryTool

1. Delete `packages/cloudflare-agent/src/agentic-loop/tools/memory.ts`
2. Update `packages/cloudflare-agent/src/agentic-loop/tools/index.ts` exports
3. Update tests

### Phase 4: Deprecate/Remove DuyetInfoAgent

**Option A: Keep for Backward Compatibility** (Recommended initially)
- DuyetInfoAgent continues to work for direct routing
- Queries routed via RouterAgent → DuyetInfoAgent still work
- gradual migration

**Option B: Remove Entirely**
- Remove from agent registry
- Remove from wrangler.toml DO bindings
- Update routing to use OrchestratorAgent with duyetMcpTool

**Recommendation**: Option A initially, then Option B after validation.

### Phase 5: Testing Strategy

#### Unit Tests

```typescript
// packages/cloudflare-agent/src/__tests__/duyet-mcp-tool.test.ts

describe('duyetMcpTool', () => {
  test('returns blog posts for blog query', async () => {
    const result = await duyetMcpTool.execute(
      { query: 'latest blog posts' },
      mockContext
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('blog');
  });

  test('handles MCP timeout gracefully', async () => {
    // Mock MCP to timeout
    const result = await duyetMcpTool.execute(
      { query: 'cv' },
      mockContext
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('duyet.net');  // Fallback message
  });

  test('filters to relevant tools only', async () => {
    const filtered = duyetToolFilter('get_blog_posts');
    expect(filtered).toBe(true);

    const notFiltered = duyetToolFilter('execute_shell');
    expect(notFiltered).toBe(false);
  });
});
```

#### Integration Tests

```typescript
// Test in workflow context
describe('AgenticLoopWorkflow with duyetMcpTool', () => {
  test('workflow can call duyet_info tool', async () => {
    // Create workflow with duyet query
    // Verify tool is called
    // Verify response contains duyet info
  });
});
```

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `tools/duyet-mcp.ts` | CREATE | New tool implementation (~200 LOC) |
| `tools/index.ts` | MODIFY | Replace memoryTool with duyetMcpTool |
| `tools/memory.ts` | DELETE | Remove stub tool |
| `__tests__/duyet-mcp-tool.test.ts` | CREATE | Unit tests for new tool |
| `__tests__/memory.test.ts` | DELETE | Remove stub tests |

## Implementation Order

1. **Create `duyet-mcp.ts`** with full MCP integration
2. **Add tests** for new tool
3. **Update `index.ts`** to use new tool
4. **Delete `memory.ts`** and its tests
5. **Run full test suite** (`bun run test`)
6. **Deploy** (`bun run deploy`)
7. **Validate** in Telegram/GitHub

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| MCP server unavailable | Medium | Low | Fallback responses |
| Tool discovery fails | Low | Medium | Hardcode known tools as fallback |
| Timeout issues | Medium | Low | Conservative 8s timeout, graceful degradation |
| Breaking DuyetInfoAgent | Low | Medium | Keep agent initially (Option A) |

## Success Criteria

1. ✅ `bun run test` passes with no regressions
2. ✅ Telegram bot responds to "who is duyet" via workflow
3. ✅ Blog posts are fetched correctly
4. ✅ Graceful fallback on MCP failures
5. ✅ No DuyetInfoAgent changes required initially

## Timeline Estimate

| Phase | Effort |
|-------|--------|
| Phase 1: Create tool | 1-2 hours |
| Phase 2: Update registry | 15 min |
| Phase 3: Remove memoryTool | 15 min |
| Phase 4: Deprecate agent | Future iteration |
| Phase 5: Testing | 30 min |
| **Total** | **~2-3 hours** |

---

## Appendix: MCP SSE Protocol

The Duyet MCP server uses SSE (Server-Sent Events) protocol:

```
GET https://mcp.duyet.net/sse
Accept: text/event-stream

# Events:
event: tools
data: {"tools": [...]}

event: result
data: {"result": "..."}
```

For tool calls:
```
POST https://mcp.duyet.net/sse
Content-Type: application/json

{
  "method": "tools/call",
  "params": {
    "name": "get_blog_posts",
    "arguments": {}
  }
}
```
