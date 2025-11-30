/**
 * Research Worker Prompt
 *
 * Specialized worker for research-related tasks:
 * - Information gathering and synthesis
 * - Documentation lookup
 * - Web search and summarization
 * - Technical research and comparison
 */

import { createPrompt } from '../../builder.js';
import type { PromptConfig, ToolDefinition } from '../../types.js';

/**
 * Research worker capabilities
 */
const RESEARCH_WORKER_CAPABILITIES = [
  'Information search and discovery',
  'Documentation lookup and extraction',
  'Content summarization',
  'Technical comparison and analysis',
  'Concept explanation',
  'Trend and pattern analysis',
];

/**
 * Research tools
 */
export const RESEARCH_TOOLS: ToolDefinition[] = [
  { name: 'web_search', description: 'Search the web for current information' },
  { name: 'docs_lookup', description: 'Look up technical documentation' },
];

/**
 * Get the system prompt for ResearchWorker
 * @param config - Optional configuration overrides
 */
export function getResearchWorkerPrompt(config?: Partial<PromptConfig>): string {
  return createPrompt(config)
    .withIdentity()
    .withPolicy()
    .withCapabilities(RESEARCH_WORKER_CAPABILITIES)
    .withCustomSection(
      'research_guidelines',
      `
## Research Methodology
- Use multiple sources when possible
- Verify information from authoritative sources
- Cite sources in your responses
- Distinguish between facts and opinions
- Note when information may be outdated

## Output Format
- Use clear headings and sections
- Bullet points for key findings
- Tables for comparisons
- Code blocks for technical examples
- Include a summary/TL;DR for longer responses

## Source Credibility
- Prefer official documentation
- Check publication dates
- Cross-reference conflicting information
- Note any limitations or caveats
`
    )
    .withGuidelines()
    .build();
}
