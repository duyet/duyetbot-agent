"use client";

import { cn } from "@/lib/utils";

// Token usage statistics for a message or session
export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  // Optional cost calculation (in USD)
  cost?: number;
};

// Estimate tokens (rough approximation: 1 token ≈ 4 characters for English text)
export function estimateTokens(text: string): number {
  // Remove whitespace and count characters
  const cleanText = text.replace(/\s+/g, " ").trim();
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(cleanText.length / 4);
}

// Format token count for display
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

type TokenUsageDisplayProps = {
  usage: TokenUsage;
  className?: string;
  variant?: "compact" | "full" | "inline";
  showCost?: boolean;
};

export function TokenUsageDisplay({
  usage,
  className,
  variant = "compact",
  showCost = false,
}: TokenUsageDisplayProps) {
  const { promptTokens, completionTokens, totalTokens, cost } = usage;

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-muted-foreground text-xs",
          className
        )}
      >
        <span>{formatTokenCount(totalTokens)} tokens</span>
        {showCost && cost !== undefined && <span>· ${cost.toFixed(4)}</span>}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 text-muted-foreground text-xs",
          className
        )}
      >
        <span title="Prompt tokens">{formatTokenCount(promptTokens)} in</span>
        <span className="text-border">·</span>
        <span title="Completion tokens">
          {formatTokenCount(completionTokens)} out
        </span>
        <span className="text-border">·</span>
        <span className="font-medium text-foreground" title="Total tokens">
          {formatTokenCount(totalTokens)} total
        </span>
        {showCost && cost !== undefined && (
          <>
            <span className="text-border">·</span>
            <span title="Estimated cost">${cost.toFixed(4)}</span>
          </>
        )}
      </div>
    );
  }

  // Full variant with detailed breakdown
  return (
    <div className={cn("rounded-lg border bg-muted/50 p-3", className)}>
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Token Usage</h4>
        {showCost && cost !== undefined && (
          <span className="font-medium text-foreground text-sm">
            ${cost.toFixed(4)}
          </span>
        )}
      </div>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Prompt</span>
          <span className="font-medium font-mono">
            {formatTokenCount(promptTokens)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Completion</span>
          <span className="font-medium font-mono">
            {formatTokenCount(completionTokens)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t pt-2">
          <span className="font-medium text-sm">Total</span>
          <span className="font-bold font-mono text-sm">
            {formatTokenCount(totalTokens)}
          </span>
        </div>
      </div>

      {/* Visual bar representation */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{
            width: `${(completionTokens / totalTokens) * 100}%`,
          }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>Prompt</span>
        <span>Completion</span>
      </div>
    </div>
  );
}

// Aggregate token usage across multiple messages
export function aggregateTokenUsage(usages: TokenUsage[]): TokenUsage {
  return usages.reduce(
    (acc, usage) => ({
      promptTokens: acc.promptTokens + usage.promptTokens,
      completionTokens: acc.completionTokens + usage.completionTokens,
      totalTokens: acc.totalTokens + usage.totalTokens,
      cost: acc.cost && usage.cost ? acc.cost + usage.cost : undefined,
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  );
}

// Calculate cost based on model pricing (example rates, should be configurable)
export function calculateCost(
  usage: TokenUsage,
  _model: string,
  inputPricePer1k = 0.0005, // Default: $0.0005 per 1K input tokens
  outputPricePer1k = 0.0015 // Default: $0.0015 per 1K output tokens
): TokenUsage {
  const inputCost = (usage.promptTokens / 1000) * inputPricePer1k;
  const outputCost = (usage.completionTokens / 1000) * outputPricePer1k;

  return {
    ...usage,
    cost: inputCost + outputCost,
  };
}
