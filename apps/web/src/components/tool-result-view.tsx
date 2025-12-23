import type { ToolInvocation } from 'ai';
import { CheckCircle, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { useState } from 'react';

interface ToolResultViewProps {
  toolInvocation: ToolInvocation;
}

export function ToolResultView({ toolInvocation }: ToolResultViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toolName = toolInvocation.toolName;
  const result = toolInvocation.state === 'result' ? toolInvocation.result : undefined;

  const isError = result !== undefined && typeof result === 'object' && 'error' in result;
  const error = isError ? (result as { error?: string }).error : null;
  const displayResult = isError
    ? (error ?? 'Unknown error')
    : result !== undefined
      ? typeof result === 'string'
        ? result
        : JSON.stringify(result, null, 2)
      : 'No result';

  const duration = undefined;

  const themeColor = isError ? 'red' : 'green';

  return (
    <div
      className={`border border-${themeColor}-200 bg-${themeColor}-50 rounded-md overflow-hidden`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-${themeColor}-100 transition-colors`}
        type="button"
      >
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <CheckCircle className={`w-4 h-4 text-${themeColor}-600`} />
        <span className={`text-sm font-medium text-${themeColor}-900`}>
          {isError ? 'Error' : 'Result'}
        </span>
        <span className={`text-sm text-${themeColor}-700 ml-1`}>{toolName}</span>
        {duration !== undefined && (
          <div className="ml-auto flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-500">{duration}ms</span>
          </div>
        )}
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 pt-0">
          <pre className={`text-xs text-${themeColor}-800 whitespace-pre-wrap overflow-x-auto`}>
            {displayResult}
          </pre>
        </div>
      )}
    </div>
  );
}
