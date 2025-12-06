'use client';

import { useState } from 'react';

interface ValuePropositionProps {
  className?: string;
}

export function ValueProposition({ className = '' }: ValuePropositionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={className}>
      {/* Headline */}
      <h2 className="text-2xl font-semibold tracking-tight text-fd-foreground sm:text-3xl">
        You are absolutely right!
      </h2>

      {/* Subheadline */}
      <p className="mt-3 text-base text-fd-muted-foreground sm:text-lg">
        Multi-platform bots with durable state and tool orchestration
      </p>

      {/* Learn More button */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls="tech-specs"
        className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-fd-primary transition-colors hover:text-fd-primary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2"
      >
        <span>{expanded ? 'Hide Details' : 'Learn More'}</span>
        <svg
          className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable technical details */}
      {expanded && (
        <section
          id="tech-specs"
          className="mt-6 rounded-lg border border-fd-border bg-fd-card p-4 sm:p-6"
          aria-label="Technical specifications"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider text-fd-muted-foreground">
            Technical Specs
          </h3>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TechSpec label="Token Savings" value="80%" description="on pattern-matched requests" />
            <TechSpec label="Latency" value="<50ms" description="for edge routing" />
            <TechSpec label="Platforms" value="4+" description="Telegram, GitHub, Slack, CLI" />
            <TechSpec label="State" value="Persistent" description="with Durable Objects" />
            <TechSpec label="Tools" value="5+" description="Bash, Git, Search, MCP, Custom" />
          </dl>
        </section>
      )}
    </div>
  );
}

interface TechSpecProps {
  label: string;
  value: string;
  description: string;
}

function TechSpec({ label, value, description }: TechSpecProps) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-medium text-fd-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-fd-foreground">{value}</dd>
      <dd className="text-xs text-fd-muted-foreground">{description}</dd>
    </div>
  );
}
