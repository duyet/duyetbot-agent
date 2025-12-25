'use client';

import { useEffect } from 'react';
import { useDataStream } from '@/components/data-stream-provider';
import { type ArtifactKind, useArtifact } from '@/hooks/use-artifact';

/**
 * DataStreamHandler Component
 *
 * Headless component that processes streaming data from the chat API
 * and updates artifact state accordingly. Listens for data-kind, data-id,
 * data-title, data-clear, and data-finish events.
 *
 * This component subscribes to the data stream context and processes
 * each delta according to its type. After processing all deltas,
 * it clears the buffer to prevent reprocessing.
 *
 * @example
 * ```tsx
 * <DataStreamProvider>
 *   <DataStreamHandler />
 *   <ChatInterface />
 * </DataStreamProvider>
 * ```
 */
export function DataStreamHandler() {
  const { dataStream, setDataStream } = useDataStream();
  const { artifact, setArtifact, setMetadata } = useArtifact();

  useEffect(() => {
    if (!dataStream?.length) {
      return;
    }

    // Process and clear in one operation
    const newDeltas = dataStream.slice();
    setDataStream([]);

    for (const delta of newDeltas) {
      switch (delta.type) {
        case 'data-kind': {
          // Set artifact type/kind with validation
          const kind = String(delta.data) as ArtifactKind;
          if (['text', 'code', 'sheet', 'image'].includes(kind)) {
            setArtifact((prev) => ({
              ...prev,
              kind,
              status: 'streaming',
            }));
          }
          break;
        }

        case 'data-id': {
          // Set document ID and mark as streaming
          const documentId = String(delta.data);
          setArtifact((prev) => ({
            ...prev,
            documentId,
            status: 'streaming',
          }));
          break;
        }

        case 'data-title': {
          // Set artifact title and mark as streaming
          const title = String(delta.data);
          setArtifact((prev) => ({
            ...prev,
            title,
            status: 'streaming',
          }));
          break;
        }

        case 'data-clear': {
          // Clear artifact content (but keep other metadata)
          setArtifact((prev) => ({
            ...prev,
            content: '',
            status: 'streaming',
          }));
          break;
        }

        case 'data-finish': {
          // Mark artifact as complete/idle
          setArtifact((prev) => ({
            ...prev,
            status: 'idle',
          }));

          // Update metadata with timestamps
          if (artifact.documentId && artifact.documentId !== 'init') {
            setMetadata({
              documentId: artifact.documentId,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          }
          break;
        }

        // text-delta, tool-call-delta, and tool-result are handled elsewhere
        // (typically by the useChat hook for message content)
        default:
          break;
      }
    }
  }, [dataStream, setArtifact, setMetadata, artifact.documentId, setDataStream]);

  // Headless component - no UI
  return null;
}
