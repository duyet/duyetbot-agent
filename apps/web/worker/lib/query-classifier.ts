/**
 * Query Classifier for Auto Mode Detection
 *
 * Analyzes user messages to determine the most appropriate chat mode:
 * - duyet_mcp: Personal profile/CV queries about Duyet
 * - web_search: Factual queries, latest news, definitions
 * - agent: Complex tasks requiring tools (GitHub, Gmail, etc.)
 */

import type { UIMessage } from 'ai';

export type ChatMode = 'duyet_mcp' | 'web_search' | 'agent';

export interface QueryClassification {
  mode: ChatMode;
  confidence: number; // 0-1
  detectedIntent: string;
  keywords: string[];
}

/**
 * Keyword patterns for each mode
 */
const MODE_PATTERNS = {
  duyet_mcp: {
    keywords: [
      'duyet',
      'cv',
      'resume',
      'github',
      'insights',
      'profile',
      'about duyet',
      "duyet's",
      'your experience',
      'your skills',
      'your projects',
      'contact duyet',
      'hire duyet',
    ],
    weight: 1.0, // High specificity = high confidence
  },
  web_search: {
    keywords: [
      'latest',
      'news',
      'current',
      'recent',
      'fact',
      'define',
      'definition',
      'what is',
      'who is',
      'when did',
      'where is',
      'explain',
      'tell me about',
      'how does',
      'search for',
      'find information',
    ],
    weight: 0.7, // Medium specificity
  },
  agent: {
    keywords: [
      'pull request',
      'pr',
      'open issue',
      'create issue',
      'my email',
      'list emails',
      'gmail',
      'calendar',
      'schedule',
      'meeting',
      'file',
      'folder',
      'repository',
      'deploy',
      'run code',
      'execute',
    ],
    weight: 0.9, // High specificity for tool-based tasks
  },
};

/**
 * Get the last user message from the conversation
 * Extracts text content from UIMessage parts array
 */
function getLastUserMessage(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      const parts = messages[i].parts;
      if (!parts) return null;

      // Extract text content from parts array
      return parts
        .map((p) => (p.type === 'text' ? p.text : ''))
        .filter(Boolean)
        .join('\n');
    }
  }
  return null;
}

/**
 * Calculate confidence score based on keyword matches
 */
function calculateScore(
  query: string,
  patterns: (typeof MODE_PATTERNS)[keyof typeof MODE_PATTERNS]
): number {
  const lowerQuery = query.toLowerCase();
  let matches = 0;
  const matchedKeywords: string[] = [];

  for (const keyword of patterns.keywords) {
    if (lowerQuery.includes(keyword.toLowerCase())) {
      matches++;
      matchedKeywords.push(keyword);
    }
  }

  // Base score from matches
  const matchScore = matches > 0 ? Math.min(matches * 0.3, 0.9) : 0;

  // Apply weight
  const finalScore = matchScore * patterns.weight;

  return Math.min(finalScore, 1);
}

/**
 * Classify a query into a chat mode
 */
export function classifyQuery(messages: UIMessage[]): QueryClassification {
  const query = getLastUserMessage(messages);

  if (!query) {
    // No messages, default to web_search (safest for general queries)
    return {
      mode: 'web_search',
      confidence: 0.3,
      detectedIntent: 'no_query',
      keywords: [],
    };
  }

  const scores: Record<ChatMode, { score: number; keywords: string[] }> = {
    duyet_mcp: { score: 0, keywords: [] },
    web_search: { score: 0, keywords: [] },
    agent: { score: 0, keywords: [] },
  };

  // Calculate scores for each mode
  for (const [mode, patterns] of Object.entries(MODE_PATTERNS)) {
    const score = calculateScore(query, patterns);
    const keywords = patterns.keywords.filter((kw) =>
      query.toLowerCase().includes(kw.toLowerCase())
    );
    scores[mode as ChatMode] = { score, keywords };
  }

  // Find the mode with highest score
  let bestMode: ChatMode = 'web_search'; // Default fallback
  let bestScore = 0;
  let bestKeywords: string[] = [];

  for (const [mode, data] of Object.entries(scores)) {
    if (data.score > bestScore) {
      bestMode = mode as ChatMode;
      bestScore = data.score;
      bestKeywords = data.keywords;
    }
  }

  // Determine intent based on mode and keywords
  const detectedIntent = getIntentDescription(bestMode, bestKeywords, query);

  return {
    mode: bestMode,
    confidence: bestScore,
    detectedIntent,
    keywords: bestKeywords,
  };
}

/**
 * Get human-readable intent description
 */
function getIntentDescription(mode: ChatMode, keywords: string[], query: string): string {
  switch (mode) {
    case 'duyet_mcp':
      if (keywords.some((k) => k.includes('cv') || k.includes('resume'))) {
        return 'cv_request';
      }
      if (keywords.some((k) => k.includes('experience') || k.includes('skills'))) {
        return 'profile_inquiry';
      }
      if (keywords.some((k) => k.includes('contact') || k.includes('hire'))) {
        return 'contact_request';
      }
      return 'profile_query';

    case 'web_search':
      if (keywords.some((k) => k.includes('news') || k.includes('latest'))) {
        return 'news_query';
      }
      if (keywords.some((k) => k.includes('fact') || k.includes('define'))) {
        return 'fact_check';
      }
      return 'general_search';

    case 'agent':
      if (keywords.some((k) => k.includes('pr') || k.includes('issue'))) {
        return 'github_task';
      }
      if (keywords.some((k) => k.includes('email') || k.includes('gmail'))) {
        return 'email_task';
      }
      if (keywords.some((k) => k.includes('calendar') || k.includes('schedule'))) {
        return 'calendar_task';
      }
      return 'tool_task';

    default:
      return 'unknown';
  }
}

/**
 * Check if confidence is high enough to auto-select mode
 */
export function isHighConfidence(classification: QueryClassification): boolean {
  return classification.confidence >= 0.8;
}

/**
 * Check if confidence is medium (show warning)
 */
export function isMediumConfidence(classification: QueryClassification): boolean {
  return classification.confidence >= 0.5 && classification.confidence < 0.8;
}

/**
 * Check if confidence is low (prompt user)
 */
export function isLowConfidence(classification: QueryClassification): boolean {
  return classification.confidence < 0.5;
}
