"use client";

import { CheckCircle2Icon, CircleIcon, Loader2Icon } from "lucide-react";
import type { ComponentProps } from "react";
import { memo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Shimmer } from "./ai-elements/shimmer";

/**
 * Plan display component for tool-plan parts.
 *
 * Displays a structured plan with steps that can be in different states:
 * - pending: Not started yet
 * - in-progress: Currently executing
 * - complete: Finished successfully
 * - error: Failed with error message
 *
 * Features:
 * - Visual status indicators for each step
 * - Streaming support for active plans
 * - Collapsible view for large plans
 * - Error display with details
 */

export type PlanStep = {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in-progress" | "complete" | "error";
  error?: string;
};

export type PlanDisplayProps = ComponentProps<typeof Card> & {
  plan: {
    title?: string;
    description?: string;
    steps: PlanStep[];
  };
  isStreaming?: boolean;
};

const statusIcons = {
  pending: CircleIcon,
  "in-progress": Loader2Icon,
  complete: CheckCircle2Icon,
  error: CircleIcon,
};

const statusColors = {
  pending: "text-muted-foreground",
  "in-progress": "text-primary animate-spin",
  complete: "text-green-500",
  error: "text-red-500",
};

export const PlanDisplay = memo(
  ({ plan, isStreaming = false, className, ...props }: PlanDisplayProps) => {
    const completedSteps = plan.steps.filter(
      (s) => s.status === "complete"
    ).length;
    const totalSteps = plan.steps.length;
    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    return (
      <Card
        className={cn("border-border/50 shadow-none", className)}
        data-testid="plan-display"
        {...props}
      >
        {(plan.title || plan.description) && (
          <CardHeader className="pb-3">
            {plan.title && (
              <CardTitle className="flex items-center justify-between">
                <span>
                  {isStreaming ? (
                    <Shimmer>{plan.title}</Shimmer>
                  ) : (
                    plan.title
                  )}
                </span>
                {totalSteps > 0 && (
                  <span className="text-muted-foreground text-xs font-normal">
                    {completedSteps}/{totalSteps}
                  </span>
                )}
              </CardTitle>
            )}
            {plan.description && (
              <CardDescription>
                {isStreaming ? (
                  <Shimmer>{plan.description}</Shimmer>
                ) : (
                  plan.description
                )}
              </CardDescription>
            )}
          </CardHeader>
        )}
        <CardContent className="space-y-2">
          {/* Progress bar */}
          {totalSteps > 0 && (
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {/* Steps */}
          <div className="space-y-1.5">
            {plan.steps.map((step) => {
              const StatusIcon = statusIcons[step.status];
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    step.status === "error" && "bg-red-50 dark:bg-red-950/20",
                    step.status === "complete" && "text-muted-foreground"
                  )}
                >
                  <StatusIcon
                    className={cn(
                      "size-4 shrink-0 mt-0.5",
                      statusColors[step.status]
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{step.title}</div>
                    {step.description && (
                      <div className="text-muted-foreground text-xs">
                        {step.description}
                      </div>
                    )}
                    {step.error && (
                      <div className="text-red-600 dark:text-red-400 text-xs mt-1">
                        {step.error}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }
);

PlanDisplay.displayName = "PlanDisplay";
