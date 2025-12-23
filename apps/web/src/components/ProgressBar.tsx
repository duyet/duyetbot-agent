/**
 * ProgressBar Component
 *
 * Real-time progress indicator showing current execution step.
 * Displays thinking, tool execution, and response states.
 */

import { Brain, Loader2, Send, Wrench } from 'lucide-react';
import { useMemo } from 'react';

/**
 * Progress state types
 */
type ProgressState = 'thinking' | 'tool' | 'responding' | 'idle';

/**
 * Props for ProgressBar component
 */
interface ProgressBarProps {
  /** Current step description */
  currentStep?: string;
  /** Whether the step is currently active (in progress) */
  isActive?: boolean;
  /** Optional explicit progress state */
  state?: ProgressState;
  /** Optional progress percentage (0-100) */
  progress?: number;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Get icon for progress state
 */
function getStateIcon(state: ProgressState) {
  switch (state) {
    case 'thinking':
      return <Brain size={14} className="text-purple-500" />;
    case 'tool':
      return <Wrench size={14} className="text-blue-500" />;
    case 'responding':
      return <Send size={14} className="text-green-500" />;
    case 'idle':
      return null;
  }
}

/**
 * Infer state from step description
 */
function inferStateFromStep(step?: string): ProgressState {
  if (!step) {
    return 'idle';
  }

  const lower = step.toLowerCase();

  if (lower.includes('thinking') || lower.includes('ruminate') || lower.includes('reasoning')) {
    return 'thinking';
  }

  if (lower.includes('running') || lower.includes('executing') || lower.includes('tool')) {
    return 'tool';
  }

  if (lower.includes('responding') || lower.includes('sending') || lower.includes('preparing')) {
    return 'responding';
  }

  return 'idle';
}

/**
 * Animated dots component
 */
function AnimatedDots() {
  return (
    <span className="inline-flex items-center">
      <span className="animate-bounce [animation-delay:-0.3s]">.</span>
      <span className="animate-bounce [animation-delay:-0.15s]">.</span>
      <span className="animate-bounce">.</span>
    </span>
  );
}

/**
 * Real-time progress bar with animated indicator.
 *
 * Shows the current execution state (thinking, tool running, responding)
 * with appropriate icons and animations.
 *
 * @example
 * ```tsx
 * <ProgressBar currentStep="Running github tool..." isActive />
 *
 * <ProgressBar state="thinking" isActive />
 *
 * <ProgressBar currentStep="Responding..." progress={75} isActive />
 * ```
 */
export function ProgressBar({
  currentStep,
  isActive = true,
  state,
  progress,
  className = '',
}: ProgressBarProps) {
  const inferredState = state ?? inferStateFromStep(currentStep);
  const icon = getStateIcon(inferredState);

  const progressWidth = useMemo(() => {
    if (progress !== undefined) {
      return `${Math.min(100, Math.max(0, progress))}%`;
    }

    // Infer approximate progress based on state
    switch (inferredState) {
      case 'thinking':
        return '25%';
      case 'tool':
        return '50%';
      case 'responding':
        return '90%';
      case 'idle':
        return '0%';
      default:
        return '0%';
    }
  }, [progress, inferredState]);

  const displayText = currentStep ?? getDefaultText(inferredState);

  return (
    <div className={className}>
      {/* Progress Bar Container */}
      <div className="relative h-8 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        {/* Progress Fill */}
        <div
          className={`
            absolute top-0 left-0 h-full rounded-full transition-all duration-500 ease-out
            ${isActive ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gray-300 dark:bg-gray-700'}
          `}
          style={{ width: isActive ? progressWidth : '0%' }}
        />

        {/* Content Overlay */}
        <div className="absolute top-0 left-0 right-0 h-full flex items-center px-4 gap-2">
          {/* Icon */}
          {isActive && icon && <span className="flex-shrink-0 animate-pulse">{icon}</span>}

          {/* Spinner when active */}
          {isActive && (
            <Loader2
              size={14}
              className="text-gray-500 dark:text-gray-400 animate-spin flex-shrink-0"
            />
          )}

          {/* Step Text */}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate flex-1">
            {displayText}
          </span>

          {/* Animated Dots */}
          {isActive && <AnimatedDots />}
        </div>
      </div>

      {/* Detailed Progress (if percentage provided) */}
      {progress !== undefined && (
        <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{displayText}</span>
          <span>{progress}%</span>
        </div>
      )}
    </div>
  );
}

/**
 * Get default text for a given state
 */
function getDefaultText(state: ProgressState): string {
  switch (state) {
    case 'thinking':
      return 'Thinking...';
    case 'tool':
      return 'Executing tool...';
    case 'responding':
      return 'Generating response...';
    case 'idle':
      return 'Ready';
  }
}

/**
 * Compact progress bar variant (for smaller spaces)
 */
interface CompactProgressBarProps {
  isActive?: boolean;
  state?: ProgressState;
  className?: string;
}

export function CompactProgressBar({
  isActive = true,
  state = 'thinking',
  className = '',
}: CompactProgressBarProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isActive ? (
        <>
          <Loader2 size={16} className="text-blue-500 animate-spin" />
          <span className="text-sm text-gray-600 dark:text-gray-400">{getDefaultText(state)}</span>
        </>
      ) : (
        <span className="text-sm text-gray-500 dark:text-gray-500">Complete</span>
      )}
    </div>
  );
}

/**
 * Inline progress indicator (for embedding in text)
 */
interface InlineProgressProps {
  state: ProgressState;
  isActive?: boolean;
}

export function InlineProgress({ state, isActive = true }: InlineProgressProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
      {isActive && <Loader2 size={12} className="animate-spin text-blue-500" />}
      {getDefaultText(state)}
      {isActive && <AnimatedDots />}
    </span>
  );
}
