/**
 * Router Prompt Helper for Promptfoo
 *
 * Returns the production router system prompt from packages/prompts/
 * formatted as a message array for promptfoo's built-in OpenRouter provider.
 */

module.exports = async function ({ vars }) {
  const { getRouterPrompt } = await import('../../packages/prompts/src/agents/router.js');
  const systemPrompt = getRouterPrompt();
  const query = vars.query || '';

  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Classify this query: "${query}"

IMPORTANT: Respond with a raw JSON object only. Do NOT wrap in markdown code blocks (\`\`\`). Do NOT add any text before or after the JSON.

Example valid response:
{"type":"simple","category":"general","complexity":"low","requiresHumanApproval":false,"reasoning":"Simple factual question","suggestedTools":[]}`,
    },
  ];
};
