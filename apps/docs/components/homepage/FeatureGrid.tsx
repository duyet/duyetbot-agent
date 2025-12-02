'use client';

import { FeatureCard } from './FeatureCard';

// Clean SVG icons - Heroicons style, 1.5px stroke
const CompassIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const DatabaseIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
    />
  </svg>
);

const PlugIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
    />
  </svg>
);

const ShieldIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
    />
  </svg>
);

const features = [
  {
    number: '01',
    title: 'Smart Routing',
    description: 'Pattern matching + LLM fallback',
    icon: <CompassIcon />,
    href: '/docs/concepts/router-agent',
    technicalDetails:
      'Hybrid classifier: regex patterns (fast) + Claude fallback (accurate). 80% token savings, <50ms pattern matches, ~$0.001/request.',
  },
  {
    number: '02',
    title: 'Durable State',
    description: 'Persistent conversations with Durable Objects',
    icon: <DatabaseIcon />,
    href: '/docs/concepts/do-patterns',
    technicalDetails:
      'Durable Objects store conversation history. Auto-scale, zero cold starts, global replicas. JSON serialization, 1GB storage per DO.',
  },
  {
    number: '03',
    title: 'Multi-Platform',
    description: 'Telegram, GitHub, Slack - one codebase',
    icon: <PlugIcon />,
    href: '/docs/guides/telegram-bot',
    technicalDetails:
      'Transport abstraction layer (~50 lines). One agent, multiple platform adapters. Consistent message routing, context preservation.',
  },
  {
    number: '04',
    title: 'Human-in-Loop',
    description: 'Approval workflows for sensitive operations',
    icon: <ShieldIcon />,
    href: '/docs/concepts/hitl-integration',
    technicalDetails:
      'Pauses execution on sensitive tools. User approval via platform UI. Audit trail, rollback support. Implements security gates.',
  },
] as const;

export function FeatureGrid() {
  return (
    <section className="py-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-fd-foreground mb-1">Built for Production</h2>
        <p className="text-sm text-fd-muted-foreground">
          Enterprise-grade agent patterns on Cloudflare&apos;s edge network
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {features.map((feature) => (
          <FeatureCard key={feature.number} {...feature} />
        ))}
      </div>
    </section>
  );
}
