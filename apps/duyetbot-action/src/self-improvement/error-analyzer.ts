/**
 * Error Analyzer
 *
 * Parses and categorizes error messages from various tools
 */

import { readFile } from 'node:fs/promises';
import type { ParsedError } from './types.js';
import { ErrorCategory, ErrorSeverity } from './types.js';

/**
 * Error patterns for common tools
 */
const ERROR_PATTERNS = [
  // TypeScript errors: file.ts(line:col): error TSXXX: message
  {
    regex: /(\S+?\.(?:ts|tsx|js|jsx))\((\d+):(\d+)\):\s+error\s+(TS\d+):\s+(.+)/i,
    category: 'type' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
  },
  // TypeScript: error TSXXX: message (no location)
  {
    regex: /error\s+(TS\d+):\s+(.+)/i,
    category: 'type' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
  },
  // Build errors: Error: Cannot find module '...'
  {
    regex: /Error:\s+Cannot find module ['"](.+?)['"]/i,
    category: 'dependency' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
  },
  // Build errors: Error: Cannot find symbol
  {
    regex: /error:\s+Cannot find symbol/i,
    category: 'type_missing' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
  },
  // Test failures: FAIL <test name>
  {
    regex: /FAIL\s+(.+)/i,
    category: 'test_failure' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
  },
  // Test timeout: Test timed out after
  {
    regex: /Test timed out after\s+(\d+)ms/i,
    category: 'test_timeout' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
  },
  // Lint errors: error  <file>:<line>:<col>  <message>
  {
    regex: /error\s+(.+?):(\d+):(\d+)\s+(.+)/i,
    category: 'lint' as ErrorCategory,
    severity: 'low' as ErrorSeverity,
  },
  // Git merge conflicts: <<<<<<< HEAD
  {
    regex: /<<<<<<<\s+HEAD/i,
    category: 'merge_conflict' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
  },
  // Runtime reference errors: ReferenceError: ... is not defined
  {
    regex: /ReferenceError:\s+(.+?)\s+is not defined/i,
    category: 'runtime_reference' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
  },
  // General build errors
  {
    regex: /Build failed with\s+(\d+)\s+error/i,
    category: 'build' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
  },
];

/**
 * Error analyzer class
 */
export class ErrorAnalyzer {
  /**
   * Parse a single error message
   */
  parseError(message: string, context?: string): ParsedError {
    const trimmedMessage = message.trim();

    // Try to match against known patterns
    for (const pattern of ERROR_PATTERNS) {
      const match = trimmedMessage.match(pattern.regex);
      if (match) {
        return this.buildParsedError(match, pattern, trimmedMessage);
      }
    }

    // If no pattern matches, categorize as unknown
    const parsedError: ParsedError = {
      category: ErrorCategory.UNKNOWN,
      severity: this.estimateSeverity(trimmedMessage),
      message: trimmedMessage,
    };
    if (context !== undefined) {
      parsedError.context = context;
    }
    return parsedError;
  }

  /**
   * Parse multiple errors from output
   */
  parseErrors(output: string): ParsedError[] {
    const errors: ParsedError[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines and non-error lines
      if (!trimmed || this.isInfoLine(trimmed)) {
        continue;
      }

      const error = this.parseError(trimmed);
      if (error.category !== ErrorCategory.UNKNOWN) {
        errors.push(error);
      }
    }

    return errors;
  }

  /**
   * Get error context (lines around the error)
   */
  async getErrorContext(
    file: string,
    line: number,
    contextLines = 3,
  ): Promise<string> {
    try {
      const content = await readFile(file, 'utf-8');
      const lines = content.split('\n');

      const start = Math.max(0, line - contextLines - 1);
      const end = Math.min(lines.length, line + contextLines);

      const contextLines_array = lines.slice(start, end);
      return contextLines_array
        .map((l, i) => {
          const lineNum = start + i + 1;
          const prefix = lineNum === line ? '>>> ' : '    ';
          return `${prefix}${lineNum}: ${l}`;
        })
        .join('\n');
    } catch {
      return '';
    }
  }

  /**
   * Check if line is informational (not an error)
   */
  private isInfoLine(line: string): boolean {
    const infoPrefixes = [
      'info',
      'warn',
      'note',
      'hint',
      'suggestion',
      '✔',
      '✓',
      '✅',
      '->',
      '▸',
    ];

    const lowerLine = line.toLowerCase();
    return infoPrefixes.some((prefix) => lowerLine.startsWith(prefix));
  }

  /**
   * Build parsed error from regex match
   */
  private buildParsedError(
    match: RegExpMatchArray,
    pattern: (typeof ERROR_PATTERNS)[0],
    originalMessage: string,
  ): ParsedError {
    const error: ParsedError = {
      category: pattern.category,
      severity: pattern.severity,
      message: originalMessage,
    };

    // Extract structured information based on match groups
    // Match groups vary by pattern, so we check them dynamically
    if (match[1]) {
      // Could be file or error code depending on pattern
      if (match[1]?.includes('.')) {
        error.file = match[1];
        if (match[2]) error.line = parseInt(match[2], 10);
        if (match[3]) error.column = parseInt(match[3], 10);
        if (match[4]) error.code = match[4];
        if (match[5]) {
          // Extract just the error message part
          error.message = match[5];
        }
      } else if (match[1]?.startsWith('TS')) {
        error.code = match[1];
        error.message = match[2] || originalMessage;
      }
    }

    return error;
  }

  /**
   * Estimate severity from message content
   */
  private estimateSeverity(message: string): ErrorSeverity {
    const lowerMessage = message.toLowerCase();

    // Critical indicators
    if (
      lowerMessage.includes('fatal') ||
      lowerMessage.includes('panic') ||
      lowerMessage.includes('cannot continue')
    ) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity indicators
    if (
      lowerMessage.includes('error') ||
      lowerMessage.includes('failed') ||
      lowerMessage.includes('exception') ||
      lowerMessage.includes('cannot')
    ) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity indicators
    if (
      lowerMessage.includes('warning') ||
      lowerMessage.includes('deprecated') ||
      lowerMessage.includes('timeout')
    ) {
      return ErrorSeverity.MEDIUM;
    }

    // Default to low
    return ErrorSeverity.LOW;
  }

  /**
   * Group errors by category
   */
  groupByCategory(errors: ParsedError[]): Map<ErrorCategory, ParsedError[]> {
    const groups = new Map<ErrorCategory, ParsedError[]>();

    for (const error of errors) {
      const existing = groups.get(error.category) || [];
      existing.push(error);
      groups.set(error.category, existing);
    }

    return groups;
  }

  /**
   * Get error summary
   */
  getSummary(errors: ParsedError[]): string {
    if (errors.length === 0) {
      return 'No errors detected';
    }

    const groups = this.groupByCategory(errors);
    const parts: string[] = [];

    parts.push(`Total errors: ${errors.length}`);

    for (const [category, categoryErrors] of groups.entries()) {
      parts.push(`  ${category}: ${categoryErrors.length}`);
    }

    return parts.join('\n');
  }
}

/**
 * Singleton instance
 */
export const errorAnalyzer = new ErrorAnalyzer();
