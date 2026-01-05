# Architecture Design: Dead Letter Queue System

## Overview

Design of **dead letter queue (DLQ) system** for duyetbot-action to handle failed operations by queuing them for later retry, with exponential backoff and manual intervention capabilities.

## Goals

1. **Failed Task Queue**: Queue failed operations for later processing
2. **Exponential Backoff**: Delay retries with increasing intervals
3. **Priority Handling**: Prioritize critical tasks
4. **Max Retry Limit**: Prevent infinite retry loops
5. **Manual Intervention**: Allow manual review and retry
6. **Persistence**: Persist DLQ to disk/database
7. **Metrics**: Track DLQ statistics and health

## Directory Structure

```
src/
├── dlq/
│   ├── queue.ts            # Dead letter queue implementation
│   ├── item.ts            # DLQ item structure
│   ├── processor.ts        # DLQ processor (retry logic)
│   ├── storage.ts         # Persistent storage
│   ├── metrics.ts         # DLQ metrics
│   └── config.ts         # DLQ configuration
```

## Dead Letter Queue Item

### Item Structure

```typescript
// src/dlq/item.ts

export enum DLQStatus {
  QUEUED = 'queued',          // Item queued for retry
  RETRYING = 'retrying',      // Item being retried
  SUCCESS = 'success',        // Item successfully processed
  FAILED = 'failed',          // Item permanently failed
  ABANDONED = 'abandoned',    // Item abandoned (max retries)
  MANUAL_REVIEW = 'manual_review', // Item needs manual review
}

export enum DLQPriority {
  CRITICAL = 'critical',    // Retry immediately
  HIGH = 'high',            // Retry soon
  MEDIUM = 'medium',        // Normal retry
  LOW = 'low',              // Low priority retry
}

export interface DLQItem {
  // Identification
  id: string;                  // Unique item ID (UUID)
  taskId: string;              // Original task ID
  enqueuedAt: number;          // When item was enqueued
  updatedAt: number;          // Last update timestamp

  // Status
  status: DLQStatus;
  priority: DLQPriority;

  // Retry information
  retryCount: number;         // Number of retry attempts
  maxRetries: number;         // Maximum retries allowed
  retryAfter: number;         // Next retry timestamp
  backoffMs: number;          // Current backoff delay

  // Error information
  error: {
    category: string;          // Error category
    message: string;          // Error message
    code?: string;            // Error code
    stack?: string;           // Stack trace
    timestamp: number;         // Error timestamp
  };

  // Operation information
  operation: {
    type: string;             // Operation type (e.g., 'llm_call', 'github_api')
    method?: string;           // HTTP method or function name
    endpoint?: string;        // API endpoint or tool name
    payload?: unknown;         // Original payload
    context?: Record<string, unknown>; // Additional context
  };

  // Task context
  task?: {
    id: string;
    description: string;
    source: string;
  };

  // GitHub context
  github?: {
    owner: string;
    repo: string;
    entityNumber?: number;
    entityType?: 'issue' | 'pr' | 'comment';
  };

  // Metadata
  metadata?: {
    enqueuedBy: string;        // What enqueued this item
    tags?: string[];           // Tags for filtering
    notes?: string;            // Manual notes
    reviewed?: boolean;         // Has been manually reviewed?
    reviewedAt?: number;       // When it was reviewed
    reviewedBy?: string;       // Who reviewed it
  };

  // Processing history
  history: DLQHistoryEntry[];
}

export interface DLQHistoryEntry {
  timestamp: number;
  action: 'enqueued' | 'retry' | 'success' | 'failed' | 'abandoned' | 'reviewed';
  status: DLQStatus;
  error?: {
    category: string;
    message: string;
  };
  metadata?: Record<string, unknown>;
}
```

## Dead Letter Queue

### Queue Implementation

