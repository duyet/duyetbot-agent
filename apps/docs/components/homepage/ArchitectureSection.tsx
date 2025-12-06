'use client';

import { DiagramNode, DiagramNodeOverlay } from './DiagramNodeOverlay';

export function ArchitectureSection() {
  const diagramNodes: DiagramNode[] = [
    {
      id: 'telegram',
      title: 'Telegram Bot',
      description: 'Real-time chat interface with edge routing',
      href: '/docs/guides/telegram-bot',
      bounds: { x: 15, y: 55, width: 100, height: 38 },
    },
    {
      id: 'github',
      title: 'GitHub Bot',
      description: '@mentions and webhooks',
      href: '/docs/guides/github-bot',
      bounds: { x: 15, y: 115, width: 100, height: 38 },
    },
    {
      id: 'router',
      title: 'Router Agent',
      description: 'Pattern matching + LLM fallback',
      href: '/docs/concepts/router-agent',
      bounds: { x: 400, y: 85, width: 90, height: 50 },
    },
    {
      id: 'simple',
      title: 'Simple Agent',
      description: 'Direct execution',
      href: '/docs/concepts/simple-agent',
      bounds: { x: 505, y: 85, width: 185, height: 32 },
    },
    {
      id: 'bash',
      title: 'Bash Tool',
      description: 'Shell command execution',
      href: '/docs/reference/api',
      bounds: { x: 785, y: 85, width: 80, height: 38 },
    },
  ];

  return (
    <section className="my-12">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-fd-foreground mb-1">System Architecture</h2>
        <p className="text-sm text-fd-muted-foreground">
          Multi-agent system with durable state and tool orchestration
        </p>
      </div>

      {/* Architecture Diagram Container */}
      <div className="relative overflow-hidden rounded-xl border border-fd-border bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4 sm:p-6">
        {/* Dot pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.4] dark:opacity-[0.15]"
          style={{
            backgroundImage: `radial-gradient(circle, #94a3b8 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* Desktop SVG Diagram */}
        <div className="hidden lg:block relative">
          {/* Interactive overlay for diagram nodes */}
          <DiagramNodeOverlay nodes={diagramNodes} viewBox={{ width: 1000, height: 420 }} />
          <svg
            viewBox="0 0 1000 420"
            className="w-full h-auto"
            style={{ minHeight: '380px' }}
            role="img"
            aria-label="Architecture diagram showing multi-agent system with inputs, edge workers, and agent orchestration"
          >
            <defs>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1" />
              </filter>
              <filter id="shadowStrong" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.15" />
              </filter>
              {/* Single consistent arrow marker - smaller and thinner */}
              <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,1 L0,5 L5,3 z" fill="#64748b" fillOpacity="0.6" />
              </marker>
            </defs>

            {/* ==================== LAYER LABELS ==================== */}

            {/* Column labels */}
            <text
              x="55"
              y="45"
              className="text-[9px] font-medium uppercase tracking-wider"
              fill="#94a3b8"
            >
              Inputs
            </text>
            <text
              x="250"
              y="45"
              className="text-[9px] font-medium uppercase tracking-wider"
              fill="#94a3b8"
            >
              Edge
            </text>
            <text
              x="480"
              y="45"
              className="text-[9px] font-medium uppercase tracking-wider"
              fill="#94a3b8"
            >
              Agents
            </text>

            {/* ==================== STRAIGHT LINE CONNECTIONS ==================== */}

            {/* Inputs to Workers - straight lines (4 inputs now) */}
            <line
              x1="115"
              y1="80"
              x2="200"
              y2="130"
              stroke="#64748b"
              strokeWidth="1"
              strokeOpacity="0.5"
              markerEnd="url(#arrow)"
            />
            <line
              x1="115"
              y1="140"
              x2="200"
              y2="150"
              stroke="#64748b"
              strokeWidth="1"
              strokeOpacity="0.5"
              markerEnd="url(#arrow)"
            />
            <line
              x1="115"
              y1="200"
              x2="200"
              y2="170"
              stroke="#64748b"
              strokeWidth="1"
              strokeOpacity="0.5"
              markerEnd="url(#arrow)"
            />
            <line
              x1="115"
              y1="260"
              x2="200"
              y2="190"
              stroke="#64748b"
              strokeWidth="1"
              strokeOpacity="0.5"
              markerEnd="url(#arrow)"
            />

            {/* API Handler to Agents container */}
            <line
              x1="310"
              y1="150"
              x2="390"
              y2="150"
              stroke="#64748b"
              strokeWidth="1"
              strokeOpacity="0.5"
              markerEnd="url(#arrow)"
            />

            {/* Agents (DO) to Tools Pool - single line to pool */}
            <line
              x1="700"
              y1="160"
              x2="760"
              y2="160"
              stroke="#64748b"
              strokeWidth="1"
              strokeOpacity="0.4"
              markerEnd="url(#arrow)"
            />

            {/* ==================== INPUT NODES ==================== */}

            {/* Telegram */}
            <g transform="translate(15, 55)" filter="url(#shadow)">
              <rect
                width="100"
                height="38"
                rx="8"
                className="fill-white dark:fill-slate-800"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="50"
                y="22"
                textAnchor="middle"
                className="text-[10px] font-medium"
                fill="#334155"
              >
                Telegram
              </text>
            </g>

            {/* GitHub */}
            <g transform="translate(15, 115)" filter="url(#shadow)">
              <rect
                width="100"
                height="38"
                rx="8"
                className="fill-white dark:fill-slate-800"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="50"
                y="22"
                textAnchor="middle"
                className="text-[10px] font-medium"
                fill="#334155"
              >
                GitHub
              </text>
            </g>

            {/* CLI */}
            <g transform="translate(15, 175)" filter="url(#shadow)">
              <rect
                width="100"
                height="38"
                rx="8"
                className="fill-white dark:fill-slate-800"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="50"
                y="22"
                textAnchor="middle"
                className="text-[10px] font-medium"
                fill="#334155"
              >
                CLI
              </text>
            </g>

            {/* Scheduler */}
            <g transform="translate(15, 235)" filter="url(#shadow)">
              <rect
                width="100"
                height="38"
                rx="8"
                className="fill-white dark:fill-slate-800"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="50"
                y="22"
                textAnchor="middle"
                className="text-[10px] font-medium"
                fill="#334155"
              >
                Scheduler
              </text>
            </g>

            {/* ==================== API HANDLER NODE ==================== */}
            <g transform="translate(200, 100)" filter="url(#shadow)">
              <rect
                width="110"
                height="100"
                rx="10"
                className="fill-white dark:fill-slate-800"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="55"
                y="35"
                textAnchor="middle"
                className="text-[11px] font-semibold"
                fill="#334155"
              >
                API Handler
              </text>
              <text x="55" y="55" textAnchor="middle" className="text-[9px]" fill="#94a3b8">
                Edge Runtime
              </text>
            </g>

            {/* ==================== AGENTS CONTAINER ==================== */}

            {/* Main agents container */}
            <g transform="translate(390, 55)">
              <rect
                width="310"
                height="250"
                rx="10"
                className="fill-slate-50/50 dark:fill-slate-800/30"
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />

              {/* Cloudflare Workers section */}
              <text
                x="155"
                y="18"
                textAnchor="middle"
                className="text-[8px] font-medium uppercase tracking-wider"
                fill="#94a3b8"
              >
                Cloudflare Workers
              </text>

              {/* Router - compact box */}
              <g transform="translate(10, 30)">
                <rect
                  width="90"
                  height="50"
                  rx="6"
                  className="fill-white dark:fill-slate-800"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x="45"
                  y="30"
                  textAnchor="middle"
                  className="text-[11px] font-semibold"
                  fill="#334155"
                >
                  Router
                </text>
              </g>

              {/* Connection lines from Router to agents */}
              <line
                x1="100"
                y1="45"
                x2="115"
                y2="45"
                stroke="#64748b"
                strokeWidth="1"
                strokeOpacity="0.5"
                markerEnd="url(#arrow)"
              />
              <line
                x1="100"
                y1="55"
                x2="115"
                y2="80"
                stroke="#64748b"
                strokeWidth="1"
                strokeOpacity="0.5"
                markerEnd="url(#arrow)"
              />
              <line
                x1="100"
                y1="65"
                x2="115"
                y2="115"
                stroke="#64748b"
                strokeWidth="1"
                strokeOpacity="0.5"
                markerEnd="url(#arrow)"
              />
              <line
                x1="100"
                y1="75"
                x2="115"
                y2="150"
                stroke="#64748b"
                strokeWidth="1"
                strokeOpacity="0.5"
                markerEnd="url(#arrow)"
              />

              {/* Right column - agents stacked */}
              {/* Simple */}
              <g transform="translate(115, 30)">
                <rect
                  width="185"
                  height="32"
                  rx="6"
                  className="fill-white dark:fill-slate-800"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x="92"
                  y="20"
                  textAnchor="middle"
                  className="text-[10px] font-medium"
                  fill="#334155"
                >
                  Simple
                </text>
              </g>

              {/* Orchestrator */}
              <g transform="translate(115, 68)">
                <rect
                  width="185"
                  height="38"
                  rx="6"
                  className="fill-white dark:fill-slate-800"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x="92"
                  y="16"
                  textAnchor="middle"
                  className="text-[10px] font-medium"
                  fill="#334155"
                >
                  Orchestrator
                </text>
                <text x="92" y="30" textAnchor="middle" className="text-[8px]" fill="#94a3b8">
                  Multi-step Tasks
                </text>
              </g>

              {/* HITL */}
              <g transform="translate(115, 112)">
                <rect
                  width="185"
                  height="38"
                  rx="6"
                  className="fill-white dark:fill-slate-800"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x="92"
                  y="16"
                  textAnchor="middle"
                  className="text-[10px] font-medium"
                  fill="#334155"
                >
                  HITL
                </text>
                <text x="92" y="30" textAnchor="middle" className="text-[8px]" fill="#94a3b8">
                  Human Approval
                </text>
              </g>

              {/* Researcher */}
              <g transform="translate(115, 156)">
                <rect
                  width="185"
                  height="32"
                  rx="6"
                  className="fill-white dark:fill-slate-800"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x="92"
                  y="20"
                  textAnchor="middle"
                  className="text-[10px] font-medium"
                  fill="#334155"
                >
                  Researcher
                </text>
              </g>

              {/* Separator line */}
              <line
                x1="10"
                y1="198"
                x2="300"
                y2="198"
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* Cloudflare Sandbox section */}
              <text
                x="70"
                y="215"
                textAnchor="middle"
                className="text-[8px] font-medium uppercase tracking-wider"
                fill="#94a3b8"
              >
                Sandbox
              </text>

              {/* Claude Code Agent */}
              <g transform="translate(115, 203)">
                <rect
                  width="185"
                  height="38"
                  rx="6"
                  className="fill-white dark:fill-slate-800"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x="92"
                  y="16"
                  textAnchor="middle"
                  className="text-[10px] font-medium"
                  fill="#334155"
                >
                  Claude Code
                </text>
                <text x="92" y="30" textAnchor="middle" className="text-[8px]" fill="#94a3b8">
                  Isolated Runtime
                </text>
              </g>
            </g>

            {/* ==================== TOOLS POOL ==================== */}

            {/* Tools container box */}
            <g transform="translate(760, 55)">
              <rect
                width="130"
                height="250"
                rx="10"
                className="fill-slate-50/50 dark:fill-slate-800/30"
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x="65"
                y="18"
                textAnchor="middle"
                className="text-[8px] font-medium uppercase tracking-wider"
                fill="#94a3b8"
              >
                Tools Pool
              </text>

              {/* Tool nodes inside */}
              <g transform="translate(25, 30)">
                <rect
                  width="80"
                  height="38"
                  rx="6"
                  className="fill-white dark:fill-slate-800"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x="40"
                  y="17"
                  textAnchor="middle"
                  className="text-[10px] font-medium"
                  fill="#334155"
                >
                  Bash
                </text>
                <text x="40" y="30" textAnchor="middle" className="text-[8px]" fill="#94a3b8">
                  Shell
                </text>
              </g>

              <g transform="translate(25, 75)">
                <rect
                  width="80"
                  height="38"
                  rx="6"
                  className="fill-white dark:fill-slate-800"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x="40"
                  y="17"
                  textAnchor="middle"
                  className="text-[10px] font-medium"
                  fill="#334155"
                >
                  Git
                </text>
                <text x="40" y="30" textAnchor="middle" className="text-[8px]" fill="#94a3b8">
                  Version
                </text>
              </g>

              <g transform="translate(25, 120)">
                <rect
                  width="80"
                  height="38"
                  rx="6"
                  className="fill-white dark:fill-slate-800"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x="40"
                  y="17"
                  textAnchor="middle"
                  className="text-[10px] font-medium"
                  fill="#334155"
                >
                  Search
                </text>
                <text x="40" y="30" textAnchor="middle" className="text-[8px]" fill="#94a3b8">
                  Web
                </text>
              </g>

              <g transform="translate(25, 165)">
                <rect
                  width="80"
                  height="38"
                  rx="6"
                  className="fill-white dark:fill-slate-800"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x="40"
                  y="17"
                  textAnchor="middle"
                  className="text-[10px] font-medium"
                  fill="#334155"
                >
                  MCP
                </text>
                <text x="40" y="30" textAnchor="middle" className="text-[8px]" fill="#94a3b8">
                  Protocol
                </text>
              </g>

              <g transform="translate(25, 210)">
                <rect
                  width="80"
                  height="32"
                  rx="6"
                  className="fill-white dark:fill-slate-800"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <text x="40" y="20" textAnchor="middle" className="text-[9px]" fill="#94a3b8">
                  + Custom
                </text>
              </g>
            </g>

            {/* ==================== STORAGE LAYER ==================== */}

            {/* Storage separator line */}
            <line
              x1="50"
              y1="330"
              x2="900"
              y2="330"
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x="475"
              y="348"
              textAnchor="middle"
              className="text-[8px] font-medium uppercase tracking-wider"
              fill="#94a3b8"
            >
              Storage Layer
            </text>

            {/* Storage nodes - 5 items evenly distributed */}
            <g transform="translate(50, 355)" filter="url(#shadow)">
              <rect
                width="80"
                height="50"
                rx="8"
                className="fill-slate-50 dark:fill-slate-800"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="40"
                y="22"
                textAnchor="middle"
                className="text-[10px] font-semibold"
                fill="#334155"
              >
                D1
              </text>
              <text x="40" y="38" textAnchor="middle" className="text-[8px]" fill="#94a3b8">
                SQLite
              </text>
            </g>

            <g transform="translate(180, 355)" filter="url(#shadow)">
              <rect
                width="80"
                height="50"
                rx="8"
                className="fill-slate-50 dark:fill-slate-800"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="40"
                y="22"
                textAnchor="middle"
                className="text-[10px] font-semibold"
                fill="#334155"
              >
                KV
              </text>
              <text x="40" y="38" textAnchor="middle" className="text-[8px]" fill="#94a3b8">
                Key-Value
              </text>
            </g>

            <g transform="translate(310, 355)" filter="url(#shadow)">
              <rect
                width="80"
                height="50"
                rx="8"
                className="fill-slate-50 dark:fill-slate-800"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="40"
                y="22"
                textAnchor="middle"
                className="text-[10px] font-semibold"
                fill="#334155"
              >
                R2
              </text>
              <text x="40" y="38" textAnchor="middle" className="text-[8px]" fill="#94a3b8">
                Objects
              </text>
            </g>

            <g transform="translate(440, 355)" filter="url(#shadow)">
              <rect
                width="90"
                height="50"
                rx="8"
                className="fill-slate-50 dark:fill-slate-800"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="45"
                y="22"
                textAnchor="middle"
                className="text-[10px] font-semibold"
                fill="#334155"
              >
                Vectorize
              </text>
              <text x="45" y="38" textAnchor="middle" className="text-[8px]" fill="#94a3b8">
                Embeddings
              </text>
            </g>

            <g transform="translate(580, 355)" filter="url(#shadow)">
              <rect
                width="110"
                height="50"
                rx="8"
                className="fill-slate-50 dark:fill-slate-800"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="55"
                y="22"
                textAnchor="middle"
                className="text-[10px] font-semibold"
                fill="#334155"
              >
                Observability
              </text>
              <text x="55" y="38" textAnchor="middle" className="text-[8px]" fill="#94a3b8">
                Logs & Traces
              </text>
            </g>
          </svg>
        </div>

        {/* Tablet Layout */}
        <div className="hidden md:block lg:hidden relative">
          <svg
            viewBox="0 0 650 380"
            className="w-full h-auto"
            style={{ minHeight: '340px' }}
            role="img"
            aria-label="Architecture diagram - tablet view"
          >
            <defs>
              <filter id="shadowTab" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.08" />
              </filter>
              <marker
                id="arrowTab"
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L0,6 L6,3 z" fill="#64748b" fillOpacity="0.5" />
              </marker>
            </defs>

            {/* Labels */}
            <text
              x="50"
              y="22"
              className="text-[9px] font-semibold uppercase tracking-wider"
              fill="#64748b"
            >
              Inputs
            </text>
            <text
              x="175"
              y="22"
              className="text-[9px] font-semibold uppercase tracking-wider"
              fill="#64748b"
            >
              Edge
            </text>
            <text
              x="420"
              y="22"
              className="text-[9px] font-semibold uppercase tracking-wider"
              fill="#64748b"
            >
              Agents (DO)
            </text>

            {/* Straight line connections */}
            <line
              x1="95"
              y1="50"
              x2="160"
              y2="85"
              stroke="#64748b"
              strokeWidth="1"
              strokeOpacity="0.5"
              markerEnd="url(#arrowTab)"
            />
            <line
              x1="95"
              y1="95"
              x2="160"
              y2="100"
              stroke="#64748b"
              strokeWidth="1"
              strokeOpacity="0.5"
              markerEnd="url(#arrowTab)"
            />
            <line
              x1="95"
              y1="140"
              x2="160"
              y2="115"
              stroke="#64748b"
              strokeWidth="1"
              strokeOpacity="0.5"
              markerEnd="url(#arrowTab)"
            />
            <line
              x1="95"
              y1="185"
              x2="160"
              y2="130"
              stroke="#64748b"
              strokeWidth="1"
              strokeOpacity="0.5"
              markerEnd="url(#arrowTab)"
            />
            <line
              x1="260"
              y1="100"
              x2="285"
              y2="100"
              stroke="#64748b"
              strokeWidth="1"
              strokeOpacity="0.5"
              markerEnd="url(#arrowTab)"
            />

            {/* Input Nodes */}
            <g transform="translate(15, 30)" filter="url(#shadowTab)">
              <rect
                width="80"
                height="38"
                rx="6"
                className="fill-white dark:fill-slate-800"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="40"
                y="24"
                textAnchor="middle"
                className="text-[9px] font-medium"
                fill="#334155"
              >
                Telegram
              </text>
            </g>
            <g transform="translate(15, 75)" filter="url(#shadowTab)">
              <rect
                width="80"
                height="38"
                rx="6"
                className="fill-white dark:fill-slate-800"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="40"
                y="24"
                textAnchor="middle"
                className="text-[9px] font-medium"
                fill="#334155"
              >
                GitHub
              </text>
            </g>
            <g transform="translate(15, 120)" filter="url(#shadowTab)">
              <rect
                width="80"
                height="38"
                rx="6"
                className="fill-white dark:fill-slate-800"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="40"
                y="24"
                textAnchor="middle"
                className="text-[9px] font-medium"
                fill="#334155"
              >
                CLI
              </text>
            </g>
            <g transform="translate(15, 165)" filter="url(#shadowTab)">
              <rect
                width="80"
                height="38"
                rx="6"
                className="fill-white dark:fill-slate-800"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="40"
                y="24"
                textAnchor="middle"
                className="text-[9px] font-medium"
                fill="#334155"
              >
                Scheduler
              </text>
            </g>

            {/* API Handler */}
            <g transform="translate(160, 60)" filter="url(#shadowTab)">
              <rect
                width="100"
                height="80"
                rx="8"
                className="fill-white dark:fill-slate-800"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="50"
                y="35"
                textAnchor="middle"
                className="text-[10px] font-semibold"
                fill="#334155"
              >
                API Handler
              </text>
              <text x="50" y="50" textAnchor="middle" className="text-[8px]" fill="#94a3b8">
                Edge Runtime
              </text>
            </g>

            {/* Cloudflare Workers Group - includes Router */}
            <g transform="translate(285, 32)">
              <rect
                width="340"
                height="155"
                rx="8"
                className="fill-slate-50/50 dark:fill-slate-800/30"
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x="170"
                y="15"
                textAnchor="middle"
                className="text-[7px] font-medium uppercase tracking-wider"
                fill="#94a3b8"
              >
                Cloudflare Workers
              </text>

              {/* Router - left column */}
              <g transform="translate(10, 25)" filter="url(#shadowTab)">
                <rect
                  width="85"
                  height="120"
                  rx="6"
                  className="fill-white dark:fill-slate-800"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x="42"
                  y="45"
                  textAnchor="middle"
                  className="text-[10px] font-semibold"
                  fill="#334155"
                >
                  Router
                </text>
                <text x="42" y="85" textAnchor="middle" className="text-[7px]" fill="#94a3b8">
                  Routes →
                </text>
              </g>

              {/* Connection lines from Router to agents */}
              <line
                x1="95"
                y1="45"
                x2="110"
                y2="38"
                stroke="#64748b"
                strokeWidth="1"
                strokeOpacity="0.4"
                markerEnd="url(#arrowTab)"
              />
              <line
                x1="95"
                y1="70"
                x2="110"
                y2="70"
                stroke="#64748b"
                strokeWidth="1"
                strokeOpacity="0.4"
                markerEnd="url(#arrowTab)"
              />
              <line
                x1="95"
                y1="95"
                x2="110"
                y2="100"
                stroke="#64748b"
                strokeWidth="1"
                strokeOpacity="0.4"
                markerEnd="url(#arrowTab)"
              />
              <line
                x1="95"
                y1="115"
                x2="110"
                y2="130"
                stroke="#64748b"
                strokeWidth="1"
                strokeOpacity="0.4"
                markerEnd="url(#arrowTab)"
              />

              {/* Right column - agents */}
              {/* Simple */}
              <g transform="translate(110, 25)" filter="url(#shadowTab)">
                <rect
                  width="105"
                  height="25"
                  rx="6"
                  className="fill-white dark:fill-slate-800"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x="52"
                  y="17"
                  textAnchor="middle"
                  className="text-[9px] font-medium"
                  fill="#334155"
                >
                  Simple
                </text>
              </g>

              {/* Orchestrator */}
              <g transform="translate(225, 25)" filter="url(#shadowTab)">
                <rect
                  width="105"
                  height="25"
                  rx="6"
                  className="fill-white dark:fill-slate-800"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x="52"
                  y="17"
                  textAnchor="middle"
                  className="text-[9px] font-medium"
                  fill="#334155"
                >
                  Orchestrator
                </text>
              </g>

              {/* HITL */}
              <g transform="translate(110, 55)" filter="url(#shadowTab)">
                <rect
                  width="105"
                  height="32"
                  rx="6"
                  className="fill-white dark:fill-slate-800"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x="52"
                  y="14"
                  textAnchor="middle"
                  className="text-[9px] font-medium"
                  fill="#334155"
                >
                  HITL
                </text>
                <text x="52" y="26" textAnchor="middle" className="text-[7px]" fill="#94a3b8">
                  Human Approval
                </text>
              </g>

              {/* Researcher */}
              <g transform="translate(225, 55)" filter="url(#shadowTab)">
                <rect
                  width="105"
                  height="32"
                  rx="6"
                  className="fill-white dark:fill-slate-800"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x="52"
                  y="14"
                  textAnchor="middle"
                  className="text-[9px] font-medium"
                  fill="#334155"
                >
                  Researcher
                </text>
                <text x="52" y="26" textAnchor="middle" className="text-[7px]" fill="#94a3b8">
                  Deep Search
                </text>
              </g>
            </g>

            {/* Cloudflare Sandbox - separate below */}
            <g transform="translate(285, 195)">
              <rect
                width="340"
                height="45"
                rx="8"
                className="fill-slate-50/50 dark:fill-slate-800/30"
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x="70"
                y="15"
                textAnchor="middle"
                className="text-[7px] font-medium uppercase tracking-wider"
                fill="#94a3b8"
              >
                Cloudflare Sandbox
              </text>
              <g transform="translate(120, 8)" filter="url(#shadowTab)">
                <rect
                  width="130"
                  height="28"
                  rx="6"
                  className="fill-white dark:fill-slate-800"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x="65"
                  y="12"
                  textAnchor="middle"
                  className="text-[9px] font-medium"
                  fill="#334155"
                >
                  Claude Code
                </text>
                <text x="65" y="23" textAnchor="middle" className="text-[7px]" fill="#94a3b8">
                  Isolated Runtime
                </text>
              </g>
            </g>

            {/* Storage separator */}
            <line
              x1="30"
              y1="250"
              x2="620"
              y2="250"
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x="325"
              y="275"
              textAnchor="middle"
              className="text-[9px] font-semibold uppercase tracking-wider"
              fill="#64748b"
            >
              Storage
            </text>

            {/* Storage nodes - aligned */}
            <g transform="translate(80, 290)" filter="url(#shadowTab)">
              <rect
                width="80"
                height="40"
                rx="6"
                className="fill-slate-50 dark:fill-slate-800"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="40"
                y="25"
                textAnchor="middle"
                className="text-[9px] font-semibold"
                fill="#334155"
              >
                D1
              </text>
            </g>
            <g transform="translate(280, 290)" filter="url(#shadowTab)">
              <rect
                width="80"
                height="40"
                rx="6"
                className="fill-slate-50 dark:fill-slate-800"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="40"
                y="25"
                textAnchor="middle"
                className="text-[9px] font-semibold"
                fill="#334155"
              >
                KV
              </text>
            </g>
            <g transform="translate(480, 290)" filter="url(#shadowTab)">
              <rect
                width="80"
                height="40"
                rx="6"
                className="fill-slate-50 dark:fill-slate-800"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="40"
                y="25"
                textAnchor="middle"
                className="text-[9px] font-semibold"
                fill="#334155"
              >
                MCP
              </text>
            </g>
          </svg>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden space-y-5">
          <MobileSection title="Inputs">
            <div className="grid grid-cols-2 gap-2">
              <MobileNode title="Telegram" color="sky" />
              <MobileNode title="GitHub" color="violet" />
              <MobileNode title="CLI" color="green" />
              <MobileNode title="Scheduler" color="orange" />
            </div>
          </MobileSection>

          <MobileArrow />

          <MobileSection title="Edge">
            <MobileNode title="API Handler" subtitle="Edge Runtime" highlight />
          </MobileSection>

          <MobileArrow />

          {/* Cloudflare Workers Group - includes Router */}
          <div className="border border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-3">
            <MobileSection title="Cloudflare Workers">
              <div className="space-y-2">
                {/* Router - prominent */}
                <MobileNode title="Router" accent />
                {/* Other agents grid */}
                <div className="grid grid-cols-2 gap-2">
                  <MobileNode title="Simple" small />
                  <MobileNode title="Orchestrator" small />
                  <MobileNode title="HITL" small />
                  <MobileNode title="Researcher" small />
                </div>
              </div>
            </MobileSection>
          </div>

          <MobileArrow />

          {/* Cloudflare Sandbox - separate below */}
          <div className="border border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-3">
            <MobileSection title="Cloudflare Sandbox">
              <MobileNode title="Claude Code" subtitle="Isolated Runtime" small />
            </MobileSection>
          </div>

          <MobileArrow />

          {/* Tools Pool */}
          <div className="border border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-3">
            <MobileSection title="Tools Pool">
              <div className="grid grid-cols-4 gap-2">
                <MobileNode title="Bash" small />
                <MobileNode title="Git" small />
                <MobileNode title="Search" small />
                <MobileNode title="MCP" small />
              </div>
            </MobileSection>
          </div>

          {/* Storage separator */}
          <div className="border-t border-dashed border-slate-300 dark:border-slate-600 pt-4">
            <MobileSection title="Storage Layer">
              <div className="grid grid-cols-3 gap-2">
                <MobileNode title="D1" small />
                <MobileNode title="KV" small />
                <MobileNode title="R2" small />
                <MobileNode title="Vectorize" small />
                <MobileNode title="Observability" small />
              </div>
            </MobileSection>
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

interface MobileNodeProps {
  title: string;
  subtitle?: string;
  highlight?: boolean;
  accent?: boolean;
  small?: boolean;
  color?: 'sky' | 'violet' | 'purple' | 'green' | 'blue' | 'yellow' | 'cyan' | 'orange';
}

function MobileNode({ title, subtitle, highlight, accent, small, color }: MobileNodeProps) {
  const colorClasses = {
    sky: 'border-slate-300/50',
    violet: 'border-slate-300/50',
    purple: 'border-slate-300/50',
    green: 'border-slate-300/50',
    blue: 'border-slate-300/50',
    yellow: 'border-slate-300/50',
    cyan: 'border-slate-300/50',
    orange: 'border-slate-300/50',
  };

  return (
    <div
      className={`
        rounded-lg px-3 text-center border transition-colors
        ${
          accent
            ? 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600 py-3'
            : highlight
              ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 py-3'
              : color
                ? `bg-white dark:bg-slate-800 ${colorClasses[color]} py-2`
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 py-2'
        }
        ${small ? 'py-2' : ''}
      `}
    >
      <div
        className={`font-medium text-slate-700 dark:text-slate-200 ${small ? 'text-[11px]' : 'text-xs'}`}
      >
        {title}
      </div>
      {subtitle && (
        <div
          className={`text-slate-500 dark:text-slate-400 mt-0.5 ${small ? 'text-[9px]' : 'text-[10px]'}`}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

function MobileArrow() {
  return (
    <div className="flex justify-center py-1">
      <svg width="20" height="16" viewBox="0 0 20 16" fill="none" aria-hidden="true">
        <path
          d="M10 2L10 14M10 14L6 10M10 14L14 10"
          stroke="#64748b"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.5"
        />
      </svg>
    </div>
  );
}
