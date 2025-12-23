/**
 * ToolInspector Component
 *
 * Displays execution chains for the current session.
 * Shows collapsible tool calls with expandable args/results.
 * Includes JSON syntax highlighting for structured data.
 */

import {
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Code,
  Copy,
  Loader2,
  Terminal,
  XCircle,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { ExecutionStep } from '../types/index';

/**
 * Props for ToolInspector component
 */
interface ToolInspectorProps {
  /** Execution steps to display */
  steps: ExecutionStep[];
  /** Optional CSS class name */
  className?: string;
  /** Whether to auto-expand new steps */
  autoExpand?: boolean;
}

/**
 * Get icon for step type
 */
function getStepIcon(step: ExecutionStep) {
  switch (step.type) {
    case 'thinking':
      return <Terminal size={14} className="text-purple-500" />;
    case 'tool_start':
      return <Loader2 size={14} className="text-blue-500 animate-spin" />;
    case 'tool_complete':
      return <CheckCircle size={14} className="text-green-500" />;
    case 'tool_error':
      return <XCircle size={14} className="text-red-500" />;
    case 'tool_execution':
      return <Code size={14} className="text-blue-500" />;
    case 'routing':
      return <ChevronRight size={14} className="text-orange-500" />;
    case 'llm_iteration':
      return <Loader2 size={14} className="text-purple-500 animate-pulse" />;
    case 'preparing':
      return <Loader2 size={14} className="text-gray-500" />;
    case 'responding':
      return <CheckCircle size={14} className="text-green-500" />;
    default:
      return <ChevronRight size={14} className="text-gray-400" />;
  }
}

/**
 * Get status indicator for step
 */
function getStepStatus(step: ExecutionStep): 'running' | 'completed' | 'error' | 'pending' {
  switch (step.type) {
    case 'thinking':
    case 'tool_start':
    case 'llm_iteration':
    case 'preparing':
    case 'tool_execution':
      return 'running';
    case 'tool_complete':
    case 'responding':
    case 'routing':
      return 'completed';
    case 'tool_error':
      return 'error';
    default:
      return 'pending';
  }
}

/**
 * Token type for JSON syntax highlighting
 */
type JsonToken =
  | { type: 'string'; value: string }
  | { type: 'number'; value: string }
  | { type: 'boolean'; value: string }
  | { type: 'null'; value: string }
  | { type: 'key'; value: string }
  | { type: 'punctuation'; value: string }
  | { type: 'whitespace'; value: string };

/**
 * Tokenize JSON string for syntax highlighting
 */
function tokenizeJson(jsonStr: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let i = 0;

  while (i < jsonStr.length) {
    const char = jsonStr[i];

    // Whitespace
    if (/\s/.test(char)) {
      let ws = '';
      while (i < jsonStr.length && /\s/.test(jsonStr[i])) {
        ws += jsonStr[i++];
      }
      tokens.push({ type: 'whitespace', value: ws });
      continue;
    }

    // Punctuation
    if ('{}:[]'.includes(char)) {
      tokens.push({ type: 'punctuation', value: char });
      i++;
      continue;
    }

    // String (key or value)
    if (char === '"') {
      let str = '';
      i++; // Skip opening quote

      while (i < jsonStr.length && jsonStr[i] !== '"') {
        if (jsonStr[i] === '\\' && i + 1 < jsonStr.length) {
          str += jsonStr[i] + jsonStr[i + 1];
          i += 2;
        } else {
          str += jsonStr[i++];
        }
      }
      i++; // Skip closing quote

      // Check if this is a key (followed by :)
      let j = i;
      while (j < jsonStr.length && /\s/.test(jsonStr[j])) {
        j++;
      }
      const isKey = j < jsonStr.length && jsonStr[j] === ':';

      tokens.push({ type: isKey ? 'key' : 'string', value: str });
      continue;
    }

    // Number
    if (/[-\d.]/.test(char)) {
      let num = '';
      while (i < jsonStr.length && /[-\d.eE+]/.test(jsonStr[i])) {
        num += jsonStr[i++];
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // Boolean or null
    if (/[a-z]/.test(char)) {
      let word = '';
      while (i < jsonStr.length && /[a-z]/.test(jsonStr[i])) {
        word += jsonStr[i++];
      }
      if (word === 'true' || word === 'false') {
        tokens.push({ type: 'boolean', value: word });
      } else if (word === 'null') {
        tokens.push({ type: 'null', value: word });
      } else {
        tokens.push({ type: 'string', value: word });
      }
      continue;
    }

    i++;
  }

  return tokens;
}

/**
 * JSON syntax highlighting component (safe, no dangerouslySetInnerHTML)
 */
function JsonSyntaxHighlight({ data }: { data: unknown }) {
  const jsonString = useMemo(() => {
    return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  }, [data]);

  const tokens = useMemo(() => tokenizeJson(jsonString), [jsonString]);

  return (
    <pre className="text-xs font-mono overflow-x-auto">
      <code>
        {tokens.map((token, idx) => {
          const key = `${idx}-${token.type}`;
          switch (token.type) {
            case 'string':
              return (
                <span key={key} className="text-green-400 dark:text-green-300">
                  {token.value}
                </span>
              );
            case 'key':
              return (
                <span key={key} className="text-purple-400 dark:text-purple-300">
                  {token.value}
                </span>
              );
            case 'number':
              return (
                <span key={key} className="text-blue-400 dark:text-blue-300">
                  {token.value}
                </span>
              );
            case 'boolean':
              return (
                <span key={key} className="text-yellow-400 dark:text-yellow-300">
                  {token.value}
                </span>
              );
            case 'null':
              return (
                <span key={key} className="text-gray-400 dark:text-gray-500">
                  {token.value}
                </span>
              );
            default:
              return <span key={key}>{token.value}</span>;
          }
        })}
      </code>
    </pre>
  );
}

/**
 * Copy button component
 */
function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <Check size={14} className="text-green-500" />
      ) : (
        <Copy size={14} className="text-gray-400" />
      )}
    </button>
  );
}

