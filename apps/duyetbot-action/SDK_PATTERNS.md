# Claude Agent SDK Usage Patterns

## Overview

The Claude Agent SDK (`@duyetbot/core`) provides a powerful framework for building AI agents with tools and subagents. duyetbot-action should leverage these features properly.

## Core Concepts

### 1. Subagents

Subagents are specialized AI agents that can be called for specific tasks. They have their own:
- **name**: Unique identifier
- **description**: What the subagent does
- **tools**: Array of tool names the subagent can use
- **prompt**: Custom system prompt (optional, defaults to provided prompt)
- **model**: Model to use (haiku, sonnet, opus, or custom)

**Predefined Subagents** (from `packages/core/src/sdk/subagent.ts`):

1. **`researcher`**
   - Description: "Research and gather information from web"
   - Tools: `['research', 'web_search', 'fetch_url']`
   - Model: `'haiku'`
   - Use for: Gathering information, documentation lookup

2. **`code_reviewer`**
   - Description: "Review code for quality, security, and best practices"
   - Tools: `['bash', 'git']`
   - Model: `'sonnet'`
   - Use for: Code review, quality checks

3. **`planner`**
   - Description: "Break down complex tasks into actionable steps"
   - Tools: `['plan']`
   - Model: `'haiku'`
   - Use for: Task planning, decomposition

4. **`git_operator`**
   - Description: "Perform git operations and manage version control"
   - Tools: `['git', 'bash']`
   - Model: `'haiku'`
   - Use for: Git operations, version management

5. **`github_agent`**
   - Description: "Interact with GitHub API for issues, PRs, and repositories"
   - Tools: `['github']`
   - Model: `'haiku'`
   - Use for: GitHub operations (comments, issues, PRs)

**Creating Custom Subagents**:

```typescript
import { createSubagent } from '@duyetbot/core/sdk';

const customAgent = createSubagent({
  name: 'my-specialist',
  description: 'Custom specialist for specific task',
  tools: ['github', 'bash'], // Tools this agent can use
  prompt: 'You are a specialist...', // Optional custom prompt
  model: 'sonnet', // Optional model override
});
```

### 2. Tools

Tools are functions the agent can call. The SDK supports:

**SDKTool Interface**:
```typescript
interface SDKTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  handler: (input: TInput) => Promise<TOutput>;
}
```

**Available Built-in Tools** (from `@duyetbot/tools`):

| Tool | Lines | Purpose |
|-------|-------|---------|
| `bash` | 200 | Shell command execution |
| `git` | 486 | Git operations |
| `github` | 463 | GitHub API operations |
| `research` | ~300 | Web search and research |
| `plan` | ~150 | Task planning |
| `read` | ~100 | File reading |
| `write` | ~150 | File writing |
| `edit` | ~200 | File editing |
| `search` | ~200 | Code search |
| `run_tests` | ~200 | Test execution |

**Total**: ~2485 lines of built-in tools

### 3. Query Options

**QueryOptions Interface** (`packages/core/src/sdk/options.ts`):

```typescript
interface QueryOptions {
  model?: ModelType;                    // haiku, sonnet, opus, or custom
  tools?: SDKTool[];                   // Tools available to agent
  systemPrompt?: string;                // System prompt
  permissionMode?: PermissionMode;       // 'default' | 'acceptEdits' | 'bypassPermissions'
  mcpServers?: MCPServerConfig[];       // MCP server connections
  agents?: SubagentConfig[];             // Subagent definitions
  sessionId?: string;                   // Session ID
  resume?: string;                      // Resume from session
  forkSession?: string;                  // Fork session
  maxTokens?: number;                    // Max tokens
  temperature?: number;                   // Temperature (0-2)
  timeout?: number;                       // Timeout (ms)
  metadata?: Record<string, unknown>;     // Custom metadata
  context?: {                            // Context management
    enabled?: boolean;
    maxTokens?: number;
    compactionThreshold?: number;
    preserveRecentMessages?: number;
    pruneToolResultsAfter?: number;
    maxToolResultLength?: number;
    persistOnCompaction?: boolean;
    summarizer?: SummarizerFn;
    persist?: PersistFn;
  };
}
```

## How duyetbot-action Should Use SDK

### Current Implementation

duyetbot-action currently uses SDK but **not fully leveraging**:

```typescript
// apps/duyetbot-action/src/agent/loop.ts
const messages = await query(task.description, {
  systemPrompt,
  tools: tools as never,  // ✅ Uses tools
  model: config.model,
  sessionId: task.id,
});
```

**Missing**:
- ❌ No subagents passed to `agents` parameter
- ❌ Self-improvement logic in code, not as subagents
- ❌ Direct GitHub API calls instead of using `github` tool

### Recommended Implementation

1. **Use Subagents for Specialized Tasks**:

```typescript
import { predefinedSubagents } from '@duyetbot/core/sdk';

const options = {
  tools: getPlatformTools('server'),
  agents: [
    predefinedSubagents.githubAgent,  // For GitHub operations
    predefinedSubagents.codeReviewer,  // For code review
    predefinedSubagents.planner,     // For planning
    // Custom self-improvement subagents:
    createSubagent({
      name: 'error_analyzer',
      description: 'Analyze and categorize errors',
      tools: ['bash', 'read'],
    }),
    createSubagent({
      name: 'verifier',
      description: 'Run verification checks',
      tools: ['bash', 'run_tests'],
    }),
  ],
};
```

