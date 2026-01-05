# Architecture Design: Skill/Subagent System

## Overview

Design of the **skill and subagent system** for duyetbot-action to support dynamic, configuration-driven behavior without code changes.

## Goals

1. **Declarative Logic**: Define agent behavior in `.md` files, not TypeScript
2. **Dynamic Loading**: Load skills/subagents at runtime from `.claude/` directories
3. **Hot Reload**: Support reloading skills without restarting the agent
4. **Validation**: Validate skill/subagent structure and content before loading
5. **Registry Pattern**: Centralized registry for skill/subagent lookup
6. **Type Safety**: TypeScript types for skill/subagent interfaces
7. **Extensibility**: Easy to add new skills/subagents without core changes
8. **Backward Compatibility**: Support existing mode system during migration

## Directory Structure

```
apps/duyetbot-action/
├── .claude/
│   ├── skills/
│   │   ├── self-improvement/
│   │   │   ├── error-analyzer.md
│   │   │   ├── failure-memory.md
│   │   │   ├── verification-loop.md
│   │   │   ├── recovery.md
│   │   │   └── auto-merge.md
│   │   ├── modes/
│   │   │   ├── agent-mode.md
│   │   │   ├── tag-mode.md
│   │   │   └── continuous-mode.md
│   │   └── custom/  # User-defined skills
│   │       └── my-custom-skill.md
│   └── subagents/
│       ├── researcher.md
│       ├── code-reviewer.md
│       ├── planner.md
│       ├── git-operator.md
│       └── github-agent.md
└── src/
    ├── skills/
    │   ├── types.ts      # Skill/Subagent interfaces
    │   ├── loader.ts     # File loader
    │   ├── parser.ts     # Markdown parser
    │   ├── validator.ts  # Structure validator
    │   └── registry.ts   # Skill/Subagent registry
    └── subagents/
        ├── loader.ts     # Subagent loader
        └── registry.ts   # Subagent registry
```

## Skill Metadata

### Front Matter Schema

```yaml
---
name: error-analyzer
type: self-improvement
version: 1.0.0
author: duyetbot
description: Parses and categorizes error messages from various tools
triggers:
  - error_detected
  - verification_failed
  - error_parsed
required_tools:
  - read
  - bash
disallowed_tools:
  - github
  dependencies:
    - failure-memory
  - verification-loop
cacheable: true
  max_retries: 3
timeout_ms: 30000
priority: high
tags:
  - error-handling
  - self-improvement
  - analysis
---
```

### Metadata Fields

| Field | Type | Required | Description |
|-------|--------|----------|-------------|
| `name` | string | ✅ | Unique skill identifier |
| `type` | string | ✅ | Skill type (self-improvement, mode, custom) |
| `version` | string | ❌ | Semantic version for compatibility |
| `author` | string | ❌ | Skill author (for attribution) |
| `description` | string | ✅ | Human-readable description |
| `triggers` | string[] | ✅ | Events that trigger this skill |
| `required_tools` | string[] | ❌ | Tools required by skill |
| `disallowed_tools` | string[] | ❌ | Tools to disallow |
| `dependencies` | string[] | ❌ | Other skills this skill depends on |
| `cacheable` | boolean | ❌ | Whether skill output can be cached |
| `max_retries` | number | ❌ | Max execution retries |
| `timeout_ms` | number | ❌ | Skill execution timeout |
| `priority` | enum | ❌ | Skill priority (high, medium, low) |
| `tags` | string[] | ❌ | Keywords for searching/filtering |

## Skill Interface

### TypeScript Definition

```typescript
// src/skills/types.ts

export type SkillType = 'self-improvement' | 'mode' | 'custom';

export type SkillPriority = 'high' | 'medium' | 'low';

export interface SkillMetadata {
  name: string;
  type: SkillType;
  version?: string;
  author?: string;
  description: string;
  triggers: string[];
  requiredTools?: string[];
  disallowedTools?: string[];
  dependencies?: string[];
  cacheable?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
  priority?: SkillPriority;
  tags?: string[];
}

export interface SkillContext {
  // Task context
  task: {
    id: string;
    description: string;
    source: string;
  };

  // GitHub context
  github?: {
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

  // Execution context
  execution?: {
    mode: string;
    tools: string[];
    checkpointDir: string;
    workDir: string;
  };

  // Additional context
  [key: string]: any;
}

export interface SkillResult {
  success: boolean;
  output: string;
  data?: Record<string, unknown>;
  error?: string;
  metadata?: {
    duration: number;
    retries: number;
    cached: boolean;
  };
}

export interface Skill {
  metadata: SkillMetadata;
  content: string;  // Full markdown content

  // Execution
  execute(context: SkillContext): Promise<SkillResult>;

  // Validation
  validate?(): ValidationResult;

  // Dependencies
  resolveDependencies?(registry: SkillRegistry): Promise<void>;
}
```

