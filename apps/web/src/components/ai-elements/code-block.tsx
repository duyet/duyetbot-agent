'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import {
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  useContext,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
};

type CodeBlockContextType = {
  code: string;
};

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: '',
});

/**
 * Simple code block component without syntax highlighting
 * Uses preformatted text for zero bundle size impact
 */
export const CodeBlock = ({
  code,
  language = 'text',
  showLineNumbers = false,
  className,
  children,
  ...props
}: CodeBlockProps) => {
  // Format code with line numbers if requested
  const formattedCode = showLineNumbers
    ? code.split('\n').map((line, i) => `${String(i + 1).padStart(4, ' ')}  ${line}`).join('\n')
    : code;

  return (
    <CodeBlockContext.Provider value={{ code }}>
      <div
        className={cn(
          'group relative w-full overflow-hidden rounded-md border bg-background text-foreground',
          className
        )}
        {...props}
      >
        <div className="relative overflow-auto">
          <pre className="m-0 bg-background! p-4 text-foreground! text-sm font-mono">
            <code className="text-sm">{formattedCode}</code>
          </pre>
          {children && (
            <div className="absolute top-2 right-2 flex items-center gap-2">{children}</div>
          )}
        </div>
        {language && language !== 'text' && (
          <div className="border-t border-border px-4 py-1 text-xs text-muted-foreground">
            {language}
          </div>
        )}
      </div>
    </CodeBlockContext.Provider>
  );
};

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const { code } = useContext(CodeBlockContext);

  const copyToClipboard = async () => {
    if (typeof window === 'undefined' || !navigator?.clipboard?.writeText) {
      onError?.(new Error('Clipboard API not available'));
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      onCopy?.();
      setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      className={cn('shrink-0', className)}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon size={14} />}
    </Button>
  );
};
