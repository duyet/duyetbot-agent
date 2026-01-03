# duyetbot-action

AI-powered GitHub automation with intelligent mode detection, continuous processing, and auto-merge capabilities.

## Overview

**duyetbot-action** is a GitHub Action that implements an autonomous AI agent for code automation, issue handling, and pull request management. It uses the same loop-based agent architecture as the other bots (telegram-bot, github-bot) but is specifically designed for GitHub Actions integration.

## Features

### Intelligent Mode Detection
- **Tag Mode**: Triggered by @duyetbot mentions or 'duyetbot' label in issues/PRs
- **Agent Mode**: Direct prompts or explicit task requests
- **Continuous Mode**: Multi-task processing with configurable limits

### Self-Improvement Capabilities
- **Error Analysis**: Parse and categorize build, test, lint, and runtime errors
- **Failure Memory**: Learn from past mistakes and track successful fixes
- **Verification Loop**: Run type-check, lint, test, build before PR creation
- **Auto-Fix**: Apply patches and commands to fix common issues
- **Auto-Merge**: Automatically merge PRs when CI checks pass

### Task Sources
- **GitHub Issues**: Pulls tasks from issues with 'agent-task' label
- **File Tasks**: Reads from TASKS.md file
- **Memory MCP**: Integrates with memory-mcp server for cross-session context

### GitHub Operations
- Full CRUD operations for issues, pull requests, comments, labels
- Status check monitoring for CI integration
- Smart context enrichment for better agent decisions

## Usage

### Basic Usage

```yaml
name: duyetbot
uses: ./.github/actions/duyetbot-action@main

with:
  prompt: 'Fix the bug in src/utils.ts'
  github_token: ${{ github.token }}
```

### Continuous Mode (Multi-Task Processing)

```yaml
name: duyetbot
with:
  settings: |
    continuous:
      enabled: true
      maxTasks: 10
      delayBetweenTasks: 5000
```

### Auto-Merge Configuration

```yaml
name: duyetbot
with:
  settings: |
    autoMerge:
      enabled: true
      requiredChecks: ['ci', 'test']
      waitForChecks: true
      approveFirst: true
      deleteBranch: true
```

### Inputs

| Input | Description | Default |
|-------|-------------|----------|
| `prompt` | Task description or direct prompt | `""` |
| `settings` | Agent settings as JSON | `""` |
| `claude_args` | Additional CLI arguments | `""` |
| `trigger_phrase` | @duyetbot mention trigger | `@duyetbot` |
| `label_trigger` | Label that triggers action | `duyetbot` |
| `task_source` | Task source selection | `all` |
| `continuous_mode` | Enable continuous mode | `false` |
| `dry_run` | Dry run mode | `false` |
| `base_branch` | Base branch for operations | `main` |
| `branch_prefix` | Prefix for new branches | `duyetbot/` |

## Architecture

### Agent Loop

```typescript
import { AgentLoop } from './agent/loop.js';

const agent = new AgentLoop({
  config: {
    githubToken: process.env.GITHUB_TOKEN,
    model: 'claude-3-5-sonnet-20241022',
  },
  task: {
    description: 'Fix the bug',
  },
  onProgress: (step, message) => {
    console.log(`[Step ${step}] ${message}`);
  },
});

const result = await agent.run();
```

### Self-Improvement Flow

1. **Error Detection**: Parse build errors, test failures, lint warnings
2. **Fix Application**: Apply patches for code changes, run commands for dependencies
3. **Verification**: Run type-check, lint, test, build
4. **Learning**: Store successful fixes for future reference
5. **Auto-Merge**: Merge PR when CI passes

### Tool System

duyetbot-action uses the **built-in tools** from `@duyetbot/tools`:

- `bash`: Shell command execution
- `git`: Git operations
- `github`: GitHub API operations
- `read`: File reading
- `write`: File writing
- `research`: Web search
- `plan`: Task planning

### Testing

**606 tests** passing across all packages:
- Integration tests (auto-merge, sticky comment, error recovery)
- Unit tests for modes, task picker, GitHub operations
- Test coverage: Comprehensive validation of agent functionality

## Key Differences from Other Bots

| Feature | duyetbot-action | telegram-bot | github-bot |
|--------|------------------|---------|----------------|
| **Runtime** | Cloudflare Workers + DO | Workers + DO | Workers + DO |
| **Deployment** | GitHub Action | Cloudflare deploy | Cloudflare deploy |
| **Platform** | GitHub only | Telegram + GitHub | GitHub only |
| **State** | Durable Object | Durable Object | In-memory (per run) |
| **Context** | GitHub Actions env | Telegram webhook | GitHub webhook |
| **Test Coverage** | 606 tests | 969 tests | 969 tests |

## Documentation

For complete documentation, see:
- [Architecture](../docs/architecture.md) - Full system architecture
- [Deployment](../docs/deployment.md) - Deployment guide
- [CLAUDE.md](../CLAUDE.md) - Claude Code guidance
- [Getting Started](../docs/getting-started.md) - Setup instructions

## Development

See [`../README.md`](../README.md) for full project overview including duyetbot-action.
