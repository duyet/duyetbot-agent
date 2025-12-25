import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

export interface PreviewAttachmentProps {
  attachment: {
    url: string;
    name: string;
    contentType?: string;
  };
  isUploading?: boolean;
  onRemove?: () => void;
}

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onRemove,
}: PreviewAttachmentProps) => {
  const { name, url, contentType } = attachment;

  return (
    <div
      className="group relative size-16 overflow-hidden rounded-lg border bg-muted"
      data-testid="input-attachment-preview"
    >
      {contentType?.startsWith('image') ? (
        <img alt={name ?? 'An image attachment'} className="size-full object-cover" src={url} />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground text-xs">
          File
        </div>
      )}

      {isUploading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/50"
          data-testid="input-attachment-loader"
        >
          <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {onRemove && !isUploading && (
        <Button
          className="absolute top-0.5 right-0.5 size-4 rounded-full p-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={onRemove}
          size="sm"
          variant="destructive"
        >
          <X size={8} />
        </Button>
      )}

      <div className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5 text-[10px] text-white">
        {name}
      </div>
    </div>
  );
};