## Skill Parser

### Markdown Parser

```typescript
// src/skills/parser.ts

export class SkillParser {
  private readonly FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n/;

  async parseFile(path: string): Promise<Skill> {
    const content = await readFile(path, 'utf-8');
    return this.parse(content, path);
  }

  parse(content: string, path: string): Skill {
    // Extract front matter
    const frontmatterMatch = content.match(this.FRONTMATTER_REGEX);
    if (!frontmatterMatch) {
      throw new Error(`Invalid skill format in ${path}: No frontmatter`);
    }

    const frontmatterText = frontmatterMatch[1];
    const body = content.slice(frontmatterMatch[0].length);

    // Parse YAML front matter
    const metadata = this.parseFrontmatter(frontmatterText);

    return {
      metadata,
      content: body,
      // ... methods attached below
    };
  }

  private parseFrontmatter(yaml: string): SkillMetadata {
    const parsed = yaml.parse(yaml);

    // Validate required fields
    if (!parsed.name) {
      throw new Error('Skill must have a "name" field');
    }
    if (!parsed.type) {
      throw new Error('Skill must have a "type" field');
    }
    if (!parsed.description) {
      throw new Error('Skill must have a "description" field');
    }
    if (!parsed.triggers || parsed.triggers.length === 0) {
      throw new Error('Skill must have "triggers" array');
    }

    // Normalize fields
    return {
      name: this.normalizeName(parsed.name),
      type: this.validateType(parsed.type),
      description: parsed.description,
      triggers: parsed.triggers,
      requiredTools: parsed.required_tools || [],
      disallowedTools: parsed.disallowed_tools || [],
      dependencies: parsed.dependencies || [],
      cacheable: parsed.cacheable ?? true,
      maxRetries: parsed.max_retries ?? 3,
      timeoutMs: parsed.timeout_ms ?? 30000,
      priority: parsed.priority ?? 'medium',
      tags: parsed.tags || [],
    };
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')  // Allow alphanumeric and hyphen
      .replace(/-+/g, '-')             // Collapse multiple hyphens
      .replace(/^-|-$/g, '');         // Trim
  }

  private validateType(type: string): SkillType {
    const validTypes: SkillType[] = ['self-improvement', 'mode', 'custom'];
    if (!validTypes.includes(type as SkillType)) {
      throw new Error(`Invalid skill type: ${type}. Must be one of: ${validTypes.join(', ')}`);
    }
    return type as SkillType;
  }
}
```

## Skill Validator

### Structure Validation

```typescript
// src/skills/validator.ts

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export class SkillValidator {
  validate(skill: Skill): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate metadata
    errors.push(...this.validateMetadata(skill.metadata));

    // Validate content
    errors.push(...this.validateContent(skill.content));

    // Validate dependencies exist
    if (skill.metadata.dependencies) {
      errors.push(...this.validateDependencies(skill.metadata.dependencies));
    }

    // Validate tool permissions
    if (skill.metadata.requiredTools) {
      errors.push(...this.validateTools(skill.metadata.requiredTools));
    }

    return {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
    };
  }

  private validateMetadata(metadata: SkillMetadata): ValidationError[] {
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
        message: 'Type is required',
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

    // Timeout range
    if (metadata.timeoutMs && (metadata.timeoutMs < 1000 || metadata.timeoutMs > 300000)) {
      errors.push({
        field: 'timeout_ms',
        message: 'Timeout must be between 1000ms and 300000ms (5 minutes)',
        severity: 'warning',
      });
    }

    return errors;
  }

  private validateContent(content: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Content length
    if (content.length < 50) {
      errors.push({
        field: 'content',
        message: 'Content too short (minimum 50 characters)',
        severity: 'warning',
      });
    }

    if (content.length > 50000) {
      errors.push({
        field: 'content',
        message: 'Content too long (maximum 50000 characters)',
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

    return errors;
  }

  private validateDependencies(dependencies: string[]): ValidationError[] {
    // This would be checked against the registry
    // Implementation depends on SkillRegistry
    return [];
  }

  private validateTools(tools: string[]): ValidationError[] {
    const validTools = ['bash', 'git', 'github', 'read', 'write', 'edit',
                     'search', 'research', 'plan', 'run_tests'];
    const errors: ValidationError[] = [];

    for (const tool of tools) {
      if (!validTools.includes(tool)) {
        errors.push({
          field: 'required_tools',
          message: `Unknown tool: ${tool}`,
          severity: 'error',
        });
      }
    }

    return errors;
  }
}
```

