/**
 * MCP List Command Formatters
 *
 * Provides formatting functions for displaying MCP servers and tools
 * in user-friendly formats for chat interfaces.
 *
 * @example
 * ```typescript
 * const registry = createMCPRegistry();
 * registry.registerServer({
 *   name: 'duyet-mcp',
 *   displayName: 'Duyet Info',
 *   url: 'https://mcp.duyet.net/sse',
 *   description: 'Blog and personal info'
 * });
 *
 * // List all MCPs
 * const mcpList = formatMcpList(registry);
 * console.log(mcpList);
 *
 * // List tools from specific MCP
 * const toolsFromDuyet = formatToolList(registry, 'duyet-mcp');
 * console.log(toolsFromDuyet);
 * ```
 */

import type { MCPRegistry, MCPToolDefinition } from './index.js';

/**
 * Format MCP servers as a readable list
 *
 * Returns a markdown-formatted list of all registered MCP servers
 * with their display name, URL, and description.
 *
 * @param registry - The MCP registry instance
 * @returns Formatted string ready for display in chat
 *
 * @example
 * ```
 * **Duyet Info** (duyet-mcp)
 *   URL: https://mcp.duyet.net/sse
 *   Personal information and blog access
 *
 * **GitHub API** (github-mcp)
 *   URL: https://github-mcp.example.com/sse
 *   GitHub repository and workflow operations
 * ```
 */
export function formatMcpList(registry: MCPRegistry): string {
  const servers = registry.listServers();

  if (servers.length === 0) {
    return 'No MCP servers registered. Available: built-in tools only (plan, research, github, memory).';
  }

  const serverDetails = servers
    .map((server) => {
      let detail = `**${server.displayName}** (${server.name})\n`;
      detail += `  URL: ${server.url}\n`;
      if (server.description) {
        detail += `  ${server.description}`;
      }
      return detail;
    })
    .join('\n\n');

  return `## Available MCP Servers\n\n${serverDetails}\n\n*Use "list tools from <mcp-name>" to see what each server provides.*`;
}

/**
 * Format tools as a readable list
 *
 * Returns a markdown-formatted list of tools from a specific MCP server
 * or all MCP servers. Each tool includes its name and description.
 *
 * @param registry - The MCP registry instance
 * @param mcpName - Optional MCP server name to filter by
 * @returns Formatted string ready for display in chat
 *
 * @example
 * ```
 * **get_latest_posts**
 *   Get the latest blog posts
 *
 * **get_cv**
 *   Retrieve CV and work experience information
 *
 * **get_skills**
 *   Get technical skills and expertise
 * ```
 */
export function formatToolList(registry: MCPRegistry, mcpName?: string): string {
  const tools = mcpName ? registry.getToolsByMcp(mcpName) : registry.listTools();

  if (tools.length === 0) {
    if (mcpName) {
      return `No tools found for MCP: ${mcpName}. Check the spelling or run "list all mcps" to see registered servers.`;
    }
    return 'No MCP tools available. Built-in tools: plan, research, github. MCP tools: duyet__info, memory__save, memory__recall, memory__search. Other: request_approval.';
  }

  const toolDetails = tools
    .map((tool: { prefixedName: string; description?: string }) => {
      let detail = `**${tool.prefixedName}**`;
      if (tool.description) {
        detail += `\n  ${tool.description}`;
      }
      return detail;
    })
    .join('\n\n');

  if (mcpName) {
    const server = registry.getServer(mcpName);
    const serverName = server?.displayName ?? mcpName;
    return `## Tools from ${serverName}\n\n${toolDetails}`;
  }

  return `## All MCP Tools\n\n${toolDetails}\n\n*Built-in tools: plan, research, github. MCP tools: duyet__info, memory__save, memory__recall, memory__search. Other: request_approval*`;
}

/**
 * Format a single tool for detailed display
 *
 * Returns detailed information about a specific tool including
 * its full description and input schema if available.
 *
 * @param tool - The tool to format
 * @returns Formatted string with detailed information
 */
export function formatToolDetails(tool: MCPToolDefinition): string {
  let detail = `## ${tool.prefixedName}\n\n`;
  detail += `**From**: ${tool.mcpName}\n`;
  detail += `**Original Name**: ${tool.originalName}\n\n`;
  detail += `**Description**: ${tool.description}\n`;

  if (tool.parameters) {
    detail += `\n**Parameters**:\n\`\`\`json\n${JSON.stringify(tool.parameters, null, 2)}\n\`\`\``;
  }

  return detail;
}

/**
 * Format help text for list commands
 *
 * Provides user-friendly help about available list commands.
 *
 * @returns Formatted help string
 */
export function formatListCommandHelp(): string {
  return `## List Commands

I can help you discover available MCP servers and tools:

**List all MCP servers**
- "list all mcps"
- "show mcps"
- "what mcps are available"

**List all tools**
- "list all tools"
- "show tools"
- "what tools do you have"

**List tools from specific MCP**
- "list tools from <mcp-name>"
- "show <mcp-name> tools"
- "what can <mcp-name> do"

Example: "list tools from duyet-mcp"

**Built-in tools** are always available:
- **plan** - Decompose complex tasks into steps
- **research** - Search the web for information
- **github** - GitHub API operations
- **request_approval** - Request human approval for actions

**MCP tools** via external services:
- **duyet__info** - Duyet's personal information (blog, CV, skills)
- **memory__save** - Save information to memory
- **memory__recall** - Retrieve from memory
- **memory__search** - Search memory`;
}
