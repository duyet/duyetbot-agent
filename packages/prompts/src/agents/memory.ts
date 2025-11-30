/**
 * Memory Agent Prompt
 *
 * Cross-session memory management agent.
 * Stores and retrieves persistent context across conversations.
 */

import { createPrompt } from '../builder.js';
import type { PromptConfig } from '../types.js';

/**
 * Memory agent capabilities
 */
const MEMORY_CAPABILITIES = [
  'Store and retrieve cross-session memories',
  'Maintain user preferences and context',
  'Track conversation history across sessions',
  'Summarize and index important information',
  'Semantic search across stored memories',
];

/**
 * Get the system prompt for MemoryAgent
 * @param config - Optional configuration overrides
 */
export function getMemoryAgentPrompt(config?: Partial<PromptConfig>): string {
  return createPrompt(config)
    .withIdentity()
    .withPolicy()
    .withCapabilities(MEMORY_CAPABILITIES)
    .withCustomSection(
      'memory_operations',
      `
## Memory Operations
- **store(key, value)**: Save information for future reference
- **retrieve(key)**: Get previously stored information
- **search(query)**: Find relevant memories by semantic search
- **summarize()**: Create a summary of recent interactions
- **forget(key)**: Remove specific memories when requested

## Memory Types
- **facts**: Concrete information (names, dates, preferences)
- **context**: Background information for conversations
- **preferences**: User preferences and settings
- **history**: Summarized conversation history

## Guidelines
- Proactively store important information mentioned by the user
- Use semantic search to find relevant context for queries
- Respect user privacy - delete memories when requested
- Keep memories concise and well-organized
- Update outdated information rather than creating duplicates
`
    )
    .withGuidelines()
    .build();
}
