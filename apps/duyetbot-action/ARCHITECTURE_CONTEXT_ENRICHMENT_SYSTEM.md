# Architecture Design: Context Enrichment System

## Overview

Design of **context enrichment system** for duyetbot-action to provide richer, more contextual information to the agent with caching, filtering, and prioritization.

## Goals

1. **Enrichment Rules**: Declarative context fetching rules defined in mode skill metadata
2. **Caching**: Avoid repeated GitHub API calls with intelligent cache management
3. **Filtering**: Exclude irrelevant context to reduce token usage
4. **Prioritization**: Prioritize important context sources
5. **Configurability**: Different enrichment strategies per mode/task type
6. **Context Profiles**: Named enrichment profiles for different use cases

## Directory Structure

```
.claude/skills/
├── modes/
│   ├── agent-mode.md
│   ├── tag-mode.md
│   └── continuous-mode.md
└── self-improvement/
    └── context-enrichment.md  # Context enrichment patterns

src/
├── context/
│   ├── enricher.ts         # Main enrichment engine
│   ├── cache.ts            # Context cache management
│   ├── filters.ts           # Context filtering rules
│   └── profiles.ts          # Named context profiles
```

## Context Enrichment Schema

### Skill Metadata for Context

```yaml
context-strategy:
  enrichment:
    fetch_issue: true
    fetch_comments: true
    fetch_labels: true
    fetch_pr_files: false
    fetch_status: false
    fetch_workflow_runs: false

  filters:
    exclude_labels: ['wontfix', 'duplicate', 'spam', 'question']
    max_comments: 10
    comment_age_days: 7  # Ignore comments older than 7 days
    exclude_authors: ['bot', 'dependabot']

  prioritization:
    recent_first: true
    high_priority_labels: ['bug', 'critical', 'blocker']
    medium_priority_labels: ['enhancement', 'question']
    low_priority_labels: ['documentation', 'good first issue']

  cache:
    enabled: true
    ttl_seconds: 300  # 5 minutes
    max_cache_size: 100
```

## Context Types

### GitHub Context

```typescript
// src/context/types.ts

export interface GitHubContext {
  owner: string;
  repo: string;
  fullName: string;
  entityNumber?: number;
  isPR: boolean;
  actor: string;
  eventName: string;
  eventAction?: string;
  payload?: any;
  inputs?: Record<string, string>;
}

export interface IssueContext extends GitHubContext {
  title: string;
  body: string;
  state: 'open' | 'closed' | 'reopened';
  labels: string[];
  assignees: string[];
  createdAt: string;
  updatedAt: string;
  number: number;
}

export interface PullRequestContext extends GitHubContext {
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  labels: string[];
  headRef: string;
  baseRef: string;
  assignees: string[];
  createdAt: string;
  updatedAt: string;
  number: number;
  diffUrl: string;
}

export interface CommentContext {
  id: number;
  user: string;
  createdAt: string;
  updatedAt: string;
  body: string;
  authorAssociation: string;  'OWNER', 'COLLABORATOR', 'CONTRIBUTOR', 'NONE'
}
  reactions: {
    emoji: string;
    count: number;
    users: string[];
  };
}
```

### Enriched Context

```typescript
// src/context/types.ts

export interface EnrichedContext {
  // Original GitHub context
  github: GitHubContext;

  // Enriched data
  issue?: IssueContext;
  pr?: PullRequestContext;
  comments: CommentContext[];
  files: FileContext[];
  labels: Label[];
  status?: StatusContext;

  // Metadata
  enrichentAt: number;  // Timestamp when context was enriched
  source: 'github-api' | 'cache' | 'enricher';
  cacheHits: number;
}
}

export interface FileContext {
  path: string;
  content: string;
  size: number;
  language: string;
}

export interface StatusContext {
  combined: {
    state: string;
    creator: string;
    createdAt: string;
    updatedAt: string;
  };
  checks: StatusCheck[];
}

export interface StatusCheck {
  context: string;
  state: 'pending' | 'success' | 'failure' | 'error';
  creator: string;
  createdAt: string;
  url: string;
}
```

## Enricher Engine

