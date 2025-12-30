/**
 * Task Picker System
 *
 * Aggregates tasks from multiple sources (GitHub Issues, files, memory-mcp)
 * and provides a unified interface for task selection and management.
 */

export { TaskPicker } from './picker.js';
export {
  FileTasksSource,
  type FileTasksSourceOptions,
  GitHubIssuesSource,
  type GitHubIssuesSourceOptions,
  MemoryMcpSource,
  type MemoryMcpSourceOptions,
} from './sources/index.js';
export type {
  Task,
  TaskPickerOptions,
  TaskSource,
  TaskSourceProvider,
  TaskStatus,
} from './types.js';
