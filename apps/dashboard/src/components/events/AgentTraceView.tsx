import { Clock, Hash, Zap } from 'lucide-react';
import React from 'react';
import { AgentTrace } from '../../types';
import { AgentStepNode } from './AgentStepNode';
import { ErrorDisplay } from './ErrorDisplay';
import { TokenBreakdown } from './TokenBreakdown';

interface AgentTraceViewProps {
  trace: AgentTrace;
  loading?: boolean;
}

export const AgentTraceView: React.FC<AgentTraceViewProps> = ({ trace, loading = false }) => {
  const [expandedSteps, setExpandedSteps] = React.useState<Set<string>>(
    new Set([trace.rootStep.id])
  );

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Agent Execution Trace</h2>
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-full rounded bg-secondary" />
          ))}
        </div>
      </div>
    );
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
        <Zap className="h-5 w-5 text-primary" />
        Agent Execution Trace
      </h2>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Trace ID
          </p>
          <p className="mt-1 font-mono text-sm font-semibold">{trace.id}</p>
        </div>

        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Total Duration
          </p>
          <p className="mt-1 text-sm font-semibold">{formatDuration(trace.totalDuration)}</p>
        </div>

        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Started
          </p>
          <p className="mt-1 text-sm font-semibold">{formatTime(trace.startTime)}</p>
        </div>
      </div>

      {/* Token breakdown */}
      <div className="mb-6 rounded-lg border border-border bg-secondary/30 p-4">
        <h3 className="mb-4 font-semibold">Token Usage</h3>
        <TokenBreakdown input={trace.rootStep.tokens} output={0} cached={0} />
      </div>

      {/* Trace tree */}
      <div className="mb-6">
        <h3 className="mb-4 font-semibold">Execution Steps</h3>
        <div className="space-y-1 rounded-lg border border-border bg-background p-4">
          <AgentStepNode
            step={trace.rootStep}
            level={0}
            onToggle={toggleStep}
            expanded={expandedSteps.has(trace.rootStep.id)}
          />
        </div>
      </div>

      {/* Error display if any */}
      {trace.rootStep.status === 'error' && trace.rootStep.error && (
        <ErrorDisplay error={trace.rootStep.error} />
      )}
    </div>
  );
};
