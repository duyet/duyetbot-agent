/**
 * File Operations Tool
 *
 * Provides autonomous file operations for the agent:
 * - Read files
 * - Write files
 * - Edit files (find and replace)
 * - List directory contents
 * - Search files by pattern
 *
 * This enables the agent to autonomously modify code,
 * create new files, and manage the codebase.
 */

import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import type { Tool, ToolInput, ToolOutput, ToolStatus } from '@duyetbot/types';
import { ToolExecutionError } from '@duyetbot/types';
import { z } from 'zod';

// =============================================================================
// Input Schemas (Zod)
// =============================================================================

/**
 * Schema for read_file tool (Claude Code-style)
 *
 * Supports:
 * - Full file read (default, up to 2000 lines)
 * - Offset/limit for large files
 * - Line numbers in output (cat -n format)
 */
const readFileInputSchema = z.object({
  /** Absolute path to the file to read */
  path: z.string().min(1, 'Path is required'),
  /** File encoding (default: utf-8) */
  encoding: z.enum(['utf-8', 'ascii', 'utf-16le', 'ucs2', 'base64', 'latin1']).optional(),
  /** Line number to start reading from (1-based, for large files) */
  offset: z.number().int().min(1).optional(),
  /** Number of lines to read (default: 2000) */
  limit: z.number().int().positive().optional(),
  /** Legacy: specific line range (deprecated, use offset/limit) */
  lines: z
    .object({
      from: z.number().int().positive(),
      to: z.number().int().positive().optional(),
    })
    .optional(),
});

/**
 * Schema for write_file tool
 */
const writeFileInputSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  content: z.string(),
  createDirs: z.boolean().optional(),
});

/**
 * Schema for edit_file tool (Claude Code-style)
 *
 * Performs exact string replacements in files.
 * The edit will FAIL if old_string is not unique in the file
 * (unless replace_all is true).
 */
const editFileInputSchema = z.object({
  /** Absolute path to the file to modify */
  path: z.string().min(1, 'Path is required'),
  /** The text to replace (must be unique unless replace_all is true) */
  oldText: z.string().min(1, 'Old text is required'),
  /** The text to replace it with (must be different from oldText) */
  newText: z.string(),
  /** Replace all occurrences (default: false, requires unique match) */
  replaceAll: z.boolean().optional(),
});

/**
 * Schema for list_dir tool
 */
const listDirInputSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  recursive: z.boolean().optional(),
  maxDepth: z.number().int().positive().optional(),
  extension: z.string().optional(),
  includeHidden: z.boolean().optional(),
});

/**
 * Schema for search_files tool
 */
const searchFilesInputSchema = z.object({
  pattern: z.string().min(1, 'Pattern is required'),
  root: z.string().optional(),
  contentSearch: z.string().optional(),
  ignoreCase: z.boolean().optional(),
});

/**
 * Schema for file_stats tool
 */
