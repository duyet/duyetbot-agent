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

## Building Effective Agents

This section documents key principles from Anthropic's engineering guide on building effective agents (December 2024). These patterns and recommendations inform the architecture of duyetbot-agent.

### Core Philosophy

**Start Simple, Add Complexity Only When Needed**
- Begin with simple prompts and direct API calls
- Add comprehensive evaluation before adding complexity
- Implement multi-step agentic systems only when simpler solutions fall short
- The most successful implementations use simple, composable patterns rather than complex frameworks

### Architectural Distinction

**Workflows vs Agents**
- **Workflows**: LLMs and tools orchestrated through predefined code paths (deterministic)
- **Agents**: LLMs dynamically direct their own processes and tool usage (autonomous)

Both are "agentic systems" but differ in control flow:
- Workflows = explicit orchestration
- Agents = LLM-driven decision making

### Five Workflow Patterns (Increasing Complexity)

#### 1. Prompt Chaining
**When to use**: Tasks can be decomposed into fixed, sequential subtasks

**Pattern**:
```
Input → LLM Step 1 → LLM Step 2 → LLM Step 3 → Output
```

**Trade-offs**:
- ✅ Higher accuracy through specialized prompts
- ✅ Easier to debug individual steps
- ❌ Increased latency (sequential processing)

**Example**: Document processing pipeline (extract → summarize → categorize)

#### 2. Routing
**When to use**: Different inputs require different specialized processing paths

**Pattern**:
```
Input → Classifier LLM → Route A (specialist LLM)
                      → Route B (specialist LLM)
                      → Route C (specialist LLM)
```

**Benefits**:
- Separation of concerns
- Specialized prompts for each domain
- More efficient than single general-purpose prompt

**Example**: Customer service routing (technical → billing → general inquiry)

#### 3. Parallelization
**When to use**: Independent subtasks can run concurrently OR diversity/voting is needed

**Two variations**:

a) **Sectioning** - Break task into independent parallel subtasks:
```
Input → Split → [LLM 1] → Combine
              → [LLM 2] →
              → [LLM 3] →
```

b) **Voting** - Run same task multiple times for diverse outputs:
```
Input → [LLM attempt 1] → Vote/Aggregate → Output
      → [LLM attempt 2] →
      → [LLM attempt 3] →
```

**Example**: Analyzing different document sections simultaneously, or generating multiple solutions and selecting the best

#### 4. Orchestrator-Workers
**When to use**: Complex tasks requiring dynamic decomposition and synthesis

**Pattern**:
```
Input → Orchestrator LLM → Delegate to Worker 1 → Synthesize → Output
                         → Delegate to Worker 2 →
                         → Delegate to Worker 3 →
```

**Characteristics**:
- Central LLM dynamically breaks down tasks
- Workers are specialized for specific subtasks
- Orchestrator synthesizes worker results
- More flexible than fixed parallelization

**Example**: Research agent that decides which sources to query, delegates searches, then synthesizes findings

#### 5. Evaluator-Optimizer
**When to use**: Output quality can be iteratively improved through evaluation

**Pattern**:
```
Input → Generator LLM → Evaluator LLM → Is it good enough?
          ↑                                  ↓ No
          └──────── Refine ─────────────────┘
                                             ↓ Yes
                                          Output
```

**Use cases**:
- Code generation with review loops
- Content creation with quality checks
- Optimization problems with scoring

**Example**: Generate SQL query → Validate syntax/logic → Refine if needed → Return valid query

### Building Blocks

**The Foundation**: LLM + Augmentations
- **Retrieval**: RAG, search, knowledge bases
- **Tools**: API calls, code execution, external services
- **Memory**: Conversation history, session state, long-term storage

**Modern Capability**: LLMs can now actively use these building blocks:
- Generate their own search queries
- Select appropriate tools dynamically
- Determine what information to retain

### Implementation Recommendations

#### Start with Direct API Calls
```typescript
// ✅ Good: Simple, composable, debuggable
const response = await llm.query(messages);

// ❌ Avoid: Complex frameworks for simple tasks
const agent = new ComplexFramework({ autonomous: true, ... });
```

