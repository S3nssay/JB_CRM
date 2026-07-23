import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Smartphone, Loader2 } from 'lucide-react';

interface SmsComposerProps {
  defaultPhone?: string;
  onSend: (phone: string, message: string) => Promise<void>;
  isSending?: boolean;
}

export function SmsComposer({ defaultPhone = '', onSend, isSending }: SmsComposerProps) {
  const [phone, setPhone] = useState(defaultPhone);
  const [message, setMessage] = useState('');

  const handleSend = async () => {
    if (!phone || !message.trim()) return;
    await onSend(phone, message);
    setMessage('');
  };

  const charCount = message.length;
  const segments = Math.ceil(charCount / 160) || 1;

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">Phone Number</Label>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+44..."
          className="h-8 text-sm"
        />
      </div>
      <div>
        <div className="flex justify-between items-center">
          <Label className="text-xs text-muted-foreground">Message</Label>
          <span className={`text-xs ${charCount > 160 ? 'text-amber-500' : 'text-muted-foreground'}`}>
            {charCount}/160 {segments > 1 ? `(${segments} segments)` : ''}
          </span>
        </div>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your SMS message..."
          rows={3}
          className="text-sm resize-none"
        />
      </div>
      <Button
        onClick={handleSend}
        disabled={isSending || !phone || !message.trim()}
        size="sm"
        variant="default"
      >
        {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Smartphone className="h-4 w-4 mr-2" />}
        Send SMS
      </Button>
    </div>
  );
}
