/**
 * Agentic Loop Module
 *
 * Claude Code-style single-agent architecture for autonomous task execution.
 * Replaces multi-agent routing with a unified think-act-observe loop.
 *
 * ## Architecture
 *
 * ```
 * User Query → AgenticLoop
 *                 │
 *                 ├─ Think (LLM generates response)
 *                 ├─ Act (Execute tool calls if needed)
 *                 ├─ Observe (Feed results back to LLM)
 *                 └─ Repeat until task complete
 * ```
 *
 * ## Core Components
 *
 * - **AgenticLoop** (`agentic-loop.ts`): Main execution loop with iteration limits and tool orchestration
 * - **Tools** (`tools/`): 6 built-in tools (plan, research, memory, github, subagent, approval)
 * - **Progress** (`progress.ts`): Real-time status updates (thinking, tool running, tool complete)
 * - **Transport** (`transport-adapter.ts`): Platform abstraction for message editing (Telegram/GitHub)
 * - **Integration** (`cloudflare-integration.ts`): CloudflareAgent wiring and feature flag support
 *
 * ## Key Features
 *
 * - **Real-time updates**: Progress messages edit in-place throughout execution
 * - **Tool execution**: Parallel tool calls when independent, sequential when dependent
 * - **Subagent support**: One-level delegation for parallel subtasks (recursion prevented)
 * - **Heartbeat integration**: Keeps Durable Objects alive during long operations
 * - **Feature flag**: `USE_AGENTIC_LOOP=true|false` toggles between new/old architecture
 *
 * ## Available Tools
 *
 * 1. **plan** - Task decomposition and planning (replaces OrchestratorAgent)
 * 2. **research** - Web search and synthesis (replaces LeadResearcherAgent + ResearchWorker)
 * 3. **memory** - Personal information lookup via MCP (replaces DuyetInfoAgent)
 * 4. **github** - GitHub API operations via MCP (replaces GitHubMCPAgent + GitHubWorker)
 * 5. **subagent** - Delegate independent subtasks (one level max, prevents recursion)
 * 6. **request_approval** - Human-in-the-loop approval (replaces HITLAgent)
 *
 * ## Progress Updates
 *
 * Real-time status messages are sent to users during execution:
 *
 * - 🤔 Thinking... - LLM generating response
 * - 🔧 Running {tool}... - Tool execution started
 * - ✅ {tool} completed - Tool finished successfully
 * - ❌ {tool} failed - Tool error (with details)
 * - 📝 Generating response... - Final response generation
 *
 * ## Feature Flag Control
 *
 * Set `USE_AGENTIC_LOOP=true` in `wrangler.toml` to enable (default).
 * Set `USE_AGENTIC_LOOP=false` to fall back to legacy multi-agent routing.
 *
 * Both telegram-bot and github-bot have this enabled by default.
 *
 * ## Usage
 *
 * ```typescript
 * import { runAgenticLoop } from '@duyetbot/cloudflare-agent/agentic-loop';
 *
 * const result = await runAgenticLoop({
 *   agent: cloudflareAgent,
 *   context: executionContext,
 *   transport: telegramTransport,
 *   provider: claudeProvider,
 *   tools: createCoreTools({ mcpClient }),
 * });
 * ```
 *
 * @module agentic-loop
 * @see {@link https://developers.cloudflare.com/agents/patterns/} Cloudflare Agent Patterns
 */

// Core implementation
export { AgenticLoop, createAgenticLoop } from './agentic-loop.js';
export type {
  AgenticLoopIntegrationConfig,
  AgenticLoopIntegrationResult,
} from './cloudflare-integration.js';
// CloudflareAgent integration
export {
  formatAgenticLoopResponse,
  runAgenticLoop,
  shouldUseAgenticLoop,
} from './cloudflare-integration.js';
// Progress tracking utilities
export { createProgressTracker, PROGRESS_MESSAGES, ProgressTracker } from './progress.js';
export type { TransportAdapter, TransportAdapterConfig } from './transport-adapter.js';
// Transport adapter for wiring progress to Telegram/GitHub
export {
  createSimpleProgressCallback,
  createTransportAdapter,
  formatProgressUpdate,
} from './transport-adapter.js';

export type {
  // Configuration
  AgenticLoopConfig,
  // Results
  AgenticLoopResult,
  // Context
  LoopContext,
  // LLM Messages
  LoopMessage,
  // Tool Definitions
  LoopTool,
  // Progress Tracking
  ProgressUpdate,
  ToolCall,
  // Tool Invocation History
  ToolInvocation,
  ToolParameters,
  ToolResult,
} from './types.js';

export { agenticLoopResultToAgentResult } from './types.js';
