# SVG Architecture Diagram Components

Production-ready React components for rendering the duyetbot-agent system architecture in an interactive left-to-right flow diagram.

## Overview

Three complementary components work together to create a responsive, interactive architecture diagram:

1. **ArchitectureDiagram** - Main container (default export)
2. **FlowStage** - Individual stage columns
3. **ConnectionPath** - Animated connection paths

## ArchitectureDiagram

The main component that orchestrates the entire diagram.

### Props
None - the component is self-contained and manages its own state.

### Features
- **4-Stage Layout**: Platforms → Cloudflare Edge → Router → Agents
- **Responsive SVG**: Uses viewBox for scaling across screen sizes
- **Interactive State Management**: Tracks active/hovered agents
- **Path Highlighting**: Highlights connection paths on agent selection
- **Animations**: Subtle breathing effect (4s) and glow pulses (3s)
- **Dark Mode**: Compatible with dark theme via `currentColor`

### Usage
```typescript
import ArchitectureDiagram from '@/components/homepage/ArchitectureDiagram';

export default function HomePage() {
  return (
    <div className="w-full h-screen">
      <ArchitectureDiagram />
    </div>
  );
}
```

### State Structure
```typescript
interface DiagramState {
  activeAgent: AgentData | null;      // Currently selected agent
  hoveredAgent: AgentData | null;     // Currently hovered agent
  highlightedPath: string[];          // IDs of agents in highlighted path
  isPanelOpen: boolean;               // Whether detail panel is open
}
```

### Styling
- Uses SVG native attributes for all styling
- `currentColor` for theme-aware coloring
- Opacity patterns for light/dark mode compatibility
- Tailwind CSS classes for container and interactive elements

## FlowStage

Renders a single column in the diagram (stage).

### Props
```typescript
interface FlowStageProps {
  stage: FlowStageData;              // Stage configuration and items
  activeAgent: AgentData | null;     // Currently active agent
  onAgentClick: (agent: AgentData) => void;
  onAgentHover: (agent: AgentData | null) => void;
}
```

### Features
- **Three Item Types**:
  - `AgentData`: Colored circles with rings and labels (interactive)
  - `PlatformData`: Rounded rectangles with icons
  - Generic labels: Small text boxes

- **Smart Layout**: Automatically adjusts spacing based on item count
- **Visual States**:
  - Normal: 18px radius, 0.4 stroke opacity
  - Active: 22px radius, 1.0 stroke opacity, glow effect
  - Hovered: Increased stroke opacity

- **Type-Safe Detection**: Uses discriminator functions to identify item types

### Item Rendering
#### Agent Nodes
- Outer circle: Color fill at 0.1 opacity (0.25 when active)
- Stroke: Color-dependent, 1.5-2.5px thickness
- Inner circle: Color fill at 0.15 opacity (0.4 when active)
- Label: 2-character abbreviation, color-coded

#### Platform Nodes
- Rounded rectangle: 40x32px
- Color fill at 0.12 opacity
- Icon/label: Platform code (TG, GH, ...)

## ConnectionPath

Renders individual SVG paths connecting nodes between stages.

### Props
```typescript
interface ConnectionPathProps {
  from: { x: number; y: number };   // Source node coordinates
  to: { x: number; y: number };     // Target node coordinates
  animated?: boolean;               // Enable flow animation
  highlighted?: boolean;            // Highlighted state
  color?: string;                   // Stroke color (default: currentColor)
}
```

### Features
- **Smooth Bezier Curves**: Quadratic bezier with calculated control points
- **Gradient Strokes**: Linear gradient for visual depth
- **Animated Flow**: Optional flowing dot animation (3s loop)
- **Smart Highlighting**: 2-3px stroke width, enhanced opacity
- **Depth Effect**: Subtle background line for visual layering
- **Hover Zones**: 20px transparent hit area for better UX

### Gradient Details
- Start: 30% opacity
- Middle: 70% opacity
- End: 30% opacity
- Creates natural flow appearance

## Layout Constants

From `constants.ts`:

```typescript
const DIAGRAM_CONFIG = {
  viewBox: { width: 900, height: 400 },
  padding: 40,
  stageGap: 200,
  nodeSize: { sm: 32, md: 48, lg: 64 },
  stages: {
    inputs: { x: 80, width: 100 },
    edge: { x: 280, width: 140 },
    routing: { x: 500, width: 120 },
    agents: { x: 720, width: 160 },
  },
};
```

