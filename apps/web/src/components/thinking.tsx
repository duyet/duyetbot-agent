import { Sparkles } from 'lucide-react';

export function ThinkingMessage() {
  return (
    <div className="group/message fade-in w-full animate-in duration-300" data-role="assistant">
      <div className="flex items-start justify-start gap-3">
        {/* Sparkles icon in circle */}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
          <div className="animate-pulse">
            <Sparkles size={14} />
          </div>
        </div>
        {/* Thinking text with bouncing dots */}
        <div className="flex w-full flex-col gap-2 md:gap-4">
          <div className="flex items-center gap-1 p-0 text-sm text-muted-foreground">
            <span className="animate-pulse">Thinking</span>
            <span className="inline-flex">
              <span className="animate-bounce [animation-delay:0ms]">.</span>
              <span className="animate-bounce [animation-delay:150ms]">.</span>
              <span className="animate-bounce [animation-delay:300ms]">.</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
