/**
 * AgentMessageParts Component
 *
 * Renders agent-specific message parts including ChainOfThought,
 * Task lists, and Artifacts using AI Elements components.
 */

import { AlertCircle, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import {
  Artifact,
  ArtifactContent,
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
  Task,
  TaskContent,
  TaskItem,
  TaskTrigger,
} from '@/components/ai-elements/index';

/**
 * Data structure for chain-of-thought step
 */
interface ChainOfThoughtStepData {
  label: string;
  description?: string;
  status?: 'complete' | 'active' | 'pending';
}

/**
 * Data structure for chain-of-thought part
 */
interface ChainOfThoughtData {
  steps?: ChainOfThoughtStepData[];
}

/**
 * Data structure for task item
 */
interface TaskItemData {
  label: string;
  status?: 'complete' | 'active' | 'pending' | 'error';
}

/**
 * Data structure for task list part
 */
interface TaskListData {
  tasks?: TaskItemData[];
}

/**
 * Data structure for artifact part
 */
interface ArtifactData {
  title?: string;
  content?: string;
}

/**
 * Message part type discriminator
 */
type MessagePart =
  | { type: 'data-chain-of-thought'; steps?: ChainOfThoughtStepData[] }
  | { type: 'data-task-list'; tasks?: TaskItemData[] }
  | { type: 'data-artifact'; title?: string; content?: string }
  | { type: string; [key: string]: unknown };

/**
 * Props for AgentMessageParts component
 */
export interface AgentMessagePartsProps {
  /** Array of message parts to render */
  parts: MessagePart[];
  /** Optional status for the entire message */
  status?: string;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Get icon component for task status
 */
function getTaskIcon(status: string = 'pending') {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'active':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Circle className="h-4 w-4 text-gray-400" />;
  }
}

/**
 * ChainOfThought display component
 */
function ChainOfThoughtDisplay({ data }: { data: ChainOfThoughtData }) {
  const steps = data.steps ?? [];

  if (steps.length === 0) {
    return null;
  }

  return (
    <ChainOfThought defaultOpen={false}>
      <ChainOfThoughtHeader>Execution Plan</ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        {steps.map((step, idx) => (
          <ChainOfThoughtStep
            key={idx}
            label={step.label}
            description={step.description}
            status={step.status}
          />
        ))}
      </ChainOfThoughtContent>
    </ChainOfThought>
  );
}

/**
 * Task list display component
 */
function TaskListDisplay({ data }: { data: TaskListData }) {
  const tasks = data.tasks ?? [];
  const completed = tasks.filter((t) => t.status === 'complete').length;
  const total = tasks.length;

  if (total === 0) {
    return null;
  }

  return (
    <Task defaultOpen={true}>
      <TaskTrigger title={`Tasks (${completed}/${total})`} />
      <TaskContent>
        {tasks.map((task, idx) => (
          <TaskItem key={idx} className="flex items-center">
            {getTaskIcon(task.status)}
            <span className="ml-2">{task.label}</span>
          </TaskItem>
        ))}
      </TaskContent>
    </Task>
  );
}

/**
 * Artifact display component
 */
function ArtifactDisplay({ data }: { data: ArtifactData }) {
  if (!data.content) {
    return null;
  }

  return (
    <Artifact>
      {data.title && (
        <div className="border-b bg-muted/50 px-4 py-3">
          <p className="font-medium text-sm">{data.title}</p>
        </div>
      )}
      <ArtifactContent>
        <pre className="whitespace-pre-wrap text-sm">{data.content}</pre>
      </ArtifactContent>
    </Artifact>
  );
}

/**
 * Renders agent-specific message parts.
 *
 * This component filters and renders special data parts that contain
 * chain-of-thought steps, task lists, and artifacts.
 *
 * @example
 * ```tsx
 * <AgentMessageParts
 *   parts={[
 *     { type: 'data-chain-of-thought', steps: [...] },
 *     { type: 'data-task-list', tasks: [...] }
 *   ]}
 * />
 * ```
 */
export function AgentMessageParts({
  parts,
  status: _status,
  className = '',
}: AgentMessagePartsProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {parts.map((part, i) => {
        switch (part.type) {
          case 'data-chain-of-thought':
            return <ChainOfThoughtDisplay key={i} data={part as ChainOfThoughtData} />;
          case 'data-task-list':
            return <TaskListDisplay key={i} data={part as TaskListData} />;
          case 'data-artifact':
            return <ArtifactDisplay key={i} data={part as ArtifactData} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

/**
 * Check if a parts array contains any agent-specific parts
 */
export function hasAgentParts(
  parts: MessagePart[]
): parts is
  | [{ type: 'data-chain-of-thought' }]
  | [{ type: 'data-task-list' }]
  | [{ type: 'data-artifact' }] {
  return parts.some(
    (p) =>
      p.type === 'data-chain-of-thought' ||
      p.type === 'data-task-list' ||
      p.type === 'data-artifact'
  );
}
