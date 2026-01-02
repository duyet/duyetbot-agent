# duyetbot-action Redesign Plan

## Overview

Redesign duyetbot-action to match claude-code-action's architecture and developer experience (DX).

## Current State Analysis

### duyetbot-action (Current)
```
apps/duyetbot-action/
├── src/
│   ├── index.ts                 # CLI entrypoint (commander.js)
│   ├── agent/                   # Agent loop implementation
│   ├── config.ts                # Environment-based config
│   ├── entrypoints/             # prepare, execute, report, update-comment
│   ├── github/                  # GitHub operations
│   ├── modes/                   # agent, continuous, tag modes
│   ├── prompts/                 # System prompts
│   ├── reporter/                # Result reporting
│   ├── self-improvement/        # Auto-merge, verification
│   └── tasks/                   # Task sources (github-issues, file, memory)
└── action.yml                   # NOT EXISTS - uses workflow_dispatch only
```

**Issues:**
- No action.yml file (only .github/workflows/duyetbot-action.yml)
- Complex workflow with 480+ lines of inline shell scripts
- CLI-based with commander.js flags
- 20+ environment variables for configuration
- Monolithic workflow file with no conditional execution

### claude-code-action (Reference)
```
claude-code-action/
├── action.yml                   # Composite action definition
├── base-action/                 # SDK execution wrapper
│   ├── action.yml
│   └── src/
│       ├── index.ts
│       ├── prepare-prompt.ts
│       ├── run-claude.ts
│       └── setup-claude-code-settings.ts
├── src/
│   ├── entrypoints/
│   │   ├── prepare.ts           # Trigger detection + setup
│   │   └── update-comment-link.ts
│   ├── github/                  # Context, API, validation
│   ├── modes/                   # tag, agent
│   │   ├── detector.ts          # Auto-mode detection
│   │   ├── registry.ts
│   │   └── types.ts             # Mode interface
│   └── prepare/
│       └── index.ts             # Modular prepare function
```

**Strengths:**
- Clean composite action structure
- Only 3 main inputs: `prompt`, `claude_args`, `settings`
- Prepare step sets `contains_trigger` for conditional execution
- Base action separates SDK execution from orchestration
- Mode interface with clear contract

## Redesign Architecture

### New Structure
```
apps/duyetbot-action/
├── action.yml                   # NEW: Composite action definition
├── base-action/                 # NEW: SDK execution wrapper
│   ├── action.yml
│   ├── package.json
│   └── src/
│       ├── index.ts             # Run agent SDK
│       ├── prepare-config.ts    # Build agent config
│       └── run-agent.ts         # Execute agent
├── src/
│   ├── entrypoints/
│   │   ├── prepare.ts           # Trigger detection + setup
│   │   └── update-comment.ts    # Comment updates
│   ├── github/
│   │   ├── context.ts           # Parse GitHub event
│   │   ├── token.ts             # GitHub token setup
│   │   ├── validation/
│   │   │   └── permissions.ts   # Permission checks
│   │   └── operations/          # (keep existing)
│   ├── modes/
│   │   ├── types.ts             # UPDATED: Match claude-code-action interface
│   │   ├── detector.ts          # Auto-mode detection
│   │   ├── registry.ts          # Mode registry
│   │   ├── tag/                 # Interactive mode (@duyetbot mentions)
│   │   ├── agent/               # Direct task mode (explicit prompts)
│   │   └── continuous/          # Multi-task automation mode
│   ├── prepare/
│   │   └── index.ts             # Modular prepare function
│   └── config.ts                # Environment-based config (internal)
```

## Interface Changes

### Before (Current)
```yaml
# .github/workflows/duyetbot-action.yml
on:
  workflow_dispatch:
    inputs:
      task:          # Task description
      model:         # AI model choice
      timeout:       # Timeout in minutes
      dry_run:       # Dry run flag
      task_source:   # Task source selector
      task_id:       # Specific task ID
      continuous_mode:      # Enable continuous
      max_tasks:     # Max tasks in continuous
      auto_merge:    # Auto-merge PRs
      close_issues:  # Close issues after merge
      delay_between_tasks: # Delay between tasks
      stop_on_failure:      # Stop on failure
      # ... 15+ more inputs
env:
  DUYETBOT_BASE_URL: ...
  DUYETBOT_API_KEY: ...
  GITHUB_TOKEN: ...
  MEMORY_MCP_URL: ...
  MODEL: ...
  DRY_RUN: ...
  TASK_SOURCE: ...
  # ... 10+ more env vars
```

### After (Redesigned)
```yaml
# .github/workflows/duyetbot.yml
on:
  workflow_dispatch:
    inputs:
      prompt:        # Task description or prompt
      settings:      # Settings JSON or file path
      claude_args:   # Additional CLI args
      # Optional overrides
      github_token:
      anthropic_api_key:

jobs:
  duyetbot:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
    steps:
      - uses: duyet/duyetbot-agent@v1
        with:
          prompt: "Fix the failing tests"
          settings: |
            {
              "continuous": {
                "enabled": true,
                "maxTasks": 10
              },
              "autoMerge": {
                "enabled": true
              }
            }
```

