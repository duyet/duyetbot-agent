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
import type { LLMProvider } from '../types.js';
import { type QueryClassification, type RouteTarget } from './schemas.js';
/**
 * Classification context for better accuracy
 */
export interface ClassificationContext {
  /** Platform the query came from */
  platform?: 'telegram' | 'github' | 'api' | 'cli' | undefined;
  /** Previous messages in conversation */
  recentMessages?: Array<{
    role: string;
    content: string;
  }>;
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
 * Classify a query using LLM
 */
export declare function classifyQuery(
  query: string,
  config: ClassifierConfig,
  context?: ClassificationContext
): Promise<QueryClassification>;
/**
 * Determine route target from classification
 * Updated to support lead-researcher-agent for complex research tasks
 */
export declare function determineRouteTarget(classification: QueryClassification): RouteTarget;
/**
 * Add effort estimation to a classification
 * Called after LLM classification to add resource planning
 */
export declare function addEffortEstimation(
  classification: QueryClassification,
  queryLength: number
): QueryClassification;
/**
 * Quick classification for simple patterns (no LLM needed)
 *
 * Now uses the Agent Registry for pattern matching.
 * Agents self-register their patterns, and this function delegates to the registry.
 * This enables adding/removing agents without modifying the classifier.
 */
export declare function quickClassify(query: string): QueryClassification | null;
/**
 * Hybrid classifier: tries quick patterns first, falls back to LLM
 * Now includes effort estimation for resource planning
 */
export declare function hybridClassify(
  query: string,
  config: ClassifierConfig,
  context?: ClassificationContext
): Promise<QueryClassification>;
/**
 * Create a classifier instance
 */
export declare function createClassifier(config: ClassifierConfig): {
  classify: (
    query: string,
    context?: ClassificationContext
  ) => Promise<{
    type: 'simple' | 'complex' | 'tool_confirmation';
    category: 'research' | 'github' | 'code' | 'general' | 'admin' | 'duyet';
    complexity: 'low' | 'high' | 'medium';
    reasoning: string;
    requiresHumanApproval: boolean;
    confidence?: number | undefined;
    suggestedTools?: string[] | undefined;
    estimatedTokens?: number | undefined;
    effortEstimate?:
      | {
          level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
          recommendedSubagents: number;
          maxToolCalls: number;
          expectedDuration: 'medium' | 'fast' | 'long';
        }
      | undefined;
  }>;
  quickClassify: typeof quickClassify;
  determineRouteTarget: typeof determineRouteTarget;
};
//# sourceMappingURL=classifier.d.ts.map
