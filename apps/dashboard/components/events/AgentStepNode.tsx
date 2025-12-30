import { AlertCircle, CheckCircle, ChevronDown, ChevronRight, Clock, Loader2 } from 'lucide-react';
import React from 'react';
import {
  calculatePaddingLeft,
  formatDuration,
  formatTokenCount,
  getStatusBgClass,
  hasChildren as hasAgentStepChildren,
} from '@/lib/agent-step-utils';
import type { AgentStep } from '@/types';

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
  const hasChildren = hasAgentStepChildren(step);
  const paddingLeft = calculatePaddingLeft(level);

  const statusIcons = {
    success: <CheckCircle className="h-5 w-5 text-success" />,
    error: <AlertCircle className="h-5 w-5 text-destructive" />,
    pending: <Clock className="h-5 w-5 text-muted-foreground" />,
    running: <Loader2 className="h-5 w-5 text-primary animate-spin" />,
  };

  const statusIcon = statusIcons[step.status] ?? statusIcons.pending;
  const bgClass = getStatusBgClass(step.status);

  return (
    <div>
      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-secondary/80 transition-colors border ${bgClass}`}
        style={{ marginLeft: paddingLeft }}
      >
        {hasChildren && (
          <button
            type="button"
            onClick={() => onToggle?.(step.id)}
            className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-secondary transition-colors"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-6" />}

        <div>{statusIcon}</div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{step.name}</p>
          {step.error && (
            <p className="text-xs text-destructive truncate mt-0.5">Error: {step.error}</p>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-mono">{formatDuration(step.duration)}</span>
          <span>{formatTokenCount(step.tokens)} tokens</span>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="mt-1 space-y-1">
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
