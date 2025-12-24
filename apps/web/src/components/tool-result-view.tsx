import type { UIToolInvocation } from 'ai';
import { CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface ToolResultViewProps {
  toolInvocation: UIToolInvocation<any>;
}

export function ToolResultView({ toolInvocation }: ToolResultViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract tool name from title or use a default
  const toolName = toolInvocation.title ?? 'Tool';

  // Determine state
  const isError = toolInvocation.state === 'output-error';
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
        <span className={`text-sm font-medium text-${themeColor}-900`}>{toolInvocation.state}</span>
        <span className={`text-sm text-${themeColor}-700 ml-1`}>{toolName}</span>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 pt-0">
          <p className={`text-xs text-${themeColor}-800`}>
            Tool Call ID: {toolInvocation.toolCallId}
          </p>
        </div>
      )}
    </div>
  );
}
