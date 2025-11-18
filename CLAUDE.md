# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**duyetbot-agent** is an autonomous bot agent system built on the Claude Agent SDK, designed to run on Cloudflare Workers. It provides a background task execution system with a simple web UI for task management and scheduling.

### Core Capabilities
- Multi-LLM provider support (OpenAI, Claude, OpenRouter)
- Background task execution with scheduling
- Sub-agent system with custom model configuration
- Markdown-based configuration for tasks, tools, and agents
- Natural language task input and automatic task creation
- Cloudflare Workers deployment with Sandbox SDK integration

## Architecture

### Technology Stack
- **Runtime**: Cloudflare Workers
- **Sandbox**: Cloudflare Sandbox SDK for containerized execution
- **Agent Framework**: Claude Agent SDK (@anthropic-ai/claude-agent-sdk)
- **Language**: TypeScript
- **Storage**: Cloudflare KV/D1 for task persistence
- **UI**: Minimal web interface (inspired by homelab.duyet.net, insights.duyet.net)

### Core Components

**1. Agent Core** (`src/agent/`)
- Multi-provider LLM integration with unified interface
- Provider format: `<provider>:<model_id>` (e.g., `claude:claude-3-5-sonnet-20241022`, `openai:gpt-4`)
- Session management and state tracking
- Tool execution engine

**2. Tools System** (`src/tools/`)
Built-in tools include:
- `bash`: Execute shell commands in sandboxed environment
- `git`: Git operations (clone, commit, push, pull, etc.)
- `research`: Web research and information gathering
- `plan`: Task planning and decomposition
- `sleep`: Delay execution for scheduling
- Custom tools defined via markdown configuration

**3. Sub-Agent System** (`src/agents/`)
- Hierarchical agent architecture
- Per-agent model configuration
- Specialized agents for specific domains
- Configured via markdown files in `agents/` directory

**4. Task Scheduler** (`src/scheduler/`)
- Background task execution
- Cron-like scheduling support
- Task queue with priority management
- Natural language task parsing using LLM

**5. Configuration Parser** (`src/config/`)
- Markdown-based configuration format
- Dynamic tool/agent loading
- Validation and schema enforcement

**6. Web UI** (`src/ui/`)
- Task input and management interface
- Schedule visualization
- Execution logs and status
- Simple, clean design pattern (reference: homelab.duyet.net)

**7. Cloudflare Workers Entry** (`src/index.ts`)
- HTTP API endpoints
- Worker request routing
- Sandbox lifecycle management

### Configuration Format

#### Agent Configuration (`agents/*.md`)
```markdown
# Agent Name

## Description
Brief description of agent purpose

## Model
<provider>:<model_id>

## Tools
- tool1
- tool2

## Prompt
System prompt for this agent
```

#### Task Configuration (`tasks/*.md`)
```markdown
# Task Name

## Schedule
cron expression or natural description

## Agent
agent-name or <provider>:<model_id>

## Input
Task description or prompt
```

## Development Commands

### Setup
```bash
npm install
```

### Development
```bash
npm run dev                  # Start local development server (port 8787)
npm run build               # Build for production
npm run type-check          # TypeScript type checking
```

