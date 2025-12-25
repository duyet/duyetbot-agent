/**
 * useArtifact Hook
 *
 * Manages artifact state for the chat web application.
 * Artifacts are generated content (code, sheets, images) that can be displayed
 * in a separate panel alongside the chat.
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * Artifact type/kind
 */
export type ArtifactKind = 'text' | 'code' | 'sheet' | 'image';

/**
 * Artifact status
 */
export type ArtifactStatus = 'idle' | 'streaming';

/**
 * Bounding box for artifact positioning
 */
export interface BoundingBox {
  /** Top position in pixels */
  top: number;
  /** Left position in pixels */
  left: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/**
 * UI Artifact data structure
 */
export interface UIArtifact {
  /** Unique document identifier */
  documentId: string;
  /** Artifact content */
  content: string;
  /** Type of artifact */
  kind: ArtifactKind;
  /** Display title */
  title: string;
  /** Current status */
  status: ArtifactStatus;
  /** Whether artifact is visible in UI */
  isVisible: boolean;
  /** Positioning bounds */
  boundingBox: BoundingBox;
}

/**
 * Artifact metadata (optional, loaded separately)
 */
export interface ArtifactMetadata {
  documentId: string;
  createdAt: number;
  updatedAt: number;
  language?: string;
  [key: string]: unknown;
}

/**
 * Initial/empty artifact state
 */
export const initialArtifactData: UIArtifact = {
  documentId: 'init',
  content: '',
  kind: 'text',
  title: '',
  status: 'idle',
  isVisible: false,
  boundingBox: { top: 0, left: 0, width: 0, height: 0 },
};

/**
 * Result from useArtifact hook
 */
interface UseArtifactResult {
  /** Current artifact state */
  artifact: UIArtifact;
  /** Update artifact state */
  setArtifact: (updater: UIArtifact | ((current: UIArtifact) => UIArtifact)) => void;
  /** Artifact metadata (if loaded) */
  metadata: ArtifactMetadata | null;
  /** Update metadata */
  setMetadata: (metadata: ArtifactMetadata | null) => void;
  /** Reset artifact to initial state */
  resetArtifact: () => void;
}

/**
 * Storage keys
 */
const ARTIFACT_KEY = 'chat_web_artifact';
const ARTIFACT_METADATA_KEY_PREFIX = 'chat_web_artifact_metadata_';

/**
 * Manages artifact state for generated content panels.
 *
 * @example
 * ```tsx
 * const { artifact, setArtifact, metadata, resetArtifact } = useArtifact();
 *
 * const showCodeArtifact = (code: string, title: string) => {
 *   setArtifact({
 *     ...initialArtifactData,
 *     documentId: nanoid(),
 *     kind: 'code',
 *     content: code,
 *     title,
 *     status: 'idle',
 *     isVisible: true,
 *     boundingBox: { top: 0, left: 0, width: 800, height: 600 },
 *   });
 * };
 *
 * return <ArtifactPanel artifact={artifact} onClose={resetArtifact} />;
 * ```
 */
export function useArtifact(): UseArtifactResult {
  const [artifact, setArtifactState] = useState<UIArtifact>(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(ARTIFACT_KEY);
        if (cached) {
          return JSON.parse(cached) as UIArtifact;
        }
      } catch {
        // Ignore cache errors
      }
    }
    return initialArtifactData;
  });

  const [metadata, setMetadataState] = useState<ArtifactMetadata | null>(() => {
    // Load metadata for current artifact
    if (typeof window !== 'undefined' && artifact.documentId !== 'init') {
      try {
        const key = `${ARTIFACT_METADATA_KEY_PREFIX}${artifact.documentId}`;
        const cached = localStorage.getItem(key);
        if (cached) {
          return JSON.parse(cached) as ArtifactMetadata;
        }
      } catch {
        // Ignore cache errors
      }
    }
    return null;
  });

  /**
   * Update artifact state and persist to localStorage
   */
  const setArtifact = useCallback((updater: UIArtifact | ((current: UIArtifact) => UIArtifact)) => {
    setArtifactState((current) => {
      const newValue =
        typeof updater === 'function'
          ? (updater as (current: UIArtifact) => UIArtifact)(current)
          : updater;

      // Persist to localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(ARTIFACT_KEY, JSON.stringify(newValue));
        } catch (err) {
          console.error('[useArtifact] Failed to cache artifact:', err);
        }
      }

      return newValue;
    });
  }, []);

  /**
   * Update metadata for current artifact
   */
  const setMetadata = useCallback((newMetadata: ArtifactMetadata | null) => {
    setMetadataState(newMetadata);

    if (typeof window !== 'undefined' && newMetadata) {
      try {
        const key = `${ARTIFACT_METADATA_KEY_PREFIX}${newMetadata.documentId}`;
        localStorage.setItem(key, JSON.stringify(newMetadata));
      } catch (err) {
        console.error('[useArtifact] Failed to cache metadata:', err);
      }
    }
  }, []);

  /**
   * Reset artifact to initial state
   */
  const resetArtifact = useCallback(() => {
    setArtifact(initialArtifactData);
    setMetadata(null);
  }, [setArtifact, setMetadata]);

  // Clear metadata when documentId changes
  useEffect(() => {
    if (artifact.documentId !== 'init') {
      try {
        const key = `${ARTIFACT_METADATA_KEY_PREFIX}${artifact.documentId}`;
        const cached = localStorage.getItem(key);
        if (cached) {
          setMetadataState(JSON.parse(cached) as ArtifactMetadata);
        } else {
          setMetadataState(null);
        }
      } catch {
        setMetadataState(null);
      }
    } else {
      setMetadataState(null);
    }
  }, [artifact.documentId]);

  return {
    artifact,
    setArtifact,
    metadata,
    setMetadata,
    resetArtifact,
  };
}
