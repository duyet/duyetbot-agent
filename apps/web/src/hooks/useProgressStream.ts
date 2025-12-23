/**
 * useProgressStream Hook
 *
 * Connects to SSE endpoint for real-time execution progress updates.
 * Parses ExecutionStep events and provides them to components.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExecutionStep } from '../types/index';

/**
 * SSE event types from the progress endpoint
 */
interface SSEMessage {
  type: 'step' | 'complete' | 'error';
  data: ExecutionStep | { error: string };
}

/**
 * Connection state for the SSE stream
 */
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Result from useProgressStream hook
 */
interface UseProgressStreamResult {
  /** Execution steps received so far */
  steps: ExecutionStep[];
  /** Current connection state */
  connectionState: ConnectionState;
  /** Error message if connection failed */
  error: string | null;
  /** Whether the stream is complete */
  isComplete: boolean;
  /** Manually close the connection */
  disconnect: () => void;
  /** Manually reconnect */
  reconnect: () => void;
}

/**
 * Options for the progress stream
 */
interface ProgressStreamOptions {
  /** Callback when a new step arrives */
  onStep?: (step: ExecutionStep) => void;
  /** Callback when stream completes */
  onComplete?: () => void;
  /** Callback when error occurs */
  onError?: (error: string) => void;
  /** Auto-reconnect on connection loss (default: false) */
  autoReconnect?: boolean;
  /** Delay before auto-reconnect in ms (default: 1000) */
  reconnectDelay?: number;
}

/**
 * Parses an SSE line to extract event data
 */
function parseSSELine(line: string): SSEMessage | null {
  if (!line.startsWith('data: ')) {
    return null;
  }

  const data = line.slice(6);

  try {
    const parsed = JSON.parse(data);
    return parsed as SSEMessage;
  } catch {
    return null;
  }
}

/**
 * Connects to SSE endpoint and streams execution progress.
 *
 * @param sessionId - Session ID to stream progress for
 * @param baseUrl - Base URL for the API (default: /api)
 * @param options - Stream options
 *
 * @example
 * ```tsx
 * const { steps, connectionState, isComplete } = useProgressStream('session-123');
 *
 * if (connectionState === 'connecting') {
 *   return <div>Connecting...</div>;
 * }
 *
 * return <ToolInspector steps={steps} />;
 * ```
 */
export function useProgressStream(
  sessionId: string,
  baseUrl: string = '/api',
  options: ProgressStreamOptions = {}
): UseProgressStreamResult {
  const { onStep, onComplete, onError, autoReconnect = false, reconnectDelay = 1000 } = options;

  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Clean up the EventSource connection
   */
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * Manually disconnect the stream
   */
  const disconnect = useCallback(() => {
    cleanup();
    setConnectionState('disconnected');
    setIsComplete(true);
  }, [cleanup]);

  /**
   * Manually reconnect the stream
   */
  const reconnect = useCallback(() => {
    cleanup();
    setIsComplete(false);
    setError(null);
    setConnectionState('connecting');
  }, [cleanup]);

  /**
   * Connect to SSE endpoint
   */
  useEffect(() => {
    if (!sessionId || connectionState === 'connected' || isComplete) {
      return;
    }

    setConnectionState('connecting');
    setError(null);

    const url = `${baseUrl}/progress/${sessionId}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnectionState('connected');
      setError(null);
    };

    eventSource.onmessage = (event) => {
      const message = parseSSELine(`data: ${event.data}`);

      if (!message) {
        return;
      }

      switch (message.type) {
        case 'step': {
          const step = message.data as ExecutionStep;
          setSteps((prev) => [...prev, step]);
          onStep?.(step);
          break;
        }

        case 'complete': {
          setIsComplete(true);
          setConnectionState('disconnected');
          cleanup();
          onComplete?.();
          break;
        }

        case 'error': {
          const errorData = message.data as { error: string };
          const errorMessage = errorData.error || 'Unknown error';
          setError(errorMessage);
          setConnectionState('error');
          cleanup();
          onError?.(errorMessage);
          break;
        }
      }
    };

    eventSource.onerror = (err) => {
      console.error('[useProgressStream] SSE error:', err);

      if (autoReconnect && !isComplete) {
        setConnectionState('connecting');
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnect();
        }, reconnectDelay);
      } else {
        setConnectionState('error');
        setError('Connection lost');
        cleanup();
      }
    };

    return cleanup;
  }, [
    sessionId,
    baseUrl,
    isComplete,
    autoReconnect,
    reconnectDelay,
    cleanup,
    connectionState,
    onComplete,
    onError,
    onStep,
    reconnect,
  ]);

  /**
   * Clean up on unmount
   */
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    steps,
    connectionState,
    error,
    isComplete,
    disconnect,
    reconnect,
  };
}
