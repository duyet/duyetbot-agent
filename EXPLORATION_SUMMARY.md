# packages/core and packages/tools Structure Analysis

## Overview
The project has a monorepo structure with specialized packages for core agent logic and tool implementations. Both packages depend on a shared `@duyetbot/types` package and the Claude Agent SDK.

---

## 1. PACKAGES/CORE STRUCTURE

### Purpose
Core agent orchestration, session management, and MCP client integration.

### Files and Their Purpose

#### `/src/index.ts`
- **Purpose**: Barrel export for the package
- **Exports**: Agent functionality and MCP client
- **Note**: Session exports commented out (future implementation)

#### `/src/agent/index.ts`
- **Purpose**: Module index for agent functionality
- **Exports**: `core.ts` and `session.ts`
- **Note**: Executor module commented out (future)

#### `/src/agent/core.ts`
- **Purpose**: Main orchestration layer for agent execution
- **Key Class**: `Agent`
- **Key Exports**:
  - `AgentConfig` interface
  - `Agent` class

**Agent Class Methods**:
- Constructor takes `AgentConfig` containing provider, sessionManager, toolRegistry
- `getProvider()` - Get LLM provider
- `getSessionManager()` - Get session manager
- `getToolRegistry()` - Get tool registry
- `createSession(input)` - Create new session
- `getSession(id)` - Retrieve session
- `listSessions(filter?)` - List sessions with filtering
- `deleteSession(id)` - Delete session
- `sendMessage(sessionId, messages, options)` - Stream messages to LLM
- `addMessage(sessionId, message)` - Add message to session
- `executeTool(toolName, input)` - Execute tool directly
- `executeToolInSession(sessionId, toolName, input)` - Execute tool and track in session
- `pauseSession(sessionId, resumeToken?)` - Pause session
- `resumeSession(sessionId)` - Resume paused session
- `completeSession(sessionId)` - Mark session complete
- `failSession(sessionId, error)` - Mark session failed
- `cancelSession(sessionId)` - Cancel session
- `updateSessionMetadata(sessionId, metadata)` - Update session metadata

#### `/src/agent/session.ts`
- **Purpose**: Session types and in-memory session manager implementation
- **Key Types**:
  - `SessionState` = 'active' | 'paused' | 'completed' | 'failed' | 'cancelled'
  - `ToolResult` interface with name, status, output, error, timestamp
  - `Session` interface with id, state, createdAt, updatedAt, and optional provider, messages, metadata, error, toolResults, resumeToken, completedAt

- **Key Interfaces**:
  - `CreateSessionInput` - Input for creating sessions
  - `UpdateSessionInput` - Input for updating sessions
  - `SessionManager` - Interface for session management

- **Key Classes**:
  - `SessionError` - Custom error class for session operations
  - `InMemorySessionManager` - Full implementation for local development/testing
    - Generates unique IDs with timestamp + counter
    - Implements all SessionManager methods
    - Full state machine for session lifecycle
    - Supports filtering by state and metadata

#### `/src/mcp/client.ts`
- **Purpose**: Client for connecting to duyetbot memory MCP server
- **Key Exports**:
  - `MCPClientConfig` interface
  - `LLMMessage` interface (local copy)
  - `MemoryData` interface
  - `SaveMemoryResult` interface
  - `SearchResult` interface
  - `SessionListItem` interface
  - `AuthResult` interface
  - `MCPMemoryClient` class
  - `MCPClientError` class
  - `createMCPClient()` factory function

**MCPMemoryClient Methods**:
- `setToken(token)` - Set auth token
- `authenticate(githubToken)` - Authenticate with GitHub
- `getMemory(sessionId, options?)` - Get session memory
- `saveMemory(messages, options?)` - Save messages to memory
- `searchMemory(query, options?)` - Search across sessions
- `listSessions(options?)` - List available sessions

#### `/src/mcp/index.ts`
- **Purpose**: Module index for MCP client
- **Exports**: Everything from `client.ts`

### Key Patterns Used

**Dependency Injection Pattern**:
```typescript
// Agent constructor takes dependencies
constructor(config: AgentConfig) {
  this.provider = config.provider;
  this.sessionManager = config.sessionManager;
  this.toolRegistry = config.toolRegistry;
}
```