```typescript
// src/context/enricher.ts

export class ContextEnricher {
  private readonly cache: ContextCache;
  private readonly filters: ContextFilters;
  private readonly profiles: ContextProfiles;

  constructor(
    private config: EnrichmentConfig
  ) {
    this.cache = new ContextCache(config.cache);
    this.filters = new ContextFilters(config.filters);
    this.profiles = new ContextProfiles();
  }

  async enrich(context: GitHubContext): Promise<EnrichedContext> {
    const startTime = Date.now();

    // 1. Determine enrichment strategy from skill metadata
    const strategy = this.getStrategy(context);

    // 2. Apply filters to exclude unwanted context
    const filtered = await this.applyFilters(context, strategy);

    // 3. Enrich with GitHub data
    const enriched = await this.enrichFromGitHub(context, strategy);

    // 4. Apply prioritization
    const prioritized = this.prioritize(enriched, strategy);

    const duration = Date.now() - startTime;

    return {
      github: context,
      ...prioritized,
      enrichentAt: Date.now(),
      source: 'enricher',
      cacheHits: this.cache.getHits(),
      duration,
    };
  }

  private getStrategy(context: GitHubContext): EnrichmentConfig {
    // For now, return default strategy
    // In the future, this would load from mode skill metadata
    return DEFAULT_ENRICHMENT_CONFIG;
  }

  private async applyFilters(
    context: GitHubContext,
    strategy: EnrichmentConfig
  ): Promise<GitHubContext> {
    // Exclude labels
    const filtered = this.excludeLabels(context);

    // Filter comments by age and authors
    const filtered2 = this.filterComments(filtered);

    return filtered2;
  }

  private excludeLabels(context: GitHubContext): GitHubContext {
    if (!context.payload?.issue?.labels && !context.payload?.pull_request?.labels) {
      return context;
    }

    const labels = [
      ...context.payload?.issue?.labels || [],
      ...context.payload?.pull_request?.labels || [],
    ];

    const excludeSet = strategy.filters.exclude_labels || [];

    const filtered = labels.filter(l => !excludeSet.includes(l.name.toLowerCase()));

    return {
      ...context,
      payload: {
        ...context.payload,
        issue: {
          ...context.payload?.issue,
          labels: filtered,
        },
        pull_request: {
          ...context.payload?.pull_request,
          labels: filtered,
        },
      },
    };
  };
  }

  private async enrichFromGitHub(
    context: GitHubContext,
    strategy: EnrichmentConfig
  ): Promise<EnrichedContext> {
    const enriched: EnrichedContext = {
      github: context,
    enrichentAt: Date.now(),
      source: 'enricher',
      cacheHits: 0,
    duration: 0,
    };

    // Check cache
    const cached = this.cache.get(context);
    if (cached) {
      enriched.source = 'cache';
      enriched.cacheHits = 1;
      return enriched;
    }

    // Enrich from GitHub based on strategy
    if (strategy.enrichment.fetch_issue && context.entityNumber) {
      enriched.issue = await this.enrichIssue(context);
    }

    if (strategy.enrichment.fetch_comments && context.entityNumber) {
      enriched.comments = await this.enrichComments(context);
    }

    if (strategy.enrichment.fetch_labels) {
      enriched.labels = await this.enrichLabels(context);
    }

    if (strategy.enrichment.fetch_status && context.entityNumber) {
      enriched.status = await this.enrichStatus(context);
    }

    if (strategy.enrichment.fetch_pr_files) {
      enriched.files = await this.enrichFiles(context);
    }

    return enriched;
  }

  private async enrichIssue(context: GitHubContext): Promise<IssueContext | undefined> {
    if (!context.entityNumber || context.isPR) {
      return undefined;
    }

    const { owner, repo, entityNumber } = context;

    // Check cache
    const cacheKey = this.cacheKey(owner, repo, 'issue', entityNumber);
    const cached = this.cache.get(cacheKey);

    if (cached) {
      enriched.source = 'cache';
      enriched.cacheHits++;
      return cached;
    }

    // Fetch from GitHub
    const issue = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: entityNumber,
    headers: { accept: 'application/vnd.github+json' },
    });

    // Cache result
    await this.cache.set(cacheKey, issue);

    return {
      title: issue.title,
      body: issue.body || '',
      state: issue.state,
      labels: issue.labels.map(l => l.name),
      assignees: issue.assignees.map(a => a.login),
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      number: issue.number,
    };
  }

  private async enrichComments(
    context: GitHubContext
  ): Promise<CommentContext[]> {
    if (!context.entityNumber) {
      return [];
    }

    const { owner, repo, entityNumber } = context;

    // Check cache
    const cacheKey = this.cacheKey(owner, repo, 'comments', entityNumber);
    const cached = this.cache.get(cacheKey);

    if (cached) {
      enriched.source = 'cache';
      enriched.cacheHits++;
      return cached;
    }

    // Fetch comments from GitHub
    const { data } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: entityNumber,
      per_page: 100,
      headers: { accept: 'application/vnd.github+json' },
    });

    // Filter by age and authors
    const filtered = this.filterComments(data);

    // Cache result
    await this.cache.set(cacheKey, filtered);

    return filtered;
  }

  private filterComments(comments: CommentContext[]): CommentContext[] {
    const strategy = this.profiles.getCurrentStrategy();

    if (!strategy.prioritization?.recent_first) {
      return comments;
    }

    const excludeAuthors = strategy.filters?.exclude_authors || [];

    return comments.filter(c => {
      // Exclude authors
      if (excludeAuthors.includes(c.user.toLowerCase())) {
        return false;
      }

      // Filter by age
      const ageDays = strategy.filters?.comment_age_days || 7;
      const commentDate = new Date(c.createdAt);
      const daysSince = (Date.now() - commentDate.getTime()) / (1000 * 60 * 60 * 24);

      return daysSince <= ageDays;
    });
  }

  private async enrichLabels(context: GitHubContext): Promise<string[]> {
    const { owner, repo } = context;

    // Check cache
    const cacheKey = this.cacheKey(owner, repo, 'labels');
    const cached = this.cache.get(cacheKey);

    if (cached) {
      enriched.source = 'cache';
      enriched.cacheHits++;
      return cached;
    }

    // Fetch labels from GitHub
    const { data } = await octokit.rest.issues.listLabelsForRepo({
      owner,
      repo,
      per_page: 100,
      headers: { accept: 'application/vnd.github+json' },
    });

    // Cache result
    const labels = data.map(l => l.name);

    await this.cache.set(cacheKey, labels);

    return labels;
  }

  private async enrichStatus(context: GitHubContext): Promise<StatusContext | undefined> {
    if (!context.entityNumber) {
      return undefined;
    }

    const { owner, repo, entityNumber } = context;

    // Check cache
    const cacheKey = this.cacheKey(owner, repo, 'status', entityNumber);
    const cached = this.cache.get(cacheKey);

    if (cached) {
      enriched.source = 'cache';
      enriched.cacheHits++;
      return cached;
    }

    // Fetch combined status from GitHub
    const combined = await octokit.rest.repos.getCombinedStatus({
      owner,
      repo,
      ref: `heads/${context.inputs.baseBranch || 'main'}`,
    });

    // Fetch individual status checks
    const checks = await Promise.all([
      octokit.rest.checks.listForRef({
        owner,
        repo,
        ref: `heads/${context.inputs.baseBranch || 'main'}`,
      }),
      this.enrichChecks(combined, combined),
    ]);

    const status = {
      combined: {
        state: combined.state,
        creator: combined.creator?.user?.login,
        createdAt: combined.created_at,
        updatedAt: combined.updated_at,
      },
      checks,
    };

    // Cache result
    await this.cache.set(cacheKey, status);

    return status;
  }

  private enrichChecks(
    combined: Awaited<OctokitResponse<any>>,
    combinedStatus: Awaited<OctokitResponse<any>>
  ): StatusCheck[] {
    const combinedChecks = combinedStatus.data;

    // Build enriched checks
    return [
      this.enrichCheck('ci', combinedChecks.find(c => c.context === 'ci')),
      this.enrichCheck('tests', combinedChecks.find(c => c.context === 'tests')),
      this.enrichCheck('lint', combinedChecks.find(c => c.context === 'lint')),
      this.enrichCheck('deploy', combinedChecks.find(c => c.context === 'deploy')),
      this.enrichCheck('security', combinedChecks.find(c => c.context === 'security')),
    ];
  }

  private enrichCheck(
    type: string,
    check: any | undefined
  ): StatusCheck {
    if (!check) {
      return {
        context: type,
        state: 'unknown',
        creator: 'unknown',
        createdAt: '',
        updatedAt: '',
        url: '',
      };
    }

    return {
      context: type,
      state: check.state,
      creator: check.creator?.user?.login || '',
      createdAt: check.created_at || '',
      updatedAt: check.updated_at || '',
      url: check.html_url || check.url || '',
    };
  }

  private async enrichFiles(context: GitHubContext): Promise<FileContext[]> {
    const { owner, repo } = context;

    // Get PR files
    const pr = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: context.entityNumber!,
      per_page: 100,
      headers: { accept: 'application/vnd.github.v3.diff' },
    });

    const files = pr.files.map(f => ({
      path: f.filename,
      content: '',  // Would need to fetch each file
      size: f.size || 0,
      language: f.language || 'text',
    }));

    return files;
  }

  private prioritize(
    enriched: EnrichedContext,
    strategy: EnrichmentConfig
  ): EnrichedContext {
    // Reorder comments by priority
    if (strategy.prioritization?.recent_first && enriched.comments) {
      enriched.comments = this.prioritizeComments(enriched.comments, strategy);
    }

    // Prioritize issues/PRs by labels
    if (enriched.issue || enriched.pr) {
      enriched.labels = this.prioritizeLabels(enriched.labels || [], strategy);
    }

    // Prioritize by high priority labels
    const highPriority = strategy.prioritization?.high_priority_labels || [];
    const hasHighPriority = enriched.labels.some(l => highPriority.includes(l));

    // Remove low priority items if high priority exists
    if (hasHighPriority && enriched.comments.length > 0) {
      enriched.comments = enriched.comments.filter(c =>
        !c.authorAssociation.includes('OWNER') &&  // Don't filter owner comments
        this.isLowPriorityComment(c, enriched)
      );
    }

    return enriched;
  }

  private prioritizeComments(
    comments: CommentContext[],
    strategy: EnrichmentConfig
  ): CommentContext[] {
    const excludeAuthors = strategy.filters?.exclude_authors || [];
    const ageDays = strategy.filters?.comment_age_days || 7;

    return comments.sort((a, b) => {
      // Prioritize by author association
      const aScore = this.getAuthorScore(a.authorAssociation, excludeAuthors);
      const bScore = this.getAuthorScore(b.authorAssociation, excludeAuthors);

      if (aScore !== bScore) {
        return aScore - bScore;
      }
      if (aScore > bScore) return 1;
      return -1;
      return 0;
    });
  }

  private getAuthorScore(
    association: string,
    exclude: string[]
  ): number {
    if (exclude.includes(association.toLowerCase())) {
      return 0;  // Exclude excluded authors
    }

    switch (association) {
      case 'OWNER': return 10;
      case 'COLLABORATOR': return 7;
      case 'CONTRIBUTOR': return 5;
      case 'NONE': return 0;
      default: return 1;
    }
  }

  private isLowPriorityComment(
    comment: CommentContext,
    enriched: EnrichedContext
  ): boolean {
    const isLowPriority = enriched.labels.some(l =>
      this.isLowPriorityLabel(l, enriched)
    );

    // Also check if comment is from high-priority author
    const isLowAuthor = this.isLowPriorityAuthor(comment.author);

    return isLowPriority && isLowAuthor;
  }

  private isLowPriorityLabel(label: string, enriched: EnrichedContext): boolean {
    const lowPriority = enriched.labels.some(l =>
      this.isLowPriorityLabel(l, enriched)
    );

    const lowPriorityLabels = strategy.prioritization?.low_priority_labels || [];

    return lowPriorityLabels.includes(label.toLowerCase());
  }

  private isLowPriorityAuthor(author: string): boolean {
    const excludeAuthors = this.profiles.getCurrentStrategy().filters?.exclude_authors || [];
    return excludeAuthors.includes(author.toLowerCase());
  }

  private prioritizeLabels(labels: string[], strategy: EnrichmentConfig): string[] {
    const strategy = this.profiles.getCurrentStrategy();

    const { highPriorityLabels, mediumPriorityLabels, lowPriorityLabels } =
      strategy.prioritization;

    return labels.sort((a, b) => {
      if (this.isHighPriorityLabel(a, highPriorityLabels)) {
        return -1;
      }
      if (this.isMediumPriorityLabel(a, mediumPriorityLabels)) {
        return 0;
      if (this.isLowPriorityLabel(a, lowPriorityLabels)) {
        return 1;
      return 0;
      }
      return 0;
    });
  }

  private isHighPriorityLabel(label: string, labels: string[]): boolean {
    const highPriority = labels.filter(l => labels.includes(l.toLowerCase()));
    return highPriority.includes(label.toLowerCase());
  }

  private isMediumPriorityLabel(label: string, labels: string[]): boolean {
    const mediumPriority = labels.filter(l => labels.includes(l.toLowerCase()));
    return mediumPriority.includes(label.toLowerCase());
  }

  private cacheKey(
    owner: string,
    repo: string,
    type: string,
    entityNumber?: number
  ): string {
    return `${owner}/${repo}/${type}/${entityNumber}`;
  }
}
```

