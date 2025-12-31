/**
 * Failure Memory
 *
 * Stores and retrieves learned patterns from past failures
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type {
  FailurePattern,
  FixSuggestion,
  LearnedFix,
  ParsedError,
} from './types.js';
import { ErrorCategory } from './types.js';

/**
 * Pattern schema for validation
 */
const patternSchema = z.object({
  id: z.string(),
  category: z.string(),
  pattern: z.string(),
  symptom: z.string(),
  solution: z.string(),
  frequency: z.number(),
  lastSeen: z.number(),
  successRate: z.number(),
  exampleError: z.string(),
});

/**
 * Learned fix schema
 */
const learnedFixSchema = z.object({
  id: z.string(),
  errorSignature: z.string(),
  fix: z.object({
    type: z.enum(['patch', 'command', 'refactor']),
    description: z.string(),
    patch: z.object({
      file: z.string(),
      oldText: z.string(),
      newText: z.string(),
    }).optional(),
    command: z.object({
      cwd: z.string(),
      command: z.string(),
      args: z.array(z.string()),
    }).optional(),
  }),
  appliedAt: z.number(),
  worked: z.boolean(),
  timesSeen: z.number(),
  timesSuccessful: z.number(),
});

/**
 * Failure memory class
 */
export class FailureMemory {
  private patterns: Map<string, FailurePattern> = new Map();
  private fixes: Map<string, LearnedFix> = new Map();

  constructor(private memoryPath: string) {}

  /**
   * Initialize memory from disk
   */
  async load(): Promise<void> {
    await mkdir(this.memoryPath, { recursive: true });

    // Load patterns
    await this.loadPatterns();

    // Load fixes
    await this.loadFixes();

    console.log(`📚 Loaded ${this.patterns.size} patterns and ${this.fixes.size} learned fixes`);
  }

  /**
   * Find similar errors in memory
   */
  findSimilarErrors(error: ParsedError): FailurePattern[] {
    const similar: FailurePattern[] = [];

    for (const pattern of this.patterns.values()) {
      if (this.matchesPattern(error, pattern)) {
        similar.push(pattern);
      }
    }

    // Sort by success rate (highest first)
    similar.sort((a, b) => b.successRate - a.successRate);

    return similar;
  }

  /**
   * Get suggested fix for an error
   */
  getFixForError(error: ParsedError): FixSuggestion | null {
    const signature = this.getErrorSignature(error);
    const learnedFix = this.fixes.get(signature);

    if (learnedFix && learnedFix.timesSuccessful > 0) {
      const fixSuggestion: FixSuggestion = {
        error,
        description: learnedFix.fix.description,
        confidence: learnedFix.timesSuccessful / learnedFix.timesSeen,
        autoAppliable: learnedFix.worked,
      };
      if (learnedFix.fix.patch !== undefined) {
        fixSuggestion.patch = learnedFix.fix.patch;
      }
      if (learnedFix.fix.command !== undefined) {
        fixSuggestion.command = learnedFix.fix.command;
      }
      return fixSuggestion;
    }

    // Check patterns for suggestions
    const patterns = this.findSimilarErrors(error);
    if (patterns.length > 0) {
      const bestPattern = patterns[0];
      if (bestPattern === undefined) {
        return null;
      }
      return {
        error,
        description: bestPattern.solution,
        confidence: bestPattern.successRate,
        autoAppliable: false, // Pattern-based fixes need verification
      };
    }

    return null;
  }

  /**
   * Record a successful fix
   */
  async recordSuccess(error: ParsedError, fix: FixSuggestion): Promise<void> {
    const signature = this.getErrorSignature(error);
    const existing = this.fixes.get(signature);

    if (existing) {
      // Update existing fix
      existing.timesSeen++;
      existing.timesSuccessful++;
      existing.appliedAt = Date.now();
    } else {
      // Create new fix
      const newFix: LearnedFix = {
        id: this.generateId(),
        errorSignature: signature,
        fix: {
          type: fix.patch ? 'patch' : fix.command ? 'command' : 'refactor',
          description: fix.description,
          patch: fix.patch,
          command: fix.command,
        },
        appliedAt: Date.now(),
        worked: true,
        timesSeen: 1,
        timesSuccessful: 1,
      };

      this.fixes.set(signature, newFix);
    }

    await this.saveFixes();
  }

  /**
   * Record a failed fix attempt
   */
  async recordFailure(_error: ParsedError, _fix: FixSuggestion): Promise<void> {
    const signature = this.getErrorSignature(_error);
    const existing = this.fixes.get(signature);

    if (existing) {
      existing.timesSeen++;
      // Don't increment timesSuccessful
      existing.appliedAt = Date.now();
    }

    await this.saveFixes();
  }

