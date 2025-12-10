/**
 * Routing Accuracy Assertions
 *
 * Validates that queries are classified to the correct agents based on:
 * - Hybrid classifier (pattern matching + LLM)
 * - Agent routing accuracy
 * - Confidence scores
 * - Query complexity detection
 *
 * Reference: packages/cloudflare-agent/src/routing/classifier.ts
 */

interface AssertionContext {
  prompt?: string;
  vars?: Record<string, unknown>;
  test?: unknown;
  value?: string;
  threshold?: number;
}

interface GradingResult {
  pass: boolean;
  score: number;
  reason: string;
  metadata?: Record<string, unknown>;
}

/**
 * Validates agent classification accuracy
 * Checks if router classified query to expected agent
 */
export async function routesToAgent(
  output: string,
  context: AssertionContext
): Promise<GradingResult> {
  const expectedAgent = context.value as string | undefined;

  if (!expectedAgent) {
    return {
      pass: false,
      score: 0,
      reason: 'No expected agent specified in context.value',
    };
  }

  // Parse output (might be JSON with metadata)
  let classified: string;
  let confidence = 1;

  try {
    const parsed = JSON.parse(output);
    if (typeof parsed === 'object') {
      // Extract agent name from various possible formats
      classified = parsed.agent || parsed.name || parsed.classifier_result?.agent || parsed.result;
      confidence = parsed.confidence || parsed.metadata?.confidence || 1;
    } else {
      classified = String(parsed);
    }
  } catch {
    // Output is plain text (just the agent name)
    classified = output.trim();
  }

  if (!classified) {
    return {
      pass: false,
      score: 0,
      reason: 'Could not extract agent name from output',
    };
  }

  // Normalize for comparison (case-insensitive, remove underscores/dashes)
  const normalize = (s: string) => s.toLowerCase().replace(/[_-]/g, '').trim();
  const normalizedExpected = normalize(expectedAgent);
  const normalizedClassified = normalize(classified);

  // Check for exact match or substring match
  const match =
    normalizedClassified === normalizedExpected ||
    normalizedClassified.includes(normalizedExpected) ||
    normalizedExpected.includes(normalizedClassified);

  return {
    pass: match,
    score: match ? Math.min(1, confidence) : 0,
    reason: match
      ? `Correctly routed to ${classified}${confidence < 1 ? ` (confidence: ${(confidence * 100).toFixed(0)}%)` : ''}`
      : `Expected ${expectedAgent}, got ${classified}`,
    metadata: { expected: expectedAgent, actual: classified, confidence },
  };
}

/**
 * Validates routing confidence level
 */
export async function routingConfidence(
  output: string,
  context: AssertionContext & { threshold?: number }
): Promise<GradingResult> {
  const threshold = context.threshold || 0.7;

  let confidence = 1; // Default high confidence for pattern matching
  let agent: string | undefined;

  try {
    const parsed = JSON.parse(output);
    if (typeof parsed === 'object') {
      confidence = parsed.confidence || parsed.metadata?.confidence || 1;
      agent = parsed.agent || parsed.name || parsed.result;
    }
  } catch {
    // Plain text output = high confidence pattern match
    confidence = 1;
    agent = output.trim();
  }

  const pass = confidence >= threshold;
  const confidencePercent = (confidence * 100).toFixed(0);

  return {
    pass,
    score: Math.min(1, confidence / threshold),
    reason: pass
      ? `Confidence ${confidencePercent}% meets threshold (${(threshold * 100).toFixed(0)}%)`
      : `Confidence ${confidencePercent}% below threshold (${(threshold * 100).toFixed(0)}%)`,
    metadata: { confidence, threshold, agent },
  };
}

/**
 * Validates that simple queries route to SimpleAgent
 */
export async function simpleQueryRoutesCorrectly(
  output: string,
  _context: AssertionContext
): Promise<GradingResult> {
  let classified: string;

  try {
    const parsed = JSON.parse(output);
    classified =
      typeof parsed === 'string' ? parsed : parsed.agent || parsed.name || String(parsed);
  } catch {
    classified = output.trim();
  }

  const isSimple = classified.toLowerCase().includes('simple');
  const isFactual =
    classified.toLowerCase().includes('knowledge') || classified.toLowerCase().includes('info');

  // Simple queries should route to SimpleAgent or knowledge-based agents
  const correct = isSimple || isFactual;

  return {
    pass: correct,
    score: correct ? 1 : 0,
    reason: correct
      ? `Simple query correctly routed to ${classified}`
      : `Simple query incorrectly routed to ${classified} (expected simple-agent or knowledge agent)`,
  };
}

/**
 * Validates that complex queries don't route to simple-agent
 */
export async function complexQueryNotSimple(
  output: string,
  _context: AssertionContext
): Promise<GradingResult> {
  let classified: string;

  try {
    const parsed = JSON.parse(output);
    classified =
      typeof parsed === 'string' ? parsed : parsed.agent || parsed.name || String(parsed);
  } catch {
    classified = output.trim();
  }

  const isSimple = classified.toLowerCase().includes('simple');

  return {
    pass: !isSimple,
    score: isSimple ? 0 : 1,
    reason: isSimple
      ? 'Complex query incorrectly routed to simple-agent'
      : `Complex query correctly routed to ${classified}`,
  };
}

/**
 * Validates code-related queries route to CodeWorker
 */
