# @duyetbot/types

Shared TypeScript types for duyetbot-agent monorepo.

## Installation

```bash
pnpm add @duyetbot/types
```

## Usage

```typescript
import type { LLMProvider, LLMMessage, Tool, Session } from '@duyetbot/types';

// Or import specific modules
import type { ProviderConfig } from '@duyetbot/types/provider';
import type { ToolDefinition } from '@duyetbot/types/tool';
import type { AgentConfig } from '@duyetbot/types/agent';
```

## Exports

### Provider Types (`@duyetbot/types/provider`)
- `LLMProvider` - Unified interface for LLM providers
- `LLMMessage` - Message format
- `ProviderConfig` - Provider configuration
- `LLMResponse` - Provider response format

### Tool Types (`@duyetbot/types/tool`)
- `Tool` - Tool interface
- `ToolDefinition` - Tool metadata
- `ToolInput` / `ToolOutput` - Tool I/O types
- `ToolContext` - Execution context

### Agent Types (`@duyetbot/types/agent`)
- `AgentConfig` - Agent configuration
- `AgentState` - Agent execution state
- `AgentResult` - Execution results
- `AgentHooks` - Lifecycle hooks

### Session Types (`@duyetbot/types/session`)
- `Session` - Session data structure
- `SessionStorage` - Storage interface
- `SessionManager` - Management interface

### Message Types (`@duyetbot/types/message`)
- `ExtendedMessage` - Enhanced message format
- `ToolCallMessage` - Tool invocation messages
- `ToolResultMessage` - Tool result messages

## Development

```bash
# Build
pnpm run build

# Type check
pnpm run type-check

# Watch mode
pnpm run dev
```