const fileStatsInputSchema = z.object({
  path: z.string().min(1, 'Path is required'),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Recursively walk a directory
 */
async function walkDir(
  dir: string,
  options: {
    maxDepth?: number;
    extension?: string;
    includeHidden?: boolean;
    currentDepth?: number;
  } = {}
): Promise<string[]> {
  const { maxDepth = 10, extension, includeHidden = false, currentDepth = 0 } = options;

  if (currentDepth >= maxDepth) {
    return [];
  }

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const results: string[] = [];

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Skip hidden files if not requested
      if (!includeHidden && entry.name.startsWith('.')) {
        continue;
      }

      // Skip by extension if specified
      if (extension && !entry.name.endsWith(`.${extension}`)) {
        // Only check files, not directories
        if (entry.isFile()) {
          continue;
        }
      }

      if (entry.isDirectory()) {
        // Recursively walk subdirectories
        const walkOptions: {
          maxDepth: number;
          extension?: string;
          includeHidden: boolean;
          currentDepth: number;
        } = {
          maxDepth,
          includeHidden,
          currentDepth: currentDepth + 1,
        };
        if (extension !== undefined) {
          walkOptions.extension = extension;
        }
        const subResults = await walkDir(fullPath, walkOptions);
        results.push(...subResults);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Convert glob pattern to regex for simple matching
 */
function globToRegex(glob: string): RegExp {
  // Escape special regex characters except glob wildcards
  let pattern = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  // Convert glob wildcards to regex
  pattern = pattern.replace(/\*/g, '.*');
  pattern = pattern.replace(/\?/g, '.');
  return new RegExp(`^${pattern}$`);
}

/**
 * Filter files by glob pattern
 */
function filterByPattern(files: string[], pattern: string): string[] {
  const regex = globToRegex(pattern);
  return files.filter((file) => regex.test(file));
}

// =============================================================================
// Tool Implementations
// =============================================================================

/**
 * Read file tool (Claude Code-style)
 *
 * Reads a file and returns its contents with line numbers (cat -n format).
 * Supports offset/limit for reading large files in chunks.
 * Default limit is 2000 lines, lines longer than 2000 chars are truncated.
 */
export class ReadFileTool implements Tool {
  name = 'read_file';
  description =
    'Read the contents of a file with line numbers (cat -n format). ' +
    'By default reads up to 2000 lines. Use offset/limit for large files. ' +
    'Lines longer than 2000 characters will be truncated.';
  inputSchema = readFileInputSchema;

  private static readonly DEFAULT_LIMIT = 2000;
  private static readonly MAX_LINE_LENGTH = 2000;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    try {
      const parsed = this.inputSchema.parse(input.content);
      const {
        path: filePath,
        encoding = 'utf-8',
        offset,
        limit = ReadFileTool.DEFAULT_LIMIT,
        lines,
      } = parsed;

      const content = await readFile(filePath, { encoding });
      const allLines = content.split('\n');
      const totalLines = allLines.length;

      // Determine which lines to return
      let startLine: number;
      let endLine: number;

      if (lines) {
        // Legacy: specific line range
        startLine = Math.max(1, lines.from);
        endLine = lines.to ? Math.min(totalLines, lines.to) : startLine;
      } else if (offset) {
        // New: offset/limit (1-based)
        startLine = Math.max(1, offset);
        endLine = Math.min(totalLines, startLine + limit - 1);
      } else {
        // Default: from beginning, up to limit
        startLine = 1;
        endLine = Math.min(totalLines, limit);
      }

      // Extract lines (convert to 0-based index)
      const selectedLines = allLines.slice(startLine - 1, endLine);

      // Format with line numbers (cat -n style)
      const maxLineNumWidth = String(endLine).length;
      const formattedLines = selectedLines.map((line, index) => {
        const lineNum = startLine + index;
        const paddedNum = String(lineNum).padStart(maxLineNumWidth, ' ');
        // Truncate long lines
        const truncatedLine =
          line.length > ReadFileTool.MAX_LINE_LENGTH
            ? line.substring(0, ReadFileTool.MAX_LINE_LENGTH) + '...'
            : line;
        return `${paddedNum}\t${truncatedLine}`;
      });

      const formattedContent = formattedLines.join('\n');

      return {
        status: 'success',
        content: formattedContent,
        metadata: {
          path: filePath,
          totalLines,
          linesRead: selectedLines.length,
          lineRange: { from: startLine, to: endLine },
          truncated: endLine < totalLines,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'Failed to read file',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'READ_FAILED',
        },
      };
    }
  }
}

/**
 * Write file tool
 *
 * Writes content to a file. Can optionally create parent directories.
 */
export class WriteFileTool implements Tool {
  name = 'write_file';
  description =
    'Write content to a file. Creates the file if it does not exist. ' +
    'Can optionally create parent directories. Overwrites existing files.';
  inputSchema = writeFileInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    try {
      const parsed = this.inputSchema.parse(input.content);
      const { path, content, createDirs = true } = parsed;

      if (createDirs) {
        const dir = dirname(path);
        await mkdir(dir, { recursive: true });
      }

      await writeFile(path, content, 'utf-8');

      return {
        status: 'success',
        content: `Successfully wrote ${content.length} bytes to ${path}`,
        metadata: {
          path,
          bytesWritten: content.length,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'Failed to write file',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'WRITE_FAILED',
        },
      };
    }
  }
}

/**
 * Edit file tool (Claude Code-style)
 *
 * Performs exact string replacements in files.
 * The edit will FAIL if old_string is not unique in the file
 * (unless replace_all is true). This prevents accidental edits.
 */
export class EditFileTool implements Tool {
  name = 'edit_file';
  description =
    'Perform exact string replacements in files. ' +
    'The edit will FAIL if old_string is not unique (provide more context to make it unique). ' +
    'Use replace_all=true to replace all occurrences.';
  inputSchema = editFileInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    try {
      const parsed = this.inputSchema.parse(input.content);
      const { path: filePath, oldText, newText, replaceAll = false } = parsed;

      // Check that old and new text are different
      if (oldText === newText) {
        return {
          status: 'error',
          content: 'old_string and new_string must be different',
          error: {
            message: 'The old_string and new_string are identical',
            code: 'IDENTICAL_STRINGS',
          },
        };
      }

      const content = await readFile(filePath, 'utf-8');

      // Count occurrences
      const regex = new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const matches = content.match(regex);
      const occurrences = matches ? matches.length : 0;

      if (occurrences === 0) {
        return {
          status: 'error',
          content: 'Old text not found in file',
          error: {
            message: 'The specified old_string was not found in the file',
            code: 'TEXT_NOT_FOUND',
          },
        };
      }

      // If not replace_all and multiple occurrences, fail
      if (!replaceAll && occurrences > 1) {
        return {
          status: 'error',
          content: `old_string is not unique (found ${occurrences} occurrences). Provide more context or use replace_all=true.`,
          error: {
            message: `Found ${occurrences} occurrences of old_string. Either provide a larger string with more surrounding context to make it unique, or set replace_all=true to replace all occurrences.`,
            code: 'NOT_UNIQUE',
          },
        };
      }

      // Perform replacement
      let newContent: string;
      let replacements: number;

      if (replaceAll) {
        newContent = content.replaceAll(oldText, newText);
        replacements = occurrences;
      } else {
        // Single replacement (we know it's unique at this point)
        const index = content.indexOf(oldText);
        newContent =
          content.substring(0, index) + newText + content.substring(index + oldText.length);
        replacements = 1;
      }

      await writeFile(filePath, newContent, 'utf-8');

      return {
        status: 'success',
        content: `Successfully replaced ${replacements} occurrence(s) in ${filePath}`,
        metadata: {
          path: filePath,
          replacements,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'Failed to edit file',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'EDIT_FAILED',
        },
      };
    }
  }
}

/**
 * List directory tool
 *
 * Lists directory contents with optional filtering.
 */
export class ListDirTool implements Tool {
  name = 'list_dir';
  description =
    'List directory contents. Can recursively list nested directories ' +
    'and filter by file extension.';
  inputSchema = listDirInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    try {
      const parsed = this.inputSchema.parse(input.content);
      const { path, recursive = false, maxDepth = 10, extension, includeHidden = false } = parsed;

      if (!recursive) {
        const entries = await readdir(path, { withFileTypes: true });

        const filtered = entries.filter((entry) => {
          if (!includeHidden && entry.name.startsWith('.')) {
            return false;
          }
          if (extension && !entry.name.endsWith(`.${extension}`)) {
            return false;
          }
          return true;
        });

        const result = filtered.map((entry) => ({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
        }));

        return {
          status: 'success',
          content: result as unknown as Record<string, unknown>,
          metadata: {
            path,
            count: result.length,
          },
        };
      }

      // Recursive listing
      const walkOptions: {
        maxDepth: number;
        extension?: string;
        includeHidden: boolean;
      } = {
        maxDepth,
        includeHidden,
      };
      if (extension !== undefined) {
        walkOptions.extension = extension;
      }
      const files = await walkDir(path, walkOptions);

      const result = files.map((file) => ({
        path: file,
        name: basename(file),
        relative: file.replace(`${path}/`, ''),
      }));

      return {
        status: 'success',
        content: result as unknown as Record<string, unknown>,
        metadata: {
          path,
          count: result.length,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'Failed to list directory',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'LIST_FAILED',
        },
      };
    }
  }
}