## Cache Management

### Cache Entry

```typescript
// src/context/cache.ts

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  size: number;
}

export class ContextCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxBytes: number;

  constructor(config: CacheConfig) {
    this.maxBytes = config.maxCacheSize || 100 * 1024; // 100MB default
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    const age = Date.now() - entry.timestamp;
    const ttl = config.ttl_seconds || 300; // 5 minutes default

    if (age > ttl * 1000) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      size: JSON.stringify(data).length,
    };

    this.cache.set(key, entry);

    // Prune old entries if cache is full
    await this.prune();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  async prune(): Promise<void> {
    const currentSize = this.getCurrentSize();
    const maxBytes = this.maxBytes;

    if (currentSize <= maxBytes) {
      return;
    }

    // Remove oldest entries
    const sorted = Array.from(this.cache.entries())
      .sort((a, b) => a[1] - b[1]);

    let size = currentSize;
    for (const [key, entry] of sorted) {
      this.cache.delete(key);
      size -= entry.size;
      if (size <= maxBytes) {
        break;
      }
    }
  }

  getCurrentSize(): number {
    return Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.size, 0);
  }

  getHits(): number {
    return Array.from(this.cache.values()).length;
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  private getSize(entry: CacheEntry<any>): number {
    return JSON.stringify(entry.data).length;
  }
}
```

