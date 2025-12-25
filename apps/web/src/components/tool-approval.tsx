import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ToolApprovalProps {
  approvalId: string;
  onApprove: (id: string, approved: boolean, reason?: string) => void;
  disabled?: boolean;
  className?: string;
}

export const ToolApproval = React.forwardRef<HTMLDivElement, ToolApprovalProps>(
  ({ approvalId, onApprove, disabled = false, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-end gap-2 border-t px-4 py-3', className)}
      >
        <Button
          type="button"
          variant="ghost"
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => onApprove(approvalId, false)}
          disabled={disabled}
        >
          Deny
        </Button>
        <Button
          type="button"
          variant="default"
          className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
          onClick={() => onApprove(approvalId, true)}
          disabled={disabled}
        >
          Allow
        </Button>
      </div>
    );
  }
);

ToolApproval.displayName = 'ToolApproval';