**Session State Machine**:
```
active → paused (with optional resumeToken)
       ↓
     complete (terminal)
       ↓
     failed (terminal)
       ↓
     cancelled (terminal)
```

**Streaming LLM Responses**:
- Uses async generators for streaming: `async *sendMessage(...): AsyncGenerator<LLMResponse>`
- Allows real-time streaming of LLM responses

**Tool Execution Tracking**:
- Tools can be executed directly or within a session context
- Session tracks tool results with metadata

---

## 2. PACKAGES/TOOLS STRUCTURE

### Purpose
Unified tool implementations for agent operations with standardized interface.

### Files and Their Purpose

#### `/src/index.ts`
- **Purpose**: Barrel export for all tools
- **Exports**: All tool implementations (sleep, plan, bash, git, research, registry, github)

#### `/src/registry.ts`
- **Purpose**: Central registry for managing all tools
- **Key Class**: `ToolRegistry`
- **Key Exports**: `ToolRegistry` class, singleton `toolRegistry` instance

**ToolRegistry Methods**:
- `register(tool, options?)` - Register single tool
- `registerAll(tools, options?)` - Register multiple tools
- `get(name)` - Get tool by name (throws if not found)
- `getAll()` - Get all registered tools
- `has(name)` - Check if tool registered
- `list()` - List all tool names
- `unregister(name)` - Unregister tool
- `clear()` - Clear all tools
- `execute(name, input)` - Execute tool by name
- `validate(name, input)` - Validate input for tool
- `filter(predicate)` - Filter tools by predicate
- `find(predicate)` - Find tool by predicate
- `getMetadata(name)` - Get tool metadata
- `getAllMetadata()` - Get metadata for all tools

#### `/src/bash.ts`
- **Purpose**: Execute shell commands in sandboxed environment
- **Class**: `BashTool implements Tool`
- **Input Schema**: Zod union supporting string or object with command, timeout, cwd, env
- **Max Command Length**: 50,000 characters
- **Default Timeout**: 30 seconds
- **Key Features**:
  - Flexible input: accepts raw string or structured object
  - Comprehensive error handling (timeout, non-zero exit, etc.)
  - Returns stdout, stderr, exit code, and duration in metadata
  - Validates input before execution
  - 10MB max buffer for output

#### `/src/git.ts`
- **Purpose**: Execute git version control operations
- **Class**: `GitTool implements Tool`
- **Supported Commands**: status, clone, commit, push, pull, add, diff, log, branch, checkout
- **Default Timeout**: 60 seconds
- **Features**:
  - Enum-based command routing for type safety
  - Specialized handling for each git operation
  - Builds git commands from options
  - Status parsing returns branch and file list
  - Branch command parsing extracts branch names
  - Error handling for non-zero exits (common in git)

#### `/src/plan.ts`
- **Purpose**: Create structured plans for complex tasks
- **Class**: `PlanTool implements Tool`
- **Max Task Length**: 5,000 characters
- **Features**:
  - Generates plan steps based on task description keywords
  - Estimates complexity (low, medium, high)
  - Special handling for migration tasks
  - Returns markdown-formatted plan
  - Provides estimated time for each step
  - Includes context and constraints support

**Step Generation Keywords**:
- build, create, develop → Research & Requirements
- api, architecture, system → Architecture & Design
- project, setup, initialize → Project Setup
- database, storage, persist → Database & Data Layer
- deploy, production, ci/cd, pipeline → Deployment Setup
- Special case: migrate/migration → 5-step migration plan

**Complexity Factors**:
- High: 7+ steps or keywords: migrate, architecture, distributed, scalable, enterprise, oauth, authentication
- Medium: 4+ steps or keywords: api, integration, database, deployment, ci/cd
- Low: Everything else

#### `/src/sleep.ts`
- **Purpose**: Delay execution for specified duration
- **Class**: `SleepTool implements Tool`
- **Input Schema**: Zod union supporting number or object with duration and unit
- **Max Duration**: 5 minutes
- **Units Supported**: milliseconds (default), seconds, minutes
- **Features**:
  - Supports AbortSignal for cancellation
  - Returns detailed timing metadata
  - Handles timeout properly

