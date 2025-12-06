/**
 * Tools Section
 *
 * Lists available tools and their descriptions.
 */
import type { ToolDefinition } from '../types.js';
/**
 * Generate the tools section
 * @param tools - Array of tool definitions
 */
export declare function toolsSection(tools: ToolDefinition[]): string;
/**
 * Common tool definitions for reuse
 */
export declare const COMMON_TOOLS: {
  readonly webSearch: {
    readonly name: 'web_search';
    readonly description: 'Search the web for current information';
  };
  readonly codeExecution: {
    readonly name: 'code_execution';
    readonly description: 'Execute code in a sandboxed environment';
  };
  readonly fileRead: {
    readonly name: 'file_read';
    readonly description: 'Read contents of files';
  };
  readonly fileWrite: {
    readonly name: 'file_write';
    readonly description: 'Write or modify files';
  };
  readonly gitOperations: {
    readonly name: 'git';
    readonly description: 'Git version control operations';
  };
  readonly githubAPI: {
    readonly name: 'github_api';
    readonly description: 'Interact with GitHub (issues, PRs, comments)';
  };
};
//# sourceMappingURL=tools.d.ts.map
