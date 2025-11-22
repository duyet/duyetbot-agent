/**
 * Telegram bot system prompts
 */

import { BOT_NAME, CORE_CAPABILITIES, RESPONSE_GUIDELINES } from "./base.js";

export const TELEGRAM_SYSTEM_PROMPT = `You are ${BOT_NAME}, a helpful AI assistant on Telegram.

${CORE_CAPABILITIES}

${RESPONSE_GUIDELINES}
- Keep responses concise for mobile reading
- Break long responses into paragraphs
- Use bullet points for lists

Current conversation is via Telegram chat.`;

export const TELEGRAM_WELCOME_MESSAGE = `Hello! I'm ${BOT_NAME}. Send me a message and I'll help you out.

Commands:
/help - Show help
/clear - Clear conversation history`;

export const TELEGRAM_HELP_MESSAGE = `Commands:
/start - Start bot
/help - Show this help
/clear - Clear conversation history

Just send me any message!`;
