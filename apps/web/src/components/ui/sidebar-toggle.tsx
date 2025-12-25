'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { useSidebar } from './sidebar-provider';

interface SidebarToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Icon size in pixels
   * @default 16
   */
  iconSize?: number;
  /**
   * Additional class name for the button
   */
  className?: string;
}

const SidebarToggle = React.forwardRef<HTMLButtonElement, SidebarToggleProps>(
  ({ className, iconSize = 16, ...props }, ref) => {
    const { toggle, isOpen } = useSidebar();

    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon-sm"
        className={cn('h-7 w-7', className)}
        onClick={toggle}
        aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
        aria-pressed={isOpen}
        {...props}
      >
        {isOpen ? <PanelLeftClose size={iconSize} /> : <PanelLeftOpen size={iconSize} />}
      </Button>
    );
  }
);
SidebarToggle.displayName = 'SidebarToggle';

interface SidebarTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Icon size in pixels
   * @default 16
   */
  iconSize?: number;
  /**
   * Additional class name for the button
   */
  className?: string;
}

const SidebarTrigger = React.forwardRef<HTMLButtonElement, SidebarTriggerProps>(
  ({ className, iconSize = 16, ...props }, ref) => {
    const { toggle, isOpen } = useSidebar();

    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon-sm"
        className={cn('h-7 w-7', className)}
        onClick={toggle}
        aria-label="Open sidebar"
        aria-pressed={isOpen}
        {...props}
      >
        <PanelLeftOpen size={iconSize} />
      </Button>
    );
  }
);
SidebarTrigger.displayName = 'SidebarTrigger';

interface SidebarCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Icon size in pixels
   * @default 16
   */
  iconSize?: number;
  /**
   * Additional class name for the button
   */
  className?: string;
}

const SidebarClose = React.forwardRef<HTMLButtonElement, SidebarCloseProps>(
  ({ className, iconSize = 16, ...props }, ref) => {
    const { toggle } = useSidebar();

    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon-sm"
        className={cn('h-7 w-7', className)}
        onClick={toggle}
        aria-label="Close sidebar"
        {...props}
      >
        <PanelLeftClose size={iconSize} />
      </Button>
    );
  }
);
SidebarClose.displayName = 'SidebarClose';

export { SidebarToggle, SidebarTrigger, SidebarClose };

export type { SidebarToggleProps, SidebarTriggerProps, SidebarCloseProps };
