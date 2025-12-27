"use client";

import type {
  Step,
  StepCollection,
  ToolStartStep,
  ToolCompleteStep,
  ToolErrorStep,
} from "@duyetbot/progress";
import {
  CheckCircle2,
  CircleDashed,
  AlertCircle,
  Loader2,
  Zap,
} from "lucide-react";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { formatDuration } from "@duyetbot/progress";

export type ProgressTrackerProps = ComponentProps<"div"> & {
  /** Step collection to display */
  steps: Step[];
  /** Whether to show detailed timing information */
  showTiming?: boolean;
  /** Maximum number of steps to show before truncating */
  maxSteps?: number;
  /** Default open state */
  defaultOpen?: boolean;
};

/**
 * Progress tracker component for displaying agent execution steps.
 * Shows tool executions, timing, and status indicators.
 */
export const ProgressTracker = ({
  steps,
  showTiming = true,
  maxSteps = 20,
  defaultOpen = false,
  className,
  ...props
}: ProgressTrackerProps) => {
  // Group steps by iteration for cleaner display
  const groupedSteps = useMemo(() => {
    const groups: Record<number, Step[]> = {};
    for (const step of steps.slice(0, maxSteps)) {
      const iter = step.iteration;
      if (!groups[iter]) {
        groups[iter] = [];
      }
      groups[iter].push(step);
    }
    return groups;
  }, [steps, maxSteps]);

  const stepCount = steps.length;
  const truncatedCount = Math.max(0, steps.length - maxSteps);

  return (
    <Collapsible defaultOpen={defaultOpen} className={cn("w-full", className)}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-muted/50"
        >
          <span className="font-medium">Execution Progress</span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {stepCount} {stepCount === 1 ? "step" : "steps"}
            </Badge>
            {truncatedCount > 0 && (
              <span className="text-muted-foreground">
                (+{truncatedCount} more)
              </span>
            )}
          </div>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2 space-y-3">
        {Object.entries(groupedSteps).map(([iteration, iterSteps]) => (
          <IterationGroup
            key={iteration}
            iteration={Number(iteration)}
            steps={iterSteps}
            showTiming={showTiming}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

type IterationGroupProps = {
  iteration: number;
  steps: Step[];
  showTiming: boolean;
};

const IterationGroup = ({
  iteration,
  steps,
  showTiming,
}: IterationGroupProps) => {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-xs text-muted-foreground">
          Iteration {iteration}
        </span>
        {showTiming && (
          <span className="text-muted-foreground text-xs">
            {formatDuration(
              steps.reduce((acc, s) => acc + s.durationMs, 0)
            )}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {steps.map((step, idx) => (
          <StepItem key={idx} step={step} showTiming={showTiming} />
        ))}
      </div>
    </div>
  );
};

type StepItemProps = {
  step: Step;
  showTiming: boolean;
};

const StepItem = ({ step, showTiming }: StepItemProps) => {
  const { icon, label, description, status } = useMemo(() => {
    switch (step.type) {
      case "thinking":
        return {
          icon: <Zap className="size-3.5 text-blue-500" />,
          label: "Thinking",
          description: step.thinking,
          status: "running",
        };
      case "tool_start":
        return {
          icon: <Loader2 className="size-3.5 animate-spin text-yellow-500" />,
          label: `Running ${step.toolName}`,
          description: formatToolArgs(step.args),
          status: "running",
        };
      case "tool_complete":
        return {
          icon: <CheckCircle2 className="size-3.5 text-green-500" />,
          label: `Completed ${step.toolName}`,
          description: formatToolResultSummary(step.result),
          status: "completed",
        };
      case "tool_error":
        return {
          icon: <AlertCircle className="size-3.5 text-red-500" />,
          label: `Error in ${step.toolName}`,
          description: step.error,
          status: "error",
        };
      case "routing":
        return {
          icon: <CircleDashed className="size-3.5 text-purple-500" />,
          label: `Routing to ${step.agentName}`,
          description: undefined,
          status: "running",
        };
      case "llm_iteration":
        return {
          icon: <Zap className="size-3.5 text-blue-500" />,
          label: `LLM Iteration ${step.iteration}/${step.maxIterations}`,
          description: undefined,
          status: "running",
        };
      case "preparing":
        return {
          icon: <Loader2 className="size-3.5 animate-spin text-muted-foreground" />,
          label: "Preparing",
          description: undefined,
          status: "running",
        };
      case "parallel_tools":
        return {
          icon: <Loader2 className="size-3.5 animate-spin text-yellow-500" />,
          label: `Running ${step.tools.length} tools in parallel`,
          description: step.tools.map((t) => t.toolName).join(", "),
          status: "running",
        };
      case "subagent":
        return {
          icon: step.status === "completed"
            ? <CheckCircle2 className="size-3.5 text-green-500" />
            : step.status === "error"
              ? <AlertCircle className="size-3.5 text-red-500" />
              : <Loader2 className="size-3.5 animate-spin text-yellow-500" />,
          label: `${step.agentName} sub-agent`,
          description: step.description,
          status: step.status,
        };
      default:
        return {
          icon: <CircleDashed className="size-3.5 text-muted-foreground" />,
          label: "Unknown step",
          description: undefined,
          status: "running",
        };
    }
  }, [step]);

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
        status === "error" && "bg-destructive/10",
        status === "completed" && "bg-green-500/5"
      )}
    >
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          {showTiming && step.durationMs > 0 && (
            <span className="text-muted-foreground">
              {formatDuration(step.durationMs)}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 line-clamp-2 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * Format tool arguments for compact display
 */
function formatToolArgs(args: Record<string, unknown>): string {
  const priorityKeys = [
    "query",
    "search",
    "q",
    "url",
    "link",
    "prompt",
    "question",
    "text",
    "path",
  ];

  for (const key of priorityKeys) {
    if (args[key] !== undefined) {
      const value = String(args[key]);
      return value.length > 60 ? `${value.slice(0, 60)}...` : value;
    }
  }

  const firstValue = Object.values(args)[0];
  if (firstValue) {
    const str = String(firstValue);
    return str.length > 60 ? `${str.slice(0, 60)}...` : str;
  }

  return "";
}

/**
 * Format tool result summary
 */
function formatToolResultSummary(result: string): string {
  if (result.length <= 80) {
    return result;
  }
  return `${result.slice(0, 80)}...`;
}
