/**
 * Tools Section
 *
 * Lists available tools and their descriptions.
 */
/**
 * Generate the tools section
 * @param tools - Array of tool definitions
 */
export function toolsSection(tools) {
  if (tools.length === 0) {
    return '';
  }
  return `<tools>
Available tools:
${tools.map((t) => `- ${t.name}: ${t.description}`).join('\n')}
</tools>`;
}
/**
 * Common tool definitions for reuse
 */
export const COMMON_TOOLS = {
  webSearch: {
    name: 'web_search',
    description: 'Search the web for current information',
  },
  codeExecution: {
    name: 'code_execution',
    description: 'Execute code in a sandboxed environment',
  },
  fileRead: {
    name: 'file_read',
    description: 'Read contents of files',
  },
  fileWrite: {
    name: 'file_write',
    description: 'Write or modify files',
  },
  gitOperations: {
    name: 'git',
    description: 'Git version control operations',
  },
  githubAPI: {
    name: 'github_api',
    description: 'Interact with GitHub (issues, PRs, comments)',
  },
};
