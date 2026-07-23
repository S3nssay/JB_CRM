import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageCircle, Loader2, Send } from 'lucide-react';

interface WhatsAppComposerProps {
  defaultPhone?: string;
  onSend: (phone: string, message: string) => Promise<void>;
  isSending?: boolean;
}

export function WhatsAppComposer({ defaultPhone = '', onSend, isSending }: WhatsAppComposerProps) {
  const [phone, setPhone] = useState(defaultPhone);
  const [message, setMessage] = useState('');

  const handleSend = async () => {
    if (!phone || !message.trim()) return;
    await onSend(phone, message);
    setMessage('');
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">WhatsApp Number</Label>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+44..."
          className="h-8 text-sm"
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Message</Label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your WhatsApp message..."
          rows={3}
          className="text-sm resize-none"
        />
      </div>
      <Button
        onClick={handleSend}
        disabled={isSending || !phone || !message.trim()}
        size="sm"
        className="bg-[#25D366] hover:bg-[#20b954] text-white"
      >
        {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}
        Send WhatsApp
      </Button>
    </div>
  );
}
