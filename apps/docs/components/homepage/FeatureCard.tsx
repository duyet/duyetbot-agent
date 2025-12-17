'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { SimpleTooltip } from './SimpleTooltip';

const InfoIcon = ({ className }: { className: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

interface FeatureCardProps {
  number: string;
  title: string;
  description: string;
  icon: ReactNode;
  href: string;
  technicalDetails?: string;
}

export function FeatureCard({
  number,
  title,
  description,
  icon,
  href,
  technicalDetails,
}: FeatureCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-4 rounded-xl border border-fd-border bg-fd-card p-6 transition-all hover:border-[#f38020] hover:shadow-[4px_4px_0px_0px_rgba(243,128,32,0.1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-[#f38020] bg-[#f38020]/10 px-2 py-1 rounded">
          {number}
        </span>
        <div className="text-fd-muted-foreground group-hover:text-[#f38020] transition-colors p-2 rounded-lg bg-fd-muted/50 group-hover:bg-[#f38020]/10">
          {icon}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-fd-foreground group-hover:text-[#f38020] transition-colors">
            {title}
          </h3>
          {technicalDetails && (
            <SimpleTooltip content={technicalDetails}>
              <InfoIcon className="h-4 w-4 text-fd-muted-foreground/60 hover:text-[#f38020] cursor-help transition-colors" />
            </SimpleTooltip>
          )}
        </div>
        <p className="text-sm text-fd-muted-foreground leading-relaxed">{description}</p>
      </div>

      <div className="mt-auto pt-2 flex items-center gap-1.5 text-xs font-bold text-[#f38020] opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
        Learn more
        <svg
          className="h-3 w-3 transition-transform group-hover:translate-x-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
        </svg>
      </div>
    </Link>
  );
}