/**
 * Search files tool
 *
 * Searches for files by glob pattern and optionally searches file contents.
 */
export class SearchFilesTool implements Tool {
  name = 'search_files';
  description =
    'Search for files matching a glob pattern. ' +
    'Optionally search file contents for text (like grep).';
  inputSchema = searchFilesInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    try {
      const parsed = this.inputSchema.parse(input.content);
      const { pattern, root = '.', contentSearch, ignoreCase = false } = parsed;

      // Get all files recursively
      const allFiles = await walkDir(root, { maxDepth: 20, includeHidden: false });

      // Filter by glob pattern
      const files = filterByPattern(allFiles, pattern);

      if (!contentSearch) {
        return {
          status: 'success',
          content: files as unknown as Record<string, unknown>,
          metadata: {
            pattern,
            root,
            count: files.length,
          },
        };
      }

      // Search file contents
      const results: Array<{
        file: string;
        matches: Array<{ line: number; content: string }>;
      }> = [];

      for (const file of files) {
        try {
          const content = await readFile(file, 'utf-8');
          const lines = content.split('\n');

          const matches: Array<{ line: number; content: string }> = [];

          lines.forEach((line, index) => {
            const searchRegex = new RegExp(
              contentSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              ignoreCase ? 'gi' : 'g'
            );

            if (searchRegex.test(line)) {
              matches.push({
                line: index + 1,
                content: line.trim(),
              });
            }
          });

          if (matches.length > 0) {
            results.push({ file, matches });
          }
        } catch {
          // Skip files that can't be read
        }
      }

      return {
        status: 'success',
        content: results as unknown as Record<string, unknown>,
        metadata: {
          pattern,
          root,
          contentSearch,
          filesWithMatches: results.length,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'Failed to search files',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'SEARCH_FAILED',
        },
      };
    }
  }
}

/**
 * File stats tool
 *
 * Gets file or directory statistics.
 */