## Data Flow

### Input Stage (3 items)
- Telegram
- GitHub
- Future Platforms

### Edge Stage (2 items)
- Workers
- Durable Objects (DO)
- Subtitle: <100ms

### Routing Stage (1 item)
- RouterAgent (hybrid classifier)

### Agents Stage (5 items)
- SimpleAgent (quick responses)
- OrchestratorAgent (task planner)
- HITLAgent (human-in-loop)
- LeadResearcherAgent (research coordinator)
- DuyetInfoAgent (knowledge retrieval)

### Connections (13 total)
```
telegram → edge
github → edge
future → edge
edge → router
router → simple
router → orchestrator
router → hitl
router → lead-researcher
router → duyet-info
orchestrator → code-worker
orchestrator → research-worker
orchestrator → github-worker
lead-researcher → research-worker
```

## Colors

All colors inherited from `constants.ts`:

| Agent | Color | Hex | Tailwind |
|-------|-------|-----|----------|
| Router | Purple | #a855f7 | purple-500 |
| Simple | Green | #22c55e | green-500 |
| Orchestrator | Blue | #3b82f6 | blue-500 |
| HITL | Orange | #f97316 | orange-500 |
| Lead Researcher | Cyan | #06b6d4 | cyan-500 |
| Duyet Info | Yellow | #eab308 | yellow-500 |
| Code Worker | Slate | #64748b | slate-500 |
| Research Worker | Slate | #64748b | slate-500 |
| GitHub Worker | Slate | #64748b | slate-500 |
| Telegram | Sky | #0088cc | sky-500 |
| GitHub | Violet | #6e40c9 | violet-500 |

## Accessibility

- **Semantic SVG**: Uses `<g>`, `<path>`, `<circle>` elements appropriately
- **Tooltips**: Title elements provide hover text for all nodes
- **Keyboard Navigation**: Links through to agent selection
- **ARIA Labels**: Can be extended with `aria-label` attributes

## Performance

- **useMemo**: Flow stage data is memoized to prevent recalculation
- **Efficient State**: State updates are batched
- **SVG Rendering**: Native rendering avoids DOM overhead
- **Event Delegation**: Minimal event handlers with proper cleanup

## Dark Mode Support

All components use `currentColor` and opacity patterns:

```css
/* Light mode (default) */
color: inherit; /* inherits from parent (dark text) */
opacity: 0.7;

/* Dark mode */
color: inherit; /* inherits from parent (light text) */
opacity: 0.7;
```

The colors themselves are absolute hex values, but opacity ensures consistency across themes.

## Animation Details

### Breathing Animation (4s)
```css
@keyframes breathe {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}
```

### Glow Pulse (3s)
```css
@keyframes glow-pulse {
  0%, 100% { filter: drop-shadow(0 0 4px rgba(139, 92, 246, 0.2)); }
  50% { filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.4)); }
}
```

### Flow Dot (3s)
```css
@keyframes flowDot {
  0% { offset-distance: 0%; }
  100% { offset-distance: 100%; }
}
```

## TypeScript

All components are fully typed:

- `ConnectionPathProps` - Connection path configuration
- `FlowStageProps` - Stage configuration with handlers
- `FlowStageData` - Stage data structure
- `AgentData` - Agent node information
- `PlatformData` - Platform input information
- `DiagramState` - Component state interface

## Integration

The components are designed to work seamlessly with:

- **Fumadocs**: Documentation theme and color system
- **Next.js 15**: App Router with React 19
- **Tailwind CSS**: Utility classes for container/wrapper styling
- **TypeScript**: Strict mode compatible

## Testing

To verify components:

```bash
# Type checking
bun run check --filter "@duyetbot/docs"

# Building
bun run build --filter "@duyetbot/docs"

# Testing (if tests are added)
bun run test --filter "@duyetbot/docs"
```

## Files

- `ArchitectureDiagram.tsx` - Main component (285 lines)
- `FlowStage.tsx` - Stage renderer (234 lines)
- `ConnectionPath.tsx` - Connection paths (104 lines)
- `types.ts` - Type definitions (shared)
- `constants.ts` - Data and config (shared)

Total: ~623 lines of production code