/**
 * Individual step component
 */
function StepItem({
  step,
  isExpanded,
  onToggle,
}: {
  step: ExecutionStep;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const status = getStepStatus(step);
  const icon = getStepIcon(step);

  /**
   * Get step label/description
   */
  const getLabel = (): string => {
    switch (step.type) {
      case 'thinking':
        return step.thinking || 'Thinking...';
      case 'tool_start':
        return `Starting ${step.toolName}...`;
      case 'tool_complete':
        return `${step.toolName} completed${step.durationMs ? ` (${step.durationMs}ms)` : ''}`;
      case 'tool_error':
        return `${step.toolName} failed: ${step.error}`;
      case 'tool_execution':
        return `${step.toolName}${step.durationMs ? ` (${step.durationMs}ms)` : ''}`;
      case 'routing':
        return `Routed to ${step.agentName}`;
      case 'llm_iteration':
        return `Iteration ${step.iteration}${step.maxIterations ? `/${step.maxIterations}` : ''}`;
      case 'preparing':
        return 'Preparing response...';
      case 'responding':
        return 'Sending response...';
      default:
        return 'Unknown step';
    }
  };

  /**
   * Get expandable content
   */
  const getExpandableContent = (): {
    args?: Record<string, unknown>;
    result?: unknown;
    error?: string;
    thinking?: string;
  } | null => {
    switch (step.type) {
      case 'tool_start':
      case 'tool_execution':
        return { args: step.args };
      case 'tool_complete':
        return { args: step.args, result: step.result };
      case 'tool_error':
        return { args: step.args, error: step.error };
      case 'thinking':
        return step.thinking ? { thinking: step.thinking } : null;
      default:
        return null;
    }
  };

  const content = getExpandableContent();
  const hasContent = content && Object.keys(content).length > 0;
  const label = getLabel();

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className={`
          w-full flex items-center gap-2 px-3 py-2 text-left transition-colors
          ${hasContent ? 'hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer' : 'cursor-default'}
        `}
      >
        {/* Expand/Collapse icon */}
        {hasContent && (
          <span className="text-gray-400">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}

        {/* Status icon */}
        <span>{icon}</span>

        {/* Label */}
        <span
          className={`
          text-sm flex-1
          ${status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}
        `}
        >
          {label}
        </span>

        {/* Status badge */}
        <span
          className={`
          text-xs px-2 py-0.5 rounded-full
          ${status === 'running' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}
          ${status === 'completed' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}
          ${status === 'error' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}
          ${status === 'pending' && 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}
        `}
        >
          {status}
        </span>
      </button>

      {/* Expandable content */}
      {isExpanded && hasContent && (
        <div className="px-3 pb-3 pl-9 bg-gray-50 dark:bg-gray-800/30">
          {content.args && (
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Arguments
                </span>
                <CopyButton content={JSON.stringify(content.args, null, 2)} />
              </div>
              <div className="rounded bg-gray-100 dark:bg-gray-900 p-2">
                <JsonSyntaxHighlight data={content.args} />
              </div>
            </div>
          )}

          {content.result !== undefined && content.result !== null && (
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Result</span>
                <CopyButton
                  content={
                    typeof content.result === 'string'
                      ? content.result
                      : JSON.stringify(content.result, null, 2)
                  }
                />
              </div>
              <div className="rounded bg-gray-100 dark:bg-gray-900 p-2">
                <JsonSyntaxHighlight data={content.result} />
              </div>
            </div>
          )}

          {content.error && (
            <div>
              <span className="text-xs font-medium text-red-500 dark:text-red-400">Error</span>
              <div className="rounded bg-red-50 dark:bg-red-900/20 p-2 mt-1">
                <p className="text-sm text-red-700 dark:text-red-300">{content.error}</p>
              </div>
            </div>
          )}

          {content.thinking && (
            <div>
              <span className="text-xs font-medium text-purple-500 dark:text-purple-400">
                Thinking
              </span>
              <div className="rounded bg-purple-50 dark:bg-purple-900/20 p-2 mt-1">
                <p className="text-sm text-purple-700 dark:text-purple-300">{content.thinking}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Displays execution steps in an expandable/collapsible list.
 *
 * Shows tool execution chains with args and results,
 * thinking steps, and routing information.
 *
 * @example
 * ```tsx
 * <ToolInspector steps={executionSteps} autoExpand />
 * ```
 */
export function ToolInspector({ steps, className = '', autoExpand = true }: ToolInspectorProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  /**
   * Toggle step expansion
   */
  const toggleStep = useCallback((index: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  /**
   * Auto-expand new steps when autoExpand is enabled
   */
  useMemo(() => {
    if (autoExpand && steps.length > 0) {
      setExpandedSteps((prev) => {
        const next = new Set(prev);
        // Auto-expand the last step
        next.add(steps.length - 1);
        return next;
      });
    }
  }, [steps.length, autoExpand]);

  if (steps.length === 0) {
    return (
      <div className={className}>
        <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">
          No execution steps yet
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden ${className}`}
    >
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          Execution Steps ({steps.length})
        </h3>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {steps.map((step, index) => (
          <StepItem
            key={`${step.type}-${'iteration' in step ? step.iteration : ''}-${index}`}
            step={step}
            isExpanded={expandedSteps.has(index)}
            onToggle={() => toggleStep(index)}
          />
        ))}
      </div>
    </div>
  );
}
