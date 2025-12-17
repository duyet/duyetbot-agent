'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

interface DocsCategoryCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  recommended?: boolean;
  timeEstimate?: string;
  audience?: 'all' | 'beginner' | 'intermediate' | 'advanced';
}

const audienceLabels: Record<string, string> = {
  all: 'All levels',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export function DocsCategoryCard({
  icon,
  title,
  description,
  href,
  recommended,
  timeEstimate,
  audience,
}: DocsCategoryCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex h-full flex-col overflow-visible rounded-xl p-5 transition-all hatched-shadow"
      style={{ '--hatch-color': '#f38020' } as React.CSSProperties}
    >
      
      {recommended && (
        <span className="absolute top-3 right-3 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#f38020]/10 text-[#f38020] border border-[#f38020]/20">
          Recommended
        </span>
      )}

      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-fd-border bg-fd-muted/50 group-hover:border-[#f38020]/30 group-hover:bg-[#f38020]/5 transition-colors text-fd-foreground group-hover:text-[#f38020]">
        {icon}
      </div>

      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <h3 className="text-base font-bold text-fd-foreground group-hover:text-[#f38020] transition-colors flex items-center gap-2">
          {title}
          <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </h3>
        <p className="text-sm text-fd-muted-foreground leading-relaxed">{description}</p>
        
        {(timeEstimate || audience) && (
          <div className="mt-auto pt-4 flex items-center gap-3 text-xs font-mono text-fd-muted-foreground/80">
            {timeEstimate && (
              <span className="flex items-center gap-1.5">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {timeEstimate}
              </span>
            )}
            {audience && (
              <span className={`px-1.5 py-0.5 rounded border ${
                audience === 'beginner' ? 'border-green-200 bg-green-50 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400' :
                audience === 'advanced' ? 'border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' :
                'border-fd-border bg-fd-muted'
              }`}>
                {audienceLabels[audience]}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
