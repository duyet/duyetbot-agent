import { AlertCircle, CheckCircle, ChevronDown, ChevronRight, Clock, Loader2 } from 'lucide-react';
import React from 'react';
import { AgentStep } from '@/types';

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

  const statusConfig = {
    success: {
      icon: <CheckCircle className="h-5 w-5 text-success" />,
      bgClass: 'bg-success/10 border-success/20',
    },
    error: {
      icon: <AlertCircle className="h-5 w-5 text-destructive" />,
      bgClass: 'bg-destructive/10 border-destructive/20',
    },
    pending: {
      icon: <Clock className="h-5 w-5 text-muted-foreground" />,
      bgClass: 'bg-muted/50 border-muted',
    },
    running: {
      icon: <Loader2 className="h-5 w-5 text-primary animate-spin" />,
      bgClass: 'bg-primary/10 border-primary/20',
    },
  };

  const { icon: statusIcon, bgClass } = statusConfig[step.status] || statusConfig.pending;

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
          <span className="font-mono">{step.duration}ms</span>
          <span>{step.tokens.toLocaleString()} tokens</span>
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
