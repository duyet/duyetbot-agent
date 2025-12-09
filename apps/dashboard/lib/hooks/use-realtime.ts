'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Real-time event from SSE stream
 */
export interface RealtimeEvent {
  type: 'connected' | 'message' | 'step' | 'error' | 'system';
  data: unknown;
  id?: string;
  timestamp: number;
}

export interface StreamMessageEvent {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  platform: string;
  userId: string;
  inputTokens: number;
  outputTokens: number;
  createdAt: number;
}

export interface StreamStepEvent {
  id: string;
  eventId: string;
  agentName: string;
  agentType: string;
  status: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  createdAt: number;
}

interface UseRealtimeOptions {
  /** Event types to subscribe to */
  types?: ('message' | 'step' | 'event')[];
  /** Maximum number of events to keep in history */
  maxEvents?: number;
  /** Auto-connect on mount */
  autoConnect?: boolean;
}

interface UseRealtimeReturn {
  /** Whether connected to SSE stream */
  connected: boolean;
  /** Recent events from the stream */
  events: RealtimeEvent[];
  /** Recent messages */
  messages: StreamMessageEvent[];
  /** Recent agent steps */
  steps: StreamStepEvent[];
  /** Connection error if any */
  error: string | null;
  /** Connect to the stream */
  connect: () => void;
  /** Disconnect from the stream */
  disconnect: () => void;
  /** Clear event history */
  clearEvents: () => void;
}

/**
 * Hook to consume SSE stream from /api/stream
 *
 * @example
 * ```tsx
 * const { connected, messages, steps, connect, disconnect } = useRealtime({
 *   types: ['message', 'step'],
 *   maxEvents: 100,
 * });
 * ```
 */
export function useRealtime(options: UseRealtimeOptions = {}): UseRealtimeReturn {
  const { types = ['message', 'step'], maxEvents = 100, autoConnect = true } = options;

  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [messages, setMessages] = useState<StreamMessageEvent[]>([]);
  const [steps, setSteps] = useState<StreamStepEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const addEvent = useCallback(
    (event: RealtimeEvent) => {
      setEvents((prev) => {
        const newEvents = [event, ...prev];
        return newEvents.slice(0, maxEvents);
      });
    },
    [maxEvents]
  );

  const handleMessage = useCallback(
    (data: StreamMessageEvent) => {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === data.id)) {
          return prev;
        }
        const newMessages = [data, ...prev];
        return newMessages.slice(0, maxEvents);
      });
    },
    [maxEvents]
  );

  const handleStep = useCallback(
    (data: StreamStepEvent) => {
      setSteps((prev) => {
        // Avoid duplicates
        if (prev.some((s) => s.id === data.id)) {
          return prev;
        }
        const newSteps = [data, ...prev];
        return newSteps.slice(0, maxEvents);
      });
    },
    [maxEvents]
  );

  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/stream?types=${types.join(',')}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
    };

    eventSource.onerror = () => {
      setConnected(false);
      setError('Connection lost. Attempting to reconnect...');

      // Auto-reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    };

    // Handle 'connected' event
    eventSource.addEventListener('connected', (e: Event) => {
      const messageEvent = e as globalThis.MessageEvent;
      const data = JSON.parse(messageEvent.data);
      addEvent({
        type: 'connected',
        data,
        timestamp: Date.now(),
      });
    });

    // Handle 'message' events
    eventSource.addEventListener('message', (e: Event) => {
      const messageEvent = e as globalThis.MessageEvent;
      const data = JSON.parse(messageEvent.data);
      handleMessage(data);
      addEvent({
        type: 'message',
        data,
        id: data.id,
        timestamp: Date.now(),
      });
    });

    // Handle 'step' events
    eventSource.addEventListener('step', (e: Event) => {
      const messageEvent = e as globalThis.MessageEvent;
      const data = JSON.parse(messageEvent.data);
      handleStep(data);
      addEvent({
        type: 'step',
        data,
        id: data.id,
        timestamp: Date.now(),
      });
    });

    // Handle 'error' events
    eventSource.addEventListener('error', (e: Event) => {
      try {
        const messageEvent = e as globalThis.MessageEvent;
        if (messageEvent.data) {
          const data = JSON.parse(messageEvent.data);
          setError(data.message || 'Unknown error');
          addEvent({
            type: 'error',
            data,
            timestamp: Date.now(),
          });
        }
      } catch {
        // SSE error, not a data event
      }
    });

    // Handle 'system' events
    eventSource.addEventListener('system', (e: Event) => {
      const messageEvent = e as globalThis.MessageEvent;
      const data = JSON.parse(messageEvent.data);
      addEvent({
        type: 'system',
        data,
        timestamp: Date.now(),
      });
    });
  }, [types, addEvent, handleMessage, handleStep]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setMessages([]);
    setSteps([]);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    connected,
    events,
    messages,
    steps,
    error,
    connect,
    disconnect,
    clearEvents,
  };
}
