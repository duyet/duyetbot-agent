/**
 * GitHub MCP Prompt Helper for Promptfoo
 *
 * Returns the production GitHub MCP system prompt from packages/prompts/
 * formatted as a message array for promptfoo's built-in OpenRouter provider.
 */

module.exports = async ({ vars }) => {
  const { getGitHubMCPPrompt } = await import('../../packages/prompts/src/agents/github-mcp.js');
  const systemPrompt = getGitHubMCPPrompt({ outputFormat: 'github-markdown' });
  const query = vars.query || '';

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: query },
  ];
};
