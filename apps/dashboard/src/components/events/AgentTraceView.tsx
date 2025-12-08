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
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Agent Execution Trace
        </h2>
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-full rounded bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      </div>
    );
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
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
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Agent Execution Trace
      </h2>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">Trace ID</p>
          <p className="mt-1 font-mono text-sm font-semibold text-gray-900 dark:text-white">
            {trace.id}
          </p>
        </div>

        <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Duration</p>
          <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
            {formatDuration(trace.totalDuration)}
          </p>
        </div>

        <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">Started</p>
          <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
            {formatTime(trace.startTime)}
          </p>
        </div>
      </div>

      {/* Token breakdown */}
      <div className="mb-6 rounded border border-gray-200 p-4 dark:border-gray-700">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Token Usage</h3>
        <TokenBreakdown input={trace.rootStep.tokens} output={0} cached={0} />
      </div>

      {/* Trace tree */}
      <div className="mb-6">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Execution Steps</h3>
        <div className="space-y-1 rounded border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
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
