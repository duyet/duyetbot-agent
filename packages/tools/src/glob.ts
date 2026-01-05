/**
 * Glob Tool - Fast file pattern matching (Claude Code-style)
 *
 * Provides fast file pattern matching using glob patterns like "**\/*.ts".
 * Returns matching file paths sorted by modification time.
 *
 * Features:
 * - Full glob pattern support (**, *, ?, {a,b}, [abc])
 * - Respects .gitignore patterns
 * - Sorted by modification time (most recent first)
 * - Configurable depth and limits
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';

// =============================================================================
// Input Schema
// =============================================================================

const globInputSchema = z.object({
  /** Glob pattern to match files (e.g., "**\/*.ts", "src/**\/*.tsx") */
  pattern: z.string().min(1, 'Pattern is required'),
  /** Directory to search in (defaults to current directory) */
  path: z.string().optional(),
  /** Maximum number of results to return (default: 100) */
  limit: z.number().int().positive().optional(),
  /** Include hidden files and directories (default: false) */
  includeHidden: z.boolean().optional(),
  /** Maximum directory depth to search (default: 20) */
  maxDepth: z.number().int().positive().optional(),
});

type GlobInput = z.infer<typeof globInputSchema>;

// =============================================================================
// Glob Pattern Matching
// =============================================================================

/**
 * Convert a glob pattern to a RegExp
 *
 * Supports:
 * - ** = matches any number of directories
 * - * = matches anything except /
 * - ? = matches exactly one character except /
 * - {a,b} = matches either a or b
 * - [abc] = matches any character in the set
 * - [!abc] = matches any character not in the set
 */
function globToRegex(pattern: string): RegExp {
  let regexStr = '';
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];

    if (char === '*') {
      if (pattern[i + 1] === '*') {
        // ** matches any number of path segments
        if (pattern[i + 2] === '/') {
          regexStr += '(?:.*\\/)?';
          i += 3;
        } else {
          regexStr += '.*';
          i += 2;
        }
      } else {
        // * matches anything except /
        regexStr += '[^\\/]*';
        i++;
      }
    } else if (char === '?') {
      // ? matches exactly one character except /
      regexStr += '[^\\/]';
      i++;
    } else if (char === '{') {
      // {a,b,c} matches any of the alternatives
      const end = pattern.indexOf('}', i);
      if (end !== -1) {
        const alternatives = pattern.slice(i + 1, end).split(',');
        regexStr += `(?:${alternatives.map(escapeRegex).join('|')})`;
        i = end + 1;
      } else {
        regexStr += escapeRegex(char);
        i++;
      }
    } else if (char === '[') {
      // [abc] or [!abc] character class
      const end = pattern.indexOf(']', i);
      if (end !== -1) {
        const inner = pattern.slice(i + 1, end);
        if (inner.startsWith('!')) {
          regexStr += `[^${inner.slice(1)}]`;
        } else {
          regexStr += `[${inner}]`;
        }
        i = end + 1;
      } else {
        regexStr += escapeRegex(char);
        i++;
      }
    } else {
      regexStr += escapeRegex(char);
      i++;
    }
  }

  return new RegExp(`^${regexStr}$`);
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string | undefined): string {
  if (!str) {
    return '';
  }
  return str.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

// =============================================================================
// Gitignore Support
// =============================================================================

interface IgnorePatterns {
  patterns: RegExp[];
  negations: RegExp[];
}

/**
 * Parse .gitignore file content into patterns
 */
function parseGitignore(content: string): IgnorePatterns {
  const patterns: RegExp[] = [];
  const negations: RegExp[] = [];

  for (let line of content.split('\n')) {
    // Remove trailing whitespace
    line = line.trimEnd();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) {
      continue;
    }

    // Handle negation patterns
    const isNegation = line.startsWith('!');
    if (isNegation) {
      line = line.slice(1);
    }

    // Convert to glob pattern
    let pattern = line;

    // If pattern ends with /, it matches only directories
    // For our purposes, we'll match anything under that directory
    if (pattern.endsWith('/')) {
      pattern = `${pattern}**`;
    }

    // If pattern doesn't start with /, it matches anywhere
    if (pattern.startsWith('/')) {
      pattern = pattern.slice(1);
    } else {
      pattern = `**/${pattern}`;
    }

    const regex = globToRegex(pattern);

    if (isNegation) {
      negations.push(regex);
    } else {
      patterns.push(regex);
    }
  }

  return { patterns, negations };
}

