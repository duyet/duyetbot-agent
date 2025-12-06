'use client';

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';

interface SimpleTooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom';
}

export function SimpleTooltip({ content, children, position = 'bottom' }: SimpleTooltipProps) {
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setVisible((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      setVisible((prev) => !prev);
    }
    if (e.key === 'Escape') {
      setVisible(false);
    }
  }, []);

  // Auto-dismiss on click outside (mobile)
  useEffect(() => {
    if (!visible) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [visible]);

  const positionClasses =
    position === 'top'
      ? 'bottom-full mb-2 after:top-full after:border-t-fd-card'
      : 'top-full mt-2 after:bottom-full after:border-b-fd-card';

  return (
    <button
      ref={containerRef}
      type="button"
      className="group relative inline-flex cursor-help appearance-none border-none bg-transparent p-0"
      data-tooltip={content}
      onClick={handleClick}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onKeyDown={handleKeyDown}
      aria-label="Show technical details"
      aria-describedby={visible ? 'tooltip-content' : undefined}
    >
      <span>{children}</span>

      {visible && (
        <span
          id="tooltip-content"
          role="tooltip"
          className={`absolute left-1/2 z-50 max-w-[250px] -translate-x-1/2 rounded-md border border-fd-border bg-fd-card px-3 py-2 text-xs text-fd-muted-foreground shadow-md after:absolute after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent ${positionClasses}`}
        >
          {content}
        </span>
      )}
    </button>
  );
}
