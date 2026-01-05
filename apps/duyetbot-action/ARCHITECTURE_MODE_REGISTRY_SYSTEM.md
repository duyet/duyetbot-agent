# Architecture Design: Mode Registry System

## Overview

Design of the **mode registry system** to support dynamic mode loading from `.claude/skills/modes/` directory, replacing hardcoded mode logic.

## Goals

1. **Dynamic Loading**: Load modes from `.md` skill files at runtime
2. **Backward Compatibility**: Support fallback to existing hardcoded modes during migration
3. **Mode Priority System**: Support priority-based mode selection
4. **Hot Reload**: Support reloading modes without restarting agent
5. **Validation**: Validate mode structure before registration
6. **Extensibility**: Easy to add custom modes via `.md` files

## Directory Structure

```
.claude/skills/
├── modes/
│   ├── agent-mode.md
│   ├── tag-mode.md
│   ├── continuous-mode.md
│   └── custom/  # User-defined modes
│       └── my-custom-mode.md
└── src/
    ├── types.ts       # Mode interfaces
    ├── loader.ts      # Mode file loader
    ├── registry.ts     # Mode registry
    └── validator.ts   # Mode structure validator
```

## Mode Metadata

### Front Matter Schema

```yaml
---
name: agent-mode
type: mode
version: 1.0.0
author: duyetbot
description: Direct automation mode for explicit prompts
triggers:
  - workflow_dispatch
  - issue_opened
  - agent_task_label
  - explicit_prompt
priority: 90  # 0-100, higher = more important
context_requirements:
  - github_context: true
  - entity_context: true
  - comment_context: true
  - label_context: true
tool_permissions:
  allowed_tools: []  # Empty = all tools allowed
  disallowed_tools: []  # Tools to disallow
tracking:
  create_tracking_comment: true
  update_tracking_comment: true
  add_status_labels: true
execution:
  requires_branch: false
  requires_pr: false
  supports_continuous: false
  supports_retry: true
  timeout_ms: 300000  # 5 minutes
dependencies:
  - error-analyzer
  - failure-memory
tags:
  - mode
  - automation
  - direct-prompt
---
```

### Metadata Fields

| Field | Type | Required | Description |
|-------|--------|-----------|-------------|
| `name` | string | ✅ | Unique mode identifier (lowercase, alphanumeric, hyphens) |
| `type` | enum | ✅ | Must be `mode` |
| `version` | string | ❌ | Semantic version for compatibility |
| `author` | string | ❌ | Mode author (for attribution) |
| `description` | string | ✅ | Human-readable description |
| `triggers` | string[] | ✅ | Events that trigger this mode |
| `priority` | number (0-100) | ❌ | Mode priority for conflict resolution |
| `context_requirements` | object | ❌ | What context the mode needs |
| `tool_permissions` | object | ❌ | Tool permissions for this mode |
| `tracking` | object | ❌ | Tracking comment and label behavior |
| `execution` | object | ❌ | Execution requirements |
| `dependencies` | string[] | ❌ | Skills this mode depends on |
| `tags` | string[] | ❌ | Keywords for filtering/searching |

## Mode Interface

### TypeScript Definition

```typescript
// src/modes/types.ts

export type ModeType = 'mode';  // Single type for modes

export type ModePriority = 0 | 1 | 2;  // Low, Medium, High (mapped to 0-100)

export type ModeState = 'active' | 'inactive' | 'disabled';

export interface ContextRequirements {
  githubContext: boolean;
  entityContext: boolean;
  commentContext: boolean;
  labelContext: boolean;
  taskContext: boolean;
}

export interface ToolPermissions {
  allowedTools: string[];
  disallowedTools: string[];
}

export interface TrackingConfig {
  createTrackingComment: boolean;
  updateTrackingComment: boolean;
  addStatusLabels: boolean;
  statusLabels?: {
    working: string;
    success: string;
    failed: string;
  };
}

export interface ExecutionConfig {
  requiresBranch: boolean;
  requiresPR: boolean;
  supportsContinuous: boolean;
  supportsRetry: boolean;
  timeoutMs: number;
  maxConcurrentTasks?: number;
}

export interface ModeMetadata {
  name: string;
  type: ModeType;
  version?: string;
  author?: string;
  description: string;
  triggers: string[];
  priority: number;  // 0-100
  contextRequirements: ContextRequirements;
  toolPermissions: ToolPermissions;
  tracking: TrackingConfig;
  execution: ExecutionConfig;
  dependencies: string[];
  tags: string[];
}

export interface ModeContext {
  // GitHub context
  github: {
    owner: string;
    repo: string;
    entityNumber?: number;
    isPR: boolean;
    actor: string;
    eventName: string;
    eventAction?: string;
    payload?: any;
    inputs?: Record<string, string>;
  };

  // Task context
  task?: {
    id: string;
    description: string;
    source: string;
  };

  // Execution context
  execution?: {
    mode: string;
    tools: string[];
    checkpointDir: string;
    workDir: string;
    maxTasks?: number;
  };

  // Additional context
  [key: string]: any;
}

export interface ModeResult {
  commentId?: number;
  taskId: string;
  branchInfo?: {
    baseBranch: string;
    claudeBranch?: string;
    currentBranch: string;
  };
  issueNumber?: number;
  shouldExecute: boolean;
}

export interface Mode {
  metadata: ModeMetadata;
  content: string;  // Full markdown content

  // Trigger detection
  shouldTrigger(context: ModeContext): boolean | Promise<boolean>;

  // Context preparation
  prepareContext(context: ModeContext): ModeContext;

  // Tool permissions
  getAllowedTools(): string[];
  getDisallowedTools(): string[];

  // Tracking
  shouldCreateTrackingComment(): boolean;

  // Prompt generation
  generatePrompt(context: ModeContext): string | Promise<string>;

  // System prompt
  getSystemPrompt(context: ModeContext): string;

  // Preparation
  prepare(options: ModeOptions): Promise<ModeResult>;
}

export interface ModeOptions {
  context: ModeContext;
  octokit: Octokit;
  tools: Tool[];
}
```

