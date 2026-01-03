# duyetbot-action Architecture Documentation

## Overview

duyetbot-action is a GitHub Action that implements an autonomous AI agent for code automation, issue handling, and pull request management. It uses the Claude Agent SDK for LLM interactions and provides self-improvement capabilities.

## Current Architecture

### Entry Points

The system has three main entry points (in `src/entrypoints/`):

1. **`execute.ts`** - Main CLI entry point for running agent tasks
2. **`prepare.ts`** - Preparation step (branch creation, environment setup)
3. **`report.ts`** - Reporting results back to GitHub
4. **`update-comment.ts`** - Updating progress comments

The main entry is `src/index.ts` which uses Command.js for CLI argument parsing.

### Core Components

#### 1. Agent Loop (`src/agent/`)

- **`loop.ts`** - Main agent loop using Claude Agent SDK via `@duyetbot/core/query`
- **`self-improving-loop.ts`** - Extends AgentLoop with verification and error recovery
- **`checkpoint.ts`** - Checkpoint management for resuming tasks

Key features:
- Uses Claude Agent SDK (via `@duyetbot/core/query`)
- Checkpoint-based task resumption
- Progress callbacks for step-by-step updates
- Token tracking

#### 2. Modes (`src/modes/`)

Three execution modes:

- **`agent/index.ts`** - Direct automation mode for explicit prompts
  - Triggers: workflow_dispatch, issue opened, agent-task label
  - Creates tracking comments
  - Uses all available tools

- **`tag/index.ts`** - Interactive mode triggered by @duyetbot mentions
  - Triggers: @duyetbot mention in issue/PR body or comments, "duyetbot" label
  - **MISSING: Does NOT check for assignee trigger** (documented but not implemented)
  - Creates/sticky updates progress comments

- **`continuous/index.ts`** - Multi-task processing mode
  - Processes multiple tasks from various sources
  - Configurable delays and limits

- **`detector.ts`** - Auto-detects appropriate mode based on context
- **`registry.ts`** - Mode registry and management

#### 3. Self-Improvement (`src/self-improvement/`) ⚠️ HARDCODED LOGIC

This entire module contains hardcoded logic that should be converted to skills:

- **`error-analyzer.ts`** (200+ lines)
  - Parses and categorizes error messages from various tools
  - Hardcoded error patterns (regex)
  - Error severity estimation
  - File/location extraction

- **`failure-memory.ts`** (200+ lines)
  - Tracks and learns from past failures
  - File-based storage (JSON)
  - Pattern matching for error signatures
  - Fix suggestion with confidence scores

- **`verification-loop.ts`** (200+ lines)
  - Runs type-check, lint, test, build before PR
  - Hardcoded check commands
  - Error collection and categorization
  - Checkpoint-based verification

- **`auto-merge.ts`** (200+ lines)
  - Monitors CI status checks
  - Automatic PR approval and merging
  - Hardcoded merging logic

- **`types.ts`** (188 lines)
  - All self-improvement type definitions
  - Error categories, severities
  - Fix suggestion interfaces

- **`index.ts`** - Exports self-improvement system

**Total**: ~1200 lines of hardcoded self-improvement logic

#### 4. GitHub Operations (`src/github/`)

Direct GitHub API operations (should use tools instead):

- **`api/client.ts`** - Octokit client wrapper
- **`operations/comments.ts`** - Comment CRUD operations
- **`operations/issues.ts`** - Issue CRUD operations
- **`operations/pulls.ts`** - Pull request operations
- **`operations/labels.ts`** - Label operations
- **`operations/branches.ts`** - Branch operations
- **`operations/commits.ts`** - Commit operations
- **`operations/tags.ts`** - Tag operations
- **`operations/status.ts`** - Status check operations
- **`validation/permissions.ts`** - Permission validation
- **`token.ts`** - Token management
- **`context.ts`** - GitHub context types and parsing

**Issue**: All these use direct Octokit API calls instead of the `github` tool

#### 5. Task Sources (`src/tasks/`)

Three task source implementations:

- **`sources/github-issues.ts`** - Pulls tasks from GitHub issues with "agent-task" label
- **`sources/file-tasks.ts`** - Reads tasks from TASKS.md file
- **`sources/memory-mcp.ts`** - Integrates with memory-mcp server for cross-session context
- **`types.ts`** - Task type definitions
- **`picker.ts`** - Task prioritization and selection logic
- **`index.ts`** - Task source registry

#### 6. Prompts (`src/prompts/`)

System prompt construction:

- **`github-actions.ts`** - Main system prompt for GitHub Actions context
- **`sections/identity.ts`** - Identity section
- **`sections/safety.ts`** - Safety guidelines
- **`sections/self-improvement.ts`** - Self-improvement instructions (HARDCODED)
- **`index.ts`** - Prompt builder

#### 7. Reporter (`src/reporter/`)

Result reporting to GitHub:

- **`github.ts`** - GitHub reporter (comments, issues)
- **`artifacts.ts`** - Artifact management
- **`types.ts`** - Reporter type definitions
- **`index.ts`** - Combined reporter

#### 8. Configuration (`src/config.ts`)

Comprehensive configuration management:

- Uses Zod for validation
- Environment variable parsing
- Settings object support
- Configures:
  - API keys and tokens
  - Model selection
  - Task sources
  - Auto-merge settings
  - Self-improvement settings
  - Continuous mode settings
  - Repository info

## Dependencies

### Internal Dependencies (workspace)

