import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Phone, Mail, Loader2, PhoneCall, PhoneOff, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

// ==========================================
// Click-to-Call Button
// ==========================================
interface CallButtonProps {
  phoneNumber: string;
  contactName?: string;
  entityType?: string;
  entityId?: number;
  agentPhone?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
  showLabel?: boolean;
}

export function CallButton({
  phoneNumber,
  contactName,
  entityType,
  entityId,
  agentPhone,
  variant = 'outline',
  size = 'sm',
  className = '',
  showLabel = true,
}: CallButtonProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isConfirming, setIsConfirming] = useState(false);
  const [manualPhone, setManualPhone] = useState('');

  // Resolve the agent's phone: prop > user profile > manual entry
  const resolvedAgentPhone = agentPhone || (user as any)?.phone || '';

  const callMutation = useMutation({
    mutationFn: async () => {
      const callerPhone = resolvedAgentPhone || manualPhone;
      if (!callerPhone) {
        throw new Error('Please set your phone number in Call Management settings, or enter it below.');
      }
      const response = await fetch('/api/crm/calls/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          to: phoneNumber,
          agentPhone: callerPhone,
          contactName,
          entityType,
          entityId,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to initiate call');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setIsConfirming(false);
      if (data.mode === 'phone') {
        toast({
          title: 'Call initiated',
          description: `Calling your phone now. When you answer, you'll be connected to ${contactName || phoneNumber}.`,
        });
      } else {
        toast({
          title: 'Browser call ready',
          description: 'Browser calling is configured. Use the softphone panel to connect.',
        });
      }
    },
    onError: (error: Error) => {
      setIsConfirming(false);
      toast({
        title: 'Call failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (!phoneNumber) return null;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={`text-green-600 hover:text-green-700 hover:bg-green-50 ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsConfirming(true);
        }}
        disabled={callMutation.isPending}
      >
        {callMutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Phone className="h-3.5 w-3.5" />
        )}
        {showLabel && <span className="ml-1">Call</span>}
      </Button>

      <Dialog open={isConfirming} onOpenChange={setIsConfirming}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-green-600" />
              Call {contactName || phoneNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm text-muted-foreground">
              Twilio will call your phone first, then connect you to:
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="font-medium">{contactName}</div>
              <div className="text-sm text-muted-foreground">{phoneNumber}</div>
            </div>
            {!resolvedAgentPhone && (
              <div>
                <Label className="text-xs text-muted-foreground">Your phone number</Label>
                <Input
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="+44..."
                  className="h-8 text-sm mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Set your phone in <a href="/crm/call-management" className="text-[#791E75] underline">Call Management</a> to skip this step.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirming(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => callMutation.mutate()}
              disabled={callMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {callMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Phone className="h-4 w-4 mr-2" />
              )}
              Start Call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==========================================
// Compose Email Dialog
// ==========================================
interface ComposeEmailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  contactName?: string;
  entityType?: string;
  entityId?: number;
}

export function ComposeEmailDialog({
  open,
  onOpenChange,
  defaultTo = '',
  defaultSubject = '',
  defaultBody = '',
  contactName = '',
  entityType,
  entityId,
}: ComposeEmailProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);

  // Reset form when dialog opens with new defaults
  useEffect(() => {
    if (open) {
      setTo(defaultTo);
      setSubject(defaultSubject);
      setBody(defaultBody);
    }
  }, [open, defaultTo, defaultSubject, defaultBody]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/crm/communications/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          to,
          subject,
          body,
          cc: cc || undefined,
          contactName,
          entityType,
          entityId,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to send email');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Email sent',
        description: `Email sent to ${contactName || to} via ${data.provider === 'microsoft365' ? 'Microsoft 365' : 'SMTP'}.`,
      });
      onOpenChange(false);
      setTo('');
      setCc('');
      setSubject('');
      setBody('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to send email',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#791E75]" />
            Compose Email
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@email.com"
              type="email"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">CC</Label>
            <Input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@email.com (optional)"
              type="email"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message..."
              rows={10}
              className="font-normal"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !to || !subject || !body}
            style={{ backgroundColor: '#791E75' }}
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// Email Button (opens compose dialog)
// ==========================================
interface EmailButtonProps {
  email: string;
  contactName?: string;
  defaultSubject?: string;
  entityType?: string;
  entityId?: number;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
  showLabel?: boolean;
}

export function EmailButton({
  email,
  contactName,
  defaultSubject,
  entityType,
  entityId,
  variant = 'outline',
  size = 'sm',
  className = '',
  showLabel = true,
}: EmailButtonProps) {
  const [showCompose, setShowCompose] = useState(false);

  if (!email) return null;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={`text-blue-600 hover:text-blue-700 hover:bg-blue-50 ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          setShowCompose(true);
        }}
      >
        <Mail className="h-3.5 w-3.5" />
        {showLabel && <span className="ml-1">Email</span>}
      </Button>

      <ComposeEmailDialog
        open={showCompose}
        onOpenChange={setShowCompose}
        defaultTo={email}
        defaultSubject={defaultSubject || ''}
        contactName={contactName}
        entityType={entityType}
        entityId={entityId}
      />
    </>
  );
}
