/**
 * Router Prompt Helper for Promptfoo
 *
 * Returns the production router system prompt from packages/prompts/
 * formatted as a message array for promptfoo's built-in OpenRouter provider.
 */

module.exports = async ({ vars }) => {
  const { getRouterPrompt } = await import('../../packages/prompts/src/agents/router.js');
  const systemPrompt = getRouterPrompt();
  const query = vars.query || '';

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: query },
  ];
};
