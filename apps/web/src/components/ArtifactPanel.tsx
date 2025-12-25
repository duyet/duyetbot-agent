'use client';

import { Code as CodeIcon, FileText, Maximize2, Minimize2, Table, X } from 'lucide-react';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react';
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import type { UIArtifact } from '@/hooks/use-artifact';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

// ============================================================================
// Types
// ============================================================================

export interface ArtifactPanelProps {
  /** Artifact data to display */
  artifact: UIArtifact;
  /** Called when user closes the artifact */
  onClose: () => void;
  /** Called when content changes (for auto-save) */
  onContentChange?: (content: string) => void;
  /** Auto-save debounce delay in milliseconds */
  autoSaveDelay?: number;
  /** Additional CSS classes */
  className?: string;
}

type FullscreenState = 'none' | 'entering' | 'entered' | 'exiting';

// ============================================================================
// Sub-Components
// ============================================================================

interface ArtifactCodeContentProps {
  code: string;
  language?: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  className?: string;
}

function ArtifactCodeContent({
  code,
  language = 'typescript',
  editable = false,
  onChange,
  className,
}: ArtifactCodeContentProps) {
  const [localCode, setLocalCode] = useState(code);

  useEffect(() => {
    setLocalCode(code);
  }, [code]);

  const handleChange = useCallback(
    (newValue: string) => {
      setLocalCode(newValue);
      onChange?.(newValue);
    },
    [onChange]
  );

  if (editable) {
    return (
      <textarea
        className={cn(
          'w-full h-full bg-transparent text-sm font-mono p-4 resize-none focus:outline-none',
          className
        )}
        value={localCode}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
      />
    );
  }

  return (
    <div className={cn('w-full h-full overflow-auto', className)}>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: '1rem',
          height: '100%',
          background: 'transparent',
          fontSize: '0.875rem',
        }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

interface ArtifactTextContentProps {
  content: string;
  className?: string;
}

function ArtifactTextContent({ content, className }: ArtifactTextContentProps) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none p-4', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

interface ArtifactSheetContentProps {
  data: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  className?: string;
}

function ArtifactSheetContent({
  data,
  editable = false,
  onChange,
  className,
}: ArtifactSheetContentProps) {
  const sheetData = useMemo(() => {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const keys = Object.keys(parsed[0]);
        return {
          rows: parsed,
          columns: keys.map((key) => ({
            key,
            name: key.charAt(0).toUpperCase() + key.slice(1),
          })),
        };
      }
      return null;
    } catch {
      return null;
    }
  }, [data]);

  if (!sheetData) {
    return (
      <div className={cn('p-4 text-sm text-muted-foreground', className)}>No valid sheet data</div>
    );
  }

  if (editable) {
    return (
      <textarea
        className={cn(
          'w-full h-full bg-transparent text-sm font-mono p-4 resize-none focus:outline-none',
          className
        )}
        value={data}
        onChange={(e) => onChange?.(e.target.value)}
        spellCheck={false}
      />
    );
  }

  return (
    <div className={cn('w-full h-full overflow-auto', className)}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/50 backdrop-blur-sm">
          <tr>
            {sheetData.columns.map((col) => (
              <th key={col.key} className="px-4 py-2 text-left font-medium border-b border-border">
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheetData.rows.map((row: unknown, i: number) => (
            <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
              {sheetData.columns.map((col) => (
                <td key={col.key} className="px-4 py-2">
                  {String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ArtifactPanel - Animated overlay panel for displaying AI-generated artifacts
 *
 * Features:
 * - Animated expansion from bounding box to full screen
 * - Code rendering with syntax highlighting
 * - Sheet rendering with table view
 * - Text rendering with markdown
 * - Auto-save with debounce
 * - Close and fullscreen controls
 */
export function ArtifactPanel({
  artifact,
  onClose,
  onContentChange,
  autoSaveDelay = 2000,
  className,
}: ArtifactPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState<FullscreenState>('none');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(artifact.content);

  const panelRef = useRef<HTMLDivElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Motion values for smooth animation
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Sync content when artifact changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: We only want to sync when documentId or kind changes, not on every content edit
  useEffect(() => {
    setEditedContent(artifact.content);
    setIsEditing(false);
  }, [artifact.documentId, artifact.kind]);

  // Auto-save with debounce
  useEffect(() => {
    if (isEditing && editedContent !== artifact.content) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        onContentChange?.(editedContent);
      }, autoSaveDelay);
    }

    return () => {
      clearTimeout(autoSaveTimerRef.current);
    };
  }, [editedContent, isEditing, artifact.content, onContentChange, autoSaveDelay]);

  // Handle fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (isFullscreen === 'entered' || isFullscreen === 'entering') {
      setIsFullscreen('exiting');
      setTimeout(() => {
        setIsFullscreen('none');
      }, 300);
    } else {
      setIsFullscreen('entering');
      setTimeout(() => {
        setIsFullscreen('entered');
      }, 300);
    }
  }, [isFullscreen]);

  // Handle close
  const handleClose = useCallback(() => {
    if (isEditing && editedContent !== artifact.content) {
      onContentChange?.(editedContent);
    }
    setIsFullscreen('none');
    onClose();
  }, [isEditing, editedContent, artifact.content, onContentChange, onClose]);

  // Handle edit mode toggle
  const toggleEdit = useCallback(() => {
    if (isEditing) {
      onContentChange?.(editedContent);
    }
    setIsEditing((prev) => !prev);
  }, [isEditing, editedContent, onContentChange]);

  // Get icon based on kind
  const KindIcon = useMemo(() => {
    switch (artifact.kind) {
      case 'code':
        return CodeIcon;
      case 'sheet':
        return Table;
      case 'text':
        return FileText;
      default:
        return FileText;
    }
  }, [artifact.kind]);

  // Get title based on kind
  const kindTitle = useMemo(() => {
    switch (artifact.kind) {
      case 'code':
        return 'Code';
      case 'sheet':
        return 'Sheet';
      case 'text':
        return 'Document';
      default:
        return 'Artifact';
    }
  }, [artifact.kind]);

  // Detect language from content or metadata
  const language = useMemo(() => {
    if (artifact.kind === 'code') {
      // Simple language detection from content
      const firstLine = artifact.content.split('\n')[0];
      if (firstLine.startsWith('```')) {
        return firstLine.replace(/```/, '').trim();
      }
      // Default to typescript for code artifacts
      return 'typescript';
    }
    return undefined;
  }, [artifact.kind, artifact.content]);

  // Handle mouse move for parallax effect
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (panelRef.current) {
        const rect = panelRef.current.getBoundingClientRect();
        mouseX.set(e.clientX - rect.left - rect.width / 2);
        mouseY.set(e.clientY - rect.top - rect.height / 2);
      }
    },
    [mouseX, mouseY]
  );

  const rotateX = useTransform(mouseY, [-200, 200], [2, -2]);
  const rotateY = useTransform(mouseX, [-200, 200], [-2, 2]);

  if (!artifact.isVisible) {
    return null;
  }

  const isExpanded = isFullscreen !== 'none';

  return (
    <AnimatePresence>
      {artifact.isVisible && (
        <motion.div
          ref={panelRef}
          onMouseMove={handleMouseMove}
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm',
            className
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-background/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Panel */}
          <motion.div
            className={cn(
              'relative flex flex-col bg-card border border-border rounded-lg shadow-2xl overflow-hidden',
              'transition-all duration-300 ease-out',
              isExpanded
                ? 'w-[95vw] h-[90vh] max-w-6xl'
                : 'w-[600px] h-[400px] max-w-[90vw] max-h-[80vh]'
            )}
            initial={{
              scale: 0.8,
              opacity: 0,
              x: artifact.boundingBox.left || 0,
              y: artifact.boundingBox.top || 0,
              width: artifact.boundingBox.width || 400,
              height: artifact.boundingBox.height || 300,
            }}
            animate={{
              scale: 1,
              opacity: 1,
              x: 0,
              y: 0,
              width: isExpanded ? '95vw' : 600,
              height: isExpanded ? '90vh' : 400,
            }}
            exit={{
              scale: 0.8,
              opacity: 0,
            }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 300,
            }}
            style={{
              rotateX,
              rotateY,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 text-accent">
                  <KindIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{artifact.title || kindTitle}</h3>
                  {artifact.status === 'streaming' && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-accent animate-pulse" />
                      <div className="w-1 h-1 rounded-full bg-accent animate-pulse delay-75" />
                      <div className="w-1 h-1 rounded-full bg-accent animate-pulse delay-150" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Edit Toggle */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={toggleEdit}
                        className={cn(
                          'text-muted-foreground hover:text-foreground',
                          isEditing && 'bg-accent/10 text-accent'
                        )}
                      >
                        {isEditing ? (
                          <CheckIcon className="w-4 h-4" />
                        ) : (
                          <EditIcon className="w-4 h-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isEditing ? 'Save changes' : 'Edit content'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Fullscreen Toggle */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={toggleFullscreen}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {isExpanded ? (
                          <Minimize2 className="w-4 h-4" />
                        ) : (
                          <Maximize2 className="w-4 h-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isExpanded ? 'Exit fullscreen' : 'Fullscreen'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Close */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleClose}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Close (Esc)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden bg-background">
              {artifact.kind === 'code' && (
                <ArtifactCodeContent
                  code={editedContent}
                  language={language}
                  editable={isEditing}
                  onChange={setEditedContent}
                  className="h-full"
                />
              )}

              {artifact.kind === 'text' && (
                <ArtifactTextContent content={editedContent} className="h-full overflow-auto" />
              )}

              {artifact.kind === 'sheet' && (
                <ArtifactSheetContent
                  data={editedContent}
                  editable={isEditing}
                  onChange={setEditedContent}
                  className="h-full"
                />
              )}
            </div>

            {/* Footer - Auto-save indicator */}
            <AnimatePresence>
              {isEditing && (
                <motion.div
                  className="px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  Auto-saving in {autoSaveDelay / 1000}s...
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Icons
// ============================================================================

function CheckIcon(props: ComponentProps<'svg'>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function EditIcon(props: ComponentProps<'svg'>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}
