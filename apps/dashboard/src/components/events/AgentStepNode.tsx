import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import React from 'react';
import { AgentStep } from '../../types';

interface AgentStepNodeProps {
  step: AgentStep;
  level: number;
  onToggle?: (stepId: string) => void;
  expanded?: boolean;
}

export const AgentStepNode: React.FC<AgentStepNodeProps> = ({
  step,
  level,
  onToggle,
  expanded = true,
}) => {
  const hasChildren = step.children.length > 0;
  const paddingLeft = `${level * 1.5}rem`;

  const statusIcon = {
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    pending: <Clock className="h-5 w-5 text-yellow-500" />,
    running: <Clock className="h-5 w-5 animate-spin text-blue-500" />,
  }[step.status];

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
        style={{ paddingLeft }}
      >
        {hasChildren && (
          <button
            onClick={() => onToggle?.(step.id)}
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <span className="text-xs">{expanded ? '▼' : '▶'}</span>
          </button>
        )}
        {!hasChildren && <div className="w-5" />}

        <div>{statusIcon}</div>

        <div className="flex-1">
          <p className="font-medium text-gray-900 dark:text-white">{step.name}</p>
          {step.error && (
            <p className="text-xs text-red-600 dark:text-red-400">Error: {step.error}</p>
          )}
        </div>

        <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>{step.duration}ms</span>
          <span>{step.tokens.toLocaleString()} tokens</span>
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {step.children.map((child) => (
            <AgentStepNode
              key={child.id}
              step={child}
              level={level + 1}
              onToggle={onToggle}
              expanded={expanded}
            />
          ))}
        </div>
      )}
    </div>
  );
};
