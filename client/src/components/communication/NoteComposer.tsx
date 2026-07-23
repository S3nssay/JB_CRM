import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StickyNote, Loader2 } from 'lucide-react';

interface NoteComposerProps {
  onSend: (content: string) => Promise<void>;
  isSending?: boolean;
}

export function NoteComposer({ onSend, isSending }: NoteComposerProps) {
  const [content, setContent] = useState('');

  const handleSend = async () => {
    if (!content.trim()) return;
    await onSend(content);
    setContent('');
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">Internal Note</Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add an internal note or record an in-person interaction..."
          rows={3}
          className="text-sm resize-none"
        />
      </div>
      <Button
        onClick={handleSend}
        disabled={isSending || !content.trim()}
        size="sm"
        variant="secondary"
      >
        {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <StickyNote className="h-4 w-4 mr-2" />}
        Save Note
      </Button>
    </div>
  );
}