## Filters Engine

### Filter Types

```typescript
// src/context/filters.ts

export interface FilterConfig {
  exclude_labels?: string[];
  max_comments?: number;
  comment_age_days?: number;
  exclude_authors?: string[];
}

export interface Filters {
  excludeLabels: (labels: string[]) => boolean[];
  maxComments: (comments: CommentContext[]) => CommentContext[];
  commentAge: (comments: CommentContext[]) => CommentContext[];
  excludeAuthors: (authors: string[]) => boolean[];
}
```

### Filter Implementation

```typescript
// src/context/filters.ts

export class ContextFilters {
  constructor(private config: FilterConfig) {}

  excludeLabels(labels: string[]): boolean[] {
    if (!this.config.exclude_labels) {
      return []; // Accept all labels
    }

    const excludeSet = new Set(
      this.config.exclude_labels.map(l => l.toLowerCase())
    );

    return (labels: (label: string) =>
      !excludeSet.has(label.toLowerCase())
    );
  }

  maxComments(comments: CommentContext[]): CommentContext[] {
    const max = this.config.max_comments || 10;

    if (comments.length <= max) {
      return comments;
    }

    // Sort by recency, then take first N
    return comments
      .sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      )
      .slice(0, max);
  }

  commentAge(comments: CommentContext[]): CommentContext[] {
    const ageDays = this.config.comment_age_days || 7;

    const cutoffDate = new Date(
      Date.now() - ageDays * 24 * 60 * 60 * 1000
    );

    return comments.filter(c =>
      new Date(c.createdAt) >= cutoffDate
    );
  }

  excludeAuthors(authors: string[]): (authors: string[]) => boolean[] {
    if (!this.config.exclude_authors) {
      return [];
    }

    const excludeSet = new Set(
      this.config.exclude_authors.map(a => a.toLowerCase())
    );

    return (author: string) => excludeSet.has(author.toLowerCase());
  }
}
```

