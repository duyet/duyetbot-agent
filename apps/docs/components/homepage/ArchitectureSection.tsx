'use client';

import { DiagramNode, DiagramNodeOverlay } from './DiagramNodeOverlay';

export function ArchitectureSection() {
  // Nodes for interactivity/overlay - mapped to the isometric positions approximately
  const diagramNodes: DiagramNode[] = [
    {
      id: 'telegram',
      title: 'Transport Layer',
      description: 'Telegram, GitHub, & API',
      href: '/docs/concepts/architecture',
      bounds: { x: 550, y: 50, width: 140, height: 60 },
    },
    {
      id: 'router',
      title: 'Edge Router',
      description: 'Pattern matching & security',
      href: '/docs/concepts/router-agent',
      bounds: { x: 180, y: 160, width: 140, height: 40 },
    },
    {
      id: 'agents',
      title: 'Agent Runtime',
      description: 'Durable Objects & Loops',
      href: '/docs/concepts/simple-agent',
      bounds: { x: 180, y: 280, width: 140, height: 40 },
    },
    {
      id: 'storage',
      title: 'Storage & Tools',
      description: 'Vector DB, D1, MCP',
      href: '/docs/concepts/persistence',
      bounds: { x: 180, y: 400, width: 140, height: 40 },
    },
  ];

  return (
    <section className="my-20 lg:my-32">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-fd-foreground mb-4">
          System Architecture
        </h2>
        <p className="text-lg text-fd-muted-foreground max-w-2xl mx-auto">
          A layered, durable architecture built for resilience and scale on the Edge.
        </p>
      </div>

      {/* Architecture Diagram Container */}
      <div className="relative w-full max-w-5xl mx-auto">
        {/* Desktop Isometric SVG */}
        <div className="hidden lg:block relative h-[600px] w-full select-none">
          {/* Interactive Overlay */}
          <DiagramNodeOverlay nodes={diagramNodes} viewBox={{ width: 1000, height: 600 }} />

          <svg
            viewBox="0 0 1000 600"
            className="w-full h-full drop-shadow-2xl"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="grid-pattern"
                width="40"
                height="20"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(0)"
              >
                <path
                  d="M0 10 L40 10 M20 0 L20 20"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.5"
                />
              </pattern>

              {/* Hatch Pattern for Sides - Blue */}
              <pattern
                id="hatch-side-blue"
                width="4"
                height="4"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(-45)"
              >
                <rect width="4" height="4" fill="#dbeafe" opacity="0.3" />
                <path d="M0 0h4v1h-4z" fill="#3b82f6" opacity="0.2" />
              </pattern>

              {/* Hatch Pattern for Sides - Orange */}
              <pattern
                id="hatch-side-orange"
                width="4"
                height="4"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(-45)"
              >
                <rect width="4" height="4" fill="#ffedd5" opacity="0.3" />
                <path d="M0 0h4v1h-4z" fill="#f97316" opacity="0.2" />
              </pattern>

              {/* Hatch Pattern for Sides - Gray */}
              <pattern
                id="hatch-side-gray"
                width="4"
                height="4"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(-45)"
              >
                <rect width="4" height="4" fill="#f1f5f9" opacity="0.3" />
                <path d="M0 0h4v1h-4z" fill="#64748b" opacity="0.2" />
              </pattern>
            </defs>

            {/* Background Grid Elements (Subtle) */}
            <path
              d="M500 100 L900 300 L500 500 L100 300 Z"
              fill="url(#grid-pattern)"
              opacity="0.3"
            />

            {/* ==================== LAYER 3: STORAGE (BOTTOM) ==================== */}
            <g transform="translate(500, 480)">
              {/* Box Geometry: 400x300 isometric-ish plane */}
              {/* Left Face */}
              <path
                d="M0 100 L-300 0 V20 L0 120 Z"
                fill="url(#hatch-side-blue)"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              {/* Right Face */}
              <path
                d="M0 100 L300 0 V20 L0 120 Z"
                fill="#eff6ff"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              {/* Top Face */}
              <path
                d="M0 100 L300 0 L0 -100 L-300 0 Z"
                fill="#ffffff"
                stroke="#3b82f6"
                strokeWidth="2"
                fillOpacity="0.9"
              />

              {/* Content on Layer */}
              <text
                x="-240"
                y="10"
                className="text-sm font-bold fill-blue-600 font-mono tracking-widest uppercase"
              >
                Storage & Tools
              </text>

              <g transform="translate(0, 10)">
                {/* D1 Database Block */}
                <path d="M-100 30 L-60 45 L-20 30 L-60 15 Z" fill="#e0f2fe" stroke="#38bdf8" />
                <path d="M-100 30 L-60 45 V55 L-100 40 Z" fill="#bae6fd" stroke="#38bdf8" />
                <path d="M-60 45 L-20 30 V40 L-60 55 Z" fill="#7dd3fc" stroke="#38bdf8" />
                <text
                  x="-60"
                  y="65"
                  textAnchor="middle"
                  className="text-[10px] font-mono fill-slate-500"
                >
                  D1
                </text>

                {/* Vectorize Block */}
                <path d="M20 30 L60 45 L100 30 L60 15 Z" fill="#e0f2fe" stroke="#38bdf8" />
                <path d="M20 30 L60 45 V55 L20 40 Z" fill="#bae6fd" stroke="#38bdf8" />
                <path d="M60 45 L100 30 V40 L60 55 Z" fill="#7dd3fc" stroke="#38bdf8" />
                <text
                  x="60"
                  y="65"
                  textAnchor="middle"
                  className="text-[10px] font-mono fill-slate-500"
                >
                  Vectorize
                </text>
              </g>
            </g>

            {/* ==================== LAYER 2: AGENTS (MIDDLE) ==================== */}
            <g transform="translate(500, 340)">
              {/* Left Face */}
              <path
                d="M0 100 L-300 0 V25 L0 125 Z"
                fill="url(#hatch-side-blue)"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              {/* Right Face */}
              <path
                d="M0 100 L300 0 V25 L0 125 Z"
                fill="#eff6ff"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              {/* Top Face */}
              <path
                d="M0 100 L300 0 L0 -100 L-300 0 Z"
                fill="#ffffff"
                stroke="#3b82f6"
                strokeWidth="2"
                fillOpacity="0.95"
              />

              <text
                x="-240"
                y="10"
                className="text-sm font-bold fill-blue-600 font-mono tracking-widest uppercase"
              >
                Agent Runtime
              </text>

              {/* Durable Object 'Chip' */}
              <g transform="translate(140, 0)">
                <path d="M0 20 L40 10 L80 20 L40 30 Z" fill="#fef3c7" stroke="#f59e0b" />
                <path d="M0 20 L40 30 V35 L0 25 Z" fill="#fde68a" stroke="#f59e0b" />
                <path d="M40 30 L80 20 V25 L40 35 Z" fill="#fbbf24" stroke="#f59e0b" />
                <text
                  x="40"
                  y="50"
                  textAnchor="middle"
                  className="text-[10px] font-mono fill-amber-600"
                >
                  Durable State
                </text>
              </g>

              {/* Orchestrator 'Chip' */}
              <g transform="translate(0, 40)">
                <path d="M0 20 L40 10 L80 20 L40 30 Z" fill="#dbeafe" stroke="#3b82f6" />
                <path d="M0 20 L40 30 V35 L0 25 Z" fill="#bfdbfe" stroke="#3b82f6" />
                <path d="M40 30 L80 20 V25 L40 35 Z" fill="#93c5fd" stroke="#3b82f6" />
                <text
                  x="40"
                  y="50"
                  textAnchor="middle"
                  className="text-[10px] font-mono fill-blue-600"
                >
                  Orchestrator
                </text>
              </g>
            </g>

            {/* ==================== LAYER 1: EDGE (TOP) ==================== */}
            <g transform="translate(500, 200)">
              {/* Left Face */}
              <path
                d="M0 100 L-300 0 V20 L0 120 Z"
                fill="url(#hatch-side-blue)"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              {/* Right Face */}
              <path
                d="M0 100 L300 0 V20 L0 120 Z"
                fill="#eff6ff"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              {/* Top Face */}
              <path
                d="M0 100 L300 0 L0 -100 L-300 0 Z"
                fill="#ffffff"
                stroke="#3b82f6"
                strokeWidth="2"
                fillOpacity="0.95"
              />

              <text
                x="-240"
                y="10"
                className="text-sm font-bold fill-blue-600 font-mono tracking-widest uppercase"
              >
                Edge Layer
              </text>

              {/* Router Badge */}
              <g transform="translate(0, 0)">
                <rect
                  x="-40"
                  y="-10"
                  width="80"
                  height="20"
                  rx="4"
                  fill="#3b82f6"
                  fillOpacity="0.1"
                  stroke="#3b82f6"
                  transform="skewY(10) skewX(-10)"
                />
                <text x="0" y="5" textAnchor="middle" className="text-xs font-bold fill-blue-600">
                  ROUTER
                </text>
              </g>
            </g>

            {/* ==================== FLOATING INPUTS ==================== */}

            {/* Dashed Line Connection */}
            <path d="M680 120 L680 180" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
            <path
              d="M680 180 L500 240"
              stroke="#94a3b8"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.5"
            />

            <g transform="translate(680, 100)">
              {/* User Box (Orange) */}
              <path
                d="M0 20 L40 0 L80 20 L40 40 Z"
                fill="#fff7ed"
                stroke="#f97316"
                strokeWidth="2"
              />
              <path
                d="M0 20 L40 40 V60 L0 40 Z"
                fill="url(#hatch-side-orange)"
                stroke="#f97316"
                strokeWidth="2"
              />
              <path
                d="M40 40 L80 20 V40 L40 60 Z"
                fill="#ffedd5"
                stroke="#f97316"
                strokeWidth="2"
              />

              <text x="100" y="35" className="text-xs font-bold fill-orange-500 font-mono">
                User / API
              </text>
              <text x="100" y="50" className="text-[10px] fill-orange-400 font-mono">
                Telegram/GitHub
              </text>
            </g>

            {/* Attack/Noise Box (Left - Red/Red) */}
            <path d="M320 180 L360 200" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />

            <g transform="translate(280, 160)">
              <path
                d="M0 15 L30 0 L60 15 L30 30 Z"
                fill="#fef2f2"
                stroke="#ef4444"
                strokeWidth="1"
              />
              <path
                d="M0 15 L30 30 V40 L0 25 Z"
                fill="url(#hatch-side-gray)"
                stroke="#ef4444"
                strokeWidth="1"
              />
              <path
                d="M30 30 L60 15 V25 L30 40 Z"
                fill="#fee2e2"
                stroke="#ef4444"
                strokeWidth="1"
              />
              <text x="-10" y="50" textAnchor="end" className="text-[10px] fill-red-400 font-mono">
                Unverified Req
              </text>
            </g>
          </svg>
        </div>

        {/* Mobile/Tablet Stack Layout */}
        <div className="lg:hidden space-y-6 px-4">
          {/* Inputs */}
          <MobileSection title="01. Inputs">
            <div className="grid grid-cols-2 gap-3">
              <MobileNode title="Telegram" color="sky" />
              <MobileNode title="GitHub" color="violet" />
              <MobileNode title="CLI / API" color="green" />
              <MobileNode title="Scheduler" color="orange" />
            </div>
          </MobileSection>

          {/* Edge */}
          <MobileSection title="02. Edge Layer">
            <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-2">
                Router Agent
              </h4>
              <p className="text-xs text-muted-foreground mb-0">
                Intercepts all requests. Pattern matches to route to correct agent or rejects
                unverified traffic.
              </p>
            </div>
          </MobileSection>

          {/* Agents */}
          <MobileSection title="03. Agents (Durable Objects)">
            <div className="space-y-3">
              <MobileNode title="Simple Agent" subtitle="Direct LLM Response" accent />
              <MobileNode title="Orchestrator" subtitle="Planning & Tool Execution" accent />
              <MobileNode title="Researcher" subtitle="Deep web search loops" accent />
            </div>
          </MobileSection>

          {/* Storage */}
          <MobileSection title="04. Storage & Tools">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border rounded-md text-center">
                <div className="text-xs font-bold text-slate-600">D1 Database</div>
                <div className="text-[10px] text-slate-400">Relational Data</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border rounded-md text-center">
                <div className="text-xs font-bold text-slate-600">Vectorize</div>
                <div className="text-[10px] text-slate-400">Embeddings</div>
              </div>
              <div className="col-span-2 p-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900 rounded-md flex items-center justify-center gap-2">
                <span className="text-xs font-bold text-purple-600">MCP Servers</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                  New
                </span>
              </div>
            </div>
          </MobileSection>
        </div>
      </div>
    </section>
  );
}

// Helper Components
function MobileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{title}</div>
      {children}
    </div>
  );
}

interface MobileNodeProps {
  title: string;
  subtitle?: string;
  color?: string;
  small?: boolean;
  highlight?: boolean;
  accent?: boolean;
}

function MobileNode({ title, subtitle, small, highlight, accent }: MobileNodeProps) {
  return (
    <div
      className={`
      relative rounded-lg border transition-all
      ${small ? 'p-2' : 'p-3'}
      ${highlight ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800' : 'bg-card border-border shadow-sm'}
      ${accent ? 'border-l-4 border-l-blue-500' : ''}
    `}
    >
      <div className="text-sm font-medium text-foreground">{title}</div>
      {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
    </div>
  );
}
