/**
 * Response Handler - Parse LLM responses and extract tool calls
 *
 * Handles:
 * - Extracting content and tool calls from LLM response
 * - Converting to unified format for chat loop
 */

import type { LLMResponse, ToolCall } from '../types.js';

/**
 * Parsed LLM response
 */
export interface ParsedResponse {
  /** Response content */
  content: string;
  /** Tool calls if any */
  toolCalls?: ToolCall[];
  /** Token usage */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedTokens?: number;
  };
  /** Model used */
  model?: string;
}

/**
 * ResponseHandler class - Parse LLM responses
 */
export class ResponseHandler {
  /**
   * Parse LLM response
   * @param response - Raw LLM response
   * @returns Parsed response
   */
  static parse(response: LLMResponse): ParsedResponse {
    const parsed: ParsedResponse = {
      content: response.content,
    };

    // Only add optional fields if they are defined (exactOptionalPropertyTypes compliance)
    if (response.toolCalls) {
      parsed.toolCalls = response.toolCalls;
    }

    if (response.model) {
      parsed.model = response.model;
    }

    // Only add usage if present, and only include cachedTokens if it's a number
    if (response.usage) {
      parsed.usage = {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        totalTokens: response.usage.totalTokens,
      };
      // Only add cachedTokens if it's a number (exactOptionalPropertyTypes compliance)
      if (typeof response.usage.cachedTokens === 'number') {
        parsed.usage.cachedTokens = response.usage.cachedTokens;
      }
    }

    return parsed;
  }

  /**
   * Check if response has tool calls
   */
  static hasToolCalls(response: ParsedResponse): boolean {
    return !!(response.toolCalls && response.toolCalls.length > 0);
  }

  /**
   * Extract tool calls from response
   */
  static getToolCalls(response: ParsedResponse): ToolCall[] {
    return response.toolCalls || [];
  }
}
