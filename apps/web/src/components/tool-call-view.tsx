import type { UIToolInvocation } from 'ai';
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import { useState } from 'react';

interface ToolCallViewProps {
  toolInvocation: UIToolInvocation<any>;
}

export function ToolCallView({ toolInvocation }: ToolCallViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract tool name from title or use a default
  const toolName = toolInvocation.title ?? 'Tool';

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-md overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-100 transition-colors"
        type="button"
      >
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Wrench className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-900">Tool Call</span>
        <span className="text-sm text-blue-700 ml-1">{toolName}</span>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 pt-0">
          <p className="text-xs text-blue-800">Tool Call ID: {toolInvocation.toolCallId}</p>
        </div>
      )}
    </div>
  );
}
