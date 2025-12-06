/**
 * Research Worker
 *
 * Specialized worker for research-related tasks:
 * - Information gathering and synthesis
 * - Documentation lookup
 * - Web search and summarization
 * - Technical research and comparison
 */
import { getResearchWorkerPrompt } from '@duyetbot/prompts';
import { createBaseWorker } from './base-worker.js';

/**
 * System prompt for research worker
 * Imported from centralized @duyetbot/prompts package
 */
const RESEARCH_WORKER_SYSTEM_PROMPT = getResearchWorkerPrompt();
/**
 * Detect the research task type from the task description
 */
export function detectResearchTaskType(task) {
  const taskLower = task.toLowerCase();
  if (taskLower.includes('search') || taskLower.includes('find')) {
    return 'search';
  }
  if (taskLower.includes('summarize') || taskLower.includes('summary')) {
    return 'summarize';
  }
  if (taskLower.includes('compare') || taskLower.includes('versus') || taskLower.includes('vs')) {
    return 'compare';
  }
  if (taskLower.includes('explain') || taskLower.includes('what is')) {
    return 'explain';
  }
  if (
    taskLower.includes('lookup') ||
    taskLower.includes('documentation') ||
    taskLower.includes('docs')
  ) {
    return 'lookup';
  }
  return 'analyze'; // Default to general analysis
}
/**
 * Get task-specific instructions based on task type
 */
function getResearchInstructions(taskType) {
  const instructions = {
    search: `
## Search Guidelines
1. Identify key search terms and concepts
2. Consider multiple angles and perspectives
3. Evaluate source credibility
4. Synthesize findings into coherent summary
5. Note any gaps in available information
6. Provide actionable next steps if needed`,
    summarize: `
## Summarization Guidelines
1. Identify main themes and key points
2. Preserve essential details and context
3. Remove redundancy and filler
4. Maintain logical flow and structure
5. Include relevant examples
6. Provide TL;DR at the beginning`,
    compare: `
## Comparison Guidelines
1. Define clear comparison criteria
2. Evaluate each option objectively
3. Highlight strengths and weaknesses
4. Consider different use cases
5. Provide recommendations when appropriate
6. Use tables for structured comparisons

| Criteria | Option A | Option B |
|----------|----------|----------|
| ...      | ...      | ...      |`,
    explain: `
## Explanation Guidelines
1. Start with a high-level overview
2. Define key terms and concepts
3. Use analogies for complex ideas
4. Provide concrete examples
5. Build from simple to complex
6. Include practical applications`,
    lookup: `
## Documentation Lookup Guidelines
1. Identify the specific documentation needed
2. Extract relevant sections and examples
3. Note version-specific information
4. Highlight important warnings or caveats
5. Provide code examples when available
6. Link to original sources`,
    analyze: `
## Analysis Guidelines
1. Gather relevant data and information
2. Identify patterns and trends
3. Consider multiple perspectives
4. Draw evidence-based conclusions
5. Note limitations and assumptions
6. Provide actionable insights`,
  };
  return instructions[taskType];
}
/**
 * Build research-specific prompt
 */
function buildResearchPrompt(step, dependencyContext) {
  const taskType = detectResearchTaskType(step.task);
  const taskInstructions = getResearchInstructions(taskType);
  const parts = [];
  if (dependencyContext) {
    parts.push(dependencyContext);
  }
  parts.push(`## Research Type: ${taskType.toUpperCase()}`);
  parts.push(`## Task\n${step.task}`);
  parts.push(taskInstructions);
  parts.push('\n## Additional Instructions');
  parts.push(`- ${step.description}`);
  parts.push('- Focus on accuracy and relevance');
  parts.push('- Cite sources where possible');
  return parts.join('\n');
}
/**
 * Parse research-specific response
 */
function parseResearchResponse(content, expectedOutput) {
  // For data output, try to extract structured findings
  if (expectedOutput === 'data') {
    // Try to detect if content has a comparison table
    if (content.includes('|') && content.includes('---')) {
      return {
        type: 'comparison',
        content,
        hasTable: true,
      };
    }
    // Try to extract bullet points as findings
    const bulletPoints = content.match(/^[•\-*]\s+.+$/gm);
    if (bulletPoints && bulletPoints.length > 0) {
      return {
        type: 'findings',
        content,
        keyPoints: bulletPoints.map((b) => b.replace(/^[•\-*]\s+/, '')),
      };
    }
    // Try to parse as JSON
    try {
      const jsonMatch = content.match(/```json\n?([\s\S]*?)```/);
      if (jsonMatch?.[1]) {
        return JSON.parse(jsonMatch[1]);
      }
    } catch {
      // Not JSON, return content
    }
  }
  // Default handling
  switch (expectedOutput) {
    case 'code': {
      const codeMatch = content.match(/```[\w]*\n?([\s\S]*?)```/);
      return codeMatch?.[1] ? codeMatch[1].trim() : content;
    }
    case 'action':
      return { action: 'completed', result: content };
    default:
      return content;
  }
}
/**
 * Create a Research Worker class
 *
 * @example
 * ```typescript
 * export const ResearchWorker = createResearchWorker({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   enableWebSearch: true,
 * });
 * ```
 */
export function createResearchWorker(config) {
  const baseConfig = {
    createProvider: config.createProvider,
    workerType: 'research',
    systemPrompt: RESEARCH_WORKER_SYSTEM_PROMPT,
    buildPrompt: buildResearchPrompt,
    parseResponse: parseResearchResponse,
  };
  if (config.debug !== undefined) {
    baseConfig.debug = config.debug;
  }
  return createBaseWorker(baseConfig);
}
