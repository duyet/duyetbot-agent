/**
 * Agent Registrations
 *
 * This file contains ONLY the registration metadata for all agents.
 * It has NO dependencies on Cloudflare-specific code (agents, cloudflare:*).
 *
 * Purpose:
 * - Allows tests to import registrations without triggering Cloudflare runtime errors
 * - Centralizes agent metadata for easy discovery and modification
 * - Enables pattern-based quick classification in Node.js test environment
 *
 * Usage in tests:
 * ```typescript
 * import "../agents/registrations.js"; // Populates registry
 * import { quickClassify } from "../routing/classifier.js";
 * ```
 *
 * Usage in production:
 * Agent modules also call register() at module load time,
 * so registration happens automatically when agents are imported.
 * This file provides a lightweight alternative for test environments.
 */

import { agentRegistry } from './registry.js';

// =============================================================================
// SimpleAgent Registration
// =============================================================================

agentRegistry.register({
  name: 'simple-agent',
  description:
    'Handles simple questions that can be answered directly without tools. Used for greetings, explanations, general knowledge, help requests, list commands for MCPs and tools, and any query that does not require web search, code tools, or external APIs.',
  examples: [
    'hi',
    'hello',
    'help',
    '/help',
    'what is a function?',
    'list all mcps',
    'list all tools',
  ],
  triggers: {
    patterns: [
      // Greetings (anchored to start)
      /^(hi|hello|hey|good\s+(morning|afternoon|evening))[\s!.]*$/i,
      // Help commands
      /^\/?(help|start)[\s!.]*$/i,
      // List command patterns
      /^(list|show|what)\s+(all\s+)?(mcps?|mcp\s+servers?)/i,
      /^(list|show|what)\s+(all\s+)?tools/i,
      /^(list|show|what)\s+tools\s+(from|available\s+in)\s+\w+/i,
    ],
    keywords: ['list', 'show', 'mcps', 'tools', 'available'],
    categories: ['general'],
  },
  capabilities: {
    complexity: 'low',
  },
  priority: 10, // Low priority - fallback agent
});

// =============================================================================
// HITLAgent Registration (Human-in-the-Loop)
// =============================================================================

agentRegistry.register({
  name: 'hitl-agent',
  description:
    'Handles operations requiring human approval such as destructive actions (delete, reset, clear), tool confirmations (yes/no), and any action that modifies important data or settings.',
  examples: ['yes', 'no', 'approve', 'reject', 'delete all data', 'reset settings', '/clear'],
  triggers: {
    patterns: [
      // Tool confirmation responses (anchored for exact match)
      /^(yes|no|y|n|approve|reject|confirm|cancel)[\s!.]*$/i,
      // Destructive commands
      /\b(delete|remove|drop|reset|destroy)\s+(this|the|all)\b/i,
      // Clear/reset commands
      /^\/?(clear|reset)[\s!.]*$/i,
    ],
    categories: ['admin', 'destructive', 'confirmation'],
  },
  capabilities: {
    requiresApproval: true,
  },
  priority: 100, // Highest priority - always check confirmations first
});

// =============================================================================
// OrchestratorAgent Registration
// =============================================================================

agentRegistry.register({
  name: 'orchestrator-agent',
  description:
    'Handles complex multi-step tasks requiring planning, code analysis, GitHub operations, or coordination of multiple tools. Used for refactoring, debugging, PR reviews, and tasks that need sequential execution.',
  examples: [
    'refactor this function',
    'analyze this PR and fix issues',
    'debug the authentication flow',
    'rewrite the error handling',
  ],
  triggers: {
    patterns: [
      // Complex multi-step patterns
      /\b(refactor|rewrite)\s+(this|the)\s+\w+/i,
      /\banalyze\s+.*(and|then)\s+(fix|implement|create)/i,
    ],
    categories: ['code', 'github', 'complex'],
  },
  capabilities: {
    tools: ['code_tools', 'github_api', 'web_search', 'planning'],
    complexity: 'high',
  },
  priority: 40, // Below research (60) but above simple (10)
});

// =============================================================================
// DuyetInfoAgent Registration
// =============================================================================

agentRegistry.register({
  name: 'duyet-info-agent',
  description:
    'Answers questions about Duyet (the person), his blog posts, CV, skills, experience, and contact information. Only handles queries explicitly about Duyet or his personal content.',
  examples: [
    'who is duyet',
    'tell me about duyet',
    "duyet's blog posts",
    "duyet's latest articles",
    'what is your CV',
    'your skills and experience',
    'your contact info',
    'duyet.net',
  ],
  triggers: {
    // Specific patterns - won't match "@duyetbot" bot mentions
    patterns: [
      /\b(who\s+(is|are)\s+duyet)\b/i, // "who is duyet"
      /\bduyet'?s?\s+(blog|cv|resume|bio|posts?|articles?|skills?|experience)\b/i, // "duyet's blog"
      /\b(about|tell\s+me\s+about)\s+duyet\b/i, // "about duyet"
      /\bblog\.duyet\b/i, // "blog.duyet.net"
      /\bduyet\.net\b/i, // "duyet.net"
      // "your X" patterns for personal info queries (when bot is addressed directly)
      /\b(your)\s+(cv|resume|bio|experience|skills?|education|contact)\b/i,
    ],
    keywords: [
      'cv',
      'resume',
      'about me',
      'contact info',
      'bio',
      'my experience',
      'my skills',
      'my education',
    ],
    categories: ['duyet'],
  },
  capabilities: {
    tools: ['duyet_mcp'],
    complexity: 'low',
  },
  priority: 50, // Medium priority - below research (60) to avoid catching "latest news"
});

// =============================================================================
// LeadResearcherAgent Registration
// =============================================================================

agentRegistry.register({
  name: 'lead-researcher-agent',
  description:
    'Handles complex research queries requiring web search, synthesis of multiple sources, and comprehensive analysis. Used for news, trends, comparisons, and any query needing current information.',
  examples: [
    'latest AI news',
    'compare React vs Vue in 2024',
    'what are the best practices for TypeScript',
    'research the new Cloudflare features',
  ],
  triggers: {
    patterns: [
      // Research indicators
      /\b(research|investigate|analyze|compare|review)\s+.{10,}/i,
      // News and trends
      /\b(latest|recent|new|current|trending)\s+(news|updates|developments|releases)/i,
      // Best practices and recommendations
      /\b(best\s+practices|recommendations?|how\s+to)\s+.{10,}/i,
    ],
    keywords: ['news', 'latest', 'trending', 'compare', 'research'],
    categories: ['research'],
  },
  capabilities: {
    tools: ['web_search', 'web_fetch', 'synthesis'],
    complexity: 'medium',
  },
  priority: 60, // Higher than duyet (50) - "latest news" should route here
});