export async function codeQueryRoutesCorrectly(
  output: string,
  _context: AssertionContext
): Promise<GradingResult> {
  let classified: string;

  try {
    const parsed = JSON.parse(output);
    classified =
      typeof parsed === 'string' ? parsed : parsed.agent || parsed.name || String(parsed);
  } catch {
    classified = output.trim();
  }

  const isCodeAgent = /code|developer|implement|refactor|debug/i.test(classified);

  return {
    pass: isCodeAgent,
    score: isCodeAgent ? 1 : 0,
    reason: isCodeAgent
      ? `Code query correctly routed to ${classified}`
      : `Code query routed to ${classified} (expected code-worker or similar)`,
  };
}

/**
 * Validates research/web queries route to ResearchWorker
 */
export async function researchQueryRoutesCorrectly(
  output: string,
  _context: AssertionContext
): Promise<GradingResult> {
  let classified: string;

  try {
    const parsed = JSON.parse(output);
    classified =
      typeof parsed === 'string' ? parsed : parsed.agent || parsed.name || String(parsed);
  } catch {
    classified = output.trim();
  }

  const isResearchAgent = /research|search|web|news|current|analyze|investigate|learn/i.test(
    classified
  );

  return {
    pass: isResearchAgent,
    score: isResearchAgent ? 1 : 0,
    reason: isResearchAgent
      ? `Research query correctly routed to ${classified}`
      : `Research query routed to ${classified} (expected research-worker or similar)`,
  };
}

/**
 * Validates GitHub-related queries route to GitHubWorker
 */
export async function githubQueryRoutesCorrectly(
  output: string,
  _context: AssertionContext
): Promise<GradingResult> {
  let classified: string;

  try {
    const parsed = JSON.parse(output);
    classified =
      typeof parsed === 'string' ? parsed : parsed.agent || parsed.name || String(parsed);
  } catch {
    classified = output.trim();
  }

  const isGithubAgent = /github|repo|issue|pr|pull|code\s*review|commit/i.test(classified);

  return {
    pass: isGithubAgent,
    score: isGithubAgent ? 1 : 0,
    reason: isGithubAgent
      ? `GitHub query correctly routed to ${classified}`
      : `GitHub query routed to ${classified} (expected github-worker or similar)`,
  };
}

/**
 * Validates pattern-based classification (fast path)
 * Should use keywords to match agent without LLM
 */
export async function usesPatternMatching(
  output: string,
  _context: AssertionContext
): Promise<GradingResult> {
  let agent: string | undefined;
  let method: string | undefined;
  let latency: number | undefined;

  try {
    const parsed = JSON.parse(output);
    if (typeof parsed === 'object') {
      agent = parsed.agent || parsed.name;
      method = parsed.method || parsed.classifier_method;
      latency = parsed.latency_ms || parsed.timing?.classifier_ms;
    }
  } catch {
    // Can't determine if pattern matching was used
    return {
      pass: true,
      score: 0.5,
      reason: 'Cannot determine classification method from output',
    };
  }

  const usesPattern = method === 'pattern' || method === 'keyword' || method?.includes('pattern');

  // Pattern matching should be fast (< 10ms typically)
  const isFast = !latency || latency < 10;

  return {
    pass: usesPattern && isFast,
    score: (usesPattern ? 0.5 : 0) + (isFast ? 0.5 : 0),
    reason: `Method: ${method || 'unknown'}, Latency: ${latency ? `${latency}ms` : 'unknown'}${usesPattern ? ' (pattern)' : ' (LLM)'}`,
    metadata: { method, agent, latency },
  };
}

/**
 * Validates that router provides context/reasoning for routing decision
 */
export async function hasRoutingReasoning(
  output: string,
  _context: AssertionContext
): Promise<GradingResult> {
  let reasoning: string | undefined;

  try {
    const parsed = JSON.parse(output);
    if (typeof parsed === 'object') {
      reasoning =
        parsed.reasoning || parsed.reason || parsed.explanation || parsed.classifier_reasoning;
    }
  } catch {
    // Plain text output doesn't have reasoning
    return {
      pass: false,
      score: 0,
      reason: 'Output should include routing reasoning in JSON metadata',
    };
  }

  const hasReasoning = !!reasoning && String(reasoning).length > 10;

  return {
    pass: hasReasoning,
    score: hasReasoning ? 1 : 0,
    reason: hasReasoning ? 'Includes routing reasoning' : 'Missing reasoning for routing decision',
    metadata: { reasoning: reasoning ? String(reasoning).substring(0, 100) : undefined },
  };
}

/**
 * Validates that personal/identity queries route to DuyetInfoAgent
 */
export async function personalInfoQueryRoutesCorrectly(
  output: string,
  _context: AssertionContext
): Promise<GradingResult> {
  let classified: string;

  try {
    const parsed = JSON.parse(output);
    classified =
      typeof parsed === 'string' ? parsed : parsed.agent || parsed.name || String(parsed);
  } catch {
    classified = output.trim();
  }

  const isPersonalAgent = /duyet|creator|author|profile|bio|about|personal|identity/i.test(
    classified
  );

  return {
    pass: isPersonalAgent,
    score: isPersonalAgent ? 1 : 0,
    reason: isPersonalAgent
      ? `Personal query correctly routed to ${classified}`
      : `Personal query routed to ${classified} (expected duyet-info or similar)`,
  };
}

export default routesToAgent;
