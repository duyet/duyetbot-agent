/**
 * System prompts with simple template engine
 */

import { config } from "./config.js";
import { type TemplateContext, renderTemplate } from "./engine.js";

export type Platform = "telegram" | "github" | "agent" | "default";

export interface PromptContext extends TemplateContext {
  botName?: string;
  creator?: string;
}

/**
 * Get the system prompt for a platform
 * Renders with Nunjucks template engine (Jinja2 syntax)
 */
export function getSystemPrompt(
  platform: Platform,
  context?: PromptContext,
): string {
  const templateName = `${platform}.md`;

  // Merge defaults with provided context
  const fullContext: PromptContext = {
    botName: context?.botName || config.botName,
    creator: context?.creator || config.creator,
    ...context,
  };

  try {
    return renderTemplate(templateName, fullContext);
  } catch {
    // Fallback to default if platform-specific template not found
    return renderTemplate("default.md", fullContext);
  }
}

// Pre-compiled for backwards compatibility
export const GITHUB_SYSTEM_PROMPT = getSystemPrompt("github");
export const TELEGRAM_SYSTEM_PROMPT = getSystemPrompt("telegram");

export const TELEGRAM_WELCOME_MESSAGE = `Hello! I'm ${config.botName}, created by ${config.creator}. Send me a message and I'll help you out.

Commands:
/help - Show help
/clear - Clear conversation history`;

export const TELEGRAM_HELP_MESSAGE = `Commands:
/start - Start bot
/help - Show this help
/clear - Clear conversation history

Just send me any message!`;
