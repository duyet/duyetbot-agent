/**
 * Agentic Loop Module
 *
 * Claude Code-style single-agent architecture for autonomous task execution.
 * Replaces multi-agent routing with a unified think-act-observe loop.
 *
 * ## Architecture
 *
 * ### Primary: Workflow-Based Execution (Recommended)
 *
 * The primary execution path uses Cloudflare Workflows for timeout-resistant execution:
 *
 * ```
 * User Query → CloudflareAgent DO
 *                 ↓
 *         Spawn AgenticLoopWorkflow (fire-and-forget)
 *                 ↓
 *         Workflow runs each iteration as a durable step
 *                 ↓
 *         Progress reported back to DO via HTTP
 *                 ↓
 *         DO edits user message with updates
 * ```
 *
 * Benefits:
 * - **No timeout risk**: Each iteration has 30s budget, unlimited total time
 * - **Automatic persistence**: State saved after each step
 * - **Built-in retries**: Exponential backoff on transient failures
 * - **Real-time updates**: Progress messages edit in-place
 *
 * ### Legacy: Synchronous Execution (Deprecated)
 *
 * Falls back to synchronous execution when workflow binding is unavailable.
 * Not recommended for production - subject to 30-second DO timeout.
 *
 * ## Core Components
 *
 * - **AgenticLoopWorkflow** (`workflow/`): Durable workflow for timeout-resistant execution
 * - **AgenticLoop** (`agentic-loop.ts`): Synchronous loop (legacy, deprecated)
 * - **Tools** (`tools/`): Built-in tools (plan, research, memory, github, subagent, approval)
 * - **Progress** (`progress.ts`): Real-time status updates
 *
 * ## Available Tools
 *
 * 1. **plan** - Task decomposition and planning
 * 2. **research** - Web search and synthesis
 * 3. **memory** - Personal information lookup via MCP
 * 4. **github** - GitHub API operations via MCP
 * 5. **subagent** - Delegate independent subtasks (one level max)
 * 6. **request_approval** - Human-in-the-loop approval
 *
 * ## Progress Updates
 *
 * Real-time status messages are sent to users during execution:
 *
 * - 🤔 Thinking... - LLM generating response
 * - 🔧 Running {tool}... - Tool execution started
 * - ✅ {tool} completed - Tool finished successfully
 * - ❌ {tool} failed - Tool error (with details)
 *
 * @module agentic-loop
 * @see {@link https://developers.cloudflare.com/workflows/} Cloudflare Workflows
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
