/**
 * Query Classifier
 *
 * Uses LLM to classify incoming queries for routing decisions.
 * Determines query type, category, complexity, and whether human approval is needed.
 *
 * Now integrates with the Agent Registry for dynamic classification:
 * - quickClassify() delegates to agentRegistry.quickClassify()
 * - LLM prompt is built dynamically from agent registrations
 */

import { logger } from '@duyetbot/hono-middleware';
import { getRouterPrompt } from '@duyetbot/prompts';
import { agentRegistry } from '../agents/registry.js';
import { estimateEffortLevel } from '../config/effort-config.js';
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
 * Imported from centralized @duyetbot/prompts package
 */
const CLASSIFICATION_SYSTEM_PROMPT = getRouterPrompt();

// Log classification system prompt at module load time
logger.debug('[RouterAgent/Classifier] System prompt loaded', {
  promptLength: CLASSIFICATION_SYSTEM_PROMPT.length,
  promptPreview:
    CLASSIFICATION_SYSTEM_PROMPT.slice(0, 200) +
    (CLASSIFICATION_SYSTEM_PROMPT.length > 200 ? '...' : ''),
});

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

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return QueryClassificationSchema.parse(parsed);
  } catch (error) {
    // Return safe fallback on parse failure
    logger.error('[Classifier] Failed to parse classification JSON', {
      error: error instanceof Error ? error.message : String(error),
      response: response.slice(0, 300),
    });
    return {
      type: 'simple',
      category: 'general',
      complexity: 'low',
      requiresHumanApproval: false,
      reasoning: 'Classification parsing failed, using fallback',
    };
  }
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
 * Updated to support lead-researcher-agent for complex research tasks
 */
export function determineRouteTarget(classification: QueryClassification): RouteTarget {
  // Tool confirmation always goes to HITL agent
  if (classification.type === 'tool_confirmation') {
    return 'hitl-agent';
  }

  // Operations requiring approval go to HITL
  if (classification.requiresHumanApproval) {
    return 'hitl-agent';
  }

  // Route duyet queries to DuyetInfoAgent (before other routing)
  if (classification.category === 'duyet') {
    return 'duyet-info-agent';
  }

  // High/medium complexity research queries go to lead-researcher-agent
  // This enables multi-agent parallel research (Anthropic pattern)
  if (
    classification.category === 'research' &&
    (classification.complexity === 'high' || classification.complexity === 'medium')
  ) {
    return 'lead-researcher-agent';
  }

  // High complexity non-research goes to orchestrator
  if (classification.complexity === 'high') {
    return 'orchestrator-agent';
  }

  // Simple queries with low complexity go to simple agent
  if (classification.type === 'simple' && classification.complexity === 'low') {
    return 'simple-agent';
  }

  // Complex domain-specific queries go to orchestrator
  // which internally dispatches to the appropriate worker.
  // Workers are never called directly by router.
  switch (classification.category) {
    case 'code':
      // Code tasks go to orchestrator → CodeWorker
      return 'orchestrator-agent';
    case 'research':
      // Low complexity research goes to orchestrator → ResearchWorker
      return 'orchestrator-agent';
    case 'github':
      // GitHub tasks go to orchestrator → GitHubWorker
      return 'orchestrator-agent';
    default:
      // General queries go to simple agent
      return 'simple-agent';
  }
}

/**
 * Add effort estimation to a classification
 * Called after LLM classification to add resource planning
 */
export function addEffortEstimation(
  classification: QueryClassification,
  queryLength: number
): QueryClassification {
  const effortEstimate = estimateEffortLevel(
    classification.complexity,
    classification.category,
    queryLength
  );

  return {
    ...classification,
    effortEstimate,
  };
}

/**
 * Quick classification for simple patterns (no LLM needed)
 *
 * Now uses the Agent Registry for pattern matching.
 * Agents self-register their patterns, and this function delegates to the registry.
 * This enables adding/removing agents without modifying the classifier.
 */
export function quickClassify(query: string): QueryClassification | null {
  // Delegate to agent registry for pattern-based classification
  const agentName = agentRegistry.quickClassify(query);

  if (!agentName) {
    // No quick match - need LLM classification
    return null;
  }

  // Get agent definition for building classification
  const agent = agentRegistry.get(agentName);

  if (!agent) {
    // Agent registered but not found (shouldn't happen)
    return null;
  }

  // Map agent to classification
  // This bridges the new registry pattern to existing classification schema
  const category = agent.triggers?.categories?.[0] ?? 'general';

  // Special handling for certain agent types
  const isToolConfirmation =
    agentName === 'hitl-agent' && /^(yes|no|approve|reject|confirm|cancel)[\s!.]*$/i.test(query);
  const requiresApproval = agent.capabilities?.requiresApproval ?? false;

  // Build classification from agent metadata
  const classification: QueryClassification = {
    type: isToolConfirmation ? 'tool_confirmation' : 'simple',
    // Map category string to valid QueryCategory
    category: mapToValidCategory(category),
    complexity: agent.capabilities?.complexity ?? 'low',
    requiresHumanApproval: requiresApproval,
    reasoning: `Matched agent ${agentName} via pattern`,
    suggestedTools: agent.capabilities?.tools,
  };

  logger.debug('[Classifier] Quick classification via registry', {
    query: query.slice(0, 50),
    agentName,
    category: classification.category,
    complexity: classification.complexity,
  });

  return classification;
}

/**
 * Map category string to valid QueryCategory enum value
 * Required because agent registry uses free-form strings but classifier needs enum
 */
function mapToValidCategory(
  category: string
): 'general' | 'code' | 'research' | 'github' | 'admin' | 'duyet' {
  const validCategories = ['general', 'code', 'research', 'github', 'admin', 'duyet'] as const;

  const lower = category.toLowerCase();

  // Direct match
  if (validCategories.includes(lower as (typeof validCategories)[number])) {
    return lower as (typeof validCategories)[number];
  }

  // Map common variations
  if (lower === 'complex' || lower === 'orchestration') {
    return 'general';
  }
  if (lower === 'confirmation' || lower === 'destructive') {
    return 'admin';
  }

  // Default fallback
  return 'general';
}

/**
 * Hybrid classifier: tries quick patterns first, falls back to LLM
 * Now includes effort estimation for resource planning
 */
export async function hybridClassify(
  query: string,
  config: ClassifierConfig,
  context?: ClassificationContext
): Promise<QueryClassification> {
  // Try quick classification first
  const quick = quickClassify(query);
  if (quick) {
    // Add effort estimation even for quick classifications
    return addEffortEstimation(quick, query.length);
  }

  // Fall back to LLM classification
  const classification = await classifyQuery(query, config, context);

  // Add effort estimation for resource planning
  return addEffortEstimation(classification, query.length);
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
