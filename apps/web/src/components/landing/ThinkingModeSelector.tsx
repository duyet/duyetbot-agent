'use client';

import { Brain, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type ThinkingMode = 'quick' | 'normal' | 'extended';

interface ThinkingModeSelectorProps {
  mode: ThinkingMode;
  onModeChange: (mode: ThinkingMode) => void;
  disabled?: boolean;
}

interface ModeConfig {
  id: ThinkingMode;
  icon: React.ReactNode;
  label: string;
  description: string;
}

const modes: ModeConfig[] = [
  {
    id: 'quick',
    icon: <Zap className="size-4" />,
    label: 'Quick',
    description: 'Fast responses',
  },
  {
    id: 'normal',
    icon: <Brain className="size-4" />,
    label: 'Normal',
    description: 'Balanced thinking',
  },
  {
    id: 'extended',
    icon: <Sparkles className="size-4" />,
    label: 'Extended',
    description: 'Deep reasoning',
  },
];

export function ThinkingModeSelector({ mode, onModeChange, disabled }: ThinkingModeSelectorProps) {
  return (
    <TooltipProvider>
      <div className="flex gap-1">
        {modes.map((modeConfig) => (
          <Tooltip key={modeConfig.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                onClick={() => onModeChange(modeConfig.id)}
                className={cn(
                  'transition-colors',
                  mode === modeConfig.id && 'bg-accent text-accent-foreground'
                )}
              >
                {modeConfig.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex flex-col gap-0.5">
                <div className="font-semibold">{modeConfig.label}</div>
                <div className="text-xs opacity-90">{modeConfig.description}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