export class FileStatsTool implements Tool {
  name = 'file_stats';
  description = 'Get file or directory statistics (size, type, permissions, etc.)';
  inputSchema = fileStatsInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    try {
      const parsed = this.inputSchema.parse(input.content);
      const { path } = parsed;

      const stats = await stat(path);

      return {
        status: 'success',
        content: {
          path,
          name: basename(path),
          extension: extname(path),
          type: stats.isDirectory() ? 'directory' : stats.isFile() ? 'file' : 'other',
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          accessed: stats.atime,
          isReadable: true,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'Failed to get file stats',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'STATS_FAILED',
        },
      };
    }
  }
}

// =============================================================================
// Single Instances (for backwards compatibility)
// =============================================================================

export const readFileTool = new ReadFileTool();
export const writeFileTool = new WriteFileTool();
export const editFileTool = new EditFileTool();
export const listDirTool = new ListDirTool();
export const searchFilesTool = new SearchFilesTool();
export const fileStatsTool = new FileStatsTool();

// =============================================================================
// Batch Operations
// =============================================================================

/**
 * Schema for batch_file_ops tool
 */
const batchFileOpsInputSchema = z.object({
  operations: z.array(
    z.discriminatedUnion('type', [
      z.object({
        type: z.literal('write'),
        params: writeFileInputSchema,
      }),
      z.object({
        type: z.literal('edit'),
        params: editFileInputSchema,
      }),
      z.object({
        type: z.literal('read'),
        params: readFileInputSchema,
      }),
    ])
  ),
  stopOnError: z.boolean().optional(),
});

/**
 * Batch file operations tool
 *
 * Executes multiple file operations in a single call.
 */
export class BatchFileOpsTool implements Tool {
  name = 'batch_file_ops';
  description =
    'Execute multiple file operations in a single call. ' +
    'Operations are executed in order. Can stop on first error or continue.';
  inputSchema = batchFileOpsInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      const parsed = this.inputSchema.parse(input.content);
      const { operations, stopOnError = true } = parsed;

      const results: unknown[] = [];
      const errors: Array<{ operation: number; error: string }> = [];

      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        if (!op) {
          continue;
        }

        let result: ToolOutput;

        switch (op.type) {
          case 'write':
            result = await writeFileTool.execute({ content: op.params });
            break;
          case 'edit':
            result = await editFileTool.execute({ content: op.params });
            break;
          case 'read':
            result = await readFileTool.execute({ content: op.params });
            break;
          default: {
            // Exhaustive check - TypeScript should ensure we never reach here
            const _exhaustiveCheck: never = op;
            void _exhaustiveCheck;
            result = {
              status: 'error',
              content: 'Unknown operation type',
              error: { message: `Unknown operation type`, code: 'UNKNOWN_OP' },
            };
            break;
          }
        }

        results.push({ operation: i, ...result });

        if (result.status === 'error') {
          errors.push({
            operation: i,
            error: result.error?.message || 'Unknown error',
          });

          if (stopOnError) {
            break;
          }
        }
      }

      const hasErrors = errors.length > 0;
      const status: ToolStatus = hasErrors && stopOnError ? 'error' : 'success';

      const returnVal: ToolOutput = {
        status,
        content: results as unknown as Record<string, unknown>,
        metadata: {
          totalOperations: operations.length,
          successful: results.length - errors.length,
          failed: errors.length,
          duration: Date.now() - startTime,
        },
      };

      if (hasErrors && stopOnError) {
        returnVal.error = {
          message: `${errors.length} operation(s) failed`,
          code: 'BATCH_ERRORS',
        };
      }

      return returnVal;
    } catch (error) {
      throw new ToolExecutionError(
        'batch_file_ops',
        error instanceof Error ? error.message : 'Unknown error',
        'BATCH_EXECUTION_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }
}

export const batchFileOpsTool = new BatchFileOpsTool();

// =============================================================================
// Legacy Type Exports (for backwards compatibility)
// =============================================================================

export interface ReadFileInput {
  path: string;
  encoding?: BufferEncoding;
  lines?: {
    from: number;
    to?: number;
  };
}

export interface WriteFileInput {
  path: string;
  content: string;
  createDirs?: boolean;
}

export interface EditFileInput {
  path: string;
  oldText: string;
  newText: string;
  replaceAll?: boolean;
}

export interface ListDirInput {
  path: string;
  recursive?: boolean;
  maxDepth?: number;
  extension?: string;
  includeHidden?: boolean;
}

export interface SearchFilesInput {
  pattern: string;
  root?: string;
  contentSearch?: string;
  ignoreCase?: boolean;
}

export interface FileStatsInput {
  path: string;
}

export interface BatchFileOpsInput {
  operations: Array<
    | { type: 'write'; params: WriteFileInput }
    | { type: 'edit'; params: EditFileInput }
    | { type: 'read'; params: ReadFileInput }
  >;
  stopOnError?: boolean;
}
