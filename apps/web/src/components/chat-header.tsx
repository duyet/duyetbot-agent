'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { SidebarToggle } from '@/components/ui/sidebar-toggle';
import { VisibilitySelector, type VisibilityType } from '@/components/visibility-selector';

interface ChatHeaderProps {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly?: boolean;
  className?: string;
}

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly = false,
  className,
}: ChatHeaderProps) {
  const router = useRouter();

  const handleNewChat = () => {
    router.push('/');
    router.refresh();
  };

  return (
    <header className={className}>
      <SidebarToggle />

      <Button
        variant="outline"
        size="sm"
        onClick={handleNewChat}
        className="ml-auto gap-2 h-8 px-2.5 md:h-8 md:px-3"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden md:inline">New chat</span>
      </Button>

      {!isReadonly && (
        <VisibilitySelector
          chatId={chatId}
          selectedVisibilityType={selectedVisibilityType}
          className="shrink-0"
        />
      )}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});

ChatHeader.displayName = 'ChatHeader';