## Mode System Redesign

### Mode Interface (Updated)
```typescript
export type Mode = {
  name: ModeName;
  description: string;

  // Trigger detection
  shouldTrigger(context: GitHubContext): boolean;

  // Context preparation
  prepareContext(context: GitHubContext, data?: ModeData): ModeContext;

  // Tool permissions
  getAllowedTools(): string[];
  getDisallowedTools(): string[];

  // Tracking comment
  shouldCreateTrackingComment(): boolean;

  // Prompt generation
  generatePrompt(context: PreparedContext, githubData: FetchDataResult): string;

  // Environment setup
  prepare(options: ModeOptions): Promise<ModeResult>;

  // Optional system prompt
  getSystemPrompt?(context: ModeContext): string;
};
```

### Mode Detection Logic
```typescript
export function detectMode(context: GitHubContext): AutoDetectedMode {
  // 1. If explicit prompt provided → agent mode
  if (context.inputs.prompt) {
    return 'agent';
  }

  // 2. If continuous enabled in settings → continuous mode
  if (context.settings.continuous?.enabled) {
    return 'continuous';
  }

  // 3. If @duyetbot mention or label → tag mode
  if (isTagTrigger(context)) {
    return 'tag';
  }

  // Default to agent mode
  return 'agent';
}
```

## Input Simplification

### Old Inputs → New Approach

| Old Input/Env | New Approach |
|--------------|--------------|
| `task`, `task_id` | `prompt` input |
| `model` | `claude_args: "--model xxx"` or `settings.model` |
| `dry_run` | `claude_args: "--dry-run"` or `settings.dryRun` |
| `task_source` | `settings.taskSources` |
| `continuous_mode` | `settings.continuous.enabled` |
| `max_tasks` | `settings.continuous.maxTasks` |
| `auto_merge` | `settings.autoMerge.enabled` |
| `close_issues` | `settings.autoMerge.closeIssueAfterMerge` |
| `delay_between_tasks` | `settings.continuous.delayBetweenTasks` |
| `stop_on_failure` | `settings.continuous.stopOnFirstFailure` |
| `DUYETBOT_BASE_URL` | `settings.provider.baseUrl` |
| `DUYETBOT_API_KEY` | `anthropic_api_key` input |
| `MEMORY_MCP_URL` | `settings.mcpServers.memory.url` |
| `MODEL` | `settings.model` |
| `REQUIRED_CHECKS` | `settings.autoMerge.requiredChecks` |

### Example Configurations

#### Simple Task
```yaml
- uses: duyet/duyetbot-agent@v1
  with:
    prompt: "Fix the failing tests"
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

#### Continuous Mode
```yaml
- uses: duyet/duyetbot-agent@v1
  with:
    prompt: "Process all available tasks"
    settings: |
      {
        "continuous": {
          "enabled": true,
          "maxTasks": 50,
          "closeIssuesAfterMerge": true
        },
        "autoMerge": {
          "enabled": true
        }
      }
```

#### Custom MCP Server
```yaml
- uses: duyet/duyetbot-agent@v1
  with:
    prompt: "Analyze the codebase"
    claude_args: |
      --mcp-config '{"mcpServers":{"my-server":{"command":"npx","args":["@my/server"]}}}'
```

## Sticky Comment Pattern

### Current (Multiple Comments)
```
@duyetbot Analyze this PR

🤖 @duyetbot is analyzing...

[New comment with results]
```

### After (Sticky Comment)
```yaml
- uses: duyet/duyetbot-agent@v1
  with:
    use_sticky_comment: "true"
```

Result: Single comment that updates in place:
```
🤖 @duyetbot is analyzing...
⏳ Status: Running
🔄 Progress: [ ] Step 1
             [ ] Step 2
             [ ] Step 3
[Comment edits in place with progress]

✅ Analysis complete
[Final results]
```

## Implementation Phases

### Phase 1: Core Infrastructure
1. Create `action.yml` composite action
2. Create `base-action/` directory structure
3. Update mode interface to match reference
4. Implement prepare step with trigger detection

### Phase 2: Configuration Simplification
1. Consolidate inputs to `prompt`, `settings`, `claude_args`
2. Update config loading to support both env and settings
3. Migrate existing modes to new interface

### Phase 3: Enhanced Features
1. Implement sticky comment pattern
2. Add progress tracking with checkboxes
3. Improve comment update flow

### Phase 4: Migration & Testing
1. Update existing workflows
2. Add comprehensive tests
3. Update documentation

## Backward Compatibility

For existing workflows, provide migration guide and temporary compatibility layer:

```typescript
// Legacy environment variable support (deprecated)
if (process.env.TASK) {
  console.warn('TASK env var is deprecated, use prompt input instead');
  config.prompt = process.env.TASK;
}
```

## Success Metrics

1. **DX Improvement**: Reduce required inputs from 20+ to 3
2. **Workflow Simplicity**: Typical workflow < 20 lines
3. **Conditional Execution**: Skip runs when no trigger detected
4. **Mode Clarity**: Auto-detection works 95%+ of time
5. **Documentation**: Single-page quickstart guide
