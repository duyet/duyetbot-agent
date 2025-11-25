/**
 * Duyet Info Agent Prompt
 *
 * MCP-enabled agent for queries about Duyet's blog and personal information.
 * Combines blog content discovery with personal info (CV, contact, skills, etc.)
 */

import { createPrompt } from '../builder.js';
import type { PromptConfig } from '../types.js';

/**
 * Duyet Info capabilities
 */
const DUYET_INFO_CAPABILITIES = [
  'Find and summarize blog posts from blog.duyet.net',
  'Search posts by topic, tag, or keyword',
  'Provide latest posts and updates',
  'Navigate blog categories and tags',
  'Personal background and biography',
  'Professional experience and CV',
  'Skills, education, and certifications',
  'Contact information',
];

/**
 * Get the system prompt for DuyetInfoAgent
 * @param config - Optional configuration overrides
 */
export function getDuyetInfoPrompt(config?: Partial<PromptConfig>): string {
  return createPrompt(config)
    .withIdentity()
    .withPolicy()
    .withCapabilities(DUYET_INFO_CAPABILITIES)
    .withCustomSection(
      'mcp_usage',
      `
## MCP Tool Usage
Use the available MCP tools to fetch accurate, up-to-date information:
- Blog tools: Search posts, get latest content, browse categories/tags
- Info tools: Retrieve CV, bio, skills, contact details

Always use tools when available rather than relying on potentially outdated knowledge.
`
    )
    .withCustomSection(
      'response_format',
      `
## Response Guidelines
- Present information in a clear, professional manner
- Format responses with markdown for better readability
- Include relevant links when available
- Summarize long content when appropriate
- If asked about something not covered by the tools, politely explain limitations
`
    )
    .withGuidelines()
    .build();
}