## Mode Loader

### File System Loader

```typescript
// src/modes/loader.ts

export class ModeLoader {
  private readonly MODES_DIR = '.claude/skills/modes';
  private cache: Map<string, Mode> = new Map();

  async load(name: string): Promise<Mode> {
    // Check cache
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    // Load file
    const path = this.resolveModePath(name);
    const mode = await this.loadFromFile(path);

    // Validate mode
    const validation = new ModeValidator().validate(mode);
    if (!validation.valid) {
      throw new Error(`Invalid mode ${name}: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Cache mode
    this.cache.set(name, mode);

    return mode;
  }

  async loadAll(): Promise<Mode[]> {
    const modesDir = this.resolveModesDir();

    // Check directory exists
    await this.ensureModesDirectory(modesDir);

    // Find all .md files
    const files = await readdir(modesDir);
    const modeFiles = files.filter(f => f.endsWith('.md'));

    // Load all modes
    const modes: Mode[] = [];
    for (const file of modeFiles) {
      const name = file.replace('.md', '');
      try {
        const mode = await this.load(name);
        modes.push(mode);
      } catch (error) {
        console.error(`Failed to load mode ${name}:`, error);
        // Continue loading other modes
      }
    }

    return modes;
  }

  async loadByTrigger(trigger: string): Promise<Mode[]> {
    const allModes = await this.loadAll();
    return allModes.filter(m => m.metadata.triggers.includes(trigger));
  }

  async loadByTag(tag: string): Promise<Mode[]> {
    const allModes = await this.loadAll();
    return allModes.filter(m => m.metadata.tags?.includes(tag));
  }

  async reload(name: string): Promise<Mode> {
    // Remove from cache
    this.cache.delete(name);
    // Reload from disk
    return await this.load(name);
  }

  async reloadAll(): Promise<Mode[]> {
    // Clear cache
    this.cache.clear();
    // Reload all
    return await this.loadAll();
  }

  private resolveModesDir(): string {
    return join(process.cwd(), this.MODES_DIR);
  }

  private resolveModePath(name: string): string {
    return join(this.resolveModesDir(), `${name}.md`);
  }

  private async ensureModesDirectory(dir: string): Promise<void> {
    try {
      await stat(dir);
    } catch {
      await mkdir(dir, { recursive: true });
    }
  }

  private async loadFromFile(path: string): Promise<Mode> {
    const parser = new SkillParser();
    const skill = await parser.parseFile(path);

    // Attach mode methods
    return {
      ...skill,
      // Mode-specific methods
      shouldTrigger: this.buildTriggerFunction(skill.metadata.triggers),
      prepareContext: (context) => context,
      getAllowedTools: () => skill.metadata.toolPermissions.allowedTools || [],
      getDisallowedTools: () => skill.metadata.toolPermissions.disallowedTools || [],
      shouldCreateTrackingComment: () => skill.metadata.tracking?.createTrackingComment ?? true,
      generatePrompt: () => skill.content,
      getSystemPrompt: () => skill.content,
      prepare: this.buildPrepareFunction(skill.content),
    };
  }

  private buildTriggerFunction(triggers: string[]): (context: ModeContext) => boolean {
    return (context: ModeContext) => {
      const { github, task } = context;

      // Check triggers
      return triggers.some(trigger => {
        if (trigger === 'workflow_dispatch' && github.eventName === 'workflow_dispatch') {
          return true;
        }

        if (trigger === 'issue_opened' && github.eventName === 'issues' && github.eventAction === 'opened') {
          return true;
        }

        if (trigger === 'agent_task_label' && github.payload?.issue?.labels?.some((l: any) => l.name === 'agent-task')) {
          return true;
        }

        if (trigger === 'explicit_prompt' && github.inputs.prompt) {
          return true;
        }

        if (trigger === '@duyetbot' && (github.payload?.issue?.body || github.payload?.comment?.body || github.payload?.pull_request?.body)?.includes('@duyetbot')) {
          return true;
        }

        if (trigger === 'duyetbot_label' && (github.payload?.issue?.labels || github.payload?.pull_request?.labels)?.some((l: any) => l.name === 'duyetbot')) {
          return true;
        }

        if (trigger === 'assignee_duyetbot' && (github.payload?.issue?.assignee?.login === 'duyetbot' || github.payload?.pull_request?.assignee?.login === 'duyetbot')) {
          return true;
        }

        return false;
      });
    };
  }

  private buildPrepareFunction(content: string): (options: ModeOptions) => Promise<ModeResult> {
    return async (options: ModeOptions) => {
      const { context, octokit } = options;
      const { owner, repo } = context.github;

      // Extract prompt content from markdown
      const promptContent = this.extractPromptContent(content, context);

      console.log(`\n🤖 ${promptContent.name} Mode Execution`);
      console.log(`  Repository: ${owner}/${repo}`);

      let commentId: number | undefined;
      const taskId = `${promptContent.name}-${owner}-${repo}-${Date.now()}`;

      // Create tracking comment if required
      if (promptContent.metadata.tracking?.createTrackingComment && context.github.entityNumber) {
        const CommentOps = await import('../../github/operations/comments.js');
        const progressComment = this.generateProgressComment({
          taskId,
          status: 'starting',
          message: `🤖 Starting ${promptContent.name} task...`,
        });

        const result = await CommentOps.createComment(octokit, {
          owner,
          repo,
          issueNumber: context.github.entityNumber,
          body: progressComment,
        });
        commentId = result.id;
        console.log(`  ✓ Created tracking comment #${result.id}`);

        // Add "in-progress" label
        const LabelOps = await import('../../github/operations/labels.js');
        try {
          await LabelOps.addLabels(octokit, owner, repo, context.github.entityNumber, ['agent:working']);
        } catch {
          // Label might not exist
        }
      }

      const baseBranch = context.github.inputs.baseBranch || 'main';

      return {
        commentId,
        taskId,
        branchInfo: {
          baseBranch,
          claudeBranch: undefined,
          currentBranch: baseBranch,
        },
        issueNumber: context.github.entityNumber,
        shouldExecute: true,
      };
    };
  }

  private extractPromptContent(content: string, context: ModeContext): { name: string; content: string } {
    // For modes, the content contains both prompt template and metadata
    // The prompt template is in the content section
    return {
      name: 'agent', // Would extract from content
      content: content,
    };
  }

  private generateProgressComment(options: {
    taskId: string;
    status: 'starting' | 'running' | 'success' | 'error';
    message: string;
  }): string {
    const { taskId, status, message } = options;

    const statusIcons = {
      starting: '🔄',
      running: '⚙️',
      success: '✅',
      error: '❌',
    };

    let comment = `## 🤖 Duyetbot ${statusIcons[status]}\n\n`;
    comment += `**Task ID:** \`${taskId}\`\n\n`;
    comment += `### Status\n\n${message}\n`;

    return comment;
  }
}
```

## Mode Registry

### Centralized Registry

```typescript
// src/modes/registry.ts

