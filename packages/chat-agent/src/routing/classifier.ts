/**
 * Query Classifier
 *
 * Uses LLM to classify incoming queries for routing decisions.
 * Determines query type, category, complexity, and whether human approval is needed.
 */

import type { LLMProvider } from '../types.js';
import {
  type QueryClassification,
  QueryClassificationSchema,
  type RouteTarget,
} from './schemas.js';

/**
 * Classification context for better accuracy
 */
export interface ClassificationContext {
  /** Platform the query came from */
  platform?: 'telegram' | 'github' | 'api' | 'cli' | undefined;
  /** Previous messages in conversation */
  recentMessages?: Array<{ role: string; content: string }>;
  /** Available tools */
  availableTools?: string[];
  /** User's role/permissions */
  userRole?: string;
}

/**
 * Classifier configuration
 */
export interface ClassifierConfig {
  /** LLM provider for classification */
  provider: LLMProvider;
  /** Override classification prompt */
  customPrompt?: string;
  /** Minimum confidence threshold (0-1) */
  confidenceThreshold?: number;
}

/**
 * System prompt for classification
 */
const CLASSIFICATION_SYSTEM_PROMPT = `You are a query classifier for an AI agent system. Analyze user queries and classify them accurately.

Your task is to determine:
1. **type**: How should this query be processed?
   - "simple": Quick answer, no tools needed (greetings, simple questions, explanations)
   - "complex": Multi-step task requiring planning and multiple operations
   - "tool_confirmation": Query is responding to a pending tool approval request

2. **category**: What domain does this belong to?
   - "general": General questions, chitchat, explanations
   - "code": Code review, generation, analysis, debugging
   - "research": Web search, documentation lookup, comparisons
   - "github": GitHub operations (PRs, issues, comments, reviews)
   - "admin": Settings, configuration, system commands

3. **complexity**: How resource-intensive is this?
   - "low": Single step, fast response (< 1 tool call)
   - "medium": Few steps, moderate processing (1-3 tool calls)
   - "high": Many steps, needs orchestration (4+ tool calls or parallel work)

4. **requiresHumanApproval**: Does this involve sensitive operations?
   - true: Deleting files, merging PRs, sending emails, modifying configs
   - false: Reading, analyzing, generating content

5. **reasoning**: Brief explanation of your classification

6. **suggestedTools**: List tool names that might be needed (optional)

Be conservative with complexity - prefer "low" or "medium" unless clearly complex.
Be strict with requiresHumanApproval - flag anything destructive or irreversible.`;

/**
 * Format the classification prompt
 */
function formatClassificationPrompt(query: string, context?: ClassificationContext): string {
  let prompt = `Classify this user query:\n\n"${query}"`;

  if (context?.platform) {
    prompt += `\n\nPlatform: ${context.platform}`;
  }

  if (context?.recentMessages?.length) {
    const recent = context.recentMessages.slice(-3);
    prompt += `\n\nRecent conversation:\n${recent
      .map((m) => `${m.role}: ${m.content.slice(0, 100)}...`)
      .join('\n')}`;
  }

  if (context?.availableTools?.length) {
    prompt += `\n\nAvailable tools: ${context.availableTools.join(', ')}`;
  }

  prompt += '\n\nRespond with a JSON object matching the classification schema.';

  return prompt;
}

/**
 * Parse LLM response to classification
 */
function parseClassificationResponse(response: string): QueryClassification {
  // Try to extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in classification response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return QueryClassificationSchema.parse(parsed);
}

/**
 * Classify a query using LLM
 */
export async function classifyQuery(
  query: string,
  config: ClassifierConfig,
  context?: ClassificationContext
): Promise<QueryClassification> {
  const prompt = formatClassificationPrompt(query, context);

  const response = await config.provider.chat([
    {
      role: 'system',
      content: config.customPrompt || CLASSIFICATION_SYSTEM_PROMPT,
    },
    { role: 'user', content: prompt },
  ]);

  return parseClassificationResponse(response.content);
}

/**
 * Determine route target from classification
 */
export function determineRouteTarget(classification: QueryClassification): RouteTarget {
  // Tool confirmation always goes to HITL agent
  if (classification.type === 'tool_confirmation') {
    return 'hitl-agent';
  }

  // High complexity goes to orchestrator
  if (classification.complexity === 'high') {
    return 'orchestrator-agent';
  }

  // Operations requiring approval go to HITL
  if (classification.requiresHumanApproval) {
    return 'hitl-agent';
  }

  // Simple queries with low complexity go to simple agent
  if (classification.type === 'simple' && classification.complexity === 'low') {
    return 'simple-agent';
  }

  // Route by category to specialized workers
  switch (classification.category) {
    case 'code':
      return 'code-worker';
    case 'research':
      return 'research-worker';
    case 'github':
      return 'github-worker';
    default:
      // General queries go to simple agent
      return 'simple-agent';
  }
}

/**
 * Quick classification for simple patterns (no LLM needed)
 */
export function quickClassify(query: string): QueryClassification | null {
  const lower = query.toLowerCase().trim();

  // Greetings - simple, general, low
  if (/^(hi|hello|hey|good\s+(morning|afternoon|evening))[\s!.]*$/i.test(lower)) {
    return {
      type: 'simple',
      category: 'general',
      complexity: 'low',
      requiresHumanApproval: false,
      reasoning: 'Simple greeting',
    };
  }

  // Help commands - simple, general, low
  if (/^(help|\/help|\?|what can you do)[\s?]*$/i.test(lower)) {
    return {
      type: 'simple',
      category: 'general',
      complexity: 'low',
      requiresHumanApproval: false,
      reasoning: 'Help request',
    };
  }

  // Clear/reset commands - simple, admin, low, needs approval
  if (/^(\/clear|clear|reset|start over)[\s!]*$/i.test(lower)) {
    return {
      type: 'simple',
      category: 'admin',
      complexity: 'low',
      requiresHumanApproval: true,
      reasoning: 'Destructive admin command',
    };
  }

  // Tool confirmation responses
  if (/^(yes|no|approve|reject|confirm|cancel)[\s!.]*$/i.test(lower)) {
    return {
      type: 'tool_confirmation',
      category: 'general',
      complexity: 'low',
      requiresHumanApproval: false,
      reasoning: 'Tool confirmation response',
    };
  }

  // No quick match - need LLM classification
  return null;
}

/**
 * Hybrid classifier: tries quick patterns first, falls back to LLM
 */
export async function hybridClassify(
  query: string,
  config: ClassifierConfig,
  context?: ClassificationContext
): Promise<QueryClassification> {
  // Try quick classification first
  const quick = quickClassify(query);
  if (quick) {
    return quick;
  }

  // Fall back to LLM classification
  return classifyQuery(query, config, context);
}

/**
 * Create a classifier instance
 */
export function createClassifier(config: ClassifierConfig) {
  return {
    classify: (query: string, context?: ClassificationContext) =>
      hybridClassify(query, config, context),
    quickClassify,
    determineRouteTarget,
  };
}
