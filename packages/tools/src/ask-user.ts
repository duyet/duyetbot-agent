/**
 * AskUser Tool - Interactive User Clarification (Claude Code-style)
 *
 * Allows the agent to ask the user questions during execution.
 * Use for gathering preferences, clarifying ambiguous instructions,
 * or getting decisions on implementation choices.
 *
 * Features:
 * - Single or multiple choice questions
 * - Multi-select support for non-exclusive options
 * - Structured question format with descriptions
 */

import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';

// =============================================================================
// Types
// =============================================================================

/**
 * Question option structure
 */
export interface QuestionOption {
  /** Display text for this option */
  label: string;
  /** Explanation of what this option means */
  description: string;
}

/**
 * Question structure
 */
export interface Question {
  /** The complete question to ask */
  question: string;
  /** Short label for the question (max 12 chars) */
  header: string;
  /** Available choices (2-4 options) */
  options: QuestionOption[];
  /** Allow multiple selections */
  multiSelect: boolean;
}

// =============================================================================
// Input Schema
// =============================================================================

const optionSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  description: z.string(),
});

const questionSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  header: z.string().max(12, 'Header must be 12 characters or less'),
  options: z.array(optionSchema).min(2).max(4),
  multiSelect: z.boolean(),
});

const askUserInputSchema = z.object({
  /** Questions to ask the user (1-4 questions) */
  questions: z.array(questionSchema).min(1).max(4),
});

type AskUserInput = z.infer<typeof askUserInputSchema>;

// =============================================================================
// Pending Questions Storage
// =============================================================================

/**
 * Store for pending questions that need user response
 */
let pendingQuestions: Question[] = [];
let pendingAnswers: Map<string, string | string[]> = new Map();

/**
 * Get pending questions
 */
export function getPendingQuestions(): Question[] {
  return [...pendingQuestions];
}

/**
 * Set user answers for pending questions
 */
export function setAnswers(answers: Map<string, string | string[]>): void {
  pendingAnswers = new Map(answers);
}

/**
 * Clear pending questions and answers
 */
export function clearPendingQuestions(): void {
  pendingQuestions = [];
  pendingAnswers.clear();
}

/**
 * Check if there are pending questions
 */
export function hasPendingQuestions(): boolean {
  return pendingQuestions.length > 0;
}

// =============================================================================
// Formatting
// =============================================================================

/**
 * Format questions for display
 */
function formatQuestionsForDisplay(questions: Question[]): string {
  const lines: string[] = ['## Questions for User', ''];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q) continue;

    lines.push(`### ${i + 1}. ${q.header}`);
    lines.push(`**${q.question}**`);
    lines.push('');
    lines.push('Options:');

    for (let j = 0; j < q.options.length; j++) {
      const opt = q.options[j];
      if (!opt) continue;
      const prefix = q.multiSelect ? '☐' : '○';
      lines.push(`${prefix} **${opt.label}**`);
      if (opt.description) {
        lines.push(`  ${opt.description}`);
      }
    }

    if (q.multiSelect) {
      lines.push('');
      lines.push('_(Multiple selections allowed)_');
    }

    lines.push('');
  }

  lines.push('---');
  lines.push('_Please respond with your choices._');

  return lines.join('\n');
}

// =============================================================================
// Tool Implementation
// =============================================================================

/**
 * AskUser Tool - Ask the user questions during execution
 *
 * Use this tool when you need to:
 * - Gather user preferences or requirements
 * - Clarify ambiguous instructions
 * - Get decisions on implementation choices
 * - Offer choices about what direction to take
 */
export class AskUserTool implements Tool {
  name = 'ask_user';
  description =
    'Ask the user questions during execution. Use when you need to gather preferences, ' +
    'clarify ambiguous instructions, or get decisions on implementation choices. ' +
    'Supports single-choice and multi-select questions with 2-4 options each.';
  inputSchema = askUserInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    try {
      const parsed = this.inputSchema.parse(input.content) as AskUserInput;
      const { questions } = parsed;

      // Store questions for the platform to display
      pendingQuestions = questions.map((q) => ({
        question: q.question,
        header: q.header,
        options: q.options.map((o) => ({ ...o })),
        multiSelect: q.multiSelect,
      }));

      // Format questions for output
      const formatted = formatQuestionsForDisplay(pendingQuestions);

      return {
        status: 'success',
        content: formatted,
        metadata: {
          questionsCount: questions.length,
          requiresUserResponse: true,
          questions: pendingQuestions,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'Failed to create questions',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'ASK_USER_FAILED',
        },
      };
    }
  }
}

export const askUserTool = new AskUserTool();

// =============================================================================
// Type Exports
// =============================================================================

export type { AskUserInput };
