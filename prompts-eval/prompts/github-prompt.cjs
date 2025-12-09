/**
 * GitHub Prompt Helper for Promptfoo
 *
 * Returns the production GitHub system prompt from packages/prompts/
 * formatted as a message array for promptfoo's built-in OpenRouter provider.
 */

module.exports = async ({ vars }) => {
  const { getGitHubBotPrompt } = await import('../../packages/prompts/src/platforms/github.js');
  const systemPrompt = getGitHubBotPrompt({ outputFormat: 'github-markdown' });
  const query = vars.query || '';

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: query },
  ];
};
