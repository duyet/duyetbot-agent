'use client';

import { Eye, Globe, Lock } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export type VisibilityType = 'private' | 'public';

interface VisibilitySelectorProps {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  className?: string;
}

const visibilityOptions = [
  {
    value: 'private' as VisibilityType,
    label: 'Private',
    description: 'Only you can see this chat',
    icon: Lock,
  },
  {
    value: 'public' as VisibilityType,
    label: 'Public',
    description: 'Anyone with the link can see this chat',
    icon: Globe,
  },
];

function PureVisibilitySelector({
  chatId,
  selectedVisibilityType,
  className,
}: VisibilitySelectorProps) {
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [currentVisibility, setCurrentVisibility] = React.useState(selectedVisibilityType);

  // Sync with prop changes
  React.useEffect(() => {
    setCurrentVisibility(selectedVisibilityType);
  }, [selectedVisibilityType]);

  const handleVisibilityChange = async (newVisibility: VisibilityType) => {
    if (newVisibility === currentVisibility || isUpdating) {
      return;
    }

    setIsUpdating(true);

    try {
      const response = await fetch(`/api/v1/history/${chatId}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({
          error: 'Failed to update visibility',
        }))) as { error?: string };
        throw new Error(errorData.error || 'Failed to update visibility');
      }

      setCurrentVisibility(newVisibility);

      // Invalidate SWR cache for history
      if (typeof window !== 'undefined' && 'mutate' in window) {
        // @ts-expect-error - SWR global mutate
        window.mutate?.('/api/v1/history');
      }
    } catch (err) {
      // Log error but don't show toast - keeping it silent for now
      console.error('Failed to update visibility:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const selectedOption = visibilityOptions.find((o) => o.value === currentVisibility);
  const Icon = selectedOption?.icon || Eye;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 gap-1.5 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground',
            className
          )}
          disabled={isUpdating}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden md:inline">{selectedOption?.label}</span>
          {isUpdating && (
            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {visibilityOptions.map((option) => {
          const OptionIcon = option.icon;
          const isSelected = option.value === currentVisibility;

          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => void handleVisibilityChange(option.value)}
              className="flex flex-col items-start gap-1 px-3 py-2"
            >
              <div className="flex items-center gap-2 w-full">
                <OptionIcon className="h-4 w-4 shrink-0" />
                <span className="font-medium">{option.label}</span>
                {isSelected && (
                  <span className="ml-auto flex h-4 w-4 items-center justify-center">
                    <Eye className="h-3 w-3" />
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground ml-6">{option.description}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const VisibilitySelector = React.memo(PureVisibilitySelector, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType
  );
});

VisibilitySelector.displayName = 'VisibilitySelector';
