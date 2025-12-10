/**
 * GitHub Markdown Format Assertions
 *
 * Validates that prompts/outputs follow GitHub-flavored markdown rules.
 * Reference: packages/prompts/src/sections/guidelines.ts - GITHUB_MARKDOWN_GUIDELINES
 *
 * Covers:
 * - GitHub alerts (NOTE, TIP, IMPORTANT, WARNING, CAUTION)
 * - Code blocks with language specifiers
 * - Heading hierarchy
 * - Structured response format (TL;DR, Details, Action Items)
 * - File references
 * - Links to issues/PRs
 */

interface AssertionContext {
  prompt?: string;
  vars?: Record<string, unknown>;
  value?: string[];
}

interface GradingResult {
  pass: boolean;
  score: number;
  reason: string;
  componentResults?: Array<{ pass: boolean; score: number; reason: string }>;
}

// GitHub alert types supported
const GITHUB_ALERTS = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'];

/**
 * Validates GitHub markdown format compliance
 * Checks for:
 * - GitHub alerts format
 * - Code blocks with language hints
 * - Heading hierarchy
 * - Markdown features (tables, lists, diff syntax)
 * - Format directive
 */
export async function githubMarkdownValid(
  output: string,
  context: AssertionContext
): Promise<GradingResult> {
  const components: Array<{ pass: boolean; score: number; reason: string }> = [];
  const expectations = (context.value || []) as string[];

  let content: string;
  try {
    const parsed = JSON.parse(output);
    content = parsed.systemPrompt || output;
  } catch {
    content = output;
  }

  // Check 1: GitHub alerts format (if expected)
  if (expectations.includes('alerts')) {
    const alertPattern = /> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/;
    const hasAlerts =
      alertPattern.test(content) ||
      GITHUB_ALERTS.some((alert) => new RegExp(`\\[!${alert}\\]`).test(content));
    components.push({
      pass: hasAlerts,
      score: hasAlerts ? 1 : 0,
      reason: hasAlerts ? 'Contains GitHub alert syntax' : 'Missing GitHub alert syntax',
    });
  }

  // Check 2: Code blocks with language (if expected)
  if (expectations.includes('code-blocks')) {
    const _codeBlockPattern = /```(\w+)\n/;
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    const blocksWithLanguage = codeBlocks.filter((block) => /```\w+\n/.test(block)).length;

    components.push({
      pass: blocksWithLanguage > 0,
      score:
        codeBlocks.length === 0
          ? 1
          : Math.min(1, blocksWithLanguage / Math.max(1, codeBlocks.length)),
      reason:
        blocksWithLanguage > 0
          ? `${blocksWithLanguage}/${codeBlocks.length} code blocks have language specifiers`
          : 'Missing language in code blocks',
    });
  }

  // Check 3: File references (if expected)
  if (expectations.includes('file-refs')) {
    const fileRefPattern = /`[^`]+\.(ts|js|tsx|jsx|json|yaml|yml|md|py|go|rs)`/;
    const hasFileRefs = fileRefPattern.test(content);
    components.push({
      pass: hasFileRefs,
      score: hasFileRefs ? 1 : 0,
      reason: hasFileRefs ? 'Contains file references' : 'Missing file references',
    });
  }

  // Check 4: Proper heading hierarchy
  const headings = content.match(/^#{1,6}\s+.+$/gm) || [];
  let hierarchyValid = true;

  if (headings.length > 1) {
    const levels = headings.map((h) => {
      const match = h.match(/^#+/);
      return match ? match[0].length : 0;
    });

    // Check for heading level jumps (e.g., h1 -> h3, but h1 -> h2 is OK)
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] > levels[i - 1] + 1) {
        hierarchyValid = false;
        break;
      }
    }
  }

  components.push({
    pass: hierarchyValid,
    score: hierarchyValid ? 1 : 0.5,
    reason: hierarchyValid ? 'Heading hierarchy is valid' : 'Heading hierarchy has gaps',
  });

  // Check 5: Contains GitHub/Markdown format directive
  const hasFormatDirective =
    content.includes('GitHub') || content.includes('markdown') || content.includes('Markdown');
  components.push({
    pass: hasFormatDirective,
    score: hasFormatDirective ? 1 : 0.5,
    reason: hasFormatDirective ? 'Contains format directive' : 'Missing GitHub/markdown directive',
  });

  // Calculate overall score
  const totalScore =
    components.length > 0 ? components.reduce((sum, c) => sum + c.score, 0) / components.length : 1;

  return {
    pass: totalScore >= 0.8,
    score: totalScore,
    reason:
      totalScore >= 0.8 ? 'Valid GitHub markdown format' : 'Some GitHub markdown checks failed',
    componentResults: components,
  };
}

/**
 * Checks for structured response format (TL;DR -> Details -> Action Items)
 * This is the recommended structure from getGitHubBotPrompt
 */
export async function githubStructuredFormat(
  output: string,
  _context: AssertionContext
): Promise<GradingResult> {
  let content: string;
  try {
    const parsed = JSON.parse(output);
    content = parsed.systemPrompt || output;
  } catch {
    content = output;
  }

  // Look for structured sections
  const sections = {
    tldr: /##\s+TL;?DR\b|##\s+Summary\b|##\s+Overview\b|^\*\*TL;?DR\*\*/m.test(content),
    details: /##\s+Details\b|##\s+Explanation\b|##\s+Description\b|##\s+Detailed Review\b/i.test(
      content
    ),
    actions:
      /##\s+Action\s+Items\b|##\s+Next\s+Steps?\b|##\s+TODO|##\s+Recommendations\b|-\s+\[\s*\]/m.test(
        content
      ),
  };

  const found = Object.values(sections).filter(Boolean).length;
  const total = Object.keys(sections).length;

  // Check for task lists as secondary indicator
  const hasTaskLists = /- \[\s*\]/m.test(content);

  return {
    pass: found >= 2 || hasTaskLists,
    score: Math.min(1, (found / total + (hasTaskLists ? 0.5 : 0)) / 1.5),
    reason:
      found >= 2 || hasTaskLists
        ? `Has structured format: ${found}/${total} main sections${hasTaskLists ? ' + task lists' : ''}`
        : `Only ${found}/${total} structured sections found`,
  };
}

/**
 * Validates GitHub alerts syntax
 */
export async function githubAlertsValid(
  output: string,
  context: AssertionContext & { required?: string[] }
): Promise<GradingResult> {
  let content: string;
  try {
    const parsed = JSON.parse(output);
    content = parsed.systemPrompt || output;
  } catch {
    content = output;
  }

  const requiredAlerts = (context.required || []) as string[];
  const foundAlerts: Record<string, boolean> = {};

  // Check for each required alert type
  for (const alert of requiredAlerts) {
    const pattern = new RegExp(`> \\[!${alert}\\]`, 'i');
    foundAlerts[alert] = pattern.test(content);
  }

  const allFound = Object.values(foundAlerts).every((v) => v);
  const missing = Object.entries(foundAlerts)
    .filter(([_, found]) => !found)
    .map(([alert]) => alert);

  // Check for invalid alert types
  const allAlertsPattern = /> \[!([A-Z]+)\]/g;
  const allFoundAlerts = content.match(allAlertsPattern) || [];
  let invalidCount = 0;

  for (const match of allFoundAlerts) {
    const alertType = match.match(/\[!([A-Z]+)\]/)?.[1];
    if (alertType && !GITHUB_ALERTS.includes(alertType)) {
      invalidCount++;
    }
  }

  return {
    pass: allFound && invalidCount === 0,
    score:
      allFound && invalidCount === 0
        ? 1
        : Math.max(
            0,
            (Object.keys(foundAlerts).length - missing.length) / Object.keys(foundAlerts).length
          ) *
            0.8 +
          (invalidCount === 0 ? 0.2 : 0),
    reason:
      allFound && invalidCount === 0
        ? 'All required alerts present with valid types'
        : `${missing.length > 0 ? `Missing: ${missing.join(', ')}. ` : ''}${invalidCount > 0 ? `${invalidCount} invalid alert types.` : ''}Valid types: ${GITHUB_ALERTS.join(', ')}`,
  };
}

/**
 * Checks for proper file and issue linking
 */
export async function githubProperLinking(
  output: string,
  _context: AssertionContext
): Promise<GradingResult> {
  let content: string;
  try {
    const parsed = JSON.parse(output);
    content = parsed.systemPrompt || output;
  } catch {
    content = output;
  }

  const components: Array<{ pass: boolean; score: number; reason: string }> = [];

  // Check 1: File references format (relative links or code)
  const fileRefs = content.match(/`[^`]+\.(ts|js|tsx|jsx|json|yaml|yml|md|py|go|rs)`/g) || [];
  const fileLinks =
    content.match(/\[`[^`]+\.(ts|js|tsx|jsx|json|yaml|yml|md|py|go|rs)`\]\([^)]+\)/g) || [];

  components.push({
    pass: fileRefs.length > 0 || fileLinks.length > 0,
    score: fileRefs.length + fileLinks.length > 0 ? 1 : 0,
    reason:
      fileRefs.length + fileLinks.length > 0
        ? `References ${fileRefs.length + fileLinks.length} files`
        : 'No file references found',
  });

  // Check 2: Issue/PR references (#123 format)
  const issueRefs = content.match(/#\d+/g) || [];
  components.push({
    pass: issueRefs.length > 0,
    score: issueRefs.length > 0 ? 1 : 0.5,
    reason:
      issueRefs.length > 0
        ? `References ${issueRefs.length} issues/PRs`
        : 'No issue/PR references found',
  });

  // Check 3: Line number references (file.ts:L42)
  const lineRefs =
    content.match(/[a-zA-Z0-9._-]+\.(ts|js|tsx|jsx|json|yaml|yml|md|py|go|rs):L\d+(-L\d+)?/g) || [];
  components.push({
    pass: lineRefs.length > 0,
    score: lineRefs.length > 0 ? 1 : 0.5,
    reason:
      lineRefs.length > 0
        ? `References ${lineRefs.length} code locations`
        : 'No line-specific references found',
  });

  const totalScore = components.reduce((sum, c) => sum + c.score, 0) / components.length;

  return {
    pass: totalScore >= 0.6,
    score: totalScore,
    reason: `Linking score: ${(totalScore * 100).toFixed(0)}%`,
    componentResults: components,
  };
}

/**
 * Validates use of GitHub markdown features
 */
export async function githubMarkdownFeatures(
  output: string,
  context: AssertionContext & { features?: string[] }
): Promise<GradingResult> {
  let content: string;
  try {
    const parsed = JSON.parse(output);
    content = parsed.systemPrompt || output;
  } catch {
    content = output;
  }

  const requiredFeatures = (context.features || []) as string[];
  const foundFeatures: Record<string, boolean> = {};

  // Check for various GitHub markdown features
  const featurePatterns: Record<string, RegExp> = {
    tables: /\|[\s\S]*?\|/m,
    'code-blocks': /```[\s\S]*?```/,
    'task-lists': /- \[[ x]\]/m,
    collapsible: /<details>[\s\S]*?<\/details>/i,
    'diff-syntax': /^[\s]*[+-]/m,
    'inline-code': /`[^`]+`/,
    'ascii-diagrams': /[└├│─┌┐┘]+/,
    lists: /^[\s]*[-*+]\s+\w+/m,
  };

  for (const feature of requiredFeatures) {
    if (featurePatterns[feature]) {
      foundFeatures[feature] = featurePatterns[feature].test(content);
    }
  }

  const found = Object.values(foundFeatures).filter(Boolean).length;
  const total = requiredFeatures.length;

  return {
    pass: found >= Math.ceil(total * 0.7), // At least 70% of required features
    score: total > 0 ? found / total : 1,
    reason: found > 0 ? `Found ${found}/${total} required features` : 'No required features found',
  };
}

export default githubMarkdownValid;
