import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ShellProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  headerActions?: ReactNode;
  fullWidth?: boolean;
}

export function Shell({
  children,
  className,
  title,
  description,
  headerActions,
  fullWidth = false,
}: ShellProps) {
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {(title || description || headerActions) && (
        <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
          <div className="space-y-1">
            {title && <h1 className="text-xl font-semibold tracking-tight">{title}</h1>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      )}

      <div className={cn('flex-1 overflow-auto', !fullWidth && 'p-6')}>{children}</div>
    </div>
  );
}
