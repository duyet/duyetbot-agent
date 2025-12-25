'use client';

import { ArrowDown } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { cn } from '@/lib/utils';

export interface ConversationScrollButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  scrollToBottom?: (behavior?: ScrollBehavior) => void;
}

export function ConversationScrollButton({
  className,
  scrollToBottom: propsScrollToBottom,
  ...props
}: ConversationScrollButtonProps) {
  const { isAtBottom, scrollToBottom: hookScrollToBottom } = useScrollToBottom();

  const scrollToBottom = propsScrollToBottom || hookScrollToBottom;

  if (isAtBottom) {
    return null;
  }

  return (
    <button
      className={cn(
        '-translate-x-1/2 absolute bottom-4 left-1/2 z-10 rounded-full shadow-lg',
        'border border-input bg-background p-2 hover:bg-muted',
        'transition-all',
        className
      )}
      onClick={() => scrollToBottom?.('smooth')}
      type="button"
      aria-label="Scroll to bottom"
      {...props}
    >
      <ArrowDown className="size-4" />
    </button>
  );
}