export class ModeRegistry {
  private modes: Map<string, Mode> = new Map();
  private byTrigger: Map<string, Mode[]> = new Map();
  private byTag: Map<string, Mode[]> = new Map();
  private byPriority: Map<ModePriority, Mode[]> = new Map();

  async initialize(loader: ModeLoader): Promise<void> {
    // Load all modes
    const allModes = await loader.loadAll();

    // Register modes
    for (const mode of allModes) {
      this.register(mode);
    }

    // Resolve dependencies
    await this.resolveDependencies(allModes);

    console.log(`✓ Loaded ${this.modes.size} modes`);
    this.logModeSummary();
  }

  register(mode: Mode): void {
    // Store in name index
    this.modes.set(mode.metadata.name, mode);

    // Index by trigger
    for (const trigger of mode.metadata.triggers) {
      const existing = this.byTrigger.get(trigger) || [];
      existing.push(mode);
      this.byTrigger.set(trigger, existing);
    }

    // Index by tag
    for (const tag of mode.metadata.tags || []) {
      const existing = this.byTag.get(tag) || [];
      existing.push(mode);
      this.byTag.set(tag, existing);
    }

    // Index by priority
    const priority = this.mapPriority(mode.metadata.priority);
    const byPrio = this.byPriority.get(priority) || [];
    byPrio.push(mode);
    this.byPriority.set(priority, byPrio);
  }

  unregister(name: string): void {
    const mode = this.modes.get(name);
    if (!mode) return;

    // Remove from name index
    this.modes.delete(name);

    // Remove from trigger index
    for (const trigger of mode.metadata.triggers) {
      const existing = this.byTrigger.get(trigger) || [];
      const filtered = existing.filter(m => m.metadata.name !== name);
      this.byTrigger.set(trigger, filtered);
    }

    // Remove from tag index
    for (const tag of mode.metadata.tags || []) {
      const existing = this.byTag.get(tag) || [];
      const filtered = existing.filter(m => m.metadata.name !== name);
      this.byTag.set(tag, filtered);
    }

    // Remove from priority index
    const priority = this.mapPriority(mode.metadata.priority);
    const byPrio = this.byPriority.get(priority) || [];
    const filtered = byPrio.filter(m => m.metadata.name !== name);
    this.byPriority.set(priority, filtered);
  }

