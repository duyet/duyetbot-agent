/**
 * Grep Tool - Powerful code search (Claude Code-style)
 *
 * A powerful search tool for searching file contents using regex patterns.
 * Inspired by ripgrep with Claude Code-style output modes.
 *
 * Features:
 * - Full regex syntax support
 * - Multiple output modes (content, files_with_matches, count)
 * - Context lines (-A/-B/-C)
 * - Case-insensitive search
 * - File type filtering
 * - Glob pattern filtering
 * - Respects .gitignore
 */

import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';

// =============================================================================
// Input Schema
// =============================================================================

const grepInputSchema = z.object({
  /** Regex pattern to search for */
  pattern: z.string().min(1, 'Pattern is required'),
  /** File or directory to search in (defaults to current directory) */
  path: z.string().optional(),
  /** Glob pattern to filter files (e.g., "*.ts", "*.{ts,tsx}") */
  glob: z.string().optional(),
  /** File type to search (e.g., "ts", "js", "py") */
  type: z.string().optional(),
  /** Output mode: "content", "files_with_matches", or "count" */
  output_mode: z.enum(['content', 'files_with_matches', 'count']).optional(),
  /** Number of lines to show after each match (-A) */
  '-A': z.number().int().min(0).optional(),
  /** Number of lines to show before each match (-B) */
  '-B': z.number().int().min(0).optional(),
  /** Number of lines to show before and after each match (-C) */
  '-C': z.number().int().min(0).optional(),
  /** Case insensitive search (-i) */
  '-i': z.boolean().optional(),
  /** Show line numbers in output (-n) */
  '-n': z.boolean().optional(),
  /** Enable multiline mode where . matches newlines */
  multiline: z.boolean().optional(),
  /** Limit output to first N lines/entries */
  head_limit: z.number().int().positive().optional(),
  /** Skip first N lines/entries */
  offset: z.number().int().min(0).optional(),
});

type GrepInput = z.infer<typeof grepInputSchema>;

// =============================================================================
// File Type Mappings
// =============================================================================

const FILE_TYPE_EXTENSIONS: Record<string, string[]> = {
  ts: ['.ts', '.tsx', '.mts', '.cts'],
  typescript: ['.ts', '.tsx', '.mts', '.cts'],
  js: ['.js', '.jsx', '.mjs', '.cjs'],
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  py: ['.py', '.pyw', '.pyi'],
  python: ['.py', '.pyw', '.pyi'],
  rust: ['.rs'],
  go: ['.go'],
  java: ['.java'],
  c: ['.c', '.h'],
  cpp: ['.cpp', '.cc', '.cxx', '.c++', '.hpp', '.hh', '.hxx', '.h++', '.h'],
  css: ['.css', '.scss', '.sass', '.less'],
  html: ['.html', '.htm', '.xhtml'],
  json: ['.json', '.jsonc', '.json5'],
  yaml: ['.yaml', '.yml'],
  md: ['.md', '.markdown'],
  markdown: ['.md', '.markdown'],
  sh: ['.sh', '.bash', '.zsh'],
  shell: ['.sh', '.bash', '.zsh'],
  sql: ['.sql'],
  graphql: ['.graphql', '.gql'],
  proto: ['.proto'],
  toml: ['.toml'],
  xml: ['.xml', '.xsl', '.xslt'],
};

// =============================================================================
// Glob Pattern Matching
// =============================================================================

function globToRegex(pattern: string): RegExp {
  let regexStr = '';
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i]!;

    if (char === '*') {
      regexStr += '[^\\/]*';
      i++;
    } else if (char === '?') {
      regexStr += '[^\\/]';
      i++;
    } else if (char === '{') {
      const end = pattern.indexOf('}', i);
      if (end !== -1) {
        const alternatives = pattern.slice(i + 1, end).split(',');
        regexStr += `(?:${alternatives.map((s) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&')).join('|')})`;
        i = end + 1;
      } else {
        regexStr += '\\{';
        i++;
      }
    } else {
      regexStr += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
      i++;
    }
  }

  return new RegExp(`^${regexStr}$`);
}

