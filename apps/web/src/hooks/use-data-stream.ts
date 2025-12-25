/**
 * useDataStream Hook
 *
 * Manages streaming data deltas from the chat API.
 * Buffers incoming stream events for batch processing.
 */

import { useCallback, useState } from 'react';

/**
 * Data stream delta types
 */
export type DataStreamDeltaType =
  | 'data-kind'
  | 'data-id'
  | 'data-title'
  | 'data-clear'
  | 'data-finish'
  | 'text-delta'
  | 'tool-call-delta'
  | 'tool-result';

/**
 * Generic data stream delta
 */
export interface DataStreamDelta {
  /** Type of the delta event */
  type: DataStreamDeltaType;
  /** Associated data (varies by type) */
  data: unknown;
}

/**
 * Result from useDataStream hook
 */
interface UseDataStreamResult {
  /** Current buffer of stream deltas */
  dataStream: DataStreamDelta[];
  /** Add a new delta to the buffer */
  appendDataStream: (delta: DataStreamDelta) => void;
  /** Clear the delta buffer (called after processing) */
  setDataStream: (deltas: DataStreamDelta[]) => void;
}

/**
 * Manages streaming data deltas for artifact updates.
 *
 * Buffers incoming stream events and provides a method to clear
 * after processing. This pattern enables batch processing of
 * stream events without excessive re-renders.
 *
 * @example
 * ```tsx
 * const { dataStream, appendDataStream, setDataStream } = useDataStream();
 *
 * // Process buffered deltas
 * useEffect(() => {
 *   for (const delta of dataStream) {
 *     // Handle each delta type
 *   }
 *   setDataStream([]);
 * }, [dataStream]);
 *
 * // Add new deltas from chat stream
 * onTextDelta={(text) => appendDataStream({ type: 'text-delta', data: text })}
 * ```
 */
export function useDataStream(): UseDataStreamResult {
  const [dataStream, setDataStreamState] = useState<DataStreamDelta[]>([]);

  /**
   * Append a new delta to the buffer
   */
  const appendDataStream = useCallback((delta: DataStreamDelta) => {
    setDataStreamState((prev) => [...prev, delta]);
  }, []);

  /**
   * Set the entire delta buffer (for clearing after processing)
   */
  const setDataStream = useCallback((deltas: DataStreamDelta[]) => {
    setDataStreamState(deltas);
  }, []);

  return {
    dataStream,
    appendDataStream,
    setDataStream,
  };
}