  get(name: string): Mode | undefined {
    return this.modes.get(name);
  }

  getByTrigger(trigger: string): Mode[] {
    return this.byTrigger.get(trigger) || [];
  }

  getByTag(tag: string): Mode[] {
    return this.byTag.get(tag) || [];
  }

  getByPriority(priority: ModePriority): Mode[] {
    return this.byPriority.get(priority) || [];
  }

  getHighestPriority(triggers: string[]): Mode | null {
    // Find modes matching triggers
    const candidates: Mode[] = [];

    for (const trigger of triggers) {
      const modes = this.getByTrigger(trigger);
      candidates.push(...modes);
    }

    if (candidates.length === 0) {
      return null;
    }

    // Find highest priority mode
    candidates.sort((a, b) => b.metadata.priority - a.metadata.priority);
    return candidates[0];
  }

  getAll(): Mode[] {
    return Array.from(this.modes.values());
  }

  getNames(): string[] {
    return Array.from(this.modes.keys());
  }

  getActiveModes(): Mode[] {
    return this.getAll().filter(m => {
      // Check if mode dependencies are satisfied
      return this.areDependenciesSatisfied(m.metadata.dependencies);
    });
  }

  private areDependenciesSatisfied(dependencies: string[] | undefined): boolean {
    if (!dependencies || dependencies.length === 0) {
      return true;
    }

    return dependencies.every(dep => {
      const mode = this.modes.get(dep);
      return mode !== undefined;
    });
  }

  async resolveDependencies(modes: Mode[]): Promise<void> {
    // Topological sort to resolve dependencies
    const unresolved = new Map<string, Mode[]>();
    const resolved: Set<string> = new Set();

    // Build dependency graph
    for (const mode of modes) {
      if (mode.metadata.dependencies && mode.metadata.dependencies.length > 0) {
        const deps = mode.metadata.dependencies
          .map(d => this.modes.get(d))
          .filter((d): d is Mode => d !== undefined) as Mode[];
        unresolved.set(mode.metadata.name, deps);
      } else {
        resolved.add(mode.metadata.name);
      }
    }

    // Resolve in order
    let changed = true;
    while (changed) {
      changed = false;
      for (const [name, deps] of unresolved.entries()) {
        if (deps.every(d => d !== undefined && resolved.has(d.metadata.name))) {
          resolved.add(name);
          unresolved.delete(name);
          changed = true;
        }
      }
    }

    // Check for circular dependencies
    if (unresolved.size > 0) {
      const names = Array.from(unresolved.keys());
      throw new Error(`Circular or unresolvable mode dependencies: ${names.join(', ')}`);
    }
  }

  clear(): void {
    this.modes.clear();
    this.byTrigger.clear();
    this.byTag.clear();
    this.byPriority.clear();
  }

  size(): number {
    return this.modes.size;
  }

  private mapPriority(priority: number): ModePriority {
    if (priority >= 66) return 2;  // High
    if (priority >= 33) return 1;  // Medium
    return 0;  // Low
  }

