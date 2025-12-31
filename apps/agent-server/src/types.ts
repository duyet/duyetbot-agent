/**
 * Agent Server Types
 */

/**
 * Task priority levels
 */
export enum TaskPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

/**
 * Task status
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Task source types
 */
export enum TaskSourceType {
  MEMORY_MCP = 'memory_mcp',
  TODO_FILE = 'todo_file',
  GITHUB_WEBHOOK = 'github_webhook',
  MANUAL = 'manual',
}

/**
 * Base task interface
 */
export interface Task {
  id: string;
  sourceId: string;
  sourceType: TaskSourceType;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Agent execution result
 */
export interface AgentResult {
  taskId: string;
  success: boolean;
  output: string;
  error?: string;
  tokensUsed: number;
  duration: number;
}

/**
 * Task source configuration
 */
export interface TaskSourceConfig {
  type: TaskSourceType;
  enabled: boolean;
  config: Record<string, unknown>;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  anthropicApiKey?: string;
  openrouterApiKey?: string;
  model?: string;
  maxIterations?: number;
  temperature?: number;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  port: number;
  agent: AgentConfig;
  taskSources: TaskSourceConfig[];
  database: {
    path: string;
  };
  polling: {
    interval: number;
  };
}
