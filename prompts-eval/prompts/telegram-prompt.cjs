/**
 * Telegram Prompt Helper for Promptfoo
 *
 * Returns the production telegram system prompt from packages/prompts/
 * formatted as a message array for promptfoo's built-in OpenRouter provider.
 *
 * @param {Object} vars - Test case variables
 * @param {string} vars.query - User query
 * @param {string} [vars.outputFormat='telegram-html'] - Output format: 'telegram-html' or 'telegram-markdown'
 */
module.exports = async ({ vars }) => {
  const { getTelegramPrompt } = await import('../../packages/prompts/src/platforms/telegram.js');

  const outputFormat = vars.outputFormat || 'telegram-html';
  const systemPrompt = getTelegramPrompt({ outputFormat });
  const query = vars.query || '';

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: query },
  ];
};
