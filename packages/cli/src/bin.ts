#!/usr/bin/env node

/**
 * CLI Entry Point
 */

import { Command } from 'commander';
import { loadConfig, saveConfig } from './config.js';
import { FileSessionManager } from './sessions.js';
import type { ListSessionsOptions } from './sessions.js';
import { startChat, runPrompt } from './chat.js';

const program = new Command();

program
  .name('duyetbot')
  .description('CLI tool for duyetbot agent')
  .version('0.1.0');

// Login command
program
  .command('login')
  .description('Authenticate with GitHub')
  .action(async () => {
    console.log('GitHub OAuth login not yet implemented');
    console.log('Please set GITHUB_TOKEN environment variable');
  });

// Logout command
program
  .command('logout')
  .description('Clear authentication')
  .action(() => {
    const config = loadConfig();
    delete config.auth;
    saveConfig(config);
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
const sessions = program
  .command('sessions')
  .description('Manage sessions');

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
const configCmd = program
  .command('config')
  .description('Manage configuration');

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

// Parse and execute
program.parse();