// =============================================================================
// File Walking
// =============================================================================

async function findFiles(
  rootDir: string,
  options: {
    glob?: string;
    type?: string;
    maxDepth?: number;
  },
  currentDir: string = rootDir,
  depth: number = 0
): Promise<string[]> {
  const maxDepth = options.maxDepth ?? 20;

  if (depth >= maxDepth) {
    return [];
  }

  const results: string[] = [];

  // Common directories to skip
  const skipDirs = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.next',
    '.nuxt',
    '__pycache__',
    '.venv',
    'venv',
    '.cache',
    '.turbo',
  ]);

  try {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files and common non-essential directories
      if (entry.name.startsWith('.') && entry.name !== '.') {
        continue;
      }

      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) {
          continue;
        }
        const subResults = await findFiles(rootDir, options, fullPath, depth + 1);
        results.push(...subResults);
      } else if (entry.isFile()) {
        // Check file type filter
        if (options.type) {
          const extensions = FILE_TYPE_EXTENSIONS[options.type.toLowerCase()];
          if (extensions) {
            const ext = extname(entry.name).toLowerCase();
            if (!extensions.includes(ext)) {
              continue;
            }
          }
        }

        // Check glob filter
        if (options.glob) {
          const globRegex = globToRegex(options.glob);
          if (!globRegex.test(entry.name)) {
            continue;
          }
        }

        results.push(fullPath);
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return results;
}

// =============================================================================
// Search Implementation
// =============================================================================

interface Match {
  file: string;
  line: number;
  content: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

interface SearchResult {
  file: string;
  matches: Match[];
  matchCount: number;
}

async function searchFile(
  filePath: string,
  pattern: RegExp,
  options: {
    beforeContext: number;
    afterContext: number;
    showLineNumbers: boolean;
  }
): Promise<SearchResult | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const matches: Match[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) {
        continue;
      }

      if (pattern.test(line)) {
        const match: Match = {
          file: filePath,
          line: i + 1,
          content: line,
        };

        // Add context before
        if (options.beforeContext > 0) {
          const start = Math.max(0, i - options.beforeContext);
          match.contextBefore = lines.slice(start, i);
        }

        // Add context after
        if (options.afterContext > 0) {
          const end = Math.min(lines.length, i + 1 + options.afterContext);
          match.contextAfter = lines.slice(i + 1, end);
        }

        matches.push(match);
      }
    }

    if (matches.length === 0) {
      return null;
    }

    return {
      file: filePath,
      matches,
      matchCount: matches.length,
    };
  } catch {
    // Skip files we can't read (binary files, permission errors, etc.)
    return null;
  }
}

// =============================================================================
// Output Formatting
// =============================================================================

function formatContentOutput(
  results: SearchResult[],
  rootDir: string,
  showLineNumbers: boolean
): string {
  const lines: string[] = [];

  for (const result of results) {
    const relativePath = relative(rootDir, result.file);

    for (const match of result.matches) {
      // Context before
      if (match.contextBefore) {
        for (let j = 0; j < match.contextBefore.length; j++) {
          const contextLine = match.contextBefore[j];
          const lineNum = match.line - match.contextBefore.length + j;
          if (showLineNumbers) {
            lines.push(`${relativePath}:${lineNum}-${contextLine}`);
          } else {
            lines.push(`${relativePath}-${contextLine}`);
          }
        }
      }

      // Match line
      if (showLineNumbers) {
        lines.push(`${relativePath}:${match.line}:${match.content}`);
      } else {
        lines.push(`${relativePath}:${match.content}`);
      }

      // Context after
      if (match.contextAfter) {
        for (let j = 0; j < match.contextAfter.length; j++) {
          const contextLine = match.contextAfter[j];
          const lineNum = match.line + 1 + j;
          if (showLineNumbers) {
            lines.push(`${relativePath}:${lineNum}-${contextLine}`);
          } else {
            lines.push(`${relativePath}-${contextLine}`);
          }
        }
      }
    }
  }

  return lines.join('\n');
}