## Profile System

### Profile Types

```typescript
// src/context/profiles.ts

export type ProfileName =
  | 'default'
  | 'minimal'
  | 'verbose'
  | 'fast'
  | 'comprehensive';

export interface ProfileConfig {
  name: ProfileName;
  description: string;
  context_requirements:
    github_context: boolean;
    entity_context: boolean;
    comment_context: boolean;
    label_context: boolean;
    task_context: boolean;
  file_context: boolean;

  context_strategy:
    enrichment:
      fetch_issue: boolean;
      fetch_comments: boolean;
      fetch_labels: boolean;
      fetch_pr_files: boolean;
      fetch_status: boolean;
      fetch_workflow_runs: boolean;

  filters:
    exclude_labels: string[];
    max_comments: number;
    comment_age_days: number;
    exclude_authors: string[];

  prioritization:
      recent_first: boolean;
      high_priority_labels: string[];
      medium_priority_labels: string[];
      low_priority_labels: string[];

  cache:
    enabled: boolean;
    ttl_seconds: number;
    max_cache_size: number;
}
```

### Predefined Profiles

```typescript
// src/context/profiles.ts

export const PROFILES: Record<ProfileName, ProfileConfig> = {
  default: {
    name: 'default',
    description: 'Balanced enrichment with reasonable defaults',
    context_requirements: {
      github_context: true,
      entity_context: true,
      comment_context: true,
      label_context: true,
      task_context: false,
      file_context: false,
    },
    context_strategy: {
      enrichment: {
        fetch_issue: true,
        fetch_comments: true,
        fetch_labels: true,
        fetch_pr_files: false,
        fetch_status: false,
        fetch_workflow_runs: false,
      },
    },
    filters: {
      exclude_labels: ['wontfix', 'duplicate', 'spam', 'question'],
      max_comments: 10,
      comment_age_days: 7,
      exclude_authors: ['dependabot'],
    },
    prioritization: {
      recent_first: true,
      high_priority_labels: ['bug', 'critical'],
      medium_priority_labels: ['enhancement'],
      low_priority_labels: ['documentation'],
    },
    cache: {
      enabled: true,
      ttl_seconds: 300,  // 5 minutes
      max_cache_size: 100, // 100MB
    },
  },

  minimal: {
    name: 'minimal',
    description: 'Minimal context for faster, cheaper execution',
    context_requirements: {
      github_context: true,
      entity_context: true,
      comment_context: false,  // No comments
      label_context: false,
      task_context: false,
      file_context: false,
    },
    context_strategy: {
      enrichment: {
        fetch_issue: true,
        fetch_comments: false,  // No comments
        fetch_labels: false,
        fetch_pr_files: false,
        fetch_status: false,
        fetch_workflow_runs: false,
      },
    },
    filters: {
      exclude_labels: ['wontfix', 'spam', 'question'],  // More aggressive filtering
      max_comments: 5,
      comment_age_days: 3,
      exclude_authors: ['dependabot', 'bot'],
    },
    prioritization: {
      recent_first: true,
      high_priority_labels: ['critical', 'blocker'],
      medium_priority_labels: ['bug', 'enhancement'],
      low_priority_labels: [],  // No low priority
    },
    cache: {
      enabled: true,
      ttl_seconds: 180, // 3 minutes
      max_cache_size: 50, // 50MB
    },
  },

  verbose: {
    name: 'verbose',
    description: 'Maximum context for debugging and analysis',
    context_requirements: {
      github_context: true,
      entity_context: true,
      comment_context: true,
      label_context: true,
      task_context: false,
      file_context: true,
    },
    context_strategy: {
      enrichment: {
        fetch_issue: true,
        fetch_comments: true,
        fetch_labels: true,
        fetch_pr_files: true,
        fetch_status: true,
        fetch_workflow_runs: true,
      },
    },
    filters: {
      exclude_labels: [], // Accept all labels
      max_comments: 50,      // More comments
      comment_age_days: 30,      // Longer history
      exclude_authors: [],    // No author filtering
    },
    prioritization: {
      recent_first: true,
      high_priority_labels: ['bug', 'critical', 'blocker', 'enhancement'],
      medium_priority_labels: ['documentation', 'question', 'discussion', 'help wanted'],
      low_priority_labels: ['documentation', 'good first issue'],
    },
    cache: {
      enabled: true,
      ttl_seconds: 900, // 15 minutes
      max_cache_size: 200, // 200MB
    },
  },

  fast: {
    name: 'fast',
    description: 'Quick context for fast iteration',
    context_requirements: {
      github_context: true,
      entity_context: false,  // Minimal entity data
      comment_context: false,
      label_context: false,
      task_context: true,
      file_context: false,
    },
    context_strategy: {
      enrichment: {
        fetch_issue: false,  // Get from cache only
        fetch_comments: false,
        fetch_labels: false,
        fetch_pr_files: false,
        fetch_status: false,
        fetch_workflow_runs: false,
      },
    },
    filters: {
      exclude_labels: ['wontfix', 'duplicate'],
      max_comments: 3,
      comment_age_days: 1,
      exclude_authors: ['dependabot', 'bot'],
    },
    prioritization: {
      recent_first: true,
      high_priority_labels: ['critical', 'blocker'],
      medium_priority_labels: [],
      low_priority_labels: ['bug', 'enhancement'],
    },
    cache: {
      enabled: true,
      ttl_seconds: 120, // 2 minutes
      max_cache_size: 30,  30MB
    },
  },

  comprehensive: {
    name: 'comprehensive',
    description: 'Full context for thorough analysis',
    context_requirements: {
      github_context: true,
      entity_context: true,
      comment_context: true,
      label_context: true,
      task_context: true,
      file_context: true,
    },
    context_strategy: {
      enrichment: {
        fetch_issue: true,
        fetch_comments: true,
        fetch_labels: true,
        fetch_pr_files: true,
        fetch_status: true,
        fetch_workflow_runs: true,
      },
    },
    filters: {
      exclude_labels: [], // No label filtering
      max_comments: 50,
      comment_age_days: 90,      // 3 months history
      exclude_authors: [],    // No author filtering
    },
    prioritization: {
      recent_first: false, // Oldest first
      high_priority_labels: ['critical', 'blocker', 'enhancement'],
      medium_priority_labels: ['bug', 'enhancement', 'documentation'],
      low_priority_labels: ['question', 'discussion'],
    },
    cache: {
      enabled: true,
      ttl_seconds: 3600, // 1 hour
      max_cache_size: 500, // 500MB
    },
  },
};
```

