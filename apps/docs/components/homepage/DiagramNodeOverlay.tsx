'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

export interface DiagramNode {
  id: string;
  title: string;
  description: string;
  href: string;
  bounds: { x: number; y: number; width: number; height: number };
}

interface DiagramNodeOverlayProps {
  nodes: DiagramNode[];
  viewBox?: { width: number; height: number };
}

export function DiagramNodeOverlay({
  nodes,
  viewBox = { width: 1000, height: 420 },
}: DiagramNodeOverlayProps) {
  const router = useRouter();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, href: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        router.push(href);
      }
    },
    [router]
  );

  const handleMouseEnter = useCallback((nodeId: string, bounds: DiagramNode['bounds']) => {
    setHoveredNode(nodeId);
    setTooltipPos({
      x: bounds.x + bounds.width / 2,
      y: bounds.y,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredNode(null);
    setTooltipPos(null);
  }, []);

  const hoveredNodeData = nodes.find((n) => n.id === hoveredNode);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      {/* Clickable overlay regions */}
      {nodes.map((node) => (
        <button
          key={node.id}
          type="button"
          className="absolute pointer-events-auto cursor-pointer rounded-lg border-2 border-transparent transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 hover:bg-blue-500/10 hover:border-blue-500/30"
          style={{
            left: `${(node.bounds.x / viewBox.width) * 100}%`,
            top: `${(node.bounds.y / viewBox.height) * 100}%`,
            width: `${(node.bounds.width / viewBox.width) * 100}%`,
            height: `${(node.bounds.height / viewBox.height) * 100}%`,
          }}
          onClick={() => handleClick(node.href)}
          onKeyDown={(e) => handleKeyDown(e, node.href)}
          onMouseEnter={() => handleMouseEnter(node.id, node.bounds)}
          onMouseLeave={handleMouseLeave}
          onFocus={() => handleMouseEnter(node.id, node.bounds)}
          onBlur={handleMouseLeave}
          aria-label={`${node.title}: ${node.description}. Click to view documentation.`}
          tabIndex={0}
        />
      ))}

      {/* Tooltip */}
      {hoveredNodeData && tooltipPos && (
        <div
          className="absolute z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{
            left: `${(tooltipPos.x / viewBox.width) * 100}%`,
            top: `${(tooltipPos.y / viewBox.height) * 100}%`,
            marginTop: '-8px',
          }}
        >
          <div className="bg-fd-card border border-fd-border rounded-lg px-3 py-2 shadow-lg max-w-[200px]">
            <div className="text-xs font-semibold text-fd-foreground">{hoveredNodeData.title}</div>
            <div className="text-[10px] text-fd-muted-foreground mt-0.5">
              {hoveredNodeData.description}
            </div>
          </div>
          {/* Arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-fd-card" />
        </div>
      )}
    </div>
  );
}

// POC nodes for testing - coordinates based on desktop SVG viewBox (1000x420)
// Note: These should match the diagramNodes in ArchitectureSection.tsx
export const POC_NODES: DiagramNode[] = [
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
