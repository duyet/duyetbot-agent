#!/usr/bin/env node
/**
 * CLI Entry Point
 *
 * Interactive terminal UI for duyetbot-agent
 *
 * Usage:
 *   duyetbot                                    # Interactive mode
 *   duyetbot --api-key=sk-...                   # With API key
 *   duyetbot --model=claude-3-5-haiku-20241022  # Different model
 */

import { Agent } from '@/agent/core.js';
import { ClaudeProvider } from '@/providers/claude.js';
import { FileSessionManager } from '@/storage/file-session-manager.js';
import { bashTool, gitTool, planTool, sleepTool } from '@/tools/index.js';
import { ToolRegistry } from '@/tools/registry.js';
import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { App } from './App.js';
import { defaultConfig } from './config.js';

const program = new Command();

program
  .name(defaultConfig.appName)
  .description('Interactive terminal UI for duyetbot-agent')
  .version(defaultConfig.version)
  .option('-k, --api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
  .option('-m, --model <model>', 'Model to use', defaultConfig.defaultModel)
  .option('-s, --storage <path>', 'Storage path', undefined)
  .action((options) => {
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.error('Error: API key required');
      console.error('');
      console.error('Set ANTHROPIC_API_KEY environment variable or use --api-key flag:');
      console.error('  export ANTHROPIC_API_KEY=sk-ant-...');
      console.error(`  ${defaultConfig.appName}`);
      console.error('');
      console.error('Or:');
      console.error(`  ${defaultConfig.appName} --api-key=sk-ant-...`);
      process.exit(1);
    }

    // Create agent
    const sessionManager = new FileSessionManager(options.storage);
    const provider = new ClaudeProvider();
    const toolRegistry = new ToolRegistry();

    // Register tools
    toolRegistry.register(bashTool);
    toolRegistry.register(gitTool);
    toolRegistry.register(planTool);
    toolRegistry.register(sleepTool);

    // Configure provider
    provider.configure({
      provider: defaultConfig.defaultProvider,
      model: options.model,
      apiKey,
    });

    // Create agent
    const agent = new Agent({
      provider,
      sessionManager,
      toolRegistry,
    });

    // Render the Ink app
    render(<App agent={agent} config={{ defaultModel: options.model }} />);
  });

program.parse();