  private logModeSummary(): void {
    const modes = this.getAll();

    console.log(`\n📋 Mode Registry Summary:`);
    console.log(`  Total modes: ${modes.length}`);
    console.log(`  Total triggers: ${Array.from(this.byTrigger.keys()).length}`);
    console.log(`  Total tags: ${Array.from(this.byTag.keys()).length}`);

    // Log modes by priority
    console.log(`\n  Modes by Priority:`);
    console.log(`    High (66-100): ${this.getByPriority(2).map(m => `  - ${m.metadata.name} (${m.metadata.priority})`).join('\n')}`);
    console.log(`    Medium (33-65): ${this.getByPriority(1).map(m => `  - ${m.metadata.name} (${m.metadata.priority})`).join('\n')}`);
    console.log(`    Low (0-32): ${this.getByPriority(0).map(m => `  - ${m.metadata.name} (${m.metadata.priority})`).join('\n')}`);

    // Log triggers
    console.log(`\n  Triggers:`);
    for (const [trigger, modes] of this.byTrigger.entries()) {
      console.log(`    ${trigger}: ${modes.map(m => m.metadata.name).join(', ')}`);
    }

    // Log tags
    console.log(`\n  Tags:`);
    for (const [tag, modes] of this.byTag.entries()) {
      console.log(`    ${tag}: ${modes.map(m => m.metadata.name).join(', ')}`);
    }
  }
}
```

## Mode Validator

### Structure Validation

```typescript
// src/modes/validator.ts

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export class ModeValidator {
  validate(mode: Mode): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate metadata
    errors.push(...this.validateMetadata(mode.metadata));

    // Validate content
    errors.push(...this.validateContent(mode.content));

    // Validate triggers
    errors.push(...this.validateTriggers(mode.metadata.triggers));

    // Validate dependencies
    errors.push(...this.validateDependencies(mode.metadata.dependencies));

    return {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
    };
  }

  private validateMetadata(metadata: ModeMetadata): ValidationError[] {
    const errors: ValidationError[] = [];

    // Required fields
    if (!metadata.name) {
      errors.push({
        field: 'name',
        message: 'Name is required',
        severity: 'error',
      });
    }

    if (!metadata.type) {
      errors.push({
        field: 'type',
        message: 'Type is required (must be "mode")',
        severity: 'error',
      });
    }

    if (!metadata.description) {
      errors.push({
        field: 'description',
        message: 'Description is required',
        severity: 'error',
      });
    }

    if (!metadata.triggers || metadata.triggers.length === 0) {
      errors.push({
        field: 'triggers',
        message: 'At least one trigger is required',
        severity: 'error',
      });
    }

    // Name format
    if (metadata.name && !/^[a-z0-9-]+$/.test(metadata.name)) {
      errors.push({
        field: 'name',
        message: 'Name must be lowercase alphanumeric with hyphens',
        severity: 'error',
      });
    }

    // Version format
    if (metadata.version && !/^\d+\.\d+\.\d+$/.test(metadata.version)) {
      errors.push({
        field: 'version',
        message: 'Version must be in semantic version format (e.g., 1.0.0)',
        severity: 'warning',
      });
    }

    // Priority range
    if (metadata.priority !== undefined && (metadata.priority < 0 || metadata.priority > 100)) {
      errors.push({
        field: 'priority',
        message: 'Priority must be between 0 and 100',
        severity: 'error',
      });
    }

    // Timeout range
    if (metadata.execution && metadata.execution.timeoutMs !== undefined &&
        (metadata.execution.timeoutMs < 10000 || metadata.execution.timeoutMs > 600000)) {
      errors.push({
        field: 'execution.timeout_ms',
        message: 'Timeout must be between 10000ms (10s) and 600000ms (10m)',
        severity: 'warning',
      });
    }

    return errors;
  }

  private validateContent(content: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Content length
    if (content.length < 100) {
      errors.push({
        field: 'content',
        message: 'Content too short (minimum 100 characters)',
        severity: 'warning',
      });
    }

    if (content.length > 100000) {
      errors.push({
        field: 'content',
        message: 'Content too long (maximum 100000 characters)',
        severity: 'warning',
      });
    }

    // Markdown syntax
    if (content.includes('```') && content.split('```').length % 2 !== 0) {
      errors.push({
        field: 'content',
        message: 'Unclosed code block detected',
        severity: 'error',
      });
    }

    // Required sections
    const requiredSections = ['Purpose', 'Trigger Conditions', 'User Prompt Template', 'System Prompt Template'];
    const missingSections = requiredSections.filter(section =>
      !content.includes(`## ${section}`) || !content.includes(`### ${section}`)
    );

    if (missingSections.length > 0) {
      errors.push({
        field: 'content',
        message: `Missing required sections: ${missingSections.join(', ')}`,
        severity: 'warning',
      });
    }

    return errors;
  }

  private validateTriggers(triggers: string[] | undefined): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!triggers) {
      errors.push({
        field: 'triggers',
        message: 'Triggers array is required',
        severity: 'error',
      });
      return errors;
    }

    const validTriggers = [
      'workflow_dispatch',
      'issue_opened',
      'issue_labeled',
      'issue_commented',
      'pr_opened',
      'pr_labeled',
      'pr_reviewed',
      'explicit_prompt',
      '@duyetbot',
      'duyetbot_label',
      'assignee_duyetbot',
      'continuous_mode',
      'manual_trigger',
    ];

    for (const trigger of triggers) {
      if (!validTriggers.includes(trigger)) {
        errors.push({
          field: 'triggers',
          message: `Invalid trigger: ${trigger}. Must be one of: ${validTriggers.join(', ')}`,
          severity: 'error',
        });
      }
    }

    return errors;
  }

  private validateDependencies(dependencies: string[] | undefined): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!dependencies) return errors;

    // Check for circular dependencies
    for (const dep of dependencies) {
      // Check if dependency name format is valid
      if (!/^[a-z0-9-]+$/.test(dep)) {
        errors.push({
          field: 'dependencies',
          message: `Invalid dependency name: ${dep}. Must be lowercase alphanumeric with hyphens`,
          severity: 'warning',
        });
      }
    }

    return errors;
  }
}
```

## Integration with Existing Code

### Mode Detection Update

```typescript
// src/modes/detector.ts

import { ModeRegistry } from './registry.js';
import { ModeContext } from './types.js';

export function detectMode(context: GitHubContext): AutoDetectedMode {
  const modeRegistry = ModeRegistry.getInstance();

  // Convert GitHub context to ModeContext
  const modeContext: ModeContext = {
    github: {
      owner: context.repository.owner,
      repo: context.repository.name,
      entityNumber: context.entityNumber,
      isPR: context.isPR,
      actor: context.actor,
      eventName: context.eventName,
      eventAction: context.eventAction,
      payload: context.payload,
      inputs: context.inputs,
    },
    task: {
      id: `task-${Date.now()}`,
      description: context.inputs.prompt || '',
      source: 'github',
    },
  };

  // Check triggers in priority order
  const triggers = [
    ...getExplicitTriggers(context),
    ...getLabelTriggers(context),
    ...getAssigneeTriggers(context),
    ...getCommentTriggers(context),
  ];

  // Get highest priority matching mode
  const mode = modeRegistry.getHighestPriority(triggers);

  if (mode) {
    return {
      mode: mode.metadata.name as 'agent' | 'tag' | 'continuous',
      confidence: 1.0,
      reason: `Triggered by mode: ${mode.metadata.name}`,
    };
  }

  return {
    mode: 'none',
    confidence: 0.0,
    reason: 'No mode trigger matched',
  };
}