2. **Use github Tool Instead of Direct API**:

```typescript
// ❌ Current: Direct Octokit calls
await octokit.rest.issues.createComment({
  owner,
  repo,
  issue_number: number,
  body: comment,
});

// ✅ Recommended: Use github tool
const result = await agent.useTool('github', {
  action: 'create_comment',
  params: {
    issue_number: number,
    body: comment,
  },
});
```

3. **Skills as System Prompts + Subagents**:

```typescript
// Instead of hardcoded error-analyzer.ts, use skill + subagent
const errorAnalysisSkill = `
# Error Analysis Skill

You are an error analysis specialist. Your role is to:
- Parse and categorize error messages
- Identify error patterns
- Suggest appropriate fixes

## When to use this skill:
- Task mentions "error", "failure", "bug", or "fix"
- Build/test/lint failures detected
- User requests error analysis
`;

// Pass as subagent with custom prompt
const errorAnalyzerAgent = createSubagent({
  name: 'error_analyzer',
  description: 'Analyze errors and suggest fixes',
  tools: ['bash', 'read', 'search'],
  prompt: errorAnalysisSkill,
});
```

## Migration Path

### Step 1: Replace Self-Improvement with Subagents

| Current (Hardcoded) | New (Subagent) | Lines Removed |
|---------------------|------------------|---------------|
| `error-analyzer.ts` | `error_analyzer` subagent | ~200 |
| `failure-memory.ts` | `error_memory` subagent | ~200 |
| `verification-loop.ts` | `verifier` subagent | ~200 |
| `auto-merge.ts` | `github_operator` subagent | ~200 |
| **Total** | **4 subagents** | **~800 lines** |

### Step 2: Replace Direct GitHub API Calls

| Module | Lines | Tool to Use |
|--------|-------|-------------|
| `github/operations/comments.ts` | ~150 | `github` tool |
| `github/operations/issues.ts` | ~200 | `github` tool |
| `github/operations/pulls.ts` | ~250 | `github` tool |
| `github/operations/labels.ts` | ~100 | `github` tool |
| `github/operations/branches.ts` | ~100 | `github` tool |
| `github/operations/commits.ts` | ~150 | `github` tool |
| `github/operations/tags.ts` | ~100 | `github` tool |
| `github/operations/status.ts` | ~100 | `github` tool |
| **Total** | **~1150 lines** | **All via `github` tool** |

### Step 3: Implement Skill System

Skills should be:
- **Markdown files** in `.claude/skills/`
- **Loaded dynamically** at runtime
- **Matched to triggers** (keywords, patterns)
- **Provide system prompts** for agent/subagent

**Example Skill Structure**:
```markdown
# error-analysis

## Triggers
- error, failure, bug, fix
- build failed, test failed, lint failed

## Description
Analyze errors and suggest fixes

## Subagent
```typescript
{
  name: 'error_analyzer',
  tools: ['bash', 'read', 'search'],
}
```

## Instructions
1. Parse error messages
2. Categorize by type
3. Suggest fixes

## Tools Required
- bash: For running build/test/lint
- read: For reading error logs
- search: For finding error patterns
```

## Best Practices

### 1. Use Subagents for Specialized Tasks

- ✅ **DO**: Use subagents for code review, research, planning
- ❌ **DON'T**: Hardcode specialized logic in main agent

### 2. Use Tools for Operations

- ✅ **DO**: Use `github` tool for all GitHub operations
- ❌ **DON'T**: Make direct Octokit calls
- ✅ **DO**: Use `bash` tool for shell commands
- ❌ **DON'T**: Use child_process directly

### 3. Use Skills for Behavior

- ✅ **DO**: Define behavior in .md skill files
- ❌ **DON'T**: Hardcode behavior in TypeScript
- ✅ **DO**: Load skills dynamically
- ❌ **DON'T**: Import behavior from .ts files

### 4. Leverage SDK Features

- ✅ **DO**: Pass subagents to `agents` parameter
- ✅ **DO**: Use `permissionMode` appropriately
- ✅ **DO**: Use `systemPrompt` for context
- ❌ **DON'T**: Bypass SDK features

## Subagent Registry

The SDK provides `SubagentRegistry` for managing subagents:

```typescript
import { createSubagentRegistry } from '@duyetbot/core/sdk';

const registry = createSubagentRegistry();

// Register custom subagents
registry.register('my_agent', createSubagent({...}));

// Get subagent by name
const agent = registry.get('my_agent');

// Filter tools for subagent
const tools = registry.filterTools(allTools, 'my_agent');
```

## Tool Filtering

Tools can be filtered for specific subagents:

```typescript
import { filterToolsForSubagent } from '@duyetbot/core/sdk';

const allowedTools = filterToolsForSubagent(allTools, {
  name: 'github_agent',
  tools: ['github', 'bash', 'git'],
});
```

## Summary

| Feature | Current | Recommended | Impact |
|---------|----------|--------------|---------|
| Subagents | ❌ Not used | ✅ Use extensively | -800 LOC |
| Tools | ✅ Used | ✅ All operations via tools | -1150 LOC |
| Skills | ❌ Not implemented | ✅ Dynamic skill system | + Flexibility |
| GitHub API | ❌ Direct calls | ✅ Via `github` tool | Consistency |
| Self-improvement | ❌ Hardcoded | ✅ As subagents | Generic |