```typescript
// src/dlq/queue.ts

export interface DLQConfig {
  // Queue settings
  maxItems: number;            // Maximum items in queue
  maxRetries: number;          // Maximum retries per item
  defaultPriority: DLQPriority; // Default priority for new items

  // Backoff settings
  initialBackoffMs: number;    // Initial backoff delay
  maxBackoffMs: number;        // Maximum backoff delay
  backoffMultiplier: number;    // Exponential backoff multiplier

  // Processing settings
  processIntervalMs: number;    // How often to process queue
  processBatchSize: number;     // Items to process per batch
  maxConcurrent: number;        // Max concurrent retries

  // Cleanup settings
  ageToCleanup: number;        // Age threshold for cleanup (ms)
  autoCleanup: boolean;         // Enable automatic cleanup

  // Storage settings
  storageType: 'memory' | 'file' | 'database';
  storagePath?: string;         // Path for file storage
}

export class DeadLetterQueue {
  private items: Map<string, DLQItem> = new Map();
  private priorityQueues: Map<DLQPriority, string[]> = new Map();
  private processor: DLQProcessor;
  private storage: DLQStorage;
  private metrics: DLQMetrics;
  private processingTimer?: NodeJS.Timeout;

  constructor(config: DLQConfig) {
    this.storage = this.createStorage(config);
    this.metrics = new DLQMetrics();
    this.processor = new DLQProcessor(config, this.metrics);

    // Initialize priority queues
    this.priorityQueues.set(DLQPriority.CRITICAL, []);
    this.priorityQueues.set(DLQPriority.HIGH, []);
    this.priorityQueues.set(DLQPriority.MEDIUM, []);
    this.priorityQueues.set(DLQPriority.LOW, []);
  }

  async initialize(): Promise<void> {
    // Load items from storage
    const loadedItems = await this.storage.load();

    // Add to queue
    for (const item of loadedItems) {
      this.addItemInternal(item, false);
    }

    console.log(`✓ Loaded ${loadedItems.length} items from DLQ storage`);

    // Start processing if enabled
    if (this.processor.config.processIntervalMs > 0) {
      this.startProcessing();
    }
  }

  async enqueue(
    operation: DLQItem['operation'],
    error: Error,
    context?: {
      task?: DLQItem['task'];
      github?: DLQItem['github'];
      metadata?: Partial<DLQItem['metadata']>;
    }
  ): Promise<string> {
    // Detect error
    const errorHandler = new ErrorHandler();
    const errorContext = errorHandler.detector.detect(error, {
      type: this.inferOperationType(operation.type),
      component: operation.type,
    });

    // Create DLQ item
    const item: DLQItem = {
      id: this.generateId(),
      taskId: context?.task?.id || this.generateId(),
      enqueuedAt: Date.now(),
      updatedAt: Date.now(),
      status: DLQStatus.QUEUED,
      priority: this.determinePriority(errorContext),
      retryCount: 0,
      maxRetries: this.processor.config.maxRetries,
      retryAfter: this.calculateNextRetry(0),
      backoffMs: this.processor.config.initialBackoffMs,

      error: {
        category: errorContext.category,
        message: errorContext.message,
        code: errorContext.code,
        stack: errorContext.stack,
        timestamp: errorContext.timestamp,
      },

      operation,
      task: context?.task,
      github: context?.github,
      metadata: {
        enqueuedBy: 'system',
        ...context?.metadata,
      },
      history: [{
        timestamp: Date.now(),
        action: 'enqueued',
        status: DLQStatus.QUEUED,
      }],
    };

    // Add to queue
    this.addItemInternal(item, true);

    // Save to storage
    await this.storage.save(Array.from(this.items.values()));

    return item.id;
  }

  async retry(itemId: string): Promise<void> {
    const item = this.items.get(itemId);

    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }

    // Update status
    item.status = DLQStatus.RETRYING;
    item.retryCount++;
    item.updatedAt = Date.now();

    // Calculate next retry time
    item.retryAfter = this.calculateNextRetry(item.retryCount);
    item.backoffMs = this.calculateBackoff(item.retryCount);

    // Add history entry
    item.history.push({
      timestamp: Date.now(),
      action: 'retry',
      status: DLQStatus.RETRYING,
    });

    // Save to storage
    await this.storage.save(Array.from(this.items.values()));
  }

  async markSuccess(itemId: string): Promise<void> {
    const item = this.items.get(itemId);

    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }

    // Update status
    item.status = DLQStatus.SUCCESS;
    item.updatedAt = Date.now();

    // Add history entry
    item.history.push({
      timestamp: Date.now(),
      action: 'success',
      status: DLQStatus.SUCCESS,
    });

    // Record metrics
    this.metrics.recordSuccess(item);

    // Remove from queue
    this.removeItem(itemId);
  }

  async markFailed(itemId: string, finalError?: Error): Promise<void> {
    const item = this.items.get(itemId);

    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }

    // Check if max retries reached
    if (item.retryCount >= item.maxRetries) {
      // Abandon item
      item.status = DLQStatus.ABANDONED;
      item.updatedAt = Date.now();

      // Add history entry
      item.history.push({
        timestamp: Date.now(),
        action: 'abandoned',
        status: DLQStatus.ABANDONED,
        error: finalError ? {
          category: 'unknown',
          message: finalError.message,
        } : undefined,
      });

      // Record metrics
      this.metrics.recordAbandoned(item);
    } else {
      // Keep in queue for retry
      item.status = DLQStatus.QUEUED;
      item.updatedAt = Date.now();

      // Calculate next retry time
      item.retryAfter = this.calculateNextRetry(item.retryCount + 1);
      item.backoffMs = this.calculateBackoff(item.retryCount + 1);

      // Add history entry
      item.history.push({
        timestamp: Date.now(),
        action: 'failed',
        status: DLQStatus.QUEUED,
        error: finalError ? {
          category: 'unknown',
          message: finalError.message,
        } : undefined,
      });

      // Record metrics
      this.metrics.recordRetry(item);
    }

    // Save to storage
    await this.storage.save(Array.from(this.items.values()));
  }

  async markForManualReview(itemId: string, notes?: string): Promise<void> {
    const item = this.items.get(itemId);

    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }

    // Update status
    item.status = DLQStatus.MANUAL_REVIEW;
    item.updatedAt = Date.now();
    item.metadata!.reviewed = true;
    item.metadata!.reviewedAt = Date.now();
    item.metadata!.reviewedBy = 'system';
    if (notes) {
      item.metadata!.notes = notes;
    }

    // Add history entry
    item.history.push({
      timestamp: Date.now(),
      action: 'reviewed',
      status: DLQStatus.MANUAL_REVIEW,
    });

    // Save to storage
    await this.storage.save(Array.from(this.items.values()));
  }

  getItems(filter?: {
    status?: DLQStatus;
    priority?: DLQPriority;
    type?: string;
    limit?: number;
  }): DLQItem[] {
    let items = Array.from(this.items.values());

    // Apply filters
    if (filter) {
      if (filter.status) {
        items = items.filter(i => i.status === filter.status);
      }

      if (filter.priority) {
        items = items.filter(i => i.priority === filter.priority);
      }

      if (filter.type) {
        items = items.filter(i => i.operation.type === filter.type);
      }

      if (filter.limit) {
        items = items.slice(0, filter.limit);
      }
    }

    // Sort by retry time (oldest first)
    return items.sort((a, b) => a.retryAfter - b.retryAfter);
  }

  getItem(itemId: string): DLQItem | undefined {
    return this.items.get(itemId);
  }

  getStats(): {
    totalItems: number;
    itemsByStatus: Record<DLQStatus, number>;
    itemsByPriority: Record<DLQPriority, number>;
    itemsByType: Record<string, number>;
    avgRetryCount: number;
  } {
    const items = Array.from(this.items.values());

    const stats = {
      totalItems: items.length,
      itemsByStatus: {} as Record<DLQStatus, number>,
      itemsByPriority: {} as Record<DLQPriority, number>,
      itemsByType: {} as Record<string, number>,
      avgRetryCount: 0,
    };

    // Calculate stats
    for (const item of items) {
      // By status
      stats.itemsByStatus[item.status] =
        (stats.itemsByStatus[item.status] || 0) + 1;

      // By priority
      stats.itemsByPriority[item.priority] =
        (stats.itemsByPriority[item.priority] || 0) + 1;

      // By type
      stats.itemsByType[item.operation.type] =
        (stats.itemsByType[item.operation.type] || 0) + 1;
    }

    // Average retry count
    if (items.length > 0) {
      stats.avgRetryCount = items.reduce((sum, i) => sum + i.retryCount, 0) / items.length;
    }

    return stats;
  }

  async deleteItem(itemId: string): Promise<void> {
    this.removeItem(itemId);
    await this.storage.save(Array.from(this.items.values()));
  }

  async clear(): Promise<void> {
    this.items.clear();
    this.priorityQueues.clear();
    await this.storage.save([]);
  }

  private addItemInternal(item: DLQItem, saveToStorage: boolean = false): void {
    // Add to main map
    this.items.set(item.id, item);

    // Add to priority queue
    const queue = this.priorityQueues.get(item.priority) || [];
    queue.push(item.id);
    this.priorityQueues.set(item.priority, queue);

    // Save to storage if needed
    if (saveToStorage) {
      // This is handled by the caller
    }
  }

  private removeItem(itemId: string): void {
    const item = this.items.get(itemId);
    if (!item) return;

    // Remove from main map
    this.items.delete(itemId);

    // Remove from priority queue
    const queue = this.priorityQueues.get(item.priority) || [];
    const index = queue.indexOf(itemId);
    if (index !== -1) {
      queue.splice(index, 1);
    }
  }

  private calculateNextRetry(retryCount: number): number {
    const now = Date.now();
    const backoffMs = this.calculateBackoff(retryCount);
    return now + backoffMs;
  }

  private calculateBackoff(retryCount: number): number {
    const config = this.processor.config;
    const backoff = config.initialBackoffMs * Math.pow(config.backoffMultiplier, retryCount - 1);
    return Math.min(backoff, config.maxBackoffMs);
  }

  private determinePriority(error: ErrorContext): DLQPriority {
    // Determine priority based on error severity and category
    if (error.severity === ErrorSeverity.CRITICAL) {
      return DLQPriority.CRITICAL;
    }

    if (error.severity === ErrorSeverity.HIGH) {
      return DLQPriority.HIGH;
    }

    if (error.severity === ErrorSeverity.MEDIUM) {
      return DLQPriority.MEDIUM;
    }

    return DLQPriority.LOW;
  }

  private inferOperationType(operationType: string): 'llm' | 'github' | 'tool' | 'verification' {
    if (operationType.includes('llm') || operationType.includes('claude')) {
      return 'llm';
    }

    if (operationType.includes('github') || operationType.includes('api')) {
      return 'github';
    }

    if (operationType.includes('tool') || operationType.includes('bash') || operationType.includes('git')) {
      return 'tool';
    }

    if (operationType.includes('verification') || operationType.includes('test')) {
      return 'verification';
    }

    return 'tool';
  }

  private generateId(): string {
    return `dlq_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private startProcessing(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }

    this.processingTimer = setInterval(async () => {
      await this.processQueue();
    }, this.processor.config.processIntervalMs);
  }

  private stopProcessing(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = undefined;
    }
  }

  private async processQueue(): Promise<void> {
    // Get items ready for retry
    const now = Date.now();
    const readyItems = Array.from(this.items.values())
      .filter(item =>
        item.status === DLQStatus.QUEUED &&
        item.retryAfter <= now
      )
      .sort((a, b) => a.retryAfter - b.retryAfter) // Oldest first
      .slice(0, this.processor.config.processBatchSize);

    if (readyItems.length === 0) {
      return;
    }

    console.log(`Processing ${readyItems.length} items from DLQ`);

    // Process items concurrently
    const promises = readyItems.map(item => this.processItem(item));
    await Promise.allSettled(promises);
  }

  private async processItem(item: DLQItem): Promise<void> {
    try {
      // Mark as retrying
      await this.retry(item.id);

      // Retry the operation
      const result = await this.processor.retryOperation(item);

      if (result.success) {
        await this.markSuccess(item.id);
      } else {
        await this.markFailed(item.id, result.error);
      }
    } catch (error) {
      await this.markFailed(item.id, error as Error);
    }
  }

  async destroy(): Promise<void> {
    this.stopProcessing();
    await this.storage.save(Array.from(this.items.values()));
  }

  getMetrics(): DLQMetrics {
    return this.metrics;
  }
}
```

## DLQ Processor

### Retry Logic

```typescript
// src/dlq/processor.ts

