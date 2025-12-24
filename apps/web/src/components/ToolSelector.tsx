'use client';

import { Check } from 'lucide-react';
import { AVAILABLE_TOOLS } from '@/app/api/lib/sub-agents';
import { cn } from '@/lib/utils';

interface ToolSelectorProps {
  enabledTools: string[];
  onChange: (tools: string[]) => void;
  disabled?: boolean;
  className?: string;
}

export function ToolSelector({
  enabledTools,
  onChange,
  disabled = false,
  className,
}: ToolSelectorProps) {
  const handleToggle = (toolId: string) => {
    if (disabled) {
      return;
    }

    if (enabledTools.includes(toolId)) {
      onChange(enabledTools.filter((id) => id !== toolId));
    } else {
      onChange([...enabledTools, toolId]);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="text-sm font-medium text-foreground">Enabled Tools</div>
      <div className="space-y-2">
        {AVAILABLE_TOOLS.map((tool) => {
          const isEnabled = enabledTools.includes(tool.id);
          return (
            <label
              key={tool.id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer',
                isEnabled
                  ? 'bg-primary/10 border-primary'
                  : 'bg-background border-border hover:bg-muted',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => handleToggle(tool.id)}
                  disabled={disabled}
                  className="peer h-4 w-4 shrink-0 rounded border-border ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                {isEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-0.5">
                <div className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {tool.name}
                </div>
                <div className="text-xs text-muted-foreground">{tool.description}</div>
              </div>
            </label>
          );
        })}
      </div>
      {enabledTools.length === 0 && (
        <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
          No tools enabled. Agent mode requires at least one tool for task execution.
        </div>
      )}
    </div>
  );
}