### Testing
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests
```

### Deployment
```bash
npm run deploy              # Deploy to Cloudflare Workers
npm run deploy:staging      # Deploy to staging environment
```

### Linting
```bash
npm run lint                # ESLint check
npm run lint:fix            # Auto-fix linting issues
npm run format              # Prettier formatting
```

## Development Workflow

### IMPORTANT: Maintaining PLAN.md

**PLAN.md is a living document that tracks project progress. You MUST maintain it throughout development.**

#### Before Starting Work
1. **Always read PLAN.md first** to understand:
   - Current phase and tasks
   - Dependencies between tasks
   - Overall project status
   - What has been completed

#### During Development
1. **Check off completed tasks** in PLAN.md using `[x]` syntax
   - Mark tasks complete as soon as they're done
   - Don't batch updates - update immediately
2. **Update task status** if you discover:
   - Tasks are more complex than estimated
   - Additional subtasks are needed
   - Dependencies have changed

#### After Completing Work
1. **Update PLAN.md** with:
   - Mark completed tasks with `[x]`
   - Add any new tasks discovered during implementation
   - Update estimates if timeline has changed
   - Document any architectural decisions that affect future phases
2. **Update the Revision History** table at the bottom of PLAN.md
3. **Commit PLAN.md** along with your code changes

#### Adding New Items
When you discover new requirements or tasks:
1. Add them to the appropriate phase in PLAN.md
2. If it doesn't fit existing phases, create a new section
3. Update dependencies and timeline estimates
4. Document the rationale for the addition

#### Example Workflow
```bash
# 1. Read the plan
cat PLAN.md

# 2. Work on your task
# ... implement feature ...

# 3. Update PLAN.md (mark task complete, add new discoveries)
# ... edit PLAN.md ...

# 4. Commit both code and updated plan
git add src/ PLAN.md
git commit -m "feat: implement feature X