### Profile Manager

```typescript
// src/context/profiles.ts

export class ProfileManager {
  private currentProfile: ProfileName = 'default';

  constructor(private profiles: Record<ProfileName, ProfileConfig> = {}) {}

  getProfile(name?: ProfileName): ProfileConfig {
    if (!name) {
      return this.currentProfile;
    }

    return this.profiles[name] || PROFILES.default;
  }

  setProfile(name: ProfileName): void {
    if (!this.profiles[name]) {
      throw new Error(`Profile not found: ${name}`);
    }

    this.currentProfile = name;
  }

  getCurrentProfile(): ProfileName {
    return this.currentProfile;
  }

  getAllProfiles(): ProfileName[] {
    return Object.keys(this.profiles);
  }

  getProfiles(): Record<ProfileName, ProfileConfig> {
    return { ...this.profiles };
  }

  getProfilesByTag(tag: string): ProfileConfig[] {
    return Object.entries(this.profiles)
      .filter(([name]) => this.profiles[name].tags?.includes(tag))
      .map(([name]) => this.profiles[name]);
  }
}
```

## Integration with Skill System

### Mode Skill Integration

```typescript
// In mode skills, add context_strategy section to metadata

context_requirements:
  github_context: true
  entity_context: true
  comment_context: true
  label_context: true
  task_context: true
  file_context: false

context_strategy:
  enrichment:
    fetch_issue: true
    fetch_comments: true
    fetch_labels: true
    fetch_pr_files: false
    fetch_status: false
  fetch_workflow_runs: false

filters:
  exclude_labels: ['wontfix', 'duplicate', 'spam', 'question']
  max_comments: 10
  comment_age_days: 7
  exclude_authors: ['dependabot']

prioritization:
  recent_first: true
  high_priority_labels: ['bug', 'critical']
  medium_priority_labels: ['enhancement']
  low_priority_labels: ['documentation']

cache:
  enabled: true
  ttl_seconds: 300  # 5 minutes
```

