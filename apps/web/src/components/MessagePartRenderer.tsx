/**
 * MessagePartRenderer Component
 *
 * Renders UIMessage parts array using ai-elements components.
 * Supports text, reasoning, tool, sources, and other UI part types.
 */

'use client';

import type { DynamicToolUIPart, ReasoningUIPart, TextUIPart } from 'ai';
import { memo } from 'react';
import { CodeBlock } from './ai-elements/code-block';
import { MessageResponse } from './ai-elements/message';
import { Reasoning, ReasoningContent, ReasoningTrigger } from './ai-elements/reasoning';
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from './ai-elements/tool';

/**
 * Union type of all UI parts we support rendering
 * Uses a flexible approach to handle various tool part types
 */
type SupportedUIPart = TextUIPart | ReasoningUIPart | DynamicToolUIPart | Record<string, unknown>;

/**
 * Props for MessagePartRenderer
 */
interface MessagePartRendererProps {
  /** Array of UI parts to render */
  parts: readonly SupportedUIPart[];
  /** Current status of the message (e.g., 'streaming', 'completed') */
  status?: string;
}

/**
 * Check if a part is a tool part (static or dynamic)
 */
function isToolPart(part: SupportedUIPart): part is DynamicToolUIPart & {
  state?: string;
  toolName?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
} {
  const type = (part as { type?: string }).type || '';
  return (
    type === 'dynamic-tool' || type.startsWith('tool-') || (type === 'tool' && 'state' in part)
  );
}

/**
 * Check if a part is a reasoning part
 */
function isReasoningPart(part: SupportedUIPart): part is ReasoningUIPart {
  return (part as { type?: string }).type === 'reasoning';
}

/**
 * Render a single tool part
 */
const ToolPartRenderer = memo(function ToolPartRenderer({
  part,
}: {
  part: DynamicToolUIPart & {
    state?: string;
    toolName?: string;
    input?: Record<string, unknown>;
    output?: unknown;
    errorText?: string;
  };
}) {
  const toolName = part.toolName || part.title || 'tool';
  const hasInput = part.input && Object.keys(part.input).length > 0;
  const hasOutput = part.output || part.errorText;

  return (
    <Tool defaultOpen={part.state === 'output-error'}>
      <ToolHeader
        state={(part.state as any) || 'input-available'}
        type={part.type as any}
        title={toolName}
      />

      {(hasInput || hasOutput) && (
        <ToolContent>
          {hasInput && <ToolInput input={part.input} />}
          {hasOutput && <ToolOutput output={part.output} errorText={part.errorText} />}
        </ToolContent>
      )}
    </Tool>
  );
});

/**
 * Render a single part based on its type
 */
const PartRenderer = memo(function PartRenderer({
  part,
  isStreaming,
}: {
  part: SupportedUIPart;
  isStreaming: boolean;
}) {
  // Text part - render as markdown
  if (part.type === 'text') {
    return <MessageResponse>{(part as TextUIPart).text}</MessageResponse>;
  }

  // Tool part - render tool execution details
  if (isToolPart(part)) {
    return <ToolPartRenderer part={part} />;
  }

  // Reasoning part - use Reasoning component
  if (isReasoningPart(part)) {
    return (
      <Reasoning isStreaming={isStreaming} defaultOpen={isStreaming}>
        <ReasoningTrigger />
        <ReasoningContent>{(part as ReasoningUIPart).text}</ReasoningContent>
      </Reasoning>
    );
  }

  // Unknown part type - render as JSON for debugging
  const partType = (part as { type?: string }).type || 'unknown';
  return (
    <div className="not-prose mb-4 rounded-md border border-dashed border-muted-foreground/50 p-3">
      <p className="text-xs text-muted-foreground mb-1">Unknown part type: {String(partType)}</p>
      <CodeBlock code={JSON.stringify(part, null, 2)} language="json" />
    </div>
  );
});

/**
 * Renders an array of message parts using appropriate components for each type.
 *
 * @example
 * ```tsx
 * <MessagePartRenderer parts={message.parts} />
 * ```
 */
export function MessagePartRenderer({ parts, status }: MessagePartRendererProps) {
  if (!parts || parts.length === 0) {
    return null;
  }

  const isStreaming = status === 'streaming' || status === 'pending';

  return (
    <div className="flex flex-col gap-0">
      {parts.map((part, index) => (
        <PartRenderer key={index} part={part} isStreaming={isStreaming} />
      ))}
    </div>
  );
}
