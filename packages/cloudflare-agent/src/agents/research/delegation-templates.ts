/**
 * Delegation Templates
 *
 * Structured prompts for lead-to-subagent delegation.
 * Following Anthropic's principle: "Lead agents must provide objectives,
 * output formats, tool guidance, and clear task boundaries."
 */

import type { DelegationContext, SubagentType } from './types.js';

/**
 * Main delegation template
 * This is the core template used to delegate tasks to subagents
 */
export function buildDelegationPrompt(context: DelegationContext): string {
  const sections: string[] = [];

  // Objective section
  sections.push(`## Objective
${context.objective}`);

  // Output format section
  sections.push(`## Output Format
Your response MUST follow this format: ${context.outputFormat}

${getOutputFormatInstructions(context.outputFormat)}`);

  // Available tools section
  if (context.toolList.length > 0) {
    sections.push(`## Available Tools
${context.toolList.map((t) => `- ${t}`).join('\n')}`);
  }

  // Tool usage guidance
  if (context.toolGuidance.length > 0) {
    sections.push(`## Tool Usage Guidance
${context.toolGuidance.map((g) => `- ${g}`).join('\n')}`);
  }

  // Task boundaries
  sections.push(`## Task Boundaries

### You MUST:
${context.mustDo.map((d) => `- ${d}`).join('\n')}

### You MUST NOT:
${context.mustNotDo.map((d) => `- ${d}`).join('\n')}

### Scope Limit:
${context.scopeLimit}`);

  // Success criteria
  sections.push(`## Success Criteria
${context.successCriteria}`);

  // Previous context from dependencies
  if (context.previousContext) {
    sections.push(`## Context from Previous Tasks
${context.previousContext}`);
  }

  return sections.join('\n\n');
}

/**
 * Get detailed instructions for each output format
 */
function getOutputFormatInstructions(format: string): string {
  switch (format) {
    case 'text':
      return 'Provide a clear, well-structured text response. Use markdown formatting for readability.';

    case 'structured':
      return `Return a JSON object with your findings. The response should be parseable JSON.
Example structure:
\`\`\`json
{
  "findings": [...],
  "summary": "...",
  "confidence": 0.85
}
\`\`\``;

    case 'code':
      return `Provide code with clear explanations. Use code blocks with language specifiers.
Format:
\`\`\`language
// code here
\`\`\`
Followed by explanation of what the code does and why.`;

    case 'citations':
      return `Provide factual information with source citations. Use this format:
- Each fact should reference its source using [n] notation
- List all sources at the end
- Include confidence level for each claim

Example:
"The API supports OAuth 2.0 authentication [1] with refresh token rotation [2]."

Sources:
[1] https://example.com/docs/auth - Official documentation
[2] https://example.com/security - Security best practices`;

    case 'actions':
      return `Provide a list of actions taken or recommended. Format:
1. **Action Name**: Description of what was done/should be done
   - Result/Outcome: What happened or expected outcome
   - Status: completed/pending/blocked`;

    default:
      return 'Provide a clear, well-structured response.';
  }
}

/**
 * Get system prompt for a specific subagent type
 */
export function getSubagentSystemPrompt(type: SubagentType): string {
  switch (type) {
    case 'research':
      return `You are a research specialist. Your role is to:
- Search for and gather relevant information
- Evaluate source credibility
- Extract key facts and insights
- Provide well-cited responses

Guidelines:
- Always cite your sources
- Distinguish between facts and inferences
- Note when information might be outdated
- Be thorough but focused on the objective`;

    case 'code':
      return `You are a code specialist. Your role is to:
- Analyze and understand code structure
- Generate clean, efficient code
- Identify bugs and improvements
- Follow best practices and conventions

Guidelines:
- Write readable, maintainable code
- Add comments for complex logic
- Consider edge cases
- Follow the project's existing patterns`;

    case 'github':
      return `You are a GitHub specialist. Your role is to:
- Interact with GitHub repositories
- Review PRs and issues
- Manage code reviews and comments
- Track CI/CD status

Guidelines:
- Be concise in PR comments
- Follow repository contribution guidelines
- Respect code review etiquette
- Document your actions clearly`;

    case 'general':
      return `You are a general-purpose assistant. Your role is to:
- Handle diverse tasks efficiently
- Provide clear, helpful responses
- Know when to defer to specialists
- Maintain context across interactions

Guidelines:
- Be direct and helpful
- Ask clarifying questions when needed
- Provide actionable responses
- Be honest about limitations`;

    default:
      return 'You are a helpful assistant. Complete the assigned task efficiently.';
  }
}

/**
 * Build the complete prompt for a subagent including system and delegation
 */
export function buildSubagentPrompt(
  type: SubagentType,
  delegationContext: DelegationContext
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `${getSubagentSystemPrompt(type)}

IMPORTANT: You are operating as part of a multi-agent system. Focus ONLY on your assigned task.
Do not try to complete the entire user request - just your specific objective.
Other agents will handle other aspects of the request.`;

  const userPrompt = buildDelegationPrompt(delegationContext);

  return { systemPrompt, userPrompt };
}

/**
 * Get default tool guidance for a subagent type
 */
export function getDefaultToolGuidance(type: SubagentType): string[] {
  switch (type) {
    case 'research':
      return [
        'Use web search for current information',
        'Fetch URLs to verify claims',
        'Prefer official documentation over blog posts',
        'Cross-reference multiple sources when possible',
      ];

    case 'code':
      return [
        'Read files before modifying them',
        'Use git status to understand current state',
        'Run tests after making changes',
        'Keep changes focused and minimal',
      ];

    case 'github':
      return [
        'Check existing comments before adding new ones',
        'Use labels to categorize issues',
        'Reference related PRs/issues',
        'Be concise in comments',
      ];

    case 'general':
      return [
        'Use the most appropriate tool for each subtask',
        'Avoid unnecessary tool calls',
        'Verify results before reporting',
      ];

    default:
      return [];
  }
}

/**
 * Get default boundaries for a subagent type
 */
export function getDefaultBoundaries(type: SubagentType): string[] {
  const common = [
    'Do not exceed the assigned tool call limit',
    'Do not attempt tasks outside your objective',
    "Do not make assumptions about other agents' work",
  ];

  switch (type) {
    case 'research':
      return [
        ...common,
        'Do not fabricate sources',
        'Do not present opinions as facts',
        'Do not access paywalled content without authorization',
      ];

    case 'code':
      return [
        ...common,
        'Do not delete files without explicit instruction',
        'Do not modify unrelated code',
        'Do not commit without review',
      ];

    case 'github':
      return [
        ...common,
        'Do not merge PRs without approval',
        'Do not close issues unilaterally',
        'Do not modify repository settings',
      ];

    case 'general':
      return common;

    default:
      return common;
  }
}

/**
 * Format dependency results for context
 */
export function formatDependencyContext(
  results: Map<string, { success: boolean; content?: string; data?: unknown }>
): string {
  if (results.size === 0) {
    return '';
  }

  const parts: string[] = ['The following tasks have been completed:'];

  for (const [taskId, result] of results) {
    if (result.success) {
      const content = result.content || JSON.stringify(result.data);
      parts.push(`### Task ${taskId} (SUCCESS)
${content?.slice(0, 1000)}${content && content.length > 1000 ? '...' : ''}`);
    } else {
      parts.push(`### Task ${taskId} (FAILED)
This task failed, but you should proceed with your task using any available information.`);
    }
  }

  return parts.join('\n\n');
}