### Skill Execution Integration

```typescript
// In skill execute() method, call context enricher

async execute(context: SkillContext): Promise<SkillResult> {
  const { github, task } = context;

  // Build context for enrichment
  const enrichContext: {
    github,
    task,
  };

  // Enrich context using enricher
  const enriched = await contextEnricher.enrich(enrichContext.github);

  // Merge enriched context into skill context
  const mergedContext: {
    ...context,
    ...enriched,
  };

  return this.executeWithContext(mergedContext);
}
```

## Token Usage Estimation

### Context Size Estimator

```typescript
// src/context/estimator.ts

export class ContextEstimator {
  estimate(context: EnrichedContext): ContextEstimation {
    const chars =
      JSON.stringify(context).length;

    const tokens = Math.ceil(chars / 4);  // 1 token per 4 chars (rough estimate)

    const priority = this.estimatePriority(context);

    // Adjust by priority
    const adjustment = priority === 'high' ? 0.8 :
                       priority === 'medium' ? 1.0 :
                       priority === 'low' ? 1.5 : 1.0;

    return {
      estimatedTokens: Math.ceil(tokens * adjustment),
      priority: this.estimatePriority(context),
    };
  }

  private estimatePriority(context: EnrichedContext): 'high' | 'medium' | 'low' {
    if (!context.issue && !context.pr) {
      return 'medium';
    }

    const labels = context.issue?.labels || context.pr?.labels || [];

    const highPriority = ['bug', 'critical', 'blocker', 'enhancement'];
    const mediumPriority = ['bug', 'enhancement'];
    const lowPriority = ['documentation', 'good first issue', 'question'];

    if (labels.some(l => highPriority.includes(l))) {
      return 'high';
    }

    if (labels.some(l => mediumPriority.includes(l))) {
      return 'medium';
    }

    return 'low';
  }
}
```

## Performance Monitoring

### Context Enrichment Metrics

```typescript
// src/context/metrics.ts

export interface EnrichmentMetrics {
  totalEnrichments: number;
  cacheHits: number;
  cacheMisses: number;
  averageEnrichmentTime: number;
  totalContextSize: number;
  averageContextSize: number;
  averageTokens: number;
}

export class ContextMetrics {
  private metrics: EnrichmentMetrics = {
    totalEnrichments: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalEnrichmentTime: 0,
    totalContextSize: 0,
    totalTokens: 0,
    averageEnrichmentTime: 0,
    averageContextSize: 0,
    averageTokens: 0,
  };

  recordEnrichment(start: number, duration: number, enriched: EnrichedContext): void {
    this.metrics.totalEnrichments++;
    this.metrics.totalEnrichmentTime += duration;
    this.metrics.totalContextSize += JSON.stringify(enriched).length;
    this.metrics.averageEnrichmentTime =
      this.metrics.totalEnrichmentTime / this.metrics.totalEnrichments;
    this.metrics.averageContextSize =
      this.metrics.totalContextSize / this.metrics.totalEnrichments;
    this.metrics.averageTokens =
      this.metrics.totalTokens / this.metrics.totalEnrichments;

    if (enriched.source === 'cache') {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
  }

  recordCacheHit(): void {
    this.metrics.cacheHits++;
  }

  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  getMetrics(): EnrichmentMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      totalEnrichments: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalEnrichmentTime: 0,
      totalContextSize: 0,
      averageEnrichmentTime: 0,
      averageContextSize: 0,
      averageTokens: 0,
    };
  }

  getSummary(): string {
    const hitRate = this.metrics.totalEnrichments > 0
      ? `${(this.metrics.cacheHits / this.metrics.totalEnrichments * 100).toFixed(1)}%`
      : '0%';

    return `
