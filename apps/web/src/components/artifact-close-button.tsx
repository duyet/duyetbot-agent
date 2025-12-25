import { X } from 'lucide-react';
import { memo } from 'react';
import { useArtifact } from '@/hooks/use-artifact';
import { Button } from './ui/button';

function PureArtifactCloseButton() {
  const { resetArtifact } = useArtifact();

  return (
    <Button
      className="h-fit p-2"
      data-testid="artifact-close-button"
      onClick={resetArtifact}
      variant="outline"
    >
      <X size={18} />
    </Button>
  );
}

export const ArtifactCloseButton = memo(PureArtifactCloseButton, () => true);