- `@duyetbot/core` - SDK adapter, session management, MCP client
- `@duyetbot/tools` - Built-in tools (bash, git, github, research, plan, read, write, edit, search, run_tests)
- `@duyetbot/prompts` - System prompts
- `@duyetbot/providers` - LLM providers
- `@duyetbot/types` - Shared types

### External Dependencies

- `@octokit/rest` ^21.0.0 - GitHub API client (used directly, not via tools)
- `commander` ^12.0.0 - CLI argument parsing
- `zod` ^3.24.0 - Schema validation

### Test Dependencies

- `vitest` ^3.0.0 - Test runner
- `@duyetbot/config-typescript` - TypeScript config

## Key Issues to Address

### 1. Hardcoded Self-Improvement Logic (~1200 lines)

All self-improvement logic is hardcoded in TypeScript:
- Error patterns in `error-analyzer.ts` (should be in .md skill)
- Failure memory in `failure-memory.ts` (should be in .md skill)
- Verification checks in `verification-loop.ts` (should be in .md skill)
- Auto-merge logic in `auto-merge.ts` (should be in .md skill)

### 2. Direct GitHub API Calls

All GitHub operations use Octokit directly instead of the `github` tool:
- Should use `github` tool from `@duyetbot/tools`
- Remove direct Octokit usage
- Use tool-based pattern

### 3. Missing Assignee Trigger

The `detector.ts` mentions assignee trigger in comments but doesn't implement it:
- Line 29: "Issue/PR assigned to 'duyetbot'" (not implemented)
- Line 92: "Checks if context contains a trigger (mention, label, assignee)"
- But `checkForTrigger()` function doesn't check assignees

### 4. No Skill/Subagent System

- No `.claude/skills/` directory
- No `.claude/subagents/` directory
- No skill loader/registry
- No subagent loader/registry
- All logic is hardcoded in TypeScript

### 5. LLM Usage

Currently uses Claude Agent SDK but not with full features:
- Not using subagents from SDK
- Not using dynamic tool loading
- Self-improvement logic in code, not as subagents

## Test Coverage

**606 tests** across:
- Integration tests (auto-merge, sticky comment, error recovery)
- Unit tests for modes, task picker, GitHub operations
- Test coverage: Comprehensive validation of agent functionality

## Files by Category

```
src/
├── agent/              # Agent loop and execution
│   ├── loop.ts
│   ├── self-improving-loop.ts
│   └── checkpoint.ts
├── modes/              # Execution modes (agent, tag, continuous)
│   ├── agent/index.ts
│   ├── tag/index.ts
│   ├── continuous/index.ts
│   ├── detector.ts
│   └── registry.ts
├── self-improvement/   # ❌ HARDCODED logic (~1200 lines)
│   ├── error-analyzer.ts
│   ├── failure-memory.ts
│   ├── verification-loop.ts
│   ├── auto-merge.ts
│   ├── types.ts
│   └── index.ts
├── github/             # ❌ Direct API calls (should use tools)
│   ├── api/client.ts
│   ├── operations/*.ts
│   ├── validation/*.ts
│   ├── token.ts
│   └── context.ts
├── tasks/              # Task source management
│   ├── sources/*.ts
│   ├── types.ts
│   ├── picker.ts
│   └── index.ts
├── prompts/            # System prompts
│   ├── github-actions.ts
│   └── sections/*.ts
├── reporter/           # Result reporting
│   ├── github.ts
│   ├── artifacts.ts
│   ├── types.ts
│   └── index.ts
├── entrypoints/        # CLI entry points
│   ├── execute.ts
│   ├── prepare.ts
│   ├── report.ts
│   └── update-comment.ts
├── config.ts           # Configuration
└── index.ts           # Main entry
```

## Transformation Plan

### Phase 1: Research (In Progress)
- [x] Document current architecture (this file)
- [ ] Document Claude Agent SDK patterns
- [ ] Analyze self-improvement implementation
- [ ] Analyze mode implementations
- [ ] Document direct API calls
- [ ] Review github tool capabilities

### Phase 2: Architecture Design
- [ ] Design .claude/skills/ structure
- [ ] Design skill metadata format
- [ ] Design skill loading mechanism
- [ ] Design .claude/subagents/ structure
- [ ] Design subagent metadata format
- [ ] Design assignment detection (including assignee)

### Phase 3: Implementation
- [ ] Create skill/subagent infrastructure
- [ ] Convert self-improvement to skills
- [ ] Create specialized subagents
- [ ] Update modes to use skills
- [ ] Update GitHub operations to use tools
- [ ] Add assignee trigger support

### Phase 4: Testing
- [ ] Fix CI failures
- [ ] Test skill system
- [ ] Test subagent system
- [ ] Test self-improvement as skills
- [ ] Test assignment handling
- [ ] Test self-upgrade

### Phase 5: Documentation
- [ ] Update README
- [ ] Create migration guide
- [ ] Document skill creation
- [ ] Document subagent creation
- [ ] Update API docs

## Success Criteria

1. ✅ All hardcoded logic removed from codebase
2. ✅ All functionality moved to .md files (skills/subagents)
3. ✅ Skills loaded and executed dynamically
4. ✅ Subagents registered with SDK and callable
5. ✅ GitHub operations use github tool only
6. ✅ Assignment handling working correctly (including assignee trigger)
7. ✅ Self-improvement as skills working correctly
8. ✅ Self-upgrade functionality working
9. ✅ All tests passing (606+ tests)
10. ✅ All GitHub Actions workflows passing
11. ✅ Documentation complete and accurate
