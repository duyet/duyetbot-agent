'use client';

export function ArchitectureSection() {
  return (
    <section className="my-12">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-fd-foreground mb-1">
          System Architecture
        </h2>
        <p className="text-sm text-fd-muted-foreground">
          Multi-agent system with durable state and tool orchestration
        </p>
      </div>

      {/* Architecture Diagram Container - White Theme */}
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
          <svg
            viewBox="0 0 1100 480"
            className="w-full h-auto"
            style={{ minHeight: '400px' }}
          >
            <defs>
              {/* Connection gradients */}
              <linearGradient id="connGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f38020" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#f38020" stopOpacity="0.3" />
              </linearGradient>
              <linearGradient id="connGradientBlue" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="connGradientGreen" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0.2" />
              </linearGradient>

              {/* Shadow filter */}
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1"/>
              </filter>
              <filter id="shadowStrong" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.15"/>
              </filter>
            </defs>

            {/* ==================== CONNECTIONS ==================== */}

            {/* Platforms to Workers */}
            <path d="M 130 90 Q 180 90, 200 140 T 270 160" fill="none" stroke="url(#connGradient)" strokeWidth="2" strokeLinecap="round"/>
            <path d="M 130 180 Q 180 180, 200 170 T 270 160" fill="none" stroke="url(#connGradient)" strokeWidth="2" strokeLinecap="round"/>
            <path d="M 130 270 Q 180 270, 200 200 T 270 160" fill="none" stroke="url(#connGradient)" strokeWidth="2" strokeLinecap="round"/>

            {/* Workers to Router */}
            <path d="M 380 160 Q 430 160, 460 200 T 510 200" fill="none" stroke="url(#connGradient)" strokeWidth="2.5" strokeLinecap="round"/>

            {/* Router to Agents */}
            <path d="M 640 170 Q 680 170, 700 100 T 740 80" fill="none" stroke="url(#connGradient)" strokeWidth="2" strokeLinecap="round"/>
            <path d="M 640 190 Q 680 190, 700 160 T 740 150" fill="none" stroke="url(#connGradient)" strokeWidth="2" strokeLinecap="round"/>
            <path d="M 640 210 Q 680 210, 700 230 T 740 220" fill="none" stroke="url(#connGradient)" strokeWidth="2" strokeLinecap="round"/>
            <path d="M 640 230 Q 680 230, 700 290 T 740 290" fill="none" stroke="url(#connGradient)" strokeWidth="2" strokeLinecap="round"/>
            <path d="M 640 250 Q 680 250, 700 360 T 740 360" fill="none" stroke="url(#connGradient)" strokeWidth="2" strokeLinecap="round"/>

            {/* Agents to Tools */}
            <path d="M 860 80 Q 900 80, 920 60 T 960 50" fill="none" stroke="url(#connGradientBlue)" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M 860 150 Q 900 150, 920 120 T 960 110" fill="none" stroke="url(#connGradientBlue)" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M 860 220 Q 900 220, 920 180 T 960 170" fill="none" stroke="url(#connGradientBlue)" strokeWidth="1.5" strokeLinecap="round"/>

            {/* Router to Storage (bottom) */}
            <path d="M 575 280 Q 575 330, 480 370 T 380 390" fill="none" stroke="url(#connGradientGreen)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 4"/>
            <path d="M 575 280 Q 575 340, 575 370 T 575 400" fill="none" stroke="url(#connGradientGreen)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 4"/>
            <path d="M 575 280 Q 575 330, 670 370 T 770 390" fill="none" stroke="url(#connGradientGreen)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 4"/>

            {/* ==================== SECTION LABELS ==================== */}
            <text x="70" y="30" className="text-[10px] font-semibold uppercase tracking-wider" fill="#64748b">Inputs</text>
            <text x="290" y="30" className="text-[10px] font-semibold uppercase tracking-wider" fill="#64748b">Edge</text>
            <text x="530" y="30" className="text-[10px] font-semibold uppercase tracking-wider" fill="#64748b">Routing</text>
            <text x="760" y="30" className="text-[10px] font-semibold uppercase tracking-wider" fill="#64748b">Agents</text>
            <text x="950" y="30" className="text-[10px] font-semibold uppercase tracking-wider" fill="#64748b">Tools</text>
            <text x="530" y="350" className="text-[10px] font-semibold uppercase tracking-wider" fill="#64748b">Storage</text>

            {/* ==================== PLATFORM NODES ==================== */}

            {/* Telegram */}
            <g transform="translate(20, 55)" filter="url(#shadow)">
              <rect width="110" height="70" rx="8" className="fill-white dark:fill-slate-800" stroke="#e2e8f0" strokeWidth="1"/>
              <circle cx="25" cy="35" r="14" fill="#0088cc" fillOpacity="0.1"/>
              <text x="25" y="39" textAnchor="middle" className="text-[10px] font-bold" fill="#0088cc">TG</text>
              <text x="70" y="30" textAnchor="middle" className="text-xs font-medium" fill="#334155">Telegram</text>
              <text x="70" y="48" textAnchor="middle" className="text-[10px]" fill="#94a3b8">Bot API</text>
            </g>

            {/* GitHub */}
            <g transform="translate(20, 145)" filter="url(#shadow)">
              <rect width="110" height="70" rx="8" className="fill-white dark:fill-slate-800" stroke="#e2e8f0" strokeWidth="1"/>
              <circle cx="25" cy="35" r="14" fill="#6e40c9" fillOpacity="0.1"/>
              <text x="25" y="39" textAnchor="middle" className="text-[10px] font-bold" fill="#6e40c9">GH</text>
              <text x="70" y="30" textAnchor="middle" className="text-xs font-medium" fill="#334155">GitHub</text>
              <text x="70" y="48" textAnchor="middle" className="text-[10px]" fill="#94a3b8">Webhooks</text>
            </g>

            {/* Slack */}
            <g transform="translate(20, 235)" filter="url(#shadow)">
              <rect width="110" height="70" rx="8" className="fill-white dark:fill-slate-800" stroke="#e2e8f0" strokeWidth="1"/>
              <circle cx="25" cy="35" r="14" fill="#4a154b" fillOpacity="0.1"/>
              <text x="25" y="39" textAnchor="middle" className="text-[10px] font-bold" fill="#4a154b">SL</text>
              <text x="70" y="30" textAnchor="middle" className="text-xs font-medium" fill="#334155">Slack</text>
              <text x="70" y="48" textAnchor="middle" className="text-[10px]" fill="#94a3b8">Events API</text>
            </g>

            {/* ==================== WORKERS NODE ==================== */}
            <g transform="translate(270, 100)" filter="url(#shadow)">
              <rect width="110" height="120" rx="10" className="fill-white dark:fill-slate-800" stroke="#f38020" strokeWidth="2" strokeOpacity="0.3"/>
              <rect x="4" y="4" width="102" height="112" rx="8" className="fill-white dark:fill-slate-800"/>

              {/* CF Logo placeholder */}
              <rect x="35" y="15" width="40" height="24" rx="4" fill="#f38020" fillOpacity="0.1"/>
              <text x="55" y="32" textAnchor="middle" className="text-[10px] font-bold" fill="#f38020">CF</text>

              <text x="55" y="58" textAnchor="middle" className="text-xs font-semibold" fill="#334155">Workers</text>
              <text x="55" y="75" textAnchor="middle" className="text-[10px]" fill="#94a3b8">Edge Runtime</text>

              {/* Stats */}
              <text x="55" y="100" textAnchor="middle" className="text-[9px] font-medium" fill="#22c55e">~10ms cold start</text>
            </g>

            {/* ==================== ROUTER AGENT (Main) ==================== */}
            <g transform="translate(510, 120)" filter="url(#shadowStrong)">
              <rect width="130" height="160" rx="12" fill="#f38020" fillOpacity="0.08" stroke="#f38020" strokeWidth="2"/>
              <rect x="4" y="4" width="122" height="152" rx="10" className="fill-white dark:fill-slate-800"/>

              {/* Icon */}
              <circle cx="65" cy="30" r="16" fill="#f38020" fillOpacity="0.15"/>
              <text x="65" y="35" textAnchor="middle" className="text-xs font-bold" fill="#f38020">R</text>

              <text x="65" y="60" textAnchor="middle" className="text-sm font-bold" fill="#334155">Router</text>
              <text x="65" y="78" textAnchor="middle" className="text-[10px]" fill="#94a3b8">Durable Object</text>

              {/* Features */}
              <line x1="20" y1="92" x2="110" y2="92" stroke="#e2e8f0" strokeWidth="1"/>
              <text x="65" y="110" textAnchor="middle" className="text-[9px]" fill="#64748b">Pattern Match</text>
              <text x="65" y="125" textAnchor="middle" className="text-[9px]" fill="#64748b">LLM Fallback</text>
              <text x="65" y="140" textAnchor="middle" className="text-[9px] font-medium" fill="#f38020">80% token saved</text>
            </g>

            {/* ==================== AGENT NODES ==================== */}

            {/* Simple Agent */}
            <g transform="translate(740, 50)" filter="url(#shadow)">
              <rect width="120" height="58" rx="8" className="fill-white dark:fill-slate-800" stroke="#22c55e" strokeWidth="1.5" strokeOpacity="0.5"/>
              <circle cx="20" cy="29" r="10" fill="#22c55e" fillOpacity="0.15"/>
              <text x="20" y="33" textAnchor="middle" className="text-[8px] font-bold" fill="#22c55e">S</text>
              <text x="75" y="25" textAnchor="middle" className="text-[11px] font-semibold" fill="#334155">Simple</text>
              <text x="75" y="42" textAnchor="middle" className="text-[9px]" fill="#94a3b8">Quick responses</text>
            </g>

            {/* Orchestrator Agent */}
            <g transform="translate(740, 120)" filter="url(#shadow)">
              <rect width="120" height="58" rx="8" className="fill-white dark:fill-slate-800" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.5"/>
              <circle cx="20" cy="29" r="10" fill="#3b82f6" fillOpacity="0.15"/>
              <text x="20" y="33" textAnchor="middle" className="text-[8px] font-bold" fill="#3b82f6">O</text>
              <text x="75" y="25" textAnchor="middle" className="text-[11px] font-semibold" fill="#334155">Orchestrator</text>
              <text x="75" y="42" textAnchor="middle" className="text-[9px]" fill="#94a3b8">Multi-step tasks</text>
            </g>

            {/* HITL Agent */}
            <g transform="translate(740, 190)" filter="url(#shadow)">
              <rect width="120" height="58" rx="8" className="fill-white dark:fill-slate-800" stroke="#eab308" strokeWidth="1.5" strokeOpacity="0.5"/>
              <circle cx="20" cy="29" r="10" fill="#eab308" fillOpacity="0.15"/>
              <text x="20" y="33" textAnchor="middle" className="text-[8px] font-bold" fill="#eab308">H</text>
              <text x="75" y="25" textAnchor="middle" className="text-[11px] font-semibold" fill="#334155">HITL</text>
              <text x="75" y="42" textAnchor="middle" className="text-[9px]" fill="#94a3b8">Human approval</text>
            </g>

            {/* Researcher Agent */}
            <g transform="translate(740, 260)" filter="url(#shadow)">
              <rect width="120" height="58" rx="8" className="fill-white dark:fill-slate-800" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.5"/>
              <circle cx="20" cy="29" r="10" fill="#06b6d4" fillOpacity="0.15"/>
              <text x="20" y="33" textAnchor="middle" className="text-[8px] font-bold" fill="#06b6d4">R</text>
              <text x="75" y="25" textAnchor="middle" className="text-[11px] font-semibold" fill="#334155">Researcher</text>
              <text x="75" y="42" textAnchor="middle" className="text-[9px]" fill="#94a3b8">Deep analysis</text>
            </g>

            {/* Info Agent */}
            <g transform="translate(740, 330)" filter="url(#shadow)">
              <rect width="120" height="58" rx="8" className="fill-white dark:fill-slate-800" stroke="#a855f7" strokeWidth="1.5" strokeOpacity="0.5"/>
              <circle cx="20" cy="29" r="10" fill="#a855f7" fillOpacity="0.15"/>
              <text x="20" y="33" textAnchor="middle" className="text-[8px] font-bold" fill="#a855f7">I</text>
              <text x="75" y="25" textAnchor="middle" className="text-[11px] font-semibold" fill="#334155">Info</text>
              <text x="75" y="42" textAnchor="middle" className="text-[9px]" fill="#94a3b8">Knowledge base</text>
            </g>

            {/* ==================== TOOL NODES ==================== */}

            {/* Bash Tool */}
            <g transform="translate(960, 25)" filter="url(#shadow)">
              <rect width="85" height="48" rx="6" className="fill-slate-100 dark:fill-slate-700" stroke="#64748b" strokeWidth="1" strokeOpacity="0.3"/>
              <text x="42" y="22" textAnchor="middle" className="text-[10px] font-medium" fill="#334155">Bash</text>
              <text x="42" y="38" textAnchor="middle" className="text-[8px]" fill="#94a3b8">Shell exec</text>
            </g>

            {/* Git Tool */}
            <g transform="translate(960, 85)" filter="url(#shadow)">
              <rect width="85" height="48" rx="6" className="fill-slate-100 dark:fill-slate-700" stroke="#64748b" strokeWidth="1" strokeOpacity="0.3"/>
              <text x="42" y="22" textAnchor="middle" className="text-[10px] font-medium" fill="#334155">Git</text>
              <text x="42" y="38" textAnchor="middle" className="text-[8px]" fill="#94a3b8">Version ctrl</text>
            </g>

            {/* Web Search Tool */}
            <g transform="translate(960, 145)" filter="url(#shadow)">
              <rect width="85" height="48" rx="6" className="fill-slate-100 dark:fill-slate-700" stroke="#64748b" strokeWidth="1" strokeOpacity="0.3"/>
              <text x="42" y="22" textAnchor="middle" className="text-[10px] font-medium" fill="#334155">Search</text>
              <text x="42" y="38" textAnchor="middle" className="text-[8px]" fill="#94a3b8">Web/Tavily</text>
            </g>

            {/* ==================== STORAGE NODES ==================== */}

            {/* D1 Database */}
            <g transform="translate(320, 370)" filter="url(#shadow)">
              <rect width="100" height="55" rx="8" className="fill-slate-50 dark:fill-slate-800" stroke="#22c55e" strokeWidth="1.5" strokeOpacity="0.4"/>
              <text x="50" y="24" textAnchor="middle" className="text-[10px] font-semibold" fill="#334155">D1</text>
              <text x="50" y="42" textAnchor="middle" className="text-[9px]" fill="#94a3b8">SQLite Edge</text>
            </g>

            {/* KV Store */}
            <g transform="translate(520, 380)" filter="url(#shadow)">
              <rect width="100" height="55" rx="8" className="fill-slate-50 dark:fill-slate-800" stroke="#22c55e" strokeWidth="1.5" strokeOpacity="0.4"/>
              <text x="50" y="24" textAnchor="middle" className="text-[10px] font-semibold" fill="#334155">KV</text>
              <text x="50" y="42" textAnchor="middle" className="text-[9px]" fill="#94a3b8">Key-Value</text>
            </g>

            {/* MCP Server */}
            <g transform="translate(720, 370)" filter="url(#shadow)">
              <rect width="100" height="55" rx="8" className="fill-slate-50 dark:fill-slate-800" stroke="#22c55e" strokeWidth="1.5" strokeOpacity="0.4"/>
              <text x="50" y="24" textAnchor="middle" className="text-[10px] font-semibold" fill="#334155">MCP</text>
              <text x="50" y="42" textAnchor="middle" className="text-[9px]" fill="#94a3b8">Memory Server</text>
            </g>

          </svg>
        </div>

        {/* Tablet Layout */}
        <div className="hidden md:block lg:hidden relative">
          <svg viewBox="0 0 700 500" className="w-full h-auto" style={{ minHeight: '420px' }}>
            <defs>
              <linearGradient id="connGradientTab" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f38020" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#f38020" stopOpacity="0.2" />
              </linearGradient>
              <filter id="shadowTab" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.08"/>
              </filter>
            </defs>

            {/* Labels */}
            <text x="60" y="25" className="text-[9px] font-semibold uppercase tracking-wider" fill="#64748b">Inputs</text>
            <text x="200" y="25" className="text-[9px] font-semibold uppercase tracking-wider" fill="#64748b">Edge</text>
            <text x="340" y="25" className="text-[9px] font-semibold uppercase tracking-wider" fill="#64748b">Router</text>
            <text x="510" y="25" className="text-[9px] font-semibold uppercase tracking-wider" fill="#64748b">Agents</text>

            {/* Connections */}
            <path d="M 100 70 Q 140 70, 160 100 T 200 100" fill="none" stroke="url(#connGradientTab)" strokeWidth="1.5"/>
            <path d="M 100 130 Q 140 130, 160 110 T 200 100" fill="none" stroke="url(#connGradientTab)" strokeWidth="1.5"/>
            <path d="M 280 100 Q 310 100, 330 130 T 360 130" fill="none" stroke="url(#connGradientTab)" strokeWidth="2"/>
            <path d="M 460 110 Q 490 110, 500 70 T 530 60" fill="none" stroke="url(#connGradientTab)" strokeWidth="1.5"/>
            <path d="M 460 130 Q 490 130, 500 120 T 530 120" fill="none" stroke="url(#connGradientTab)" strokeWidth="1.5"/>
            <path d="M 460 150 Q 490 150, 500 180 T 530 180" fill="none" stroke="url(#connGradientTab)" strokeWidth="1.5"/>
            <path d="M 460 170 Q 490 170, 500 240 T 530 240" fill="none" stroke="url(#connGradientTab)" strokeWidth="1.5"/>

            {/* Platform Nodes */}
            <g transform="translate(20, 45)" filter="url(#shadowTab)">
              <rect width="80" height="50" rx="6" className="fill-white dark:fill-slate-800" stroke="#e2e8f0" strokeWidth="1"/>
              <text x="40" y="25" textAnchor="middle" className="text-[10px] font-medium" fill="#334155">Telegram</text>
              <text x="40" y="40" textAnchor="middle" className="text-[8px]" fill="#94a3b8">Bot</text>
            </g>
            <g transform="translate(20, 105)" filter="url(#shadowTab)">
              <rect width="80" height="50" rx="6" className="fill-white dark:fill-slate-800" stroke="#e2e8f0" strokeWidth="1"/>
              <text x="40" y="25" textAnchor="middle" className="text-[10px] font-medium" fill="#334155">GitHub</text>
              <text x="40" y="40" textAnchor="middle" className="text-[8px]" fill="#94a3b8">Webhooks</text>
            </g>

            {/* Workers */}
            <g transform="translate(200, 60)" filter="url(#shadowTab)">
              <rect width="80" height="80" rx="8" className="fill-white dark:fill-slate-800" stroke="#f38020" strokeWidth="1.5" strokeOpacity="0.4"/>
              <text x="40" y="35" textAnchor="middle" className="text-[10px] font-semibold" fill="#334155">Workers</text>
              <text x="40" y="52" textAnchor="middle" className="text-[8px]" fill="#94a3b8">Edge Runtime</text>
            </g>

            {/* Router */}
            <g transform="translate(360, 80)" filter="url(#shadowTab)">
              <rect width="100" height="100" rx="10" fill="#f38020" fillOpacity="0.08" stroke="#f38020" strokeWidth="2"/>
              <rect x="3" y="3" width="94" height="94" rx="8" className="fill-white dark:fill-slate-800"/>
              <text x="50" y="35" textAnchor="middle" className="text-[11px] font-bold" fill="#334155">Router</text>
              <text x="50" y="52" textAnchor="middle" className="text-[8px]" fill="#94a3b8">Durable Object</text>
              <text x="50" y="75" textAnchor="middle" className="text-[8px]" fill="#f38020">Pattern + LLM</text>
            </g>

            {/* Agents */}
            <g transform="translate(530, 40)" filter="url(#shadowTab)">
              <rect width="90" height="40" rx="6" className="fill-white dark:fill-slate-800" stroke="#22c55e" strokeWidth="1" strokeOpacity="0.5"/>
              <text x="45" y="25" textAnchor="middle" className="text-[9px] font-medium" fill="#334155">Simple</text>
            </g>
            <g transform="translate(530, 100)" filter="url(#shadowTab)">
              <rect width="90" height="40" rx="6" className="fill-white dark:fill-slate-800" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.5"/>
              <text x="45" y="25" textAnchor="middle" className="text-[9px] font-medium" fill="#334155">Orchestrator</text>
            </g>
            <g transform="translate(530, 160)" filter="url(#shadowTab)">
              <rect width="90" height="40" rx="6" className="fill-white dark:fill-slate-800" stroke="#eab308" strokeWidth="1" strokeOpacity="0.5"/>
              <text x="45" y="25" textAnchor="middle" className="text-[9px] font-medium" fill="#334155">HITL</text>
            </g>
            <g transform="translate(530, 220)" filter="url(#shadowTab)">
              <rect width="90" height="40" rx="6" className="fill-white dark:fill-slate-800" stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.5"/>
              <text x="45" y="25" textAnchor="middle" className="text-[9px] font-medium" fill="#334155">Researcher</text>
            </g>

            {/* Storage Row */}
            <text x="200" y="320" className="text-[9px] font-semibold uppercase tracking-wider" fill="#64748b">Storage</text>
            <g transform="translate(100, 340)" filter="url(#shadowTab)">
              <rect width="80" height="40" rx="6" className="fill-slate-50 dark:fill-slate-800" stroke="#22c55e" strokeWidth="1" strokeOpacity="0.4"/>
              <text x="40" y="25" textAnchor="middle" className="text-[9px] font-medium" fill="#334155">D1</text>
            </g>
            <g transform="translate(200, 340)" filter="url(#shadowTab)">
              <rect width="80" height="40" rx="6" className="fill-slate-50 dark:fill-slate-800" stroke="#22c55e" strokeWidth="1" strokeOpacity="0.4"/>
              <text x="40" y="25" textAnchor="middle" className="text-[9px] font-medium" fill="#334155">KV</text>
            </g>
            <g transform="translate(300, 340)" filter="url(#shadowTab)">
              <rect width="80" height="40" rx="6" className="fill-slate-50 dark:fill-slate-800" stroke="#22c55e" strokeWidth="1" strokeOpacity="0.4"/>
              <text x="40" y="25" textAnchor="middle" className="text-[9px] font-medium" fill="#334155">MCP</text>
            </g>

            {/* Tools Row */}
            <text x="460" y="320" className="text-[9px] font-semibold uppercase tracking-wider" fill="#64748b">Tools</text>
            <g transform="translate(420, 340)" filter="url(#shadowTab)">
              <rect width="60" height="36" rx="4" className="fill-slate-100 dark:fill-slate-700" stroke="#64748b" strokeWidth="0.5" strokeOpacity="0.3"/>
              <text x="30" y="23" textAnchor="middle" className="text-[8px] font-medium" fill="#334155">Bash</text>
            </g>
            <g transform="translate(490, 340)" filter="url(#shadowTab)">
              <rect width="60" height="36" rx="4" className="fill-slate-100 dark:fill-slate-700" stroke="#64748b" strokeWidth="0.5" strokeOpacity="0.3"/>
              <text x="30" y="23" textAnchor="middle" className="text-[8px] font-medium" fill="#334155">Git</text>
            </g>
            <g transform="translate(560, 340)" filter="url(#shadowTab)">
              <rect width="60" height="36" rx="4" className="fill-slate-100 dark:fill-slate-700" stroke="#64748b" strokeWidth="0.5" strokeOpacity="0.3"/>
              <text x="30" y="23" textAnchor="middle" className="text-[8px] font-medium" fill="#334155">Search</text>
            </g>
          </svg>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden space-y-6">
          <MobileSection title="Inputs">
            <div className="grid grid-cols-3 gap-2">
              <MobileNode title="Telegram" color="sky" />
              <MobileNode title="GitHub" color="violet" />
              <MobileNode title="Slack" color="purple" />
            </div>
          </MobileSection>

          <MobileArrow />

          <MobileSection title="Edge">
            <MobileNode title="Workers" subtitle="Edge Runtime" highlight />
          </MobileSection>

          <MobileArrow />

          <MobileSection title="Routing">
            <MobileNode title="Router Agent" subtitle="Pattern + LLM" accent />
          </MobileSection>

          <MobileArrow />

          <MobileSection title="Agents">
            <div className="grid grid-cols-2 gap-2">
              <MobileNode title="Simple" color="green" small />
              <MobileNode title="Orchestrator" color="blue" small />
              <MobileNode title="HITL" color="yellow" small />
              <MobileNode title="Researcher" color="cyan" small />
              <MobileNode title="Info" color="purple" small />
            </div>
          </MobileSection>

          <MobileArrow />

          <div className="grid grid-cols-2 gap-4">
            <MobileSection title="Storage">
              <div className="grid grid-cols-1 gap-2">
                <MobileNode title="D1" small />
                <MobileNode title="KV" small />
                <MobileNode title="MCP" small />
              </div>
            </MobileSection>
            <MobileSection title="Tools">
              <div className="grid grid-cols-1 gap-2">
                <MobileNode title="Bash" small muted />
                <MobileNode title="Git" small muted />
                <MobileNode title="Search" small muted />
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
  muted?: boolean;
  color?: 'sky' | 'violet' | 'purple' | 'green' | 'blue' | 'yellow' | 'cyan';
}

function MobileNode({ title, subtitle, highlight, accent, small, muted, color }: MobileNodeProps) {
  const colorClasses = {
    sky: 'border-sky-500/30',
    violet: 'border-violet-500/30',
    purple: 'border-purple-500/30',
    green: 'border-green-500/30',
    blue: 'border-blue-500/30',
    yellow: 'border-yellow-500/30',
    cyan: 'border-cyan-500/30',
  };

  return (
    <div
      className={`
        rounded-lg px-3 text-center border transition-colors
        ${accent
          ? 'bg-[#f38020]/5 border-[#f38020]/40 py-3'
          : highlight
            ? 'bg-white dark:bg-slate-800 border-[#f38020]/20 py-3'
            : muted
              ? 'bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 py-2'
              : color
                ? `bg-white dark:bg-slate-800 ${colorClasses[color]} py-2`
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 py-2'
        }
        ${small ? 'py-2' : ''}
      `}
    >
      <div className={`font-medium text-slate-700 dark:text-slate-200 ${small ? 'text-[11px]' : 'text-xs'}`}>
        {title}
      </div>
      {subtitle && (
        <div className={`text-slate-500 dark:text-slate-400 mt-0.5 ${small ? 'text-[9px]' : 'text-[10px]'}`}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function MobileArrow() {
  return (
    <div className="flex justify-center py-1">
      <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
        <path
          d="M10 2L10 14M10 14L6 10M10 14L14 10"
          stroke="#f38020"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.5"
        />
      </svg>
    </div>
  );
}
