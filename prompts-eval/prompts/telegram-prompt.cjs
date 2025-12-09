/**
 * Telegram Prompt Helper for Promptfoo
 *
 * Returns the production telegram system prompt from packages/prompts/
 * formatted as a message array for promptfoo's built-in OpenRouter provider.
 */

module.exports = async function ({ vars }) {
  const { getTelegramPrompt } = await import('../../packages/prompts/src/platforms/telegram.js');
  const systemPrompt = getTelegramPrompt({ outputFormat: 'telegram-html' });
  const query = vars.query || '';

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: query },
  ];
};