#### `/src/research.ts`
- **Purpose**: Web research and information gathering
- **Class**: `ResearchTool implements Tool`
- **Max Results**: 20, Default: 5
- **Cache TTL**: 5 minutes (in-memory simple cache)
- **Features**:
  - DuckDuckGo HTML scraping (no API key required)
  - URL content fetching and extraction
  - HTML cleaning and entity decoding
  - 10,000 character content limit
  - Relevance scoring based on result position
  - Simple regex-based HTML parsing

**Methods**:
- `search(query, maxResults)` - DuckDuckGo search with cache
- `searchDuckDuckGo(query, maxResults)` - Direct DuckDuckGo scraping
- `fetchUrl(url)` - Fetch and extract content
- `cleanHtml(text)` - Remove HTML entities and tags

#### `/src/github.ts`
- **Purpose**: GitHub API interactions for repository operations
- **Exports**:
  - `GitHubClient` interface (API client abstraction)
  - `RepoContext` interface (owner, repo)
  - `githubInputSchema` (Zod schema)
  - `createGitHubTool()` factory function (NOT a class)

**Supported Actions**:
- get_pr, get_issue, create_issue, update_issue
- create_comment, list_comments
- get_diff, get_file
- create_review
- get_workflow_runs, trigger_workflow
- add_labels, remove_labels
- merge_pr

**Unique Design**:
- Factory function that returns tool definition (not Tool class)
- Accepts external GitHubClient for flexibility
- Requires RepoContext to specify which repo operations affect
- Returns structured results with success/error status

### Key Patterns Used

**Standardized Tool Interface**:
```typescript
interface Tool extends ToolDefinition {
  execute(input: ToolInput): Promise<ToolOutput>;
  validate?(input: ToolInput): boolean;
  cleanup?(): Promise<void>;
  getState?(): Record<string, unknown>;
}
```

**Zod Input Validation**:
- Every tool uses Zod for input schema definition
- Schemas support flexible input formats (string or object)
- Safe parsing with proper error messages

**Flexible Input Handling**:
```typescript
// String shorthand
const bashInputSchema = z.union([
  z.string().transform(cmd => ({ command: cmd })),
  z.object({ command: z.string(), timeout: z.number().optional() })
]);
```

**Structured Error Responses**:
```typescript
{
  status: 'error',
  content: 'Human readable message',
  error: { message: 'Error details', code: 'ERROR_CODE' },
  metadata: { ... execution context ... }
}
```

**Metadata Tracking**:
- All tools return metadata with duration, command/action executed
- Tools support input.metadata.reason for audit trails
- Timing information included in all responses

**Singleton Exports**:
```typescript
export const bashTool = new BashTool();
export const gitTool = new GitTool();
// ... each tool exports a singleton instance
```

---

## 3. SHARED TYPES (packages/types)

### `/src/tool.ts`
**Exports**:
- `ToolStatus` = 'success' | 'error' | 'timeout' | 'cancelled'
- `ToolInput` - input content and metadata
- `ToolError` - error message, code, stack, metadata
- `ToolOutput` - status, content, error, metadata
- `Tool` interface with execute, validate, cleanup, getState
- `ToolExecutionError` class
- `ToolContext` - requestId, sessionId, userId, timeout, env, metadata
- `ToolRegistry`, `ToolExecutionResult`, `ToolHooks` interfaces

### `/src/provider.ts`
**Exports**:
- `MessageRole` = 'system' | 'user' | 'assistant'
- `LLMMessage`, `TokenUsage`, `StopReason`
- `LLMResponse` - content, model, provider, usage, stopReason
- `ProviderConfig` - provider, model, apiKey, temperature, maxTokens, etc.
- `QueryOptions` - model, temperature, maxTokens, stopSequences, stream
- `LLMProvider` interface - query (async generator), configure, validateConfig
- `LLMProviderError` class
- Parser utilities: `parseProviderFormat()`, `formatProvider()`

### `/src/message.ts`
**Exports**:
- `MessageSource` = 'user' | 'agent' | 'tool' | 'system'
- `MessagePriority` = 'low' | 'normal' | 'high' | 'urgent'
- `ExtendedMessage` - extends LLMMessage with id, source, priority, parentId, timestamp, tokens
- `ToolCallMessage` - assistant message with toolCalls array
- `ToolResultMessage` - user message with tool result
- `MessageFilter` - for querying message history
- `MessageHistory` - messages with pagination info