Total Enrichments: ${this.metrics.totalEnrichments}
Cache Hit Rate: ${hitRate}
Cache Hits: ${this.metrics.cacheHits}
Cache Misses: ${this.metrics.cacheMisses}
Avg Enrichment Time: ${this.metrics.averageEnrichmentTime}ms
Avg Context Size: ${Math.round(this.metrics.averageContextSize)} chars
Avg Tokens: ${Math.round(this.metrics.averageTokens)} tokens
    `;
  }
}
```

## Migration Path

### Phase 1: Foundation

1. Create `.claude/skills/context-enrichment.md` skill
2. Implement `ContextEnricher` class
3. Implement `ContextCache` class
4. Implement `ContextFilters` class
5. Implement `ContextProfiles` class
6. Implement `ContextEstimator` class
7. Implement `ContextMetrics` class

### Phase 2: Integration

8. Update `ModeExecutor` to use context enricher
9. Update mode skills to call context enricher
10. Update skill execution to pass enriched context
11. Add context enrichment to self-improvement
12. Test context enrichment with different profiles

### Phase 3: Optimization

13. Add cache warming for common contexts
14. Implement adaptive token usage based on context
15. Add context compression for large contexts
16. Optimize cache TTL based on usage patterns

## Error Handling

### Enrichment Errors

| Error | Handling |
|-------|-----------|
| Cache miss | Log warning, enrich from API |
| API rate limit | Wait and retry with exponential backoff |
| Network error | Retry with backoff, then fail |
| Parse error | Log error, use partial data |
| Validation error | Log error, skip enrich |

## Testing Strategy

### Unit Tests

```typescript
// tests/context/enricher.test.ts
describe('ContextEnricher', () => {
  it('should enrich basic issue context', async () => {
    const context = createMockGitHubContext();
    const enriched = await enricher.enrich(context);
    expect(enriched.issue).toBeDefined();
    expect(enriched.issue?.title).toBe('Test Issue');
  });

  it('should enrich comments with filtering', async () => {
    const context = createMockGitHubContext();
    const enriched = await enricher.enrich(context);
    expect(enriched.comments.length).toBeGreaterThan(0);
  });

  it('should cache enriched context', async () => {
    const context = createMockGitHubContext();
    const enriched1 = await enricher.enrich(context);
    const enriched2 = await enricher.enrich(context);

    expect(enriched1.source).toBe('enricher');
    expect(enriched2.source).toBe('cache');
    expect(enriched.cacheHits).toBe(2);
  });

  it('should prioritize high priority labels', async () => {
    const context = createMockGitHubContext();
    context.payload.issue.labels = [
      { name: 'bug' },
      { name: 'documentation' },
      { name: 'enhancement' },
    ];

    const enriched = await enricher.enrich(context);
    const prioritized = enriched.labels.map((l, i) =>
      enriched.labels[i]
    );

    expect(prioritized[0].toBe('bug');
    expect(prioritized[1]).toBe('enhancement');
    expect(prioritized[2]).toBe('documentation');
    expect(prioritized[3]).toBe('enhancement');
  });
});
```

### Integration Tests

```typescript
// tests/context/integration.test.ts
describe('Context Enrichment Integration', () => {
  it('should enrich agent mode with context', async () => {
    const mode = loadModeSkill('agent-mode');
    const context = createMockModeContext();
    const result = await mode.execute(context);

    expect(result.success).toBe(true);
    expect(result.data?.context).toBeDefined();
    expect(result.data?.context?.enriched).toBeDefined();
  });
});
```

## Next Steps

1. Implement `ContextEnricher` class
2. Implement `ContextCache` class
3. Implement `ContextFilters` class
4. Implement `ContextProfiles` class
5. Implement `ContextEstimator` class
6. Implement `ContextMetrics` class
7. Create `.claude/skills/context-enrichment.md` skill
8. Write comprehensive tests
9. Integrate with mode system
10. Integrate with self-improvement
11. Add documentation

## Conclusion

This design provides:

- ✅ **Declarative enrichment**: Rules defined in skill metadata
- ✅ **Intelligent caching**: TTL-based cache with pruning
- ✅ **Smart filtering**: Labels, age, authors
- ✅ **Prioritization**: High/medium/low priority
- ✅ **Context profiles**: 7 predefined profiles
- ✅ **Token estimation**: Based on context size and priority
- ✅ **Metrics**: Performance monitoring

**Estimated Implementation Time**: 8-10 hours  
**Risk**: MEDIUM  
**Dependencies**: None