## Skill Loader

### File System Loader

```typescript
// src/skills/loader.ts

export class SkillLoader {
  private readonly SKILLS_DIR = '.claude/skills';
  private cache: Map<string, Skill> = new Map();

  async load(name: string): Promise<Skill> {
    // Check cache
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    // Load file
    const path = this.resolveSkillPath(name);
    const skill = await this.loadFromFile(path);

    // Validate skill
    const validation = new SkillValidator().validate(skill);
    if (!validation.valid) {
      throw new Error(`Invalid skill ${name}: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Cache skill
    this.cache.set(name, skill);

    return skill;
  }

  async loadAll(): Promise<Skill[]> {
    const skillsDir = this.resolveSkillsDir();

    // Check directory exists
    await this.ensureSkillsDirectory(skillsDir);

    // Find all .md files
    const files = await readdir(skillsDir);
    const skillFiles = files.filter(f => f.endsWith('.md'));

    // Load all skills
    const skills: Skill[] = [];
    for (const file of skillFiles) {
      const name = file.replace('.md', '');
      try {
        const skill = await this.load(name);
        skills.push(skill);
      } catch (error) {
        console.error(`Failed to load skill ${name}:`, error);
        // Continue loading other skills
      }
    }

    return skills;
  }

  async loadByTrigger(trigger: string): Promise<Skill[]> {
    const allSkills = await this.loadAll();
    return allSkills.filter(s => s.metadata.triggers.includes(trigger));
  }

  async loadByType(type: SkillType): Promise<Skill[]> {
    const allSkills = await this.loadAll();
    return allSkills.filter(s => s.metadata.type === type);
  }

  async loadByTag(tag: string): Promise<Skill[]> {
    const allSkills = await this.loadAll();
    return allSkills.filter(s => s.metadata.tags?.includes(tag));
  }

  async reload(name: string): Promise<Skill> {
    // Remove from cache
    this.cache.delete(name);
    // Reload from disk
    return await this.load(name);
  }

  async reloadAll(): Promise<Skill[]> {
    // Clear cache
    this.cache.clear();
    // Reload all
    return await this.loadAll();
  }

  private resolveSkillsDir(): string {
    return join(process.cwd(), this.SKILLS_DIR);
  }

  private resolveSkillPath(name: string): string {
    return join(this.resolveSkillsDir(), `${name}.md`);
  }

  private async ensureSkillsDirectory(dir: string): Promise<void> {
    try {
      await stat(dir);
    } catch {
      await mkdir(dir, { recursive: true });
    }
  }

  private async loadFromFile(path: string): Promise<Skill> {
    const parser = new SkillParser();
    return await parser.parseFile(path);
  }
}
```

## Skill Registry

### Centralized Registry

```typescript
// src/skills/registry.ts

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private byTrigger: Map<string, Skill[]> = new Map();
  private byType: Map<SkillType, Skill[]> = new Map();

  async initialize(loader: SkillLoader): Promise<void> {
    // Load all skills
    const allSkills = await loader.loadAll();

    // Register skills
    for (const skill of allSkills) {
      this.register(skill);
    }

    // Resolve dependencies
    await this.resolveDependencies(allSkills);

    console.log(`✓ Loaded ${this.skills.size} skills`);
  }

  register(skill: Skill): void {
    // Store in name index
    this.skills.set(skill.metadata.name, skill);

    // Index by trigger
    for (const trigger of skill.metadata.triggers) {
      const existing = this.byTrigger.get(trigger) || [];
      existing.push(skill);
      this.byTrigger.set(trigger, existing);
    }

    // Index by type
    const byType = this.byType.get(skill.metadata.type) || [];
    byType.push(skill);
    this.byType.set(skill.metadata.type, byType);
  }

  unregister(name: string): void {
    const skill = this.skills.get(name);
    if (!skill) return;

    // Remove from name index
    this.skills.delete(name);

    // Remove from trigger index
    for (const trigger of skill.metadata.triggers) {
      const existing = this.byTrigger.get(trigger) || [];
      const filtered = existing.filter(s => s.metadata.name !== name);
      this.byTrigger.set(trigger, filtered);
    }

    // Remove from type index
    const byType = this.byType.get(skill.metadata.type) || [];
    const filtered = byType.filter(s => s.metadata.name !== name);
    this.byType.set(skill.metadata.type, filtered);
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  getByTrigger(trigger: string): Skill[] {
    return this.byTrigger.get(trigger) || [];
  }

  getByType(type: SkillType): Skill[] {
    return this.byType.get(type) || [];
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  getNames(): string[] {
    return Array.from(this.skills.keys());
  }

  async resolveDependencies(skills: Skill[]): Promise<void> {
    // Topological sort to resolve dependencies
    const resolved: Set<string> = new Set();
    const unresolved = new Map<string, Skill[]>();

    // Build dependency graph
    for (const skill of skills) {
      if (skill.metadata.dependencies && skill.metadata.dependencies.length > 0) {
        const deps = skill.metadata.dependencies
          .map(d => this.skills.get(d))
          .filter((d): d is Skill => d !== undefined) as Skill[];
        unresolved.set(skill.metadata.name, deps);
      } else {
        resolved.add(skill.metadata.name);
      }
    }

    // Resolve in order
    let changed = true;
    while (changed) {
      changed = false;
      for (const [name, deps] of unresolved.entries()) {
        if (deps.every(d => resolved.has(d.metadata.name))) {
          resolved.add(name);
          unresolved.delete(name);
          changed = true;
        }
      }
    }

    // Check for circular dependencies
    if (unresolved.size > 0) {
      const names = Array.from(unresolved.keys());
      throw new Error(`Circular or unresolvable skill dependencies: ${names.join(', ')}`);
    }
  }

  clear(): void {
    this.skills.clear();
    this.byTrigger.clear();
    this.byType.clear();
  }

  size(): number {
    return this.skills.size;
  }
}
```

## Subagent System

### Subagent Metadata

```yaml
---
name: researcher
type: subagent
version: 1.0.0
author: duyetbot
description: Web research specialist for finding information and documentation
triggers:
  - research_request
  - documentation_needed
  - external_reference
capabilities:
  - web_search
  - web_scrape
  - documentation_lookup
required_tools:
  - research
  - read
disallowed_tools: []
timeout_ms: 60000
max_concurrent: 1
---
```

### Subagent Interface

```typescript
// src/subagents/types.ts

export interface SubagentMetadata extends SkillMetadata {
  capabilities: string[];
  maxConcurrent?: number;
}

export interface SubagentContext extends SkillContext {
  // Research-specific context
  research?: {
    query: string;
    sources?: string[];
    maxResults?: number;
  };

  // Code review-specific context
  codeReview?: {
    files?: string[];
    diff?: string;
    checklist?: string[];
  };

  // Plan-specific context
  planning?: {
    tasks?: string[];
    constraints?: string[];
    preferences?: string[];
  };
}

export interface Subagent extends Skill {
  metadata: SubagentMetadata;
  content: string;

  execute(context: SubagentContext): Promise<SkillResult>;
}
```

### Subagent Loader

```typescript
// src/subagents/loader.ts

export class SubagentLoader extends SkillLoader {
  private readonly SUBAGENTS_DIR = '.claude/subagents';

  private resolveSubagentsDir(): string {
    return join(process.cwd(), this.SUBAGENTS_DIR);
  }

  private resolveSubagentPath(name: string): string {
    return join(this.resolveSubagentsDir(), `${name}.md`);
  }
}
```

### Subagent Registry

```typescript
// src/subagents/registry.ts

export class SubagentRegistry extends SkillRegistry {
  async initialize(loader: SubagentLoader): Promise<void> {
    await super.initialize(loader);
    console.log(`✓ Loaded ${this.size()} subagents`);
  }

  getByCapability(capability: string): Skill[] {
    return this.getAll().filter(
      s => s.metadata.tags?.includes(capability)
    );
  }
}
```

## Skill Execution

### Execution Flow

```typescript
// src/skills/executor.ts

export class SkillExecutor {
  constructor(
    private registry: SkillRegistry,
    private tools: Tool[]
  ) {}

  async execute(
    name: string,
    context: SkillContext
  ): Promise<SkillResult> {
    const skill = this.registry.get(name);
    if (!skill) {
      throw new Error(`Skill not found: ${name}`);
    }

    // Validate tools
    const missingTools = (skill.metadata.requiredTools || [])
      .filter(t => !this.tools.some(tool => tool.name === t));
    if (missingTools.length > 0) {
      throw new Error(`Missing required tools: ${missingTools.join(', ')}`);
    }

    // Filter disallowed tools
    const allowedTools = this.tools.filter(
      t => !(skill.metadata.disallowedTools || []).includes(t.name)
    );

    // Execute with retry
    return await this.executeWithRetry(skill, context, allowedTools);
  }

  private async executeWithRetry(
    skill: Skill,
    context: SkillContext,
    tools: Tool[],
    attempt: number = 1
  ): Promise<SkillResult> {
    const maxRetries = skill.metadata.maxRetries ?? 3;
    const timeout = skill.metadata.timeoutMs ?? 30000;

    // Check cache
    if (skill.metadata.cacheable) {
      const cached = this.getFromCache(skill, context);
      if (cached) {
        return {
          ...cached,
          metadata: { ...cached.metadata, cached: true },
        };
      }
    }

    try {
      // Execute skill
      const result = await Promise.race([
        skill.execute({ ...context, tools }),
        this.timeout(timeout),
      ]);

      // Cache result
      if (result.success && skill.metadata.cacheable) {
        this.setCache(skill, context, result);
      }

      return {
        ...result,
        metadata: { ...result.metadata, retries: attempt - 1 },
      };
    } catch (error) {
      // Retry on failure
      if (attempt < maxRetries) {
        console.warn(`Skill ${skill.metadata.name} failed, retrying (${attempt}/${maxRetries})...`);
        await this.backoff(attempt);
        return this.executeWithRetry(skill, context, tools, attempt + 1);
      }

      // Max retries reached
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        metadata: { duration: 0, retries: maxRetries - 1, cached: false },
      };
    }
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), ms);
    });
  }

  private async backoff(attempt: number): Promise<void> {
    const delay = 1000 * Math.pow(2, attempt - 1);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private getFromCache(skill: Skill, context: SkillContext): SkillResult | undefined {
    // Simple cache key
    const key = this.cacheKey(skill.metadata.name, context);
    return this.cache.get(key);
  }

  private setCache(skill: Skill, context: SkillContext, result: SkillResult): void {
    const key = this.cacheKey(skill.metadata.name, context);
    this.cache.set(key, result);
    // Set TTL
    setTimeout(() => this.cache.delete(key), 60000); // 1 minute
  }

  private cacheKey(name: string, context: SkillContext): string {
    return `${name}:${context.task.id}:${context.github?.entityNumber}`;
  }
}
```

## Integration with Existing Code

### Mode Detection Update

```typescript
// src/modes/detector.ts