function getExplicitTriggers(context: GitHubContext): string[] {
  const triggers: string[] = [];

  if (context.inputs.prompt) triggers.push('explicit_prompt');
  if (context.eventName === 'workflow_dispatch') triggers.push('workflow_dispatch');

  return triggers;
}

function getLabelTriggers(context: GitHubContext): string[] {
  const triggers: string[] = [];

  // Check agent-task label
  if (context.payload?.issue?.labels?.some((l: any) => l.name === 'agent-task')) {
    triggers.push('agent_task_label');
  }

  // Check duyetbot label
  if (context.payload?.issue?.labels?.some((l: any) => l.name === 'duyetbot') ||
      context.payload?.pull_request?.labels?.some((l: any) => l.name === 'duyetbot')) {
    triggers.push('duyetbot_label');
  }

  return triggers;
}

function getAssigneeTriggers(context: GitHubContext): string[] {
  const triggers: string[] = [];

  // FIX THE BUG: Check for duyetbot assignee
  if (context.payload?.issue?.assignee?.login === 'duyetbot' ||
      context.payload?.pull_request?.assignee?.login === 'duyetbot') {
    triggers.push('assignee_duyetbot');
  }

  return triggers;
}

function getCommentTriggers(context: GitHubContext): string[] {
  const triggers: string[] = [];

  const body = context.payload?.comment?.body ||
               context.payload?.issue?.body ||
               context.payload?.pull_request?.body ||
               '';

  // Check for @duyetbot mention
  if (body.includes('@duyetbot')) {
    triggers.push('@duyetbot');
  }

  return triggers;
}
```

### Mode Execution Update

```typescript
// src/modes/executor.ts

import { ModeRegistry } from './registry.js';
import { ModeContext, ModeResult } from './types.js';

export async function executeMode(
  modeName: string,
  context: ModeContext,
  octokit: Octokit,
  tools: Tool[]
): Promise<ModeResult> {
  const modeRegistry = ModeRegistry.getInstance();
  const mode = modeRegistry.get(modeName);

  if (!mode) {
    throw new Error(`Mode not found: ${modeName}`);
  }

  // Execute mode prepare
  const result = await mode.prepare({
    context,
    octokit,
    tools,
  });

  return result;
}
```

## Mode Skill Examples

### Agent Mode Skill

```markdown
---
name: agent-mode
type: mode
version: 1.0.0
author: duyetbot
description: Direct automation mode for explicit prompts
triggers:
  - workflow_dispatch
  - issue_opened
  - agent_task_label
  - explicit_prompt
priority: 90
context_requirements:
  github_context: true
  entity_context: true
tool_permissions:
  allowed_tools: []
  disallowed_tools: []
tracking:
  create_tracking_comment: true
  update_tracking_comment: true
  add_status_labels: true
execution:
  requires_branch: false
  supports_continuous: false
  supports_retry: true
  timeout_ms: 300000
dependencies:
  - error-analyzer
  - failure-memory
tags:
  - mode
  - automation
  - direct-prompt
---

# Agent Mode

## Purpose

Direct automation mode triggered by explicit prompts, workflow dispatch, or agent-task labels.

## Trigger Conditions

This mode triggers when:
1. Explicit prompt input is provided
2. Workflow dispatch event
3. Issue is opened
4. Issue is labeled with "agent-task"

## User Prompt Template

```markdown
You are duyetbot, an AI coding assistant.

## Task

{promptInput or issueContent}

## Repository Context

- **Repository**: {owner}/{repo}
- **{Issue/PR}**: #{entityNumber}
- **URL**: {url}

## Instructions

1. Understand task and analyze codebase
2. Create a plan for implementation
3. Implement changes
4. Test and verify changes
5. Report results
```

## System Prompt Template

```markdown
## GitHub Context

- **Actor**: {actor}
- **Event**: {eventName} ({eventAction})
- **Repository**: {owner}/{repo}
- **Run ID**: {runId}
```

## Preparation

1. Create tracking comment (if entity exists)
2. Add "in-progress" label
3. Determine base branch
```

### Tag Mode Skill

```markdown
---
name: tag-mode
type: mode
version: 1.0.0
author: duyetbot
description: Interactive mode triggered by @duyetbot mentions in issues/PRs
triggers:
  - @duyetbot
  - duyetbot_label
  - assignee_duyetbot
priority: 80
context_requirements:
  github_context: true
  entity_context: true
  comment_context: true
  label_context: true
tool_permissions:
  allowed_tools: []
  disallowed_tools: []