function formatFilesOutput(results: SearchResult[], rootDir: string): string {
  return results.map((r) => relative(rootDir, r.file)).join('\n');
}

function formatCountOutput(results: SearchResult[], rootDir: string): string {
  return results.map((r) => `${relative(rootDir, r.file)}:${r.matchCount}`).join('\n');
}

// =============================================================================
// Tool Implementation
// =============================================================================

/**
 * Grep Tool - Powerful code search
 *
 * A powerful search tool built on regex matching, similar to ripgrep.
 * Supports full regex syntax, context lines, and multiple output modes.
 */
export class GrepTool implements Tool {
  name = 'grep';
  description =
    'A powerful search tool for searching file contents using regex patterns. ' +
    'Supports full regex syntax, context lines (-A/-B/-C), and multiple output modes. ' +
    'Use output_mode: "content" to see matching lines, "files_with_matches" for just file paths, ' +
    '"count" for match counts per file.';
  inputSchema = grepInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    try {
      const parsed = this.inputSchema.parse(input.content) as GrepInput;
      const {
        pattern,
        path: searchPath = '.',
        glob,
        type,
        output_mode = 'files_with_matches',
        '-A': afterContext = 0,
        '-B': beforeContext = 0,
        '-C': context = 0,
        '-i': ignoreCase = false,
        '-n': showLineNumbers = true,
        multiline = false,
        head_limit = 0,
        offset = 0,
      } = parsed;

      const rootDir = resolve(searchPath);

      // Build regex flags
      let flags = 'g';
      if (ignoreCase) {
        flags += 'i';
      }
      if (multiline) {
        flags += 'ms';
      }

      // Compile regex
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, flags);
      } catch (e) {
        return {
          status: 'error',
          content: 'Invalid regex pattern',
          error: {
            message: e instanceof Error ? e.message : 'Invalid regex pattern',
            code: 'INVALID_REGEX',
          },
        };
      }

      // Find files to search
      const findOptions: { glob?: string; type?: string } = {};
      if (glob) {
        findOptions.glob = glob;
      }
      if (type) {
        findOptions.type = type;
      }
      const files = await findFiles(rootDir, findOptions);

      // Calculate effective context
      const effectiveBefore = context > 0 ? context : beforeContext;
      const effectiveAfter = context > 0 ? context : afterContext;

      // Search files
      const results: SearchResult[] = [];
      for (const file of files) {
        const result = await searchFile(file, regex, {
          beforeContext: effectiveBefore,
          afterContext: effectiveAfter,
          showLineNumbers,
        });
        if (result) {
          results.push(result);
        }
      }

      // Apply offset and limit
      let processedResults = results;
      if (offset > 0) {
        processedResults = processedResults.slice(offset);
      }
      if (head_limit > 0) {
        processedResults = processedResults.slice(0, head_limit);
      }

      // Format output based on mode
      let output: string;
      switch (output_mode) {
        case 'content':
          output = formatContentOutput(processedResults, rootDir, showLineNumbers);
          break;
        case 'count':
          output = formatCountOutput(processedResults, rootDir);
          break;
        default:
          output = formatFilesOutput(processedResults, rootDir);
          break;
      }

      // Calculate total matches
      const totalMatches = results.reduce((sum, r) => sum + r.matchCount, 0);

      return {
        status: 'success',
        content: output || 'No matches found',
        metadata: {
          pattern,
          path: rootDir,
          filesSearched: files.length,
          filesWithMatches: results.length,
          totalMatches,
          outputMode: output_mode,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'Failed to execute grep',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'GREP_FAILED',
        },
      };
    }
  }
}

export const grepTool = new GrepTool();

// =============================================================================
// Type Exports
// =============================================================================

export type { GrepInput };