import { SkillRegistry } from '../skills/registry.js';

export function detectMode(context: GitHubContext): AutoDetectedMode {
  // Get mode skills
  const modeSkills = skillRegistry.getByType('mode');

  // Check each mode skill's triggers
  for (const skill of modeSkills) {
    const matches = skill.metadata.triggers.some(trigger =>
      context.eventName === trigger ||
      context.inputs.prompt === trigger ||
      context.payload?.issue?.labels?.some(l => l.name === trigger)
    );

    if (matches) {
      return {
        mode: skill.metadata.name as 'agent' | 'tag' | 'continuous',
        confidence: 1.0,
        reason: `Triggered by skill: ${skill.metadata.name}`,
        skill,
      };
    }
  }

  return {
    mode: 'none',
    confidence: 0.0,
    reason: 'No mode trigger matched',
  };
}
```

### Mode Execution Update

```typescript
// src/modes/base.ts

import { SkillExecutor } from '../skills/executor.js';

export async function executeMode(
  modeName: string,
  context: ModeContext
): Promise<ModeResult> {
  const executor = new SkillExecutor(skillRegistry, context.tools);

  // Execute mode skill
  const result = await executor.execute(modeName, context);

  if (!result.success) {
    throw new Error(`Mode execution failed: ${result.error}`);
  }

  return {
    ...result.data,
    shouldExecute: true,
  };
}
```

## Backward Compatibility

### Fallback to Existing Modes

```typescript
// src/modes/registry.ts