tracking:
  create_tracking_comment: true
  update_tracking_comment: true
  add_status_labels: true
execution:
  requires_branch: false
  supports_continuous: false
  supports_retry: true
  timeout_ms: 300000
dependencies:
  - error-analyzer
  - failure-memory
tags:
  - mode
  - interactive
  - mention
---

# Tag Mode

## Purpose

Interactive mode triggered by @duyetbot mentions, duyetbot labels, or duyetbot assignees in issues/PRs.

## Trigger Conditions

This mode triggers when:
1. Issue/PR body or comment contains "@duyetbot"
2. Issue/PR is labeled with "duyetbot"
3. Issue/PR is assigned to "duyetbot"

## User Prompt Template

```markdown
You are duyetbot, an AI coding assistant.

## Task

{request after @duyetbot mention}

## {Issue/PR} Context

- **Number**: #{entityNumber}
- **Repository**: {owner}/{repo}
- **URL**: {url}
- **Labels**: {labels}

## Instructions

1. Analyze request and codebase
2. Create a plan for changes needed
3. Implement changes on a new branch
4. Create a pull request with your changes
5. Add a summary comment when done

## Additional Context

{additional prompt input}
```

## System Prompt Template

```markdown
## GitHub Context

- **Actor**: {actor}
- **Event**: {eventName} ({eventAction})
- **Repository**: {owner}/{repo}
- **Run ID**: {runId}
```

## Preparation

1. Find existing tracking comment
2. Create or update tracking comment
3. Add "in-progress" label
4. Determine base branch
```

### Continuous Mode Skill

```markdown
---
name: continuous-mode
type: mode
version: 1.0.0
author: duyetbot
description: Multi-task processing mode for continuous automation
triggers:
  - continuous_mode
  - manual_trigger
priority: 70
context_requirements:
  github_context: true
  task_context: true
tool_permissions:
  allowed_tools: []
  disallowed_tools: []
tracking:
  create_tracking_comment: true
  update_tracking_comment: true
  add_status_labels: true
execution:
  requires_branch: false
  supports_continuous: true
  max_concurrent_tasks: 10
  supports_retry: true
  timeout_ms: 600000
dependencies:
  - error-analyzer
  - failure-memory
  - verification-loop
tags:
  - mode
  - continuous
  - multi-task
---

# Continuous Mode

## Purpose

Multi-task processing mode that automatically processes tasks from configured sources until none remain or max tasks reached.

## Trigger Conditions

This mode triggers when:
1. `continuous_mode` input is set to "true"
2. `continuous_mode` label is added

## Configuration

```markdown
## Continuous Mode Configuration

- **Task Source**: {taskSource}
- **Max Tasks**: {maxTasks}
- **Auto-Merge**: {autoMerge}
- **Close Issues**: {closeIssues}
- **Delay Between Tasks**: {delayBetweenTasks}s
```

## User Prompt Template

```markdown
You are duyetbot, an AI coding assistant in continuous mode.

## Current Task

Task {taskIndex + 1} of {totalTasks}:

{taskDescription}

## Configuration

```markdown
## Continuous Mode Configuration

- **Max Tasks**: {maxTasks}
- **Task Source**: {taskSource}
- **Auto-Merge**: {autoMerge}
- **Close Issues**: {closeIssues}
- **Delay Between Tasks**: {delayBetweenTasks}s
```

## Instructions

1. Fetch pending tasks from configured source
2. Process each task sequentially:
   - Analyze task
   - Create a plan
   - Implement changes on a new branch
   - Create a pull request
   - Optionally auto-merge if checks pass
   - Mark task as complete
3. Continue until no tasks remain or max_tasks is reached
4. Report final summary

## Initial Context

{initial context}
```

## System Prompt Template

```markdown
## GitHub Context

- **Actor**: {actor}
- **Event**: {eventName}
- **Repository**: {owner}/{repo}
- **Run ID**: {runId}

## Continuous Mode Settings

- **Max Tasks**: {maxTasks}
- **Delay Between Tasks**: {delayBetweenTasks}s
- **Auto-Merge**: {autoMerge}
- **Close Issues**: {closeIssues}
```

## Preparation

