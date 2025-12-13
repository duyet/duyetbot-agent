# MCP Tool Naming Convention & Auto-Discovery

## Overview

Implement a standardized tool naming convention `<mcp>__<tool>` for all MCP-sourced tools and enable agent auto-discovery of available MCPs and their tools.

## Goals

1. **Consistent naming**: All MCP tools follow `<mcp>__<tool>` format (e.g., `duyet__get_cv`, `memory__save`)
2. **Auto-discovery**: Agent can discover MCPs and tools at runtime
3. **Transparency**: Agent can list all MCPs and available tools to user
4. **Clean separation**: Built-in tools remain without prefix, MCP tools have prefix

## Current State Analysis

### Existing Tools
| Tool | Type | Current Name | New Name |
|------|------|--------------|----------|
| plan | Built-in | `plan` | `plan` (no change) |
| research | Built-in | `research` | `research` (no change) |
| subagent | Built-in | `subagent` | `subagent` (no change) |
| request_approval | Built-in | `request_approval` | `request_approval` (no change) |
| github | Built-in | `github` | `github` (no change) |
| memory_save | MCP wrapper | `memory_save` | `memory__save` |
| memory_recall | MCP wrapper | `memory_recall` | `memory__recall` |
| memory_search | MCP wrapper | `memory_search` | `memory__search` |
| duyet_info | MCP wrapper | `duyet_info` | `duyet__info` |
| - | External MCP | - | `duyet__get_cv` |
| - | External MCP | - | `duyet__get_skills` |
| - | External MCP | - | `duyet__get_latest_posts` |
| - | External MCP | - | `github__list_pr` |
| - | External MCP | - | `github__get_issues` |

### Naming Convention Rules

1. **Built-in tools**: No prefix, `snake_case` (e.g., `plan`, `research`, `subagent`)
2. **MCP tools**: `<mcp>__<tool>` format using double underscore separator
   - MCP name: lowercase, no underscores (e.g., `duyet`, `memory`, `github`)
   - Tool name: `snake_case` (e.g., `get_cv`, `save`, `list_pr`)
3. **Examples**:
   - `duyet__get_cv` - Get Duyet's CV from duyet MCP
   - `memory__save` - Save to memory via memory MCP
   - `github__list_pr` - List PRs via GitHub MCP

## Architecture

### 1. MCP Registry (`packages/cloudflare-agent/src/mcp-registry/`)

```
mcp-registry/
├── index.ts           # Main exports
├── types.ts           # Type definitions
├── registry.ts        # MCPRegistry class
├── discovery.ts       # Tool discovery logic
├── naming.ts          # Naming convention utilities
└── __tests__/
    ├── registry.test.ts
    ├── discovery.test.ts
    └── naming.test.ts
```

### 2. Key Types

```typescript
// types.ts
export interface MCPServerConfig {
  name: string;              // e.g., "duyet", "memory", "github"
  displayName: string;       // e.g., "Duyet Personal Info", "Memory Service"
  url: string;               // MCP server URL
  enabled: boolean;          // Runtime enable/disable
  requiresAuth?: boolean;    // Requires authentication
  description?: string;      // Human description
}

export interface MCPToolDefinition {
  mcpName: string;           // Source MCP (e.g., "duyet")
  originalName: string;      // Original tool name (e.g., "get_cv")
  prefixedName: string;      // Prefixed name (e.g., "duyet__get_cv")
  description: string;       // Tool description
  parameters: ToolParameters; // JSON Schema parameters
}

export interface MCPRegistry {
  servers: Map<string, MCPServerConfig>;
  tools: Map<string, MCPToolDefinition>;

  // Discovery
  discoverTools(mcpName: string): Promise<MCPToolDefinition[]>;
  discoverAllTools(): Promise<MCPToolDefinition[]>;

  // Lookup
  getServer(name: string): MCPServerConfig | undefined;
  getTool(prefixedName: string): MCPToolDefinition | undefined;
  getToolsByMcp(mcpName: string): MCPToolDefinition[];

  // Listing
  listServers(): MCPServerConfig[];
  listTools(): MCPToolDefinition[];
  listToolsByCategory(): Record<string, MCPToolDefinition[]>;
}
```

### 3. Naming Utilities

```typescript
// naming.ts
export const MCP_SEPARATOR = '__';

export function formatMcpToolName(mcpName: string, toolName: string): string {
  return `${mcpName}${MCP_SEPARATOR}${toolName}`;
}

export function parseMcpToolName(prefixedName: string): { mcpName: string; toolName: string } | null {
  if (!prefixedName.includes(MCP_SEPARATOR)) return null;
  const [mcpName, ...rest] = prefixedName.split(MCP_SEPARATOR);
  return { mcpName, toolName: rest.join(MCP_SEPARATOR) };
}

export function isMcpTool(name: string): boolean {
  return name.includes(MCP_SEPARATOR);
}

export function isBuiltinTool(name: string): boolean {
  return !isMcpTool(name);
}
```