export interface DLQProcessorConfig {
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  backoffMultiplier: number;
  processIntervalMs: number;
  processBatchSize: number;
  maxConcurrent: number;
}

export class DLQProcessor {
  constructor(
    public config: DLQProcessorConfig,
    private metrics: DLQMetrics
  ) {}

  async retryOperation(item: DLQItem): Promise<{
    success: boolean;
    result?: any;
    error?: Error;
  }> {
    const { operation, task, github } = item;

    try {
      // Dispatch based on operation type
      switch (operation.type) {
        case 'llm_call':
          return await this.retryLLMOperation(operation);

        case 'github_api':
          return await this.retryGitHubOperation(operation, github);

        case 'tool_execution':
          return await this.retryToolOperation(operation, task);

        case 'verification':
          return await this.retryVerificationOperation(operation, task);

        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  private async retryLLMOperation(operation: DLQItem['operation']): Promise<{
    success: boolean;
    result?: any;
    error?: Error;
  }> {
    // Re-execute LLM call with original payload
    // This would call the LLM provider with the original request
    const llmProvider = getLLMProvider();
    const result = await llmProvider.execute(operation.payload!);

    return {
      success: true,
      result,
    };
  }

  private async retryGitHubOperation(
    operation: DLQItem['operation'],
    github?: DLQItem['github']
  ): Promise<{
    success: boolean;
    result?: any;
    error?: Error;
  }> {
    // Re-execute GitHub API call
    const octokit = getOctokit();

    const result = await octokit.rest[operation.method! as keyof typeof octokit.rest](
      ...(operation.payload! as any[])
    );

    return {
      success: true,
      result,
    };
  }

  private async retryToolOperation(
    operation: DLQItem['operation'],
    task?: DLQItem['task']
  ): Promise<{
    success: boolean;
    result?: any;
    error?: Error;
  }> {
    // Re-execute tool
    const tool = getTool(operation.endpoint!);

    const result = await tool.execute(operation.payload!);

    return {
      success: true,
      result,
    };
  }

  private async retryVerificationOperation(
    operation: DLQItem['operation'],
    task?: DLQItem['task']
  ): Promise<{
    success: boolean;
    result?: any;
    error?: Error;
  }> {
    // Re-run verification
    const verificationLoop = getVerificationLoop();

    const result = await verificationLoop.verify();

    return {
      success: result.passed,
      result,
    };
  }
}
```

## DLQ Storage

### Persistent Storage

```typescript
// src/dlq/storage.ts

export interface DLQStorageConfig {
  type: 'memory' | 'file' | 'database';
  path?: string;
}

export class DLQStorage {
  constructor(private config: DLQStorageConfig) {}

  async load(): Promise<DLQItem[]> {
    switch (this.config.type) {
      case 'memory':
        return [];

      case 'file':
        return await this.loadFromFile();

      case 'database':
        return await this.loadFromDatabase();

      default:
        throw new Error(`Unknown storage type: ${this.config.type}`);
    }
  }

  async save(items: DLQItem[]): Promise<void> {
    switch (this.config.type) {
      case 'memory':
        // No-op for memory storage
        return;

      case 'file':
        await this.saveToFile(items);
        return;

      case 'database':
        await this.saveToDatabase(items);
        return;

      default:
        throw new Error(`Unknown storage type: ${this.config.type}`);
    }
  }

  private async loadFromFile(): Promise<DLQItem[]> {
    const path = this.config.path || '.duyetbot-dlq.json';

    try {
      const content = await readFile(path, 'utf-8');
      return JSON.parse(content) as DLQItem[];
    } catch {
      // File doesn't exist or is empty
      return [];
    }
  }

  private async saveToFile(items: DLQItem[]): Promise<void> {
    const path = this.config.path || '.duyetbot-dlq.json';
    const content = JSON.stringify(items, null, 2);
    await writeFile(path, content, 'utf-8');
  }

  private async loadFromDatabase(): Promise<DLQItem[]> {
    // TODO: Implement database storage
    return [];
  }

  private async saveToDatabase(items: DLQItem[]): Promise<void> {
    // TODO: Implement database storage
  }

  async clear(): Promise<void> {
    switch (this.config.type) {
      case 'memory':
        return;

      case 'file':
        const path = this.config.path || '.duyetbot-dlq.json';
        await writeFile(path, '[]', 'utf-8');
        return;

      case 'database':
        await this.clearDatabase();
        return;

      default:
        throw new Error(`Unknown storage type: ${this.config.type}`);
    }
  }

  private async clearDatabase(): Promise<void> {
    // TODO: Implement database clear
  }
}
```

## DLQ Metrics

### Metrics Tracking

```typescript
// src/dlq/metrics.ts

export interface DLQMetrics {
  totalEnqueued: number;
  totalRetried: number;
  totalSuccesses: number;
  totalAbandoned: number;
  totalManualReviews: number;

  enqueuedByPriority: Record<DLQPriority, number>;
  enqueuedByType: Record<string, number>;

  successByPriority: Record<DLQPriority, number>;
  successByType: Record<string, number>;

  abandonedByPriority: Record<DLQPriority, number>;
  abandonedByType: Record<string, number>;

  avgRetryCount: number;
  avgBackoffMs: number;
  maxRetryCount: number;
}

export class DLQMetrics {
  private metrics: DLQMetrics = {
    totalEnqueued: 0,
    totalRetried: 0,
    totalSuccesses: 0,
    totalAbandoned: 0,
    totalManualReviews: 0,

    enqueuedByPriority: {} as Record<DLQPriority, number>,
    enqueuedByType: {} as Record<string, number>,

    successByPriority: {} as Record<DLQPriority, number>,
    successByType: {} as Record<string, number>,

    abandonedByPriority: {} as Record<DLQPriority, number>,
    abandonedByType: {} as Record<string, number>,

    avgRetryCount: 0,
    avgBackoffMs: 0,
    maxRetryCount: 0,
  };

  recordEnqueued(item: DLQItem): void {
    this.metrics.totalEnqueued++;

    // By priority
    this.metrics.enqueuedByPriority[item.priority] =
      (this.metrics.enqueuedByPriority[item.priority] || 0) + 1;

    // By type
    this.metrics.enqueuedByType[item.operation.type] =
      (this.metrics.enqueuedByType[item.operation.type] || 0) + 1;
  }

  recordRetry(item: DLQItem): void {
    this.metrics.totalRetried++;

    // Update max retry count
    if (item.retryCount > this.metrics.maxRetryCount) {
      this.metrics.maxRetryCount = item.retryCount;
    }

    // Recalculate average retry count
    this.recalculateAverages();
  }

  recordSuccess(item: DLQItem): void {
    this.metrics.totalSuccesses++;

    // By priority
    this.metrics.successByPriority[item.priority] =
      (this.metrics.successByPriority[item.priority] || 0) + 1;

    // By type
    this.metrics.successByType[item.operation.type] =
      (this.metrics.successByType[item.operation.type] || 0) + 1;

    // Recalculate average retry count
    this.recalculateAverages();
  }

  recordAbandoned(item: DLQItem): void {
    this.metrics.totalAbandoned++;

    // By priority
    this.metrics.abandonedByPriority[item.priority] =
      (this.metrics.abandonedByPriority[item.priority] || 0) + 1;

    // By type
    this.metrics.abandonedByType[item.operation.type] =
      (this.metrics.abandonedByType[item.operation.type] || 0) + 1;

    // Recalculate average retry count
    this.recalculateAverages();
  }

  recordManualReview(item: DLQItem): void {
    this.metrics.totalManualReviews++;
  }

  private recalculateAverages(): void {
    // Average retry count
    const totalItems = this.metrics.totalRetried + this.metrics.totalSuccesses;
    const totalRetries = this.metrics.totalRetried * 2; // Approximate

    this.metrics.avgRetryCount = totalItems > 0 ? totalRetries / totalItems : 0;
  }

  getMetrics(): DLQMetrics {
    return { ...this.metrics };
  }

  getSummary(): string {
    const metrics = this.metrics;

    const successRate = metrics.totalEnqueued > 0
      ? `${(metrics.totalSuccesses / metrics.totalEnqueued * 100).toFixed(1)}%`
      : '0%';

    const abandonmentRate = metrics.totalEnqueued > 0
      ? `${(metrics.totalAbandoned / metrics.totalEnqueued * 100).toFixed(1)}%`
      : '0%';

    return `
Dead Letter Queue Metrics:
--------------------------
Total Enqueued: ${metrics.totalEnqueued}
Total Retried: ${metrics.totalRetried}
Total Successes: ${metrics.totalSuccesses} (${successRate})
Total Abandoned: ${metrics.totalAbandoned} (${abandonmentRate})
Manual Reviews: ${metrics.totalManualReviews}

By Priority (Enqueued):
- Critical: ${metrics.enqueuedByPriority[DLQPriority.CRITICAL] || 0}
- High: ${metrics.enqueuedByPriority[DLQPriority.HIGH] || 0}
- Medium: ${metrics.enqueuedByPriority[DLQPriority.MEDIUM] || 0}
- Low: ${metrics.enqueuedByPriority[DLQPriority.LOW] || 0}

By Type (Enqueued):
${this.formatByType(metrics.enqueuedByType)}

Statistics:
- Avg Retry Count: ${metrics.avgRetryCount.toFixed(2)}
- Max Retry Count: ${metrics.maxRetryCount}
    `.trim();
  }

  private formatByType(typeMap: Record<string, number>): string {
    return Object.entries(typeMap)
      .map(([type, count]) => `- ${type}: ${count}`)
      .join('\n');
  }

  reset(): void {
    this.metrics = {
      totalEnqueued: 0,
      totalRetried: 0,
      totalSuccesses: 0,
      totalAbandoned: 0,
      totalManualReviews: 0,

      enqueuedByPriority: {} as Record<DLQPriority, number>,
      enqueuedByType: {} as Record<string, number>,

      successByPriority: {} as Record<DLQPriority, number>,
      successByType: {} as Record<string, number>,

      abandonedByPriority: {} as Record<DLQPriority, number>,
      abandonedByType: {} as Record<string, number>,

      avgRetryCount: 0,
      avgBackoffMs: 0,
      maxRetryCount: 0,
    };
  }
}
```

## Integration with Retry System

### DLQ Integration

```typescript
// src/resilience/integration.ts

export class ResilientExecutor {
  constructor(
    private policyManager: PolicyManager,
    private errorHandler: ErrorHandler,
    private dlq: DeadLetterQueue
  ) {}

  async execute<T>(
    policyName: string,
    operation: () => Promise<T>,
    context?: {
      task?: DLQItem['task'];
      github?: DLQItem['github'];
      operation: DLQItem['operation'];
    }
  ): Promise<T> {
    try {
      // Execute with resilience policy
      return await this.policyManager.executeWithPolicy(
        policyName,
        operation
      );
    } catch (error) {
      // Detect error
      const errorContext = this.errorHandler.detector.detect(error, {
        type: this.inferOperationType(policyName),
        component: policyName,
      });

      // Report error
      this.errorHandler.reporter.report(errorContext);

      // Check if should enqueue to DLQ
      if (this.shouldEnqueueToDLQ(errorContext, error)) {
        await this.dlq.enqueue(
          context?.operation || {
            type: policyName,
            payload: undefined,
          },
          error as Error,
          context
        );
      }

      throw error;
    }
  }

  private shouldEnqueueToDLQ(error: ErrorContext, originalError: unknown): boolean {
    // Enqueue to DLQ if:
    // - Error is retryable or recoverable
    // - Not a configuration error
    // - Not a permission error

    if (error.recoverability === ErrorRecoverability.PERMANENT) {
      // Don't enqueue permanent errors (config, permission, etc.)
      return false;
    }

    return true;
  }

  private inferOperationType(policyName: string): 'llm' | 'github' | 'tool' | 'verification' {
    if (policyName === 'llm') return 'llm';
    if (policyName === 'github') return 'github';
    if (policyName === 'tool') return 'tool';
    if (policyName === 'verification') return 'verification';
    return 'tool';
  }
}
```

## Migration Path

### Phase 1: Foundation (P0)

1. Implement `DLQItem` interface
2. Implement `DLQStorage` class
3. Implement `DLQMetrics` class
4. Implement `DLQProcessor` class
5. Implement `DeadLetterQueue` class

### Phase 2: Integration (P1)

6. Update retry system to use DLQ
7. Update error handling to use DLQ
8. Add DLQ to skill system
9. Add DLQ to mode system
10. Add DLQ metrics to dashboard

### Phase 3: Optimization (P2)

11. Add database storage option
12. Add DLQ health monitoring
13. Add automatic cleanup of old items
14. Add DLQ admin API
15. Add DLQ notifications

## Error Handling

### DLQ Errors

| Error | Handling |
|-------|-----------|
| Storage failure | Log error, keep items in memory |
| Enqueue failure | Log error, retry later |
| Retry failure | Update item status, schedule next retry |
| Max retries exceeded | Mark as abandoned, notify if needed |

## Testing Strategy

### Unit Tests

```typescript
// tests/dlq/queue.test.ts
describe('DeadLetterQueue', () => {
  it('should enqueue item', async () => {
    const dlq = new DeadLetterQueue(config);
    await dlq.initialize();

    const itemId = await dlq.enqueue(
      { type: 'llm_call', payload: {} },
      new Error('Rate limit exceeded')
    );

    const items = dlq.getItems();
    expect(items.length).toBe(1);
    expect(items[0].id).toBe(itemId);
  });

  it('should retry item after backoff', async () => {
    const dlq = new DeadLetterQueue({
      ...config,
      initialBackoffMs: 100, // Short for testing
    });
    await dlq.initialize();

    const itemId = await dlq.enqueue(
      { type: 'llm_call', payload: {} },
      new Error('Rate limit exceeded')
    );

    const item = dlq.getItem(itemId)!;
    expect(item.status).toBe(DLQStatus.QUEUED);
    expect(item.retryCount).toBe(0);

    // Retry
    await dlq.retry(itemId);

    const updatedItem = dlq.getItem(itemId)!;
    expect(updatedItem.status).toBe(DLQStatus.RETRYING);
    expect(updatedItem.retryCount).toBe(1);
  });

  it('should mark item as abandoned after max retries', async () => {
    const dlq = new DeadLetterQueue({
      ...config,
      maxRetries: 2,
    });
    await dlq.initialize();

    const itemId = await dlq.enqueue(
      { type: 'llm_call', payload: {} },
      new Error('Rate limit exceeded')
    );

    // Fail twice (max retries)
    for (let i = 0; i < 2; i++) {
      await dlq.retry(itemId);
      await dlq.markFailed(itemId, new Error('Failed'));
    }

    const item = dlq.getItem(itemId)!;
    expect(item.status).toBe(DLQStatus.ABANDONED);
    expect(item.retryCount).toBe(2);
  });
});
```

## Next Steps

1. Implement `DLQItem` interface
2. Implement `DLQStorage` class
3. Implement `DLQMetrics` class
4. Implement `DLQProcessor` class
5. Implement `DeadLetterQueue` class
6. Write comprehensive tests
7. Integrate with retry system
8. Integrate with error handling
9. Add DLQ to dashboard
10. Add documentation

## Conclusion

This design provides:

- ✅ **Failed task queue**: Queue failed operations for later processing
- ✅ **Exponential backoff**: Delay retries with increasing intervals
- ✅ **Priority handling**: 4 priority levels (critical, high, medium, low)
- ✅ **Max retry limit**: Prevent infinite retry loops
- ✅ **Manual intervention**: Mark items for manual review with notes
- ✅ **Persistence**: File-based storage (database option for future)
- ✅ **Metrics**: Comprehensive metrics tracking
- ✅ **Integration**: Seamless integration with retry and error handling systems
- ✅ **Automatic processing**: Automatic retry queue processing

**Estimated Implementation Time**: 3-4 hours  
**Risk**: MEDIUM  
**Dependencies**: Retry system (arch-5), Error handling system (arch-4)
