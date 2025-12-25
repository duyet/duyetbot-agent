/**
 * Web Chat Prompts
 *
 * System prompts for the web chat interface, built on @duyetbot/prompts.
 */

import { getSimpleAgentPrompt, toolsSection } from '@duyetbot/prompts';

/**
 * Get the system prompt for web chat
 *
 * Extends getSimpleAgentPrompt with web-specific instructions and tool descriptions.
 *
 * @param enabledTools - List of enabled tool names
 * @returns Complete system prompt string
 */
export function getWebChatPrompt(enabledTools: string[] = []): string {
  const basePrompt = getSimpleAgentPrompt({ outputFormat: 'plain' });

  // Add web-specific instructions
  const webSpecific = `
<web_chat_context>
You are responding through a web chat interface with real-time streaming.
- Responses should be concise and conversational
- Use markdown formatting for code blocks, lists, and emphasis
- Streaming is handled automatically - focus on clear, complete thoughts
</web_chat_context>`;

  // Add tools section if tools are enabled
  const tools =
    enabledTools.length > 0
      ? toolsSection(enabledTools.map((name) => ({ name, description: '' })))
      : '';

  return basePrompt + webSpecific + tools;
}