- Completed Phase 2, Task 2.1
- Added new subtask for error handling (Phase 2, Task 2.4)
- Updated PLAN.md with progress"
```

**Remember**: PLAN.md is the source of truth for project progress. Keep it updated so you and future Claude instances can track what's done and what's next.

## Key Architectural Patterns

### 1. Multi-Provider LLM Integration

The system abstracts different LLM providers behind a unified interface:

```typescript
interface LLMProvider {
  query(prompt: string, options: QueryOptions): AsyncGenerator<SDKMessage>
  configure(config: ProviderConfig): void
}
```

Provider selection uses format `<provider>:<model_id>`:
- `claude:claude-3-5-sonnet-20241022`
- `openai:gpt-4-turbo`
- `openrouter:anthropic/claude-3.5-sonnet`

### 2. Tool Architecture

Tools follow the Agent SDK pattern with Zod schemas:

```typescript
tool(
  name: string,
  description: string,
  inputSchema: ZodSchema,
  handler: (input: z.infer<typeof inputSchema>) => Promise<ToolResult>
)
```

All tools must be sandboxed and handle errors gracefully.

### 3. Task Execution Flow

1. User inputs task via UI (text or structured)
2. NLP parsing extracts intent, schedule, and requirements
3. Task stored in KV/D1 with metadata
4. Scheduler triggers execution based on schedule
5. Agent executes with appropriate tools
6. Results persisted and displayed in UI

### 4. Sub-Agent Delegation

Parent agents can spawn sub-agents for specialized tasks:
- Research agent → Web search sub-agent
- Development agent → Testing sub-agent + Review sub-agent

Sub-agents inherit tools but can override model configuration.

### 5. Cloudflare Workers Integration

The worker handles multiple concerns:
- API endpoints for UI (`/api/*`)
- Task execution triggers (`/execute/*`)
- Webhook receivers (`/webhook/*`)
- Static asset serving for UI

Uses Cloudflare Sandbox SDK for isolated execution environments.

## Configuration Management

### Environment Variables
```
ANTHROPIC_API_KEY=<key>
OPENAI_API_KEY=<key>
OPENROUTER_API_KEY=<key>
DATABASE_URL=<d1-binding>
KV_NAMESPACE=<kv-binding>
AUTH_SECRET=<secret>
```

### Wrangler Configuration (`wrangler.jsonc`)
- Define KV namespaces for task storage
- D1 bindings for relational data
- Environment-specific variables
- Compatibility dates

## UI Design Principles

Follow the design patterns from homelab.duyet.net and insights.duyet.net:
- **Minimalist**: Clean, uncluttered interface
- **Dark mode first**: Dark theme as default
- **Monospace typography**: Code-friendly fonts
- **Grid layouts**: Card-based task display
- **Real-time updates**: Live execution status
- **Mobile responsive**: Works on all screen sizes

## Security Considerations

1. **Sandbox Isolation**: All code execution happens in Cloudflare Sandboxes
2. **API Key Management**: Store provider keys in Cloudflare Secrets
3. **Authentication**: Implement auth for UI access
4. **Rate Limiting**: Prevent abuse of LLM APIs
5. **Input Validation**: Sanitize all user inputs
6. **Tool Permissions**: Explicit approval for destructive operations

## Testing Strategy

### Unit Tests
- Tool implementations
- Configuration parsers
- LLM provider adapters
- Scheduler logic

### Integration Tests
- End-to-end task execution
- Multi-agent workflows
- API endpoint responses
- Cloudflare Workers environment

### Manual Testing Checklist
- Task creation via natural language
- Schedule parsing and execution
- Sub-agent spawning
- Multi-provider LLM switching
- UI interactions
- Error handling and recovery

## Deployment Process

1. **Build**: `npm run build` creates production bundle
2. **Test**: Ensure all tests pass
3. **Deploy**: `npm run deploy` pushes to Cloudflare Workers
4. **Verify**: Check health endpoint `/health`
5. **Monitor**: Watch logs via `wrangler tail`

Initial deployment requires ~2-3 minutes for Docker container provisioning.

## Common Development Patterns

### Adding a New Tool
1. Create tool definition in `src/tools/<name>.ts`
2. Implement with Zod schema and handler
3. Register in tool registry
4. Add tests in `src/tools/__tests__/<name>.test.ts`
5. Document in markdown config example

### Creating a Sub-Agent
1. Define agent config in `agents/<name>.md`
2. Specify model, tools, and prompt
3. Register in agent system
4. Test delegation from parent agent

### Implementing a New LLM Provider
1. Create adapter in `src/providers/<name>.ts`
2. Implement `LLMProvider` interface
3. Add provider config parsing
4. Update provider registry
5. Add integration tests

## File Organization

```
duyetbot-agent/
├── src/
│   ├── index.ts              # Cloudflare Workers entry point
│   ├── agent/                # Core agent logic
│   │   ├── core.ts
│   │   ├── session.ts
│   │   └── executor.ts
│   ├── tools/                # Tool implementations
│   │   ├── bash.ts
│   │   ├── git.ts
│   │   ├── research.ts
│   │   └── ...
│   ├── providers/            # LLM provider adapters
│   │   ├── claude.ts
│   │   ├── openai.ts
│   │   └── openrouter.ts
│   ├── agents/               # Sub-agent system
│   │   ├── registry.ts
│   │   └── loader.ts
│   ├── scheduler/            # Task scheduling
│   │   ├── scheduler.ts
│   │   ├── queue.ts
│   │   └── parser.ts
│   ├── config/               # Configuration parsing
│   │   ├── markdown.ts
│   │   └── validator.ts
│   ├── storage/              # KV/D1 persistence
│   │   ├── tasks.ts
│   │   └── sessions.ts
│   └── ui/                   # Web interface
│       ├── app.tsx
│       ├── components/
│       └── styles/
├── agents/                   # Agent configurations
│   ├── researcher.md
│   ├── developer.md
│   └── ...
├── tasks/                    # Task templates
│   └── examples/
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
├── tsconfig.json
├── wrangler.jsonc
└── README.md
```

## Debugging

### Local Development
```bash
npm run dev                 # Start local server
wrangler tail               # Stream logs
```

### Common Issues
- **Container timeout**: Increase timeout in wrangler.jsonc
- **Memory limit**: Adjust container resources
- **API rate limits**: Implement exponential backoff
- **Tool failures**: Check sandbox permissions

### Logging
Use structured logging with context:
```typescript
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'info',
  component: 'scheduler',
  message: 'Task executed',
  metadata: { taskId, duration }
}))
```

## References

- [Claude Agent SDK Docs](https://docs.claude.com/en/docs/agent-sdk/typescript)
- [Cloudflare Sandbox SDK](https://github.com/cloudflare/sandbox-sdk)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Agent Engineering Blog](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