---

## 4. ARCHITECTURE PATTERNS

### 1. Dependency Injection
- Agent receives dependencies via constructor (provider, sessionManager, toolRegistry)
- Allows flexible testing and configuration

### 2. Registry Pattern
- ToolRegistry maintains central store of tools
- Tools can be registered, queried, and executed through registry
- Supports filtering and metadata retrieval

### 3. Plugin/Singleton Pattern
- Each tool is a class instance exported as singleton
- ToolRegistry manages instances
- Easy to add new tools by implementing Tool interface

### 4. Streaming vs Async
- LLM provider: async generators for streaming responses
- Tools: standard async/await for execution
- Allows real-time streaming of LLM responses with tool results

### 5. Validation Pattern
- Input validation happens in execute() method
- Optional validate() method for pre-execution checks
- Zod schemas define and document expected inputs

### 6. Error Handling
- Structured error objects with message, code, metadata
- Custom error classes (ToolExecutionError, SessionError, LLMProviderError)
- Proper error context preservation

### 7. Metadata Pattern
- All operations include metadata (timing, context, reasoning)
- Supports audit trails and debugging
- Flexible key-value metadata passed through execution chain

---

## 5. CURRENT STATE & GAPS

### What's Implemented
- Core Agent class with session management
- InMemorySessionManager (local development)
- Tool Registry with 7 tools (bash, git, plan, sleep, research, github, sleep)
- MCP Memory Client for persistence
- Session lifecycle management
- Tool execution tracking

### What's Missing/TODO
- LLM Provider implementations (commented out imports for @duyetbot/providers)
- File-based/persistent session storage (beyond in-memory)
- Executor module for complex agent workflows
- Full Claude Agent SDK integration patterns
- Streaming infrastructure for real-time responses
- Tool lifecycle hooks (beforeExecute, afterExecute, onError)

### Dependencies Already Added
- @anthropic-ai/claude-agent-sdk (v0.1.0) - in both packages
- zod (v3.23.8) - for schema validation
- TypeScript (v5.7.2) - for development

---

## 6. INTEGRATION POINTS FOR SDK

### LLM Provider Integration
```typescript
// Expected provider format in ProviderConfig
interface ProviderConfig {
  provider: string;   // 'claude' | 'openai' | 'openrouter'
  model: string;      // Model ID like 'claude-3-5-sonnet-20241022'
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
}
```

### Tool Execution Flow
```
Agent.executeToolInSession()
  ↓
ToolRegistry.execute(toolName, input)
  ↓
Tool.validate(input) [optional]
  ↓
Tool.execute(input)
  ↓
ToolOutput { status, content, error?, metadata? }
  ↓
SessionManager.update() [track result]
```

### Session & Memory Flow
```
Agent.createSession()
  ↓
SessionManager.create()
  ↓
Session { id, state, messages[], toolResults[] }
  ↓
MCPMemoryClient.saveMemory() [optional persistence]
  ↓
Session mutations via SessionManager
```

---

## Summary Table

| Component | File | Class | Purpose |
|-----------|------|-------|---------|
| **Core** | agent/core.ts | Agent | Orchestrates providers, sessions, tools |
| **Core** | agent/session.ts | InMemorySessionManager | Session lifecycle management |
| **Core** | mcp/client.ts | MCPMemoryClient | Memory persistence client |
| **Tools** | bash.ts | BashTool | Shell command execution |
| **Tools** | git.ts | GitTool | Git version control |
| **Tools** | plan.ts | PlanTool | Task planning |
| **Tools** | sleep.ts | SleepTool | Execution delays |
| **Tools** | research.ts | ResearchTool | Web research & fetching |
| **Tools** | github.ts | createGitHubTool() | GitHub API operations |
| **Tools** | registry.ts | ToolRegistry | Tool management |
| **Types** | tool.ts | - | Tool interfaces & types |
| **Types** | provider.ts | - | LLM provider interfaces |
| **Types** | message.ts | - | Extended message types |
