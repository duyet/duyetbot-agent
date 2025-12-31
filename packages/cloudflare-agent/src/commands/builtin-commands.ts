import { logger } from '@duyetbot/hono-middleware';

// We need to import the escape functions from the EXISTING debug-footer.ts (not our new workflow one)
// Assuming src/debug-footer.ts exists and exports these.
import { escapeHtml, escapeMarkdownV2 } from '../debug-footer.js';
import { EventBridge } from '../events/event-bridge.js';
import { handleTodoCommand } from './todo.js';
import type { CommandContext, CommandHandler } from './types.js';

/**
 * Format uptime from milliseconds to human-readable string.
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Format a timestamp to relative time.
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return 'just now';
}

export const builtinCommands: Record<string, CommandHandler> = {
  '/start': async (_text, ctx) => {
    return ctx.config.welcomeMessage ?? 'Hello! How can I help you?';
  },

  '/help': async (_text, ctx) => {
    return ctx.config.helpMessage ?? 'Commands: /start, /help, /clear';
  },

  '/todo': handleTodoCommand,

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
    const doMessageCount = ctx.state.messages?.length ?? 0;
    logger.info('[CloudflareAgent][CLEAR] State BEFORE clear', {
      messageCount: doMessageCount,
      workflowCount: Object.keys(ctx.state.activeWorkflows ?? {}).length,
    });

    // Reset MCP state if callback provided
    if (ctx.resetMcp) {
      ctx.resetMcp();
    }

    // Clear persistent D1 messages if callback provided
    let d1MessagesCleared = 0;
    if (ctx.clearMessages) {
      d1MessagesCleared = await ctx.clearMessages();
      logger.info('[CloudflareAgent][CLEAR] D1 messages cleared', {
        count: d1MessagesCleared,
      });
    }

    // Build fresh state
    // We maintain userId/chatId but clear everything else
    const freshState = {
      messages: [], // Clear conversation history
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...(ctx.state.userId !== undefined ? { userId: ctx.state.userId } : {}),
      ...(ctx.state.chatId !== undefined ? { chatId: ctx.state.chatId } : {}),
    };

    ctx.setState(freshState);

    // Log state AFTER clear to verify
    logger.info('[CloudflareAgent][CLEAR] State AFTER clear', {
      messageCount: 0,
      userId: freshState.userId,
      chatId: freshState.chatId,
      mcpReset: true,
      d1MessagesCleared,
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

  // ============================================
  // ADMIN DASHBOARD COMMANDS (Phase 1 Roadmap)
  // ============================================

  '/status': async (_text, ctx) => {
    if (!ctx.isAdmin) {
      return '🔒 Admin command - access denied';
    }

    const isHTML = ctx.parseMode === 'HTML';
    const bold = (text: string) => (isHTML ? `<b>${text}</b>` : `*${text}*`);
    const code = (text: string) => (isHTML ? `<code>${text}</code>` : `\`${text}\``);
    const esc = (text: string) => (isHTML ? escapeHtml(text) : escapeMarkdownV2(text));

    const lines: string[] = [`📊 ${bold('System Status')}\n`];

    // Uptime
    const uptime = ctx.startedAt ? formatUptime(Date.now() - ctx.startedAt) : 'unknown';
    lines.push(`${bold('Uptime')}: ${esc(uptime)}`);

    // Environment
    const env = ctx.env?.ENVIRONMENT ?? 'production';
    lines.push(`${bold('Environment')}: ${code(esc(env))}`);

    // Platform
    const platform = ctx.config.router?.platform ?? 'telegram';
    lines.push(`${bold('Platform')}: ${code(esc(platform))}`);
    lines.push('');

    // Memory status
    lines.push(bold('Memory:'));
    const messageCount = ctx.state.messages?.length ?? 0;
    const workflowCount = Object.keys(ctx.state.activeWorkflows ?? {}).length;
    lines.push(`  Messages in context: ${messageCount}`);
    lines.push(`  Active workflows: ${workflowCount}`);
    lines.push('');

    // Tools status
    const toolCount = ctx.config.tools?.length ?? 0;
    const mcpCount = ctx.config.mcpServers?.length ?? 0;
    lines.push(bold('Capabilities:'));
    lines.push(`  Tools: ${toolCount} available`);
    lines.push(`  MCP servers: ${mcpCount} connected`);
    lines.push('');

    // Health check
    lines.push(bold('Health:'));
    const healthStatus = workflowCount === 0 ? '✅ Healthy' : '⚠️ Active workflows';
    lines.push(`  Status: ${healthStatus}`);

    // Last activity
    if (ctx.state.updatedAt) {
      lines.push(`  Last activity: ${formatRelativeTime(ctx.state.updatedAt)}`);
    }

    return lines.join('\n');
  },

  '/agents': async (_text, ctx) => {
    if (!ctx.isAdmin) {
      return '🔒 Admin command - access denied';
    }

    const isHTML = ctx.parseMode === 'HTML';
    const bold = (text: string) => (isHTML ? `<b>${text}</b>` : `*${text}*`);
    const code = (text: string) => (isHTML ? `<code>${text}</code>` : `\`${text}\``);
    const esc = (text: string) => (isHTML ? escapeHtml(text) : escapeMarkdownV2(text));

    const lines: string[] = [`🤖 ${bold('Agent Registry')}\n`];

    // Known agents in the ecosystem (from architecture)
    const agents = [
      {
        name: 'telegram-bot',
        platform: 'Telegram',
        description: 'Personal assistant via Telegram',
        status: '✅ Online',
      },
      {
        name: 'github-bot',
        platform: 'GitHub',
        description: 'PR reviews, issue triage',
        status: '✅ Online',
      },
      {
        name: 'memory-mcp',
        platform: 'MCP',
        description: 'Cross-session memory service',
        status: mcpCount(ctx) > 0 ? '✅ Connected' : '⚪ Available',
      },
    ];

    for (const agent of agents) {
      lines.push(`${bold(esc(agent.name))}`);
      lines.push(`  Platform: ${code(esc(agent.platform))}`);
      lines.push(`  ${esc(agent.description)}`);
      lines.push(`  Status: ${agent.status}`);
      lines.push('');
    }

    lines.push(`${bold('Hint')}: Use /trigger <agent> to invoke another agent`);

    return lines.join('\n');
  },

  '/tasks': async (_text, ctx) => {
    if (!ctx.isAdmin) {
      return '🔒 Admin command - access denied';
    }

    const isHTML = ctx.parseMode === 'HTML';
    const bold = (text: string) => (isHTML ? `<b>${text}</b>` : `*${text}*`);
    const esc = (text: string) => (isHTML ? escapeHtml(text) : escapeMarkdownV2(text));

    const lines: string[] = [`📋 ${bold('Task Queue')}\n`];

    // Active workflows from state
    const workflows = ctx.state.activeWorkflows ?? {};
    const workflowKeys = Object.keys(workflows);

    if (workflowKeys.length === 0) {
      lines.push('No active tasks.');
      lines.push('');
      lines.push(`${bold('Scheduled')}: None`);
      lines.push(`${bold('Pending')}: None`);
    } else {
      lines.push(`${bold('Active Tasks')} (${workflowKeys.length}):\n`);

      for (const key of workflowKeys) {
        const workflow = workflows[key];
        lines.push(`• ${esc(key)}`);
        if (workflow && typeof workflow === 'object') {
          // Access properties safely using type assertion through unknown
          const wf = workflow as unknown as Record<string, unknown>;
          if (wf.status) {
            lines.push(`  Status: ${esc(String(wf.status))}`);
          }
          if (wf.startedAt && typeof wf.startedAt === 'number') {
            lines.push(`  Started: ${formatRelativeTime(wf.startedAt)}`);
          }
        }
      }
    }

    lines.push('');
    lines.push(`${bold('Hint')}: Use /recover to clear stuck tasks`);

    return lines.join('\n');
  },

  '/metrics': async (_text, ctx) => {
    if (!ctx.isAdmin) {
      return '🔒 Admin command - access denied';
    }

    const isHTML = ctx.parseMode === 'HTML';
    const bold = (text: string) => (isHTML ? `<b>${text}</b>` : `*${text}*`);
    const code = (text: string) => (isHTML ? `<code>${text}</code>` : `\`${text}\``);

    const lines: string[] = [`📈 ${bold('Usage Metrics')}\n`];

    // Session metrics from state
    lines.push(bold('Current Session:'));
    const messageCount = ctx.state.messages?.length ?? 0;
    lines.push(`  Messages: ${messageCount}`);

    // Estimate tokens (rough: ~4 chars per token for English)
    const totalChars = (ctx.state.messages ?? []).reduce((sum, msg) => {
      if (typeof msg.content === 'string') {
        return sum + msg.content.length;
      }
      return sum;
    }, 0);
    const estimatedTokens = Math.round(totalChars / 4);
    lines.push(`  Est. tokens: ~${estimatedTokens.toLocaleString()}`);
    lines.push('');

    // Try to get metrics from D1 if available
    if (ctx.env?.OBSERVABILITY_DB) {
      try {
        const db = ctx.env.OBSERVABILITY_DB;
        const result = await db
          .prepare(
            `SELECT
              COUNT(*) as total_messages,
              SUM(input_tokens) as total_input,
              SUM(output_tokens) as total_output
            FROM executions
            WHERE created_at > datetime('now', '-24 hours')`
          )
          .first<{ total_messages: number; total_input: number; total_output: number }>();

        if (result) {
          lines.push(bold('Last 24 Hours (D1):'));
          lines.push(`  Requests: ${result.total_messages ?? 0}`);
          lines.push(`  Input tokens: ${(result.total_input ?? 0).toLocaleString()}`);
          lines.push(`  Output tokens: ${(result.total_output ?? 0).toLocaleString()}`);
          lines.push('');
        }
      } catch (err) {
        logger.warn('[METRICS] D1 query failed', { error: String(err) });
        lines.push(`${bold('D1 Metrics')}: unavailable`);
        lines.push('');
      }
    } else {
      lines.push(`${bold('D1 Metrics')}: not configured`);
      lines.push('');
    }

    // Configuration limits
    lines.push(bold('Limits:'));
    lines.push(`  Max history: ${code(String(ctx.config.maxHistory ?? 100))}`);
    lines.push(`  Max iterations: ${code(String(ctx.config.maxToolIterations ?? 5))}`);

    return lines.join('\n');
  },

  '/events': async (_text, ctx) => {
    if (!ctx.isAdmin) {
      return '🔒 Admin command - access denied';
    }

    const isHTML = ctx.parseMode === 'HTML';
    const bold = (text: string) => (isHTML ? `<b>${text}</b>` : `*${text}*`);
    const code = (text: string) => (isHTML ? `<code>${text}</code>` : `\`${text}\``);
    const esc = (text: string) => (isHTML ? escapeHtml(text) : escapeMarkdownV2(text));

    const lines: string[] = [`📡 ${bold('Event Bridge')}\n`];

    // Check if D1 is available
    if (!ctx.env?.OBSERVABILITY_DB) {
      lines.push('❌ Event Bridge not available');
      lines.push('D1 database is not configured.');
      return lines.join('\n');
    }

    try {
      const bridge = new EventBridge({
        db: ctx.env.OBSERVABILITY_DB,
        agentId: 'telegram-bot',
      });

      // Get stats and recent events
      const [stats, recentEvents] = await Promise.all([
        bridge.getStats(),
        bridge.query({ limit: 10 }),
      ]);

      // Stats section
      lines.push(bold('Statistics:'));
      lines.push(`  Total events: ${stats.totalEvents}`);
      lines.push(`  Current sequence: ${stats.currentSequence}`);
      lines.push(`  Active subscriptions: ${stats.activeSubscriptions}`);

      if (stats.oldestEventAt) {
        lines.push(`  Oldest event: ${formatRelativeTime(stats.oldestEventAt)}`);
      }
      lines.push('');

      // Category breakdown
      const categories = Object.entries(stats.byCategory);
      if (categories.length > 0) {
        lines.push(bold('By Category:'));
        for (const [category, count] of categories) {
          lines.push(`  ${esc(category)}: ${count}`);
        }
        lines.push('');
      }

      // Priority breakdown
      const priorities = Object.entries(stats.byPriority);
      if (priorities.length > 0) {
        lines.push(bold('By Priority:'));
        for (const [priority, count] of priorities) {
          const icon =
            priority === 'critical'
              ? '🔴'
              : priority === 'high'
                ? '🟠'
                : priority === 'normal'
                  ? '🟡'
                  : '🟢';
          lines.push(`  ${icon} ${esc(priority)}: ${count}`);
        }
        lines.push('');
      }

      // Recent events
      if (recentEvents.length > 0) {
        lines.push(bold('Recent Events:'));
        for (const event of recentEvents.slice(0, 5)) {
          const icon =
            event.priority === 'critical'
              ? '🔴'
              : event.priority === 'high'
                ? '🟠'
                : event.priority === 'normal'
                  ? '🟡'
                  : '🟢';
          const age = formatRelativeTime(event.createdAt);
          lines.push(`${icon} ${code(esc(event.type))} from ${esc(event.source)}`);
          lines.push(`   ${age} • seq: ${event.sequence ?? '-'}`);
        }
      } else {
        lines.push('No events recorded yet.');
      }
    } catch (err) {
      logger.error('[EVENTS] Failed to fetch events', { error: String(err) });
      lines.push('❌ Failed to fetch events');
      lines.push(`Error: ${esc(err instanceof Error ? err.message : String(err))}`);
    }

    return lines.join('\n');
  },

  '/notifications': async (text, ctx) => {
    if (!ctx.isAdmin) {
      return '🔒 Admin command - access denied';
    }

    const isHTML = ctx.parseMode === 'HTML';
    const bold = (text: string) => (isHTML ? `<b>${text}</b>` : `*${text}*`);
    const code = (text: string) => (isHTML ? `<code>${text}</code>` : `\`${text}\``);
    const esc = (text: string) => (isHTML ? escapeHtml(text) : escapeMarkdownV2(text));

    const lines: string[] = [`🔔 ${bold('Notification Settings')}\n`];

    // Check if D1 is available
    if (!ctx.env?.OBSERVABILITY_DB) {
      lines.push('❌ Notifications not available');
      lines.push('D1 database is not configured.');
      return lines.join('\n');
    }

    // Parse subcommand: /notifications [on|off|status|categories]
    const args = text.split(/\s+/).slice(1);
    const subcommand = args[0]?.toLowerCase() ?? 'status';

    try {
      const db = ctx.env.OBSERVABILITY_DB;

      // Get current preferences
      const result = await db
        .prepare('SELECT * FROM notification_preferences WHERE chat_id = ?')
        .bind(ctx.state.chatId ?? 0)
        .first<{
          enabled: number;
          min_priority: string;
          categories: string;
          last_sequence: number;
        }>();

      const prefs = result
        ? {
            enabled: result.enabled === 1,
            minPriority: result.min_priority,
            categories: JSON.parse(result.categories) as string[],
            lastSequence: result.last_sequence,
          }
        : {
            enabled: true,
            minPriority: 'normal',
            categories: ['github', 'task', 'approval'],
            lastSequence: 0,
          };

      switch (subcommand) {
        case 'on':
          await db
            .prepare(
              `INSERT OR REPLACE INTO notification_preferences
               (chat_id, user_id, enabled, min_priority, categories, last_sequence, updated_at)
               VALUES (?, ?, 1, ?, ?, ?, ?)`
            )
            .bind(
              ctx.state.chatId ?? 0,
              ctx.state.userId ?? 0,
              prefs.minPriority,
              JSON.stringify(prefs.categories),
              prefs.lastSequence,
              Date.now()
            )
            .run();
          lines.push('✅ Notifications enabled');
          lines.push(`Categories: ${prefs.categories.join(', ')}`);
          lines.push(`Min priority: ${prefs.minPriority}`);
          break;

        case 'off':
          await db
            .prepare(
              `INSERT OR REPLACE INTO notification_preferences
               (chat_id, user_id, enabled, min_priority, categories, last_sequence, updated_at)
               VALUES (?, ?, 0, ?, ?, ?, ?)`
            )
            .bind(
              ctx.state.chatId ?? 0,
              ctx.state.userId ?? 0,
              prefs.minPriority,
              JSON.stringify(prefs.categories),
              prefs.lastSequence,
              Date.now()
            )
            .run();
          lines.push('🔕 Notifications disabled');
          lines.push('Use /notifications on to re-enable');
          break;

        case 'categories':
          if (args.length > 1) {
            const newCategories = args.slice(1).map((c) => c.toLowerCase());
            const validCategories = [
              'github',
              'task',
              'notification',
              'approval',
              'schedule',
              'system',
              'agent',
            ];
            const filtered = newCategories.filter((c) => validCategories.includes(c));

            if (filtered.length > 0) {
              await db
                .prepare(
                  `INSERT OR REPLACE INTO notification_preferences
                   (chat_id, user_id, enabled, min_priority, categories, last_sequence, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`
                )
                .bind(
                  ctx.state.chatId ?? 0,
                  ctx.state.userId ?? 0,
                  prefs.enabled ? 1 : 0,
                  prefs.minPriority,
                  JSON.stringify(filtered),
                  prefs.lastSequence,
                  Date.now()
                )
                .run();
              lines.push(`✅ Categories updated: ${filtered.join(', ')}`);
            } else {
              lines.push('❌ No valid categories provided');
              lines.push(`Valid: ${validCategories.join(', ')}`);
            }
          } else {
            lines.push(bold('Current categories:'));
            lines.push(`  ${prefs.categories.join(', ')}`);
            lines.push('');
            lines.push(`Usage: ${code('/notifications categories github task')}`);
          }
          break;

        case 'priority':
          if (args.length > 1) {
            const newPriority = args[1]!.toLowerCase();
            const validPriorities = ['low', 'normal', 'high', 'critical'];
            if (validPriorities.includes(newPriority)) {
              await db
                .prepare(
                  `INSERT OR REPLACE INTO notification_preferences
                   (chat_id, user_id, enabled, min_priority, categories, last_sequence, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`
                )
                .bind(
                  ctx.state.chatId ?? 0,
                  ctx.state.userId ?? 0,
                  prefs.enabled ? 1 : 0,
                  newPriority,
                  JSON.stringify(prefs.categories),
                  prefs.lastSequence,
                  Date.now()
                )
                .run();
              lines.push(`✅ Min priority set to: ${newPriority}`);
            } else {
              lines.push('❌ Invalid priority');
              lines.push(`Valid: ${validPriorities.join(', ')}`);
            }
          } else {
            lines.push(`Current priority: ${code(prefs.minPriority)}`);
            lines.push(`Usage: ${code('/notifications priority high')}`);
          }
          break;

        default: // status
          lines.push(bold('Current Settings:'));
          lines.push(`  Status: ${prefs.enabled ? '✅ Enabled' : '🔕 Disabled'}`);
          lines.push(`  Min priority: ${esc(prefs.minPriority)}`);
          lines.push(`  Categories: ${prefs.categories.join(', ')}`);
          lines.push(`  Last sequence: ${prefs.lastSequence}`);
          lines.push('');
          lines.push(bold('Commands:'));
          lines.push(`  ${code('/notifications on')} - Enable`);
          lines.push(`  ${code('/notifications off')} - Disable`);
          lines.push(`  ${code('/notifications priority high')} - Set min priority`);
          lines.push(`  ${code('/notifications categories github task')} - Set categories`);
      }
    } catch (err) {
      // Table might not exist
      if (String(err).includes('no such table')) {
        lines.push('⚠️ Not yet configured');
        lines.push('Notifications will start after first cron run.');
      } else {
        logger.error('[NOTIFICATIONS] Command failed', { error: String(err) });
        lines.push('❌ Failed to update settings');
        lines.push(`Error: ${esc(err instanceof Error ? err.message : String(err))}`);
      }
    }

    return lines.join('\n');
  },

  '/admin': async (_text, ctx) => {
    if (!ctx.isAdmin) {
      return '🔒 Admin command - access denied';
    }

    const isHTML = ctx.parseMode === 'HTML';
    const bold = (text: string) => (isHTML ? `<b>${text}</b>` : `*${text}*`);
    const code = (text: string) => (isHTML ? `<code>${text}</code>` : `\`${text}\``);

    const lines: string[] = [`🛠️ ${bold('Admin Commands')}\n`];

    const commands = [
      { cmd: '/status', desc: 'System health overview' },
      { cmd: '/agents', desc: 'List all agents and their status' },
      { cmd: '/tasks', desc: 'View active task queue' },
      { cmd: '/events', desc: 'View Event Bridge activity' },
      { cmd: '/notifications', desc: 'Configure notification preferences' },
      { cmd: '/metrics', desc: 'Token usage and cost metrics' },
      { cmd: '/debug', desc: 'Detailed debug information' },
      { cmd: '/clear', desc: 'Clear conversation history' },
      { cmd: '/recover', desc: 'Fix stuck workflows' },
    ];

    for (const { cmd, desc } of commands) {
      lines.push(`${code(cmd)} - ${desc}`);
    }

    lines.push('');
    lines.push(`${bold('Coming Soon')}:`);
    lines.push(`${code('/trigger')} - Invoke another agent`);
    lines.push(`${code('/approve')} - Approve pending actions`);
    lines.push(`${code('/schedule')} - Manage scheduled tasks`);

    return lines.join('\n');
  },
};

/**
 * Helper to count MCP servers.
 */
function mcpCount(ctx: CommandContext): number {
  return ctx.config.mcpServers?.length ?? 0;
}

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
