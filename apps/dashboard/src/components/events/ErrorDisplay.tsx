import { AlertTriangle, Check, Copy } from 'lucide-react';
import React from 'react';

interface ErrorDisplayProps {
  error: string;
  title?: string;
  onCopy?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  title = 'Error Details',
  onCopy,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(error);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  };

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-900 dark:text-red-200">{title}</h3>
          <div className="mt-2 space-y-2">
            <pre className="overflow-x-auto rounded bg-red-900/20 p-3 font-mono text-sm text-red-800 dark:text-red-300">
              {error}
            </pre>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy Error
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
