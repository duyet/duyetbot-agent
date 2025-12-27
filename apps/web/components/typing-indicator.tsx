"use client";

import { cn } from "@/lib/utils";

type TypingIndicatorProps = {
  className?: string;
  variant?: "dots" | "pulse" | "wave";
};

export function TypingIndicator({
  className,
  variant = "dots",
}: TypingIndicatorProps) {
  return (
    <div
      aria-label="AI is typing"
      className={cn("flex items-center gap-1", className)}
    >
      {variant === "dots" && (
        <>
          <span
            className={cn(
              "h-2 w-2 animate-bounce rounded-full bg-muted-foreground",
              "animation-delay-0"
            )}
            style={{ animationDelay: "0ms" }}
          />
          <span
            className={cn(
              "h-2 w-2 animate-bounce rounded-full bg-muted-foreground",
              "animation-delay-150"
            )}
            style={{ animationDelay: "150ms" }}
          />
          <span
            className={cn(
              "h-2 w-2 animate-bounce rounded-full bg-muted-foreground",
              "animation-delay-300"
            )}
            style={{ animationDelay: "300ms" }}
          />
        </>
      )}

      {variant === "pulse" && (
        <>
          <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" />
          <span
            className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground"
            style={{ animationDelay: "300ms" }}
          />
        </>
      )}

      {variant === "wave" && (
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <span
              className="h-3 w-0.5 animate-pulse rounded-full bg-muted-foreground"
              key={i}
              style={{
                animationDelay: `${i * 100}ms`,
                animationDuration: "800ms",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Compact version for inline use
export function CompactTypingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <span
        className="h-1 w-1 animate-ping rounded-full bg-muted-foreground"
        style={{ animationDuration: "600ms" }}
      />
      <span
        className="h-1 w-1 animate-ping rounded-full bg-muted-foreground"
        style={{ animationDelay: "150ms", animationDuration: "600ms" }}
      />
      <span
        className="h-1 w-1 animate-ping rounded-full bg-muted-foreground"
        style={{ animationDelay: "300ms", animationDuration: "600ms" }}
      />
    </div>
  );
}
