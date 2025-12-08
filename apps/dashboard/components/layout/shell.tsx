import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ShellProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

export function Shell({ children, className, title, description }: ShellProps) {
  return (
    <div className={cn('h-full', className)}>
      {(title || description) && (
        <div className="border-b border-border px-6 py-4">
          {title && <h1 className="text-2xl font-bold tracking-tight">{title}</h1>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  );
}
