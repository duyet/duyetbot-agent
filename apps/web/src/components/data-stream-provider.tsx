'use client';

import type React from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import type { DataStreamDelta } from '@/hooks/use-data-stream';

/**
 * Data stream context value type
 */
interface DataStreamContextValue {
  /** Current buffer of stream deltas */
  dataStream: DataStreamDelta[];
  /** Set the entire stream buffer (for clearing after processing) */
  setDataStream: React.Dispatch<React.SetStateAction<DataStreamDelta[]>>;
}

const DataStreamContext = createContext<DataStreamContextValue | null>(null);

/**
 * React Context provider for data stream state management.
 *
 * Wraps child components with stream buffer state, allowing
 * components like DataStreamHandler to process streaming events
 * from the chat API without prop drilling.
 *
 * Key pattern: useState for buffer state, memoization to prevent
 * unnecessary re-renders of context consumers.
 *
 * @example
 * ```tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <DataStreamProvider>
 *       {children}
 *     </DataStreamProvider>
 *   );
 * }
 * ```
 */
export function DataStreamProvider({ children }: { children: React.ReactNode }) {
  const [dataStream, setDataStream] = useState<DataStreamDelta[]>([]);

  /**
   * Memoize context value to prevent unnecessary re-renders
   * Only recreates when dataStream reference changes
   */
  const value = useMemo(() => ({ dataStream, setDataStream }), [dataStream]);

  return <DataStreamContext.Provider value={value}>{children}</DataStreamContext.Provider>;
}

/**
 * Hook to access data stream context
 *
 * @throws {Error} If used outside of DataStreamProvider
 * @returns Data stream context value with buffer and mutators
 *
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const { dataStream, setDataStream } = useDataStream();
 *
 *   useEffect(() => {
 *     // Process dataStream...
 *     setDataStream([]);
 *   }, [dataStream]);
 *
 *   return <div>{message}</div>;
 * }
 * ```
 */
export function useDataStream() {
  const context = useContext(DataStreamContext);
  if (!context) {
    throw new Error(
      'useDataStream must be used within a DataStreamProvider. ' +
        'Wrap your component tree with <DataStreamProvider>.'
    );
  }
  return context;
}
