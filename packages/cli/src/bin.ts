#!/usr/bin/env node

/**
 * CLI Entry Point
 */

import { Command } from 'commander';
import { runPrompt, startChat } from './chat.js';
import { CloudSessionManager } from './cloud-sessions.js';
import { loadConfig, saveConfig } from './config.js';
import { startDeviceLogin } from './oauth.js';
import { FileSessionManager } from './sessions.js';
import type { ListSessionsOptions } from './sessions.js';

const program = new Command();

program.name('duyetbot').description('CLI tool for duyetbot agent').version('0.1.0');

// Login command
program
  .command('login')
  .description('Authenticate with GitHub')
  .option('--client-id <id>', 'GitHub OAuth App Client ID')
  .action(async (options) => {
    const clientId = options.clientId || process.env.GITHUB_CLIENT_ID;

    if (!clientId) {
      console.error('Error: GitHub Client ID required');
      console.error('Set GITHUB_CLIENT_ID env var or use --client-id option');
      process.exit(1);
    }

    console.log('Starting GitHub OAuth device flow...\n');

    try {
      const token = await startDeviceLogin(clientId, (code, url) => {
        console.log('Please visit the following URL to authenticate:');
        console.log(`\n  ${url}\n`);
        console.log(`Your code: ${code}\n`);
        console.log('Waiting for authorization...');
      });

      // Save token to config
      const config = loadConfig();
      config.auth = {
        ...config.auth,
        githubToken: token,
      };
      saveConfig(config);

      console.log('\nAuthenticated successfully!');
    } catch (error) {
      console.error('Authentication failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Logout command
program
  .command('logout')
  .description('Clear authentication')
  .action(() => {
    const config = loadConfig();
    const { auth: _, ...configWithoutAuth } = config;
    saveConfig(configWithoutAuth as typeof config);
    console.log('Logged out successfully');
  });

// Whoami command
program
  .command('whoami')
  .description('Show current user')
  .action(() => {
    const config = loadConfig();
    if (config.auth?.githubToken) {
      console.log('Authenticated (token present)');
    } else {
      console.log('Not authenticated');
    }
  });

// Chat command
program
  .command('chat')
  .description('Start interactive chat')
  .option('-l, --local', 'Use local mode')
  .option('-s, --session <id>', 'Resume session')
  .action(async (options) => {
    const config = loadConfig();
    const mode = options.local ? 'local' : config.mode;

    const chatOptions: Parameters<typeof startChat>[0] = {
      mode,
      sessionsDir: config.sessionsDir,
    };
    if (options.session) {
      chatOptions.sessionId = options.session;
    }
    if (config.mcpServerUrl) {
      chatOptions.mcpServerUrl = config.mcpServerUrl;
    }

    await startChat(chatOptions);
  });

// Ask command (single prompt)
program
  .command('ask <prompt>')
  .description('Ask a single question')
  .option('-l, --local', 'Use local mode')
  .action(async (prompt, options) => {
    const config = loadConfig();
    const mode = options.local ? 'local' : config.mode;

    const promptOptions: Parameters<typeof runPrompt>[1] = {
      mode,
      sessionsDir: config.sessionsDir,
    };
    if (config.mcpServerUrl) {
      promptOptions.mcpServerUrl = config.mcpServerUrl;
    }

    const response = await runPrompt(prompt, promptOptions);

    console.log(response);
  });

// Sessions commands
const sessions = program.command('sessions').description('Manage sessions');

sessions
  .command('list')
  .description('List all sessions')
  .option('-s, --state <state>', 'Filter by state')
  .option('-l, --limit <limit>', 'Limit results')
  .action(async (options) => {
    const config = loadConfig();
    const manager = new FileSessionManager(config.sessionsDir);

    const listOptions: ListSessionsOptions = {};
    if (options.state) {
      listOptions.state = options.state;
    }
    if (options.limit) {
      listOptions.limit = Number.parseInt(options.limit, 10);
    }

    const sessionList = await manager.listSessions(listOptions);

    if (sessionList.length === 0) {
      console.log('No sessions found');
      return;
    }

    for (const session of sessionList) {
      console.log(`${session.id} - ${session.title} [${session.state}]`);
    }
  });

sessions
  .command('new <title>')
  .description('Create a new session')
  .action(async (title) => {
    const config = loadConfig();
    const manager = new FileSessionManager(config.sessionsDir);

    const session = await manager.createSession({ title });
    console.log(`Created session: ${session.id}`);
  });

sessions
  .command('delete <id>')
  .description('Delete a session')
  .action(async (id) => {
    const config = loadConfig();
    const manager = new FileSessionManager(config.sessionsDir);

    await manager.deleteSession(id);
    console.log(`Deleted session: ${id}`);
  });

sessions
  .command('export <id>')
  .description('Export a session to JSON')
  .action(async (id) => {
    const config = loadConfig();
    const manager = new FileSessionManager(config.sessionsDir);

    const exported = await manager.exportSession(id);
    console.log(exported);
  });

// Config commands
const configCmd = program.command('config').description('Manage configuration');

configCmd
  .command('get')
  .description('Show current configuration')
  .action(() => {
    const config = loadConfig();
    console.log(JSON.stringify(config, null, 2));
  });

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action((key, value) => {
    const config = loadConfig();

    // Handle nested keys
    if (key === 'provider') {
      config.defaultProvider = value;
    } else if (key === 'mode') {
      config.mode = value as 'local' | 'cloud';
    } else if (key === 'mcp-url') {
      config.mcpServerUrl = value;
    } else {
      console.error(`Unknown config key: ${key}`);
      process.exit(1);
    }

    saveConfig(config);
    console.log(`Set ${key} = ${value}`);
  });

// Memory commands
const memory = program.command('memory').description('Search and manage memory');

memory
  .command('search <query>')
  .description('Search across all sessions')
  .option('-l, --limit <limit>', 'Limit results', '10')
  .action(async (query, options) => {
    const config = loadConfig();

    if (config.mode === 'local') {
      // Local search using FileSessionManager
      const manager = new FileSessionManager(config.sessionsDir);
      const sessions = await manager.listSessions();

      const results: Array<{ session: string; message: string; role: string }> = [];
      const queryLower = query.toLowerCase();

      for (const session of sessions) {
        for (const msg of session.messages) {
          if (msg.content.toLowerCase().includes(queryLower)) {
            results.push({
              session: session.id,
              message: msg.content.slice(0, 100) + (msg.content.length > 100 ? '...' : ''),
              role: msg.role,
            });
          }
        }
      }

      const limit = Number.parseInt(options.limit, 10);
      const limited = results.slice(0, limit);

      if (limited.length === 0) {
        console.log('No results found');
        return;
      }

      console.log(`Found ${results.length} results (showing ${limited.length}):\n`);
      for (const result of limited) {
        console.log(`[${result.session}] ${result.role}: ${result.message}`);
      }
    } else {
      // Cloud search using MCP
      if (!config.mcpServerUrl) {
        console.error('MCP server URL not configured');
        console.error('Run: duyetbot config set mcp-url <url>');
        process.exit(1);
      }

      if (!config.auth?.githubToken) {
        console.error('Not authenticated. Run: duyetbot login');
        process.exit(1);
      }

      const manager = new CloudSessionManager(
        config.mcpServerUrl,
        'user',
        config.auth.sessionToken
      );

      const sessions = await manager.searchSessions(query);
      const limit = Number.parseInt(options.limit, 10);
      const limited = sessions.slice(0, limit);

      if (limited.length === 0) {
        console.log('No results found');
        return;
      }

      console.log(`Found ${sessions.length} sessions (showing ${limited.length}):\n`);
      for (const session of limited) {
        console.log(`${session.id} - ${session.title} (${session.messages.length} messages)`);
      }
    }
  });

memory
  .command('stats')
  .description('Show memory statistics')
  .action(async () => {
    const config = loadConfig();
    const manager = new FileSessionManager(config.sessionsDir);

    const sessions = await manager.listSessions();

    let totalMessages = 0;
    let userMessages = 0;
    let assistantMessages = 0;
    const stateCount: Record<string, number> = {};

    for (const session of sessions) {
      totalMessages += session.messages.length;
      for (const msg of session.messages) {
        if (msg.role === 'user') {
          userMessages++;
        } else if (msg.role === 'assistant') {
          assistantMessages++;
        }
      }
      stateCount[session.state] = (stateCount[session.state] || 0) + 1;
    }

    console.log('Memory Statistics\n');
    console.log(`Total sessions: ${sessions.length}`);
    console.log(`Total messages: ${totalMessages}`);
    console.log(`  User messages: ${userMessages}`);
    console.log(`  Assistant messages: ${assistantMessages}`);
    console.log('\nSessions by state:');
    for (const [state, count] of Object.entries(stateCount)) {
      console.log(`  ${state}: ${count}`);
    }

    if (sessions.length > 0) {
      const newest = sessions.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b));
      const oldest = sessions.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
      console.log(
        `\nNewest session: ${newest.title} (${new Date(newest.updatedAt).toLocaleDateString()})`
      );
      console.log(
        `Oldest session: ${oldest.title} (${new Date(oldest.createdAt).toLocaleDateString()})`
      );
    }
  });

// Parse and execute
program.parse();
