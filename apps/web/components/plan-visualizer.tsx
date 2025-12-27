"use client";

import {
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleIcon,
  ClockIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type PlanStep = {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "completed" | "blocked";
  dependencies: string[];
  complexity: "low" | "medium" | "high";
};

export type PlanData = {
  task: string;
  context?: string;
  steps: PlanStep[];
  metadata: {
    totalSteps: number;
    completedSteps: number;
    estimatedEffort: number;
    createdAt: string;
  };
  suggestion?: string;
};

export interface PlanVisualizerProps extends ComponentProps<"div"> {
  data: PlanData;
}

const getStatusIcon = (status: PlanStep["status"]) => {
  switch (status) {
    case "completed":
      return <CheckCircle2Icon className="size-4 text-green-500" />;
    case "in-progress":
      return <ClockIcon className="size-4 animate-pulse text-blue-500" />;
    case "blocked":
      return <CircleIcon className="size-4 fill-red-500 text-red-500" />;
    default:
      return <CircleIcon className="size-4 text-muted-foreground" />;
  }
};

const getComplexityColor = (complexity: PlanStep["complexity"]) => {
  switch (complexity) {
    case "low":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "medium":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    case "high":
      return "bg-red-500/10 text-red-500 border-red-500/20";
  }
};

const getComplexityLabel = (complexity: PlanStep["complexity"]) => {
  switch (complexity) {
    case "low":
      return "Simple";
    case "medium":
      return "Moderate";
    case "high":
      return "Complex";
  }
};

export function PlanVisualizer({
  data,
  className,
  ...props
}: PlanVisualizerProps) {
  const { steps, metadata, task, context, suggestion } = data;
  const progress =
    metadata.totalSteps > 0
      ? (metadata.completedSteps / metadata.totalSteps) * 100
      : 0;

  return (
    <div className={cn("w-full", className)} {...props}>
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              <CardTitle className="font-semibold text-base">{task}</CardTitle>
              {context && (
                <CardDescription className="text-sm">{context}</CardDescription>
              )}
            </div>
            <Badge className="shrink-0" variant="outline">
              {steps.length} steps
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Progress</span>
              <span className="font-medium">
                {metadata.completedSteps} of {metadata.totalSteps} completed
              </span>
            </div>
            <Progress className="h-2" value={progress} />
          </div>

          {suggestion && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-muted-foreground text-xs">
              <span className="font-medium">Suggestion:</span> {suggestion}
            </div>
          )}
        </CardHeader>

        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {steps.map((step, index) => (
                <StepCard index={index} key={step.id} step={step} />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

type StepCardProps = {
  step: PlanStep;
  index: number;
};

function StepCard({ step, index }: StepCardProps) {
  const isCompleted = step.status === "completed";
  const isInProgress = step.status === "in-progress";
  const isBlocked = step.status === "blocked";

  return (
    <div
      className={cn(
        "group relative rounded-lg border p-3 transition-all hover:shadow-md",
        isCompleted && "border-green-500/20 bg-green-500/5",
        isInProgress && "border-blue-500/20 bg-blue-500/5",
        isBlocked && "border-red-500/20 bg-red-500/5",
        !isCompleted &&
          !isInProgress &&
          !isBlocked &&
          "border-border/50 bg-muted/30"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 items-center justify-center">
          {getStatusIcon(step.status)}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground text-xs">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <ChevronRightIcon className="size-3 text-muted-foreground" />
                <h4 className="font-medium text-sm">{step.title}</h4>
              </div>

              {step.dependencies.length > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <span>Dependencies:</span>
                  {step.dependencies.map((dep) => (
                    <Badge className="text-xs" key={dep} variant="secondary">
                      {dep}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Badge
              className={cn(
                "shrink-0 text-xs",
                getComplexityColor(step.complexity)
              )}
              variant="outline"
            >
              {getComplexityLabel(step.complexity)}
            </Badge>
          </div>
        </div>
      </div>

      {step.status === "in-progress" && (
        <div className="absolute right-0 bottom-0 left-0 h-0.5 overflow-hidden rounded-b-lg">
          <div className="h-full w-full animate-progress bg-blue-500/50" />
        </div>
      )}
    </div>
  );
}
