import type { LanguageModelUsage } from 'ai';

interface UsageDisplayProps {
  usage: LanguageModelUsage;
}

export function UsageDisplay({ usage }: UsageDisplayProps) {
  return (
    <div className="border-t pt-2 mt-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <div>
          <span className="font-medium">Prompt:</span> {usage.promptTokens}
        </div>
        <div>
          <span className="font-medium">Completion:</span> {usage.completionTokens}
        </div>
        <div className="font-medium text-gray-700">Total: {usage.totalTokens}</div>
      </div>
    </div>
  );
}
