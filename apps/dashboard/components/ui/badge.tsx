import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Badge Component - Grok/X Style
 *
 * Variants use CSS variables for consistent theming across light/dark modes.
 * Semantic variants (success, warning, error, info) use the design system colors.
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground border-border',
        // Semantic variants using CSS variables
        success: 'border-success/20 bg-success/10 text-success hover:bg-success/20',
        warning: 'border-warning/20 bg-warning/10 text-warning hover:bg-warning/20',
        error: 'border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20',
        info: 'border-info/20 bg-info/10 text-info hover:bg-info/20',
        // Status badges with glow
        'status-online':
          'border-success/30 bg-success/10 text-success shadow-[0_0_8px_hsl(var(--success)/0.3)]',
        'status-offline': 'border-border bg-secondary text-muted-foreground',
        'status-warning':
          'border-warning/30 bg-warning/10 text-warning shadow-[0_0_8px_hsl(var(--warning)/0.3)]',
        'status-error':
          'border-destructive/30 bg-destructive/10 text-destructive shadow-[0_0_8px_hsl(var(--destructive)/0.3)]',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0.5 text-[10px]',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