  /**
   * Learn from a failure
   */
  async learnFromFailure(
    error: ParsedError,
    solution: string,
    worked: boolean,
  ): Promise<void> {
    const signature = this.getErrorSignature(error);
    let pattern = this.patterns.get(signature);

    if (pattern) {
      // Update existing pattern
      pattern.frequency++;
      pattern.lastSeen = Date.now();
      if (worked) {
        // Update success rate using weighted average
        const weight = 0.3; // New data has 30% weight
        pattern.successRate =
          pattern.successRate * (1 - weight) + (worked ? 1 : 0) * weight;
      }
    } else {
      // Create new pattern
      pattern = {
        id: signature,
        category: error.category,
        pattern: this.extractPattern(error),
        symptom: error.message,
        solution,
        frequency: 1,
        lastSeen: Date.now(),
        successRate: worked ? 1 : 0,
        exampleError: error.message,
      };

      this.patterns.set(signature, pattern);
    }

    await this.savePatterns();
  }

  /**
   * Get error signature for matching
   */
  private getErrorSignature(error: ParsedError): string {
    // Create a signature based on error category and message pattern
    const signatureData = {
      category: error.category,
      code: error.code,
      // Normalize the message by removing specific values
      pattern: error.message
        .replace(/'[^']*'/g, "'X'")
        .replace(/"[^"]*"/g, '"X"')
        .replace(/\d+/g, 'N')
        .replace(/[\w.-]+@\w[\w.-]+/g, 'email'),
    };

    return createHash('sha256')
      .update(JSON.stringify(signatureData))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Extract pattern from error for matching
   */
  private extractPattern(error: ParsedError): string {
    // Create a regex-friendly pattern from the error
    let pattern = error.message
      .replace(/'[^']*'/g, "'.*?'")
      .replace(/"[^"]*"/g, '".*?"')
      .replace(/\d+/g, '\\d+')
      .replace(/\./g, '\\.') // Escape dots
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');

    // Add category prefix if file info available
    if (error.file) {
      pattern = `${error.file.replace(/\./g, '\\.')}:\\d+:\\d+:\\s+${pattern}`;
    }

    return pattern;
  }

  /**
   * Check if error matches a pattern
   */
  private matchesPattern(error: ParsedError, pattern: FailurePattern): boolean {
    try {
      const regex = new RegExp(pattern.pattern, 'i');
      return regex.test(error.message);
    } catch {
      return false;
    }
  }

  /**
   * Load patterns from disk
   */
  private async loadPatterns(): Promise<void> {
    try {
      const patternFile = join(this.memoryPath, 'patterns.json');
      const content = await readFile(patternFile, 'utf-8');
      const data = JSON.parse(content);

      for (const item of data) {
        const parsed = patternSchema.parse(item);
        const pattern: FailurePattern = {
          ...parsed,
          category: parsed.category as ErrorCategory,
        };
        this.patterns.set(pattern.id, pattern);
      }
    } catch (error) {
      // File doesn't exist yet or is invalid
      console.debug('No existing patterns found');
    }
  }

  /**
   * Load fixes from disk
   */
  private async loadFixes(): Promise<void> {
    try {
      const fixFile = join(this.memoryPath, 'fixes.json');
      const content = await readFile(fixFile, 'utf-8');
      const data = JSON.parse(content);

      for (const item of data) {
        const fix = learnedFixSchema.parse(item);
        this.fixes.set(fix.errorSignature, fix);
      }
    } catch (error) {
      // File doesn't exist yet or is invalid
      console.debug('No existing fixes found');
    }
  }

  /**
   * Save patterns to disk
   */
  private async savePatterns(): Promise<void> {
    const patternFile = join(this.memoryPath, 'patterns.json');
    const data = Array.from(this.patterns.values());
    await writeFile(patternFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Save fixes to disk
   */
  private async saveFixes(): Promise<void> {
    const fixFile = join(this.memoryPath, 'fixes.json');
    const data = Array.from(this.fixes.values());
    await writeFile(fixFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get statistics about learned patterns
   */
  getStats(): { patternCount: number; fixCount: number; successRate: number } {
    let totalSuccesses = 0;
    let totalAttempts = 0;

    for (const fix of this.fixes.values()) {
      totalSuccesses += fix.timesSuccessful;
      totalAttempts += fix.timesSeen;
    }

    return {
      patternCount: this.patterns.size,
      fixCount: this.fixes.size,
      successRate: totalAttempts > 0 ? totalSuccesses / totalAttempts : 0,
    };
  }
}

/**
 * Singleton instance (initialized later)
 */
let memoryInstance: FailureMemory | null = null;

/**
 * Get or create failure memory instance
 */
export function getFailureMemory(memoryPath: string): FailureMemory {
  if (!memoryInstance) {
    memoryInstance = new FailureMemory(memoryPath);
  }
  return memoryInstance;
}