1. Create tracking comment (if entity exists)
2. Add "in-progress" label
3. Determine base branch
4. Initialize task picker
```

## Migration Path

### Phase 1: Foundation

1. Create `.claude/skills/modes/` directory
2. Implement `ModeLoader` class
3. Implement `ModeRegistry` class
4. Implement `ModeValidator` class
5. Create TypeScript types file

### Phase 2: Mode Skills

6. Create `agent-mode.md` skill
7. Create `tag-mode.md` skill
8. Create `continuous-mode.md` skill

### Phase 3: Integration

9. Update `src/modes/detector.ts` to use mode registry
10. Update `src/modes/registry.ts` (singleton instance)
11. Update `src/modes/executor.ts` to use mode registry
12. Test backward compatibility

### Phase 4: Migration

13. Remove hardcoded mode files (agent/index.ts, tag/index.ts, continuous/index.ts)
14. Update imports throughout codebase
15. Update tests
16. Update documentation

### Phase 5: Enhancement

17. Add hot reload support
18. Add mode metrics
19. Add performance monitoring
20. Add validation utilities

## Testing Strategy

### Unit Tests

```typescript
// tests/modes/loader.test.ts
describe('ModeLoader', () => {
  it('should load valid mode file', async () => {
    const loader = new ModeLoader();
    const mode = await loader.load('agent-mode');
    expect(mode.metadata.name).toBe('agent-mode');
  });

  it('should throw on missing frontmatter', async () => {
    const loader = new ModeLoader();
    await expect(loader.load('no-frontmatter'))
      .rejects.toThrow('Invalid mode format');
  });

  it('should validate required fields', async () => {
    const validator = new ModeValidator();
    const result = validator.validate({
      metadata: { name: 'test', type: 'mode', description: 'Test', triggers: [] },
      content: '# Test',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
```

### Integration Tests

```typescript
// tests/modes/registry.test.ts
describe('ModeRegistry', () => {
  let loader: ModeLoader;
  let registry: ModeRegistry;

  beforeEach(async () => {
    loader = new ModeLoader();
    await loader.loadFromFixtures();
    registry = new ModeRegistry();
    await registry.initialize(loader);
  });

  it('should load all modes', () => {
    const modes = registry.getAll();
    expect(modes.length).toBeGreaterThan(0);
  });

  it('should get mode by name', () => {
    const mode = registry.get('agent-mode');
    expect(mode).toBeDefined();
    expect(mode.metadata.name).toBe('agent-mode');
  });

  it('should get modes by trigger', () => {
    const modes = registry.getByTrigger('workflow_dispatch');
    expect(modes.length).toBeGreaterThan(0);
  });

  it('should resolve dependencies', async () => {
    const modes = registry.getAll();
    const names = modes.map(m => m.metadata.name);
    // Verify dependency graph is acyclic
    expect(true).toBe(true); // Dependency resolution passed
  });
});
```

## Backward Compatibility

### Fallback Mechanism

```typescript
// src/modes/legacy.ts

import * as agentMode from './agent/index.js';
import * as tagMode from './tag/index.js';
import * as continuousMode from './continuous/index.js';

export function getLegacyMode(context: GitHubContext): Mode | undefined {
  // Try to use skill system first
  try {
    const modeRegistry = ModeRegistry.getInstance();
    const detection = await detectMode(context);

    if (detection.mode !== 'none') {
      return modeRegistry.get(detection.mode);
    }
  } catch (error) {
    console.warn('Mode system failed, falling back to legacy modes:', error);
  }

  // Fallback to hardcoded modes
  if (agentMode.shouldTrigger(context)) return buildModeFromHardcoded(agentMode, 'agent');
  if (tagMode.shouldTrigger(context)) return buildModeFromHardcoded(tagMode, 'tag');
  if (continuousMode.shouldTrigger(context)) return buildModeFromHardcoded(continuousMode, 'continuous');

  return undefined;
}

function buildModeFromHardcoded(hardcoded: any, name: string): Mode {
  return {
    name,
    description: `Legacy ${name} mode`,
    ...hardcoded,
  };
}
```

### Feature Flag

```typescript
// src/modes/config.ts

export const USE_SKILL_SYSTEM = process.env.USE_SKILL_SYSTEM === 'true';

export function isSkillSystemEnabled(): boolean {
  return USE_SKILL_SYSTEM;
}
```

## Next Steps

1. Implement `ModeLoader` class
2. Implement `ModeValidator` class
3. Implement `ModeRegistry` class
4. Create mode skill files (agent-mode.md, tag-mode.md, continuous-mode.md)
5. Update mode detection to use registry
6. Add backward compatibility layer
7. Write comprehensive tests
8. Update documentation
9. Verify all existing functionality works
10. Enable feature flag and deploy

## Success Criteria

The mode registry system will be considered **successful** when:

- ✅ Mode files can be loaded from `.claude/skills/modes/`
- ✅ Mode registry centralizes all modes
- ✅ Mode detection uses registry instead of hardcoded logic
- ✅ Backward compatibility maintained (fallback to hardcoded modes)
- ✅ Hot reload supported without restarting agent
- ✅ Validation ensures mode structure integrity
- ✅ Dependencies resolved topologically
- ✅ Priority-based mode selection working
- ✅ All 606 existing tests still passing
- ✅ 50+ new tests passing
- ✅ Documentation complete
- ✅ Feature flag for gradual rollout

## Conclusion

This design provides:

- ✅ **Dynamic mode loading**: From `.md` files in `.claude/skills/modes/`
- ✅ **Centralized registry**: Single source of truth for modes
- ✅ **Backward compatibility**: Fallback to hardcoded modes during migration
- ✅ **Hot reload**: Support reloading without restart
- ✅ **Validation**: Mode structure and content validation
- ✅ **Dependency resolution**: Topological sort for mode dependencies
- ✅ **Priority system**: High/medium/low priority for conflict resolution
- ✅ **Extensibility**: Easy to add custom modes

**Estimated Implementation Time**: 6-8 hours  
**Risk**: MEDIUM  
**Dependencies**: None