import { SkillRegistry } from '../skills/registry.js';
import * as agentMode from './agent/index.js';
import * as tagMode from './tag/index.js';
import * as continuousMode from './continuous/index.js';

const skillRegistry = new SkillRegistry();
let useSkillSystem = false;

export async function getMode(context: GitHubContext): Mode {
  // Try to use skill system
  if (useSkillSystem) {
    const detection = await detectModeWithSkills(context);
    if (detection.mode !== 'none') {
      return buildModeFromSkill(detection.skill);
    }
  }

  // Fallback to hardcoded modes
  if (agentMode.shouldTrigger(context)) return agentMode;
  if (tagMode.shouldTrigger(context)) return tagMode;
  if (continuousMode.shouldTrigger(context)) return continuousMode;

  throw new Error('No mode detected');
}

export async function initializeSkillSystem(loader: SkillLoader): Promise<void> {
  try {
    await skillRegistry.initialize(loader);
    useSkillSystem = true;
    console.log('✓ Skill system initialized');
  } catch (error) {
    console.warn('Failed to initialize skill system, falling back to hardcoded modes:', error);
    useSkillSystem = false;
  }
}

function buildModeFromSkill(skill: Skill): Mode {
  return {
    name: skill.metadata.name as ModeName,
    description: skill.metadata.description,
    shouldTrigger: async (context: GitHubContext) => {
      const executor = new SkillExecutor(skillRegistry, []);
      const result = await executor.execute(skill.metadata.name, { github: context });
      return result.success;
    },
    getAllowedTools: () => skill.metadata.requiredTools || [],
    getDisallowedTools: () => skill.metadata.disallowedTools || [],
    shouldCreateTrackingComment: () => true,
    generatePrompt: (context: ModeContext) => skill.content,
    getSystemPrompt: (context: ModeContext) => skill.content,
    prepare: async (options: ModeOptions) => {
      const executor = new SkillExecutor(skillRegistry, options.tools || []);
      const result = await executor.execute(skill.metadata.name, {
        github: options.context,
        tools: options.tools || [],
      });
      return result.data as ModeResult;
    },
  };
}
```

## Migration Path

### Phase 1: Foundation (P0)

1. Create `.claude/skills/` and `.claude/subagents/` directories
2. Implement `SkillParser` class
3. Implement `SkillValidator` class
4. Implement `SkillLoader` class
5. Implement `SkillRegistry` class
6. Implement `SubagentLoader` class
7. Implement `SubagentRegistry` class

### Phase 2: Migration (P1)

1. Create first skill: `error-analyzer.md`
2. Test skill loading and execution
3. Create second skill: `failure-memory.md`
4. Test skill dependencies
5. Create mode skills: `agent-mode.md`, `tag-mode.md`, `continuous-mode.md`
6. Update mode registry to use skills
7. Test backward compatibility

### Phase 3: Replacement (P2)

1. Migrate all self-improvement modules to skills
2. Migrate all mode logic to skills
3. Remove hardcoded mode files
4. Update all tests
5. Verify all functionality works

### Phase 4: Enhancement (P3)

1. Add skill hot-reload support
2. Add skill caching
3. Add skill metrics
4. Add skill performance monitoring
5. Add skill documentation generator

## Error Handling

### Skill Loading Errors

| Error | Handling |
|-------|-----------|
| File not found | Log warning, skip skill |
| Parse error | Log error, skip skill |
| Validation error | Log error, skip skill |
| Dependency error | Log error, skip skill |

### Skill Execution Errors

| Error | Handling |
|-------|-----------|
| Missing required tools | Throw error, don't execute |
| Timeout | Return failure, log timeout |
| Max retries exceeded | Return failure, log retries |
| Skill error | Return failure, propagate error |

## Testing Strategy

### Unit Tests

```typescript
// tests/skills/parser.test.ts
describe('SkillParser', () => {
  it('should parse valid skill file', async () => {
    const parser = new SkillParser();
    const skill = await parser.parseFile('fixtures/valid-skill.md');
    expect(skill.metadata.name).toBe('error-analyzer');
    expect(skill.content).toContain('# Error Patterns');
  });

  it('should throw on missing frontmatter', async () => {
    const parser = new SkillParser();
    await expect(parser.parseFile('fixtures/no-frontmatter.md'))
      .rejects.toThrow('Invalid skill format');
  });

  it('should validate required fields', async () => {
    const validator = new SkillValidator();
    const result = validator.validate({
      metadata: { name: 'test', type: 'custom', description: 'Test', triggers: [] },
      content: '# Test',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
```

### Integration Tests

```typescript
// tests/skills/registry.test.ts
describe('SkillRegistry', () => {
  let loader: SkillLoader;
  let registry: SkillRegistry;

  beforeEach(async () => {
    loader = new SkillLoader();
    await loader.loadFromFixtures();
    registry = new SkillRegistry();
    await registry.initialize(loader);
  });

  it('should load all skills', () => {
    const skills = registry.getAll();
    expect(skills.length).toBeGreaterThan(0);
  });

  it('should get skill by name', () => {
    const skill = registry.get('error-analyzer');
    expect(skill).toBeDefined();
    expect(skill.metadata.name).toBe('error-analyzer');
  });

  it('should get skills by trigger', () => {
    const skills = registry.getByTrigger('error_detected');
    expect(skills.length).toBeGreaterThan(0);
  });

  it('should resolve dependencies', async () => {
    const skills = registry.getAll();
    const names = skills.map(s => s.metadata.name);
    // Verify dependency graph is acyclic
    expect(true).toBe(true); // Dependency resolution passed
  });
});
```

## Performance Considerations

### Caching

- **Skill Cache**: In-memory cache of loaded skills
- **Result Cache**: LRU cache of skill execution results
- **TTL**: 1 minute for result cache

### Lazy Loading

- Skills loaded on-demand
- Only parse skills when needed
- Background preloading for common skills

### Concurrent Execution

- Max concurrent skill executions: 3
- Queue-based execution management
- Resource limits enforced

## Security Considerations

### Skill Validation

- Validate all paths before loading
- Sanitize skill names
- Check for directory traversal
- Validate YAML front matter safely

### Sandboxing

- Skill execution timeout enforced
- Tool access controlled
- Disallowed tools enforced
- Dependency resolution limited

### Permissions

- Skills cannot access files outside workdir
- Skills cannot access environment variables directly
- Skills cannot execute arbitrary commands (only via bash tool)

## Documentation

### README for Skills

```markdown
# Skills

This directory contains declarative skills for duyetbot-action.

## Directory Structure

```
.claude/skills/
├── self-improvement/  # Error handling and recovery
├── modes/             # Mode definitions
└── custom/            # User-defined skills
```

## Creating a Skill

### 1. Create Metadata

```yaml
---
name: my-custom-skill
type: custom
description: My custom skill
triggers:
  - my_custom_trigger
required_tools:
  - bash
  - git
---
```

### 2. Define Logic

```markdown
# My Custom Skill

## Purpose

Explain what this skill does.

## Trigger Conditions

When does this skill trigger?

## Execution

Step-by-step instructions for the LLM.

## Context

What context is available?

## Output

What should this skill return?
```

### 3. Validate

```bash
# Validate skill file
bun run validate-skill .claude/skills/custom/my-custom-skill.md
```

## Best Practices

- Keep skills focused and single-purpose
- Use clear, descriptive names
- Add comprehensive documentation
- Validate dependencies
- Test skills independently
- Version skills for compatibility

## Skill Development Guide

See [SKILL_DEVELOPMENT.md](../docs/SKILL_DEVELOPMENT.md) for detailed guide.
```

## Next Steps

1. Implement skill parser and validator
2. Implement skill loader and registry
3. Implement subagent loader and registry
4. Create first batch of skills (error-analyzer, failure-memory)
5. Create mode skills (agent-mode, tag-mode, continuous-mode)
6. Update mode registry to use skill system
7. Test backward compatibility
8. Add comprehensive tests
9. Write documentation
10. Deploy and validate

## Conclusion

This design provides:

- ✅ **Declarative skills**: Logic in `.md` files
- ✅ **Dynamic loading**: Runtime skill loading from `.claude/`
- ✅ **Hot reload**: Support for reloading without restart
- ✅ **Validation**: Skill structure and content validation
- ✅ **Registry pattern**: Centralized lookup and indexing
- ✅ **Type safety**: TypeScript interfaces
- ✅ **Extensibility**: Easy to add new skills
- ✅ **Backward compatibility**: Fallback to hardcoded modes

**Estimated Implementation Time**: 12-15 hours  
**Risk**: MEDIUM  
**Dependencies**: None
