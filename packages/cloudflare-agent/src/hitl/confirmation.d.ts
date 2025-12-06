/**
 * Tool Confirmation Logic
 *
 * Handles detection and processing of tool confirmations from user messages.
 * Provides utilities for creating confirmation requests and parsing responses.
 */
import type { ToolConfirmation } from '../routing/schemas.js';
/**
 * Risk assessment for tools
 */
export type RiskLevel = 'low' | 'medium' | 'high';
/**
 * Tool definition for confirmable tools
 */
export interface ConfirmableTool {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Risk level of this tool */
  riskLevel: RiskLevel;
  /** Tool requires confirmation before execution */
  requiresConfirmation: boolean;
  /** Confirmation expiry time in ms (default: 5 minutes) */
  confirmationExpiryMs?: number;
}
/**
 * Result of parsing a user message for confirmation intent
 */
export interface ConfirmationParseResult {
  /** Whether message is a confirmation response */
  isConfirmation: boolean;
  /** Type of response */
  action: 'approve' | 'reject' | 'none';
  /** Optional reason (for rejections) */
  reason?: string | undefined;
  /** Specific confirmation ID if mentioned */
  targetConfirmationId?: string | undefined;
}
/**
 * Default high-risk tools that require confirmation
 */
export declare const DEFAULT_HIGH_RISK_TOOLS: string[];
/**
 * Default confirmation expiry time (5 minutes)
 */
export declare const DEFAULT_CONFIRMATION_EXPIRY_MS: number;
/**
 * Check if a message contains a tool confirmation response
 */
export declare function hasToolConfirmation(message: string): boolean;
/**
 * Parse a user message for confirmation intent
 */
export declare function parseConfirmationResponse(message: string): ConfirmationParseResult;
/**
 * Determine risk level for a tool
 */
export declare function determineRiskLevel(
  toolName: string,
  args?: Record<string, unknown>
): RiskLevel;
/**
 * Check if a tool requires confirmation based on risk level
 */
export declare function requiresConfirmation(
  toolName: string,
  args?: Record<string, unknown>,
  threshold?: RiskLevel
): boolean;
/**
 * Create a tool confirmation request
 */
export declare function createToolConfirmation(
  toolName: string,
  toolArgs: Record<string, unknown>,
  description: string,
  expiryMs?: number
): ToolConfirmation;
/**
 * Format a confirmation request for display to the user
 */
export declare function formatConfirmationRequest(confirmation: ToolConfirmation): string;
/**
 * Format multiple confirmation requests for display
 */
export declare function formatMultipleConfirmations(confirmations: ToolConfirmation[]): string;
/**
 * Validate that a confirmation is still valid (not expired)
 */
export declare function isConfirmationValid(confirmation: ToolConfirmation): boolean;
/**
 * Filter out expired confirmations
 */
export declare function filterExpiredConfirmations(
  confirmations: ToolConfirmation[]
): ToolConfirmation[];
//# sourceMappingURL=confirmation.d.ts.map
