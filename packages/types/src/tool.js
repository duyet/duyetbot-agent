/**
 * Tool Types and Interfaces
 *
 * Defines the unified interface for all tools that agents can execute
 */
/**
 * Tool execution error
 */
export class ToolExecutionError extends Error {
  toolName;
  code;
  cause;
  metadata;
  constructor(toolName, message, code, cause, metadata) {
    super(message);
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
    if (code !== undefined) {
      this.code = code;
    }
    if (cause !== undefined) {
      this.cause = cause;
    }
    if (metadata !== undefined) {
      this.metadata = metadata;
    }
  }
}