#### Compose Patterns as Needed
- Patterns can be combined (e.g., routing + parallelization)
- Build incrementally based on evaluation results
- Keep code paths explicit where possible

#### Use Model Context Protocol (MCP)
- Standardized tool integration
- Growing ecosystem of third-party tools
- Simple client implementation
- Enables tool reuse across agents

#### Evaluation-Driven Development
1. Define success criteria
2. Build simple solution
3. Evaluate comprehensively
4. Add complexity only if metrics improve
5. Repeat

### Anti-Patterns to Avoid

❌ **Over-engineering**: Adding autonomous agents when workflows suffice
❌ **Framework lock-in**: Using complex frameworks for simple orchestration
❌ **Premature optimization**: Building multi-agent systems before validating simpler approaches
❌ **Missing evaluation**: Adding complexity without measuring improvement
❌ **Ignoring latency**: Chaining LLM calls without considering user experience

### When to Use What

| Pattern | Best For | Avoid When |
|---------|----------|------------|
| **Simple Prompt** | Single-step tasks, fast responses | Task requires multiple specialized steps |
| **Prompt Chaining** | Sequential multi-step tasks | Steps are independent (use parallelization) |
| **Routing** | Multiple specialized domains | All inputs need same processing |
| **Parallelization** | Independent subtasks, voting/diversity | Tasks have dependencies |
| **Orchestrator-Workers** | Dynamic task decomposition | Task structure is predictable |
| **Evaluator-Optimizer** | Iterative quality improvement | Quality metrics unclear |
| **Autonomous Agents** | Truly unpredictable workflows | Workflow can be predefined |

### Application to duyetbot-agent

This project implements these patterns:

1. **Workflow Patterns**: Task scheduler uses orchestrator-worker pattern
2. **Tool System**: Building blocks approach (bash, git, plan, research tools)
3. **Sub-Agents**: Hierarchical agents with specialized prompts (evaluator pattern for code review)
4. **Routing**: Different task types routed to appropriate agents
5. **Evaluation**: Comprehensive test coverage before adding complexity

**Design Decision**: Start with workflows (explicit orchestration) before adding autonomous agents. Most use cases can be solved with composable workflow patterns.

### References

- [Anthropic: Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) (December 2024)
- [Anthropic Cookbook: Agent Patterns](https://github.com/anthropics/anthropic-cookbook/tree/main/patterns/agents)
- [Model Context Protocol](https://www.anthropic.com/news/model-context-protocol)

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

### Linting and Formatting
```bash
npm run lint                # Biome check
npm run lint:fix            # Auto-fix linting issues
npm run format              # Format code with Biome
npm run check               # Run all checks (lint + type-check)
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

### 5. Streaming vs Single Mode

The Claude Agent SDK supports two input modes for agent execution:

**Streaming Mode (Recommended)**
- Long-lived process with continuous interaction
- Full access to all tools and custom MCP servers
- Attach images directly to messages
- Send multiple messages sequentially with interrupt capability
- See responses as they're generated (real-time feedback)
- Use lifecycle hooks for customization
- Maintain conversation context across turns naturally

**Single Mode**
- Simple, one-shot execution
- Best for batch processing or deterministic runs
- Limited tool access
- No interruption support
- Final results only (no real-time streaming)

**When to Use What:**
- **Streaming**: Interactive workflows, development, UI applications, real-time feedback
- **Single**: Automation scripts, batch jobs, simple deterministic tasks

**Implementation in duyetbot-agent:**
```typescript
// Streaming mode (default for UI and interactive tasks)
const agent = createAgent({
  prompt: async function* (messages) {
    // Async generator for streaming
    for await (const message of messages) {
      yield* handleMessage(message);
    }
  },
  tools: [bashTool, gitTool, planTool],
});

// Single mode (for scheduled background tasks)
const result = await agent.query(singleMessage, { mode: 'single' });
```

**Design Decision**: Use streaming mode for all UI interactions and real-time tasks. Use single mode only for scheduled background jobs that don't require user interaction.

### 6. Cloudflare Workers Integration

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
