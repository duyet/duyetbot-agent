/**
 * Context Compression
 *
 * Intelligently manages conversation context to stay within token limits
 * Implements Claude Code's context optimization patterns
 */

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  savings: number;
  compressionRatio: number;
}

export interface CompressionConfig {
  maxContextTokens?: number;
  aggressiveCompression?: boolean;
  preserveToolResults?: boolean;
}

export class ContextCompressor {
  private config: CompressionConfig;
  private stats: Map<string, CompressionStats> = new Map();

  constructor(config: CompressionConfig = {}) {
    this.config = config;
  }

  compress(message: string): { compressed: string; stats: CompressionStats } {
    const originalSize = message.length;

    if (this.config.aggressiveCompression) {
      return {
        compressed: this.aggressiveCompress(message),
        stats: {
          originalSize,
          compressedSize: message.length,
          savings: originalSize - message.length,
          compressionRatio: message.length / originalSize,
        },
      };
    }

    return {
      compressed: this.smartCompress(message),
      stats: {
        originalSize,
        compressedSize: message.length,
        savings: originalSize - message.length,
        compressionRatio: message.length / originalSize,
      },
    };
  }

  private smartCompress(message: string): string {
    let result = message;

    result = this.removeDuplicateLines(result);
    result = this.summarizeToolResults(result);

    return result;
  }

  private aggressiveCompress(message: string): string {
    let result = message;

    result = this.removeDuplicateLines(result);
    result = this.summarizeToolResults(result);

    result = this.truncateLongLines(result, 200);

    return result;
  }

  private removeDuplicateLines(text: string): string {
    const lines = text.split('\n');
    const seen = new Set<string>();
    const unique = lines.filter((line) => {
      const trimmed = line.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        return true;
      }
      return false;
    });
    return unique.join('\n');
  }

  private summarizeToolResults(text: string): string {
    const toolResultRegex = /\[Tool.*?\]\s+(.*?)(?=\n\s*|$)/g;
    let result = text;

    let match: RegExpExecArray | null;
    while ((match = toolResultRegex.exec(result)) !== null) {
      const toolName = match[1];
      const toolOutput = match[2];

      if (!toolOutput) continue;

      if (this.config.preserveToolResults) {
        result = result.replace(toolOutput, `[Tool: ${toolName}] (result preserved)`);
      } else {
        result = result.replace(toolOutput, `[Tool: ${toolName}]`);
      }
    }

    return result;
  }

  private truncateLongLines(text: string, maxLineLength: number): string {
    const lines = text.split('\n');
    const truncated = lines.map((line) => {
      if (line.length > maxLineLength) {
        return line.substring(0, maxLineLength) + '...';
      }
      return line;
    });
    return truncated.join('\n');
  }

  getStats(): CompressionStats[] {
    return Array.from(this.stats.values());
  }

  clearStats(): void {
    this.stats.clear();
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
