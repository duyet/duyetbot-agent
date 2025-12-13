import { logger } from '@duyetbot/hono-middleware';

// We need to import the escape functions from the EXISTING debug-footer.ts (not our new workflow one)
// Assuming src/debug-footer.ts exists and exports these.
import { escapeHtml, escapeMarkdownV2 } from '../debug-footer.js';
import type { CommandContext, CommandHandler } from './types.js';

export const builtinCommands: Record<string, CommandHandler> = {
  '/start': async (_text, ctx) => {
    return ctx.config.welcomeMessage ?? 'Hello! How can I help you?';
  },

  '/help': async (_text, ctx) => {
    return ctx.config.helpMessage ?? 'Commands: /start, /help, /clear';
  },

  '/debug': async (_text, ctx) => {
    // Admin-only command
    if (!ctx.isAdmin) {
      return '🔒 Admin command - access denied';
    }

    // Use appropriate formatting based on parseMode
    // For MarkdownV2: use *text* for bold (Markdown style)
    // For HTML: use <b>text</b> for bold (HTML style)
    const isHTML = ctx.parseMode === 'HTML';
    const bold = (text: string) => (isHTML ? `<b>${text}</b>` : `*${text}*`);
    // Escape function for dynamic content - HTML needs entity escaping,
    // MarkdownV2 needs special character escaping
    const esc = (text: string) => (isHTML ? escapeHtml(text) : escapeMarkdownV2(text));

    const lines: string[] = [`🔍 ${bold('Debug Information')}\n`];

    // User context section
    lines.push(bold('User Context:'));
    lines.push(`  userId: ${esc(String(ctx.state.userId ?? '-'))}`);
    lines.push(`  chatId: ${esc(String(ctx.state.chatId ?? '-'))}`);
    lines.push(`  username: ${esc(ctx.username ?? '-')}`);
    lines.push(`  isAdmin: ${ctx.isAdmin}`);
    lines.push('');

    // Agent state
    lines.push(bold('Agent State:'));
    lines.push(`  messages: ${ctx.state.messages?.length ?? 0}`);
    lines.push(`  workflows: ${Object.keys(ctx.state.activeWorkflows ?? {}).length}`);
    lines.push('');

    // Configuration
    lines.push(bold('Configuration:'));
    lines.push(`  maxHistory: ${ctx.config.maxHistory ?? 100}`);
    lines.push(`  maxToolIterations: ${ctx.config.maxToolIterations ?? 5}`);
    lines.push(`  maxTools: ${esc(String(ctx.config.maxTools ?? 'unlimited'))}`);
    lines.push(`  thinkingInterval: ${ctx.config.thinkingRotationInterval ?? 5000}ms`);
    lines.push('');

    // Tools
    const toolCount = ctx.config.tools?.length ?? 0;
    lines.push(`${bold(`Tools (${toolCount})`)}:`);
    if (toolCount > 0) {
      for (const tool of ctx.config.tools ?? []) {
        lines.push(`  • ${esc(tool.name)}`);
      }
    } else {
      lines.push('  (no tools configured)');
    }
    lines.push('');

    // MCP Servers
    const mcpCount = ctx.config.mcpServers?.length ?? 0;
    lines.push(`${bold(`MCP Servers (${mcpCount})`)}:`);
    if (mcpCount > 0) {
      for (const mcp of ctx.config.mcpServers ?? []) {
        lines.push(`  • ${esc(mcp.name)}: ${esc(mcp.url)}`);
      }
    } else {
      lines.push('  (no MCP servers configured)');
    }
    lines.push('');

    // Router config
    lines.push(bold('Router:'));
    if (ctx.config.router) {
      lines.push(`  enabled: true`);
      lines.push(`  platform: ${esc(ctx.config.router.platform)}`);
      lines.push(`  debug: ${ctx.config.router.debug ?? false}`);
    } else {
      lines.push(`  enabled: false`);
    }

    return lines.join('\n');
  },

  '/clear': async (_text, ctx) => {
    // Log state BEFORE clear for debugging
    logger.info('[CloudflareAgent][CLEAR] State BEFORE clear', {
      messageCount: ctx.state.messages?.length ?? 0,
      workflowCount: Object.keys(ctx.state.activeWorkflows ?? {}).length,
    });

    // Reset MCP state if callback provided
    if (ctx.resetMcp) {
      ctx.resetMcp();
    }

    // Build fresh state
    // We maintain userId/chatId but clear everything else
    const freshState = {
      messages: [], // Clear conversation history
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userId: ctx.state.userId,
      chatId: ctx.state.chatId,
    };

    ctx.setState(freshState);

    // Log state AFTER clear to verify
    logger.info('[CloudflareAgent][CLEAR] State AFTER clear', {
      messageCount: 0,
      userId: freshState.userId,
      chatId: freshState.chatId,
      mcpReset: true,
    });

    return '🧹 All conversation data and agent connections cleared. Fresh start!';
  },

  '/recover': async (_text, ctx) => {
    // Clear stuck workflow state
    const hadActiveWorkflows = Object.keys(ctx.state.activeWorkflows ?? {}).length > 0;

    // Remove workflow state while preserving everything else
    const { activeWorkflows: _w, ...rest } = ctx.state;

    ctx.setState({
      ...rest,
      activeWorkflows: {},
      updatedAt: Date.now(),
    });

    logger.info('[CloudflareAgent][RECOVER] Workflow state cleared', {
      hadActiveWorkflows,
    });

    if (!hadActiveWorkflows) {
      return '[ok] No stuck workflows detected. System is healthy.';
    }

    return `[fix] Recovered from stuck state. Cleared ${hadActiveWorkflows ? 'activeWorkflows' : ''}. Try sending a message again.`;
  },
};

/**
 * Handle a command string by routing to the appropriate handler
 */
export async function handleBuiltinCommand(
  text: string,
  ctx: CommandContext
): Promise<string | null> {
  const command = (text.split(/[\s\n]/)[0] ?? '').toLowerCase();
  const handler = builtinCommands[command];

  if (handler) {
    return handler(text, ctx);
  }

  return null;
}
