'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export interface ToggleChipProps extends Omit<ComponentProps<'button'>, 'children'> {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onToggle: () => void;
  variant?: 'default' | 'accent';
}

export function ToggleChip({
  label,
  icon,
  active,
  onToggle,
  variant = 'default',
  className,
  disabled,
  ...props
}: ToggleChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
        'border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        active
          ? variant === 'accent'
            ? 'bg-accent text-accent-foreground border-accent shadow-sm'
            : 'bg-primary text-primary-foreground border-primary shadow-sm'
          : 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted hover:border-border hover:text-foreground',
        className
      )}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}