### 4. Integration Points

#### A. CloudflareChatAgent modifications
- Add `MCPRegistry` initialization in `onStart()`
- Register MCPs and discover tools
- Pass prefixed tools to AgenticLoop
- Add `list_mcps` and `list_tools` commands

#### B. AgenticLoop modifications
- Accept tools with prefixed names
- Route tool calls to appropriate MCP
- Handle dynamic tool loading

#### C. Built-in tool updates
- Update `memory.ts` to use prefixed names
- Update `duyet-mcp.ts` to use prefixed names
- Keep backward compatibility during transition

## Implementation Plan

### Phase 1: Core Infrastructure (Package 1)

**Files to create/modify:**
- `packages/cloudflare-agent/src/mcp-registry/types.ts`
- `packages/cloudflare-agent/src/mcp-registry/naming.ts`
- `packages/cloudflare-agent/src/mcp-registry/registry.ts`
- `packages/cloudflare-agent/src/mcp-registry/index.ts`

**Deliverables:**
- [ ] MCPRegistry class with server/tool registration
- [ ] Naming utilities (format, parse, validate)
- [ ] Type definitions for MCP tools
- [ ] Unit tests (80%+ coverage)

### Phase 2: Tool Discovery (Package 2)

**Files to create/modify:**
- `packages/cloudflare-agent/src/mcp-registry/discovery.ts`
- `packages/cloudflare-agent/src/mcp-registry/__tests__/discovery.test.ts`

**Deliverables:**
- [ ] Tool discovery via MCP protocol (tools/list)
- [ ] Parallel discovery from multiple MCPs
- [ ] Caching for discovered tools
- [ ] Error handling and fallbacks
- [ ] Unit tests

### Phase 3: Update Existing Tools (Package 3)

**Files to modify:**
- `packages/cloudflare-agent/src/agentic-loop/tools/memory.ts`
- `packages/cloudflare-agent/src/agentic-loop/tools/duyet-mcp.ts`
- `packages/cloudflare-agent/src/agentic-loop/tools/index.ts`

**Deliverables:**
- [ ] Update tool names to prefixed format
- [ ] Update tool descriptions to mention MCP source
- [ ] Add helper to get original tool name
- [ ] Backward compatibility shim (temporary)
- [ ] Update all tests

### Phase 4: Agent Integration (Package 4)

**Files to modify:**
- `packages/cloudflare-agent/src/cloudflare-agent.ts`
- `packages/cloudflare-agent/src/agentic-loop/workflow/executor.ts`

**Deliverables:**
- [ ] MCPRegistry initialization in CloudflareChatAgent
- [ ] Tool discovery on agent start
- [ ] Pass discovered tools to AgenticLoop
- [ ] Route tool calls by prefix
- [ ] Integration tests

### Phase 5: Agent Commands (Package 5)

**Files to create/modify:**
- `packages/cloudflare-agent/src/commands/list-mcps.ts`
- `packages/cloudflare-agent/src/commands/list-tools.ts`
- `packages/cloudflare-agent/src/commands/index.ts`

**Deliverables:**
- [ ] `/list_mcps` command - show all registered MCPs
- [ ] `/list_tools` command - show all available tools
- [ ] `/list_tools <mcp>` - show tools for specific MCP
- [ ] Natural language: "list all tools", "what tools do you have"
- [ ] Unit tests

## Testing Strategy

### Unit Tests
- Naming utilities (parse, format, validate)
- Registry operations (add, get, list)
- Discovery mocking (MCP protocol)

### Integration Tests
- End-to-end tool discovery
- Tool execution with prefixed names
- Error handling and fallbacks

### Prompt Evaluation
- Agent correctly lists MCPs
- Agent correctly lists tools
- Agent selects appropriate tool by prefix

## Migration Strategy

1. **Phase 1**: Add new naming alongside old (backward compat)
2. **Phase 2**: Update all tool references to use new names
3. **Phase 3**: Deprecate old names (warning in logs)
4. **Phase 4**: Remove old names

## Success Criteria

- [ ] All MCP tools use `<mcp>__<tool>` naming
- [ ] Agent can list all MCPs with descriptions
- [ ] Agent can list all tools with descriptions
- [ ] Agent auto-discovers tools on startup
- [ ] All tests pass
- [ ] Documentation updated

## Timeline Estimate

- Phase 1: 30 mins (senior engineer)
- Phase 2: 30 mins (senior engineer)
- Phase 3: 45 mins (senior engineer)
- Phase 4: 45 mins (senior engineer)
- Phase 5: 30 mins (senior engineer)
- Testing: 30 mins (parallel)
- Total: ~3.5 hours with parallelization → ~2 hours actual
