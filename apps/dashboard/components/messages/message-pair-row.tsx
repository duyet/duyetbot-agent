'use client';

import type { AnalyticsMessage } from '@duyetbot/analytics';
import { Bot, Eye, EyeOff, Users, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface MessagePair {
  user: AnalyticsMessage | null;
  assistant: AnalyticsMessage | null;
}

interface MessagePairRowProps {
  pair: MessagePair;
  allExpanded: boolean;
  expandedMessage: string | null;
  onToggleExpand: (messageId: string | null) => void;
}

/**
 * Detect if a message content indicates an error response
 */
export function isErrorResponse(msg: AnalyticsMessage | null): boolean {
  if (!msg) {
    return false;
  }

  // Check metadata for error indicators
  const metadata = msg.metadata as Record<string, unknown> | undefined;
  if (metadata?.error || metadata?.lastToolError || metadata?.errorMessage) {
    return true;
  }

  // Check content for common error patterns
  const content = msg.content?.toLowerCase() ?? '';
  const errorPatterns = [
    /^error:/i,
    /^failed:/i,
    /\[error\]/i,
    /exception occurred/i,
    /internal server error/i,
    /timeout exceeded/i,
    /rate limit/i,
  ];

  return errorPatterns.some((pattern) => pattern.test(content));
}

export function formatTimestamp(ts: number | null | undefined): string {
  if (ts == null) {
    return 'Unknown';
  }
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (minutes < 1) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatFullTimestamp(ts: number | null | undefined): string {
  if (ts == null) {
    return 'Unknown';
  }
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Pairs user messages with their corresponding assistant responses.
 * Uses hybrid approach:
 * 1. First tries to match via triggerMessageId (explicit FK relationship)
 * 2. Falls back to sequential matching for legacy data
 */
export function createMessagePairs(messages: AnalyticsMessage[]): MessagePair[] {
  const pairs: MessagePair[] = [];
  const sorted = [...messages].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

  // Build lookup: triggerMessageId → assistant message (for explicit pairing)
  const assistantByTrigger = new Map<string, AnalyticsMessage>();
  for (const msg of sorted) {
    if (msg.role === 'assistant' && msg.triggerMessageId) {
      assistantByTrigger.set(msg.triggerMessageId, msg);
    }
  }

  // Track which assistant messages have been paired (to avoid duplicates)
  const pairedAssistants = new Set<string>();

  // First pass: pair user messages with their responses
  for (const msg of sorted) {
    if (msg.role === 'user') {
      // Try explicit pairing via triggerMessageId first
      const explicitResponse = assistantByTrigger.get(msg.messageId);
      if (explicitResponse) {
        pairs.push({ user: msg, assistant: explicitResponse });
        pairedAssistants.add(explicitResponse.messageId);
      } else {
        // Fallback: find next unpaired assistant message in sequence
        const msgIndex = sorted.indexOf(msg);
        let foundResponse: AnalyticsMessage | null = null;

        for (let j = msgIndex + 1; j < sorted.length; j++) {
          const candidate = sorted[j];
          if (candidate.role === 'user') {
            break; // Stop at next user message
          }
          if (candidate.role === 'assistant' && !pairedAssistants.has(candidate.messageId)) {
            foundResponse = candidate;
            pairedAssistants.add(candidate.messageId);
            break;
          }
        }

        pairs.push({ user: msg, assistant: foundResponse });
      }
    }
  }

  // Second pass: add any orphan assistant messages (rare)
  for (const msg of sorted) {
    if (msg.role === 'assistant' && !pairedAssistants.has(msg.messageId)) {
      pairs.push({ user: null, assistant: msg });
    }
  }

  return pairs;
}

/**
 * Renders a single message pair row (User | Assistant)
 */
export function MessagePairRow({
  pair,
  allExpanded,
  expandedMessage,
  onToggleExpand,
}: MessagePairRowProps) {
  const userKey = pair.user?.messageId || `user-orphan-${pair.assistant?.messageId}`;
  const assistantKey = pair.assistant?.messageId || `assistant-orphan-${pair.user?.messageId}`;
  const isUserExpanded = allExpanded || expandedMessage === userKey;
  const isAssistantExpanded = allExpanded || expandedMessage === assistantKey;
  const hasError = isErrorResponse(pair.assistant);

  return (
    <div className="grid grid-cols-2 gap-4 py-3">
      {/* User Cell */}
      <div
        className={
          pair.user
            ? 'rounded-lg border border-primary/20 bg-primary/5 p-3'
            : 'flex items-center justify-center rounded-lg border border-dashed border-border/30 p-3 text-muted-foreground italic'
        }
      >
        {pair.user ? (
          <>
            <div className={`text-sm leading-relaxed ${isUserExpanded ? '' : 'line-clamp-4'}`}>
              <pre className="whitespace-pre-wrap font-sans">{pair.user.content}</pre>
            </div>
            {!allExpanded && pair.user.content && pair.user.content.length > 200 && (
              <button
                type="button"
                onClick={() => onToggleExpand(isUserExpanded ? null : userKey)}
                className="mt-1 text-xs font-medium text-primary hover:underline"
              >
                {isUserExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span title={formatFullTimestamp(pair.user.createdAt)}>
                {formatTimestamp(pair.user.createdAt)}
              </span>
              {pair.user.visibility && (
                <>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                  <span className="flex items-center gap-0.5">
                    {pair.user.visibility === 'public' ? (
                      <Eye className="h-3 w-3" />
                    ) : (
                      <EyeOff className="h-3 w-3" />
                    )}
                    {pair.user.visibility}
                  </span>
                </>
              )}
            </div>
          </>
        ) : (
          <span className="text-xs">—</span>
        )}
      </div>

      {/* Assistant Cell */}
      <div
        className={
          pair.assistant
            ? hasError
              ? 'rounded-lg border border-destructive/30 bg-destructive/5 p-3'
              : 'rounded-lg border border-success/20 bg-success/5 p-3'
            : 'flex items-center justify-center rounded-lg border border-dashed border-border/30 p-3 text-muted-foreground italic'
        }
      >
        {pair.assistant ? (
          <>
            <div className="mb-1 flex items-center gap-2">
              {hasError && (
                <Badge variant="destructive" className="text-[10px]">
                  Error
                </Badge>
              )}
              {pair.assistant.model && (
                <span className="text-xs text-muted-foreground opacity-70">
                  {pair.assistant.model}
                </span>
              )}
            </div>
            <div className={`text-sm leading-relaxed ${isAssistantExpanded ? '' : 'line-clamp-4'}`}>
              <pre className="whitespace-pre-wrap font-sans">{pair.assistant.content}</pre>
            </div>
            {!allExpanded && pair.assistant.content && pair.assistant.content.length > 200 && (
              <button
                type="button"
                onClick={() => onToggleExpand(isAssistantExpanded ? null : assistantKey)}
                className={`mt-1 text-xs font-medium hover:underline ${hasError ? 'text-destructive' : 'text-success'}`}
              >
                {isAssistantExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span title={formatFullTimestamp(pair.assistant.createdAt)}>
                {formatTimestamp(pair.assistant.createdAt)}
              </span>
              {(pair.assistant.inputTokens > 0 || pair.assistant.outputTokens > 0) && (
                <>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {pair.assistant.inputTokens > 0 && `${pair.assistant.inputTokens} in`}
                    {pair.assistant.inputTokens > 0 && pair.assistant.outputTokens > 0 && ' / '}
                    {pair.assistant.outputTokens > 0 && `${pair.assistant.outputTokens} out`}
                  </span>
                </>
              )}
              {pair.assistant.cachedTokens > 0 && (
                <>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                  <span className="text-success">{pair.assistant.cachedTokens} cached</span>
                </>
              )}
            </div>
          </>
        ) : (
          <span className="text-xs">no response</span>
        )}
      </div>
    </div>
  );
}

/**
 * Header row for message pairs
 */
export function MessagePairHeader() {
  return (
    <div className="grid grid-cols-2 gap-4 pb-2 text-xs font-medium">
      <div className="flex items-center gap-2 text-primary">
        <Users className="h-4 w-4" />
        User
      </div>
      <div className="flex items-center gap-2 text-success">
        <Bot className="h-4 w-4" />
        Assistant
      </div>
    </div>
  );
}