/**
 * Check if a path should be ignored based on gitignore patterns
 */
function shouldIgnore(relativePath: string, ignorePatterns: IgnorePatterns): boolean {
  // Check if any pattern matches
  const matches = ignorePatterns.patterns.some((p) => p.test(relativePath));

  if (!matches) {
    return false;
  }

  // Check if any negation pattern un-ignores it
  const negated = ignorePatterns.negations.some((p) => p.test(relativePath));

  return !negated;
}

// =============================================================================
// File Walking
// =============================================================================

interface FileInfo {
  path: string;
  relativePath: string;
  mtime: Date;
}

/**
 * Recursively walk a directory and collect matching files
 */
async function walkAndMatch(
  rootDir: string,
  pattern: RegExp,
  options: {
    includeHidden: boolean;
    maxDepth: number;
    ignorePatterns: IgnorePatterns;
  },
  currentDir: string = rootDir,
  depth: number = 0
): Promise<FileInfo[]> {
  if (depth >= options.maxDepth) {
    return [];
  }

  const results: FileInfo[] = [];

  try {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files if not requested
      if (!options.includeHidden && entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = join(currentDir, entry.name);
      const relativePath = relative(rootDir, fullPath);

      // Check gitignore patterns
      if (shouldIgnore(relativePath, options.ignorePatterns)) {
        continue;
      }

      if (entry.isDirectory()) {
        // Recursively walk subdirectories
        const subResults = await walkAndMatch(rootDir, pattern, options, fullPath, depth + 1);
        results.push(...subResults);
      } else if (entry.isFile()) {
        // Check if file matches the pattern
        if (pattern.test(relativePath)) {
          try {
            const stats = await stat(fullPath);
            results.push({
              path: fullPath,
              relativePath,
              mtime: stats.mtime,
            });
          } catch {
            // Skip files we can't stat
          }
        }
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return results;
}

// =============================================================================
// Tool Implementation
// =============================================================================

/**
 * Glob Tool - Fast file pattern matching
 *
 * Similar to Claude Code's Glob tool, this provides fast file pattern
 * matching with full glob syntax support.
 */
export class GlobTool implements Tool {
  name = 'glob';
  description =
    'Fast file pattern matching tool. Supports glob patterns like "**/*.ts" or "src/**/*.tsx". ' +
    'Returns matching file paths sorted by modification time (most recent first). ' +
    'Respects .gitignore patterns by default.';
  inputSchema = globInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    try {
      const parsed = this.inputSchema.parse(input.content) as GlobInput;
      const {
        pattern,
        path: searchPath = '.',
        limit = 100,
        includeHidden = false,
        maxDepth = 20,
      } = parsed;

      const rootDir = resolve(searchPath);
      const patternRegex = globToRegex(pattern);

      // Load .gitignore if present
      let ignorePatterns: IgnorePatterns = { patterns: [], negations: [] };
      try {
        const gitignoreContent = await readFile(join(rootDir, '.gitignore'), 'utf-8');
        ignorePatterns = parseGitignore(gitignoreContent);
      } catch {
        // No .gitignore or can't read it
      }

      // Always ignore common non-essential directories
      const defaultIgnores = [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        'coverage/**',
        '.next/**',
        '.nuxt/**',
        '__pycache__/**',
        '.venv/**',
        'venv/**',
      ];

      for (const ignorePattern of defaultIgnores) {
        ignorePatterns.patterns.push(globToRegex(`**/${ignorePattern}`));
      }

      // Walk directory and find matches
      const files = await walkAndMatch(rootDir, patternRegex, {
        includeHidden,
        maxDepth,
        ignorePatterns,
      });

      // Sort by modification time (most recent first)
      files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Apply limit
      const limited = files.slice(0, limit);

      // Return just the relative paths
      const paths = limited.map((f) => f.relativePath);

      return {
        status: 'success',
        content: paths.join('\n'),
        metadata: {
          pattern,
          path: rootDir,
          totalMatches: files.length,
          returned: paths.length,
          truncated: files.length > limit,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'Failed to execute glob pattern',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'GLOB_FAILED',
        },
      };
    }
  }
}

export const globTool = new GlobTool();

// =============================================================================
// Type Exports
// =============================================================================

export type { GlobInput };
