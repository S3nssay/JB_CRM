import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Mail, MessageCircle, Smartphone, Phone, StickyNote, Send,
  ChevronDown, ChevronUp, ArrowUpRight, ArrowDownLeft,
  Loader2, MessageSquare, Clock,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCommunications, type CommunicationRecord } from '@/hooks/use-communications';
import { WhatsAppComposer } from './communication/WhatsAppComposer';
import { SmsComposer } from './communication/SmsComposer';
import { NoteComposer } from './communication/NoteComposer';
import { CallHistoryItem } from './communication/CallHistoryItem';

// ==========================================
// Types
// ==========================================

interface UnifiedCommunicationPanelProps {
  entityType: 'tenant' | 'landlord' | 'lead' | 'property' | 'maintenance';
  entityId: number;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  defaultChannel?: string;
  compact?: boolean;
}

// ==========================================
// Email Composer (inline, not dialog)
// ==========================================

function EmailComposer({
  defaultTo = '',
  onSend,
  isSending,
}: {
  defaultTo?: string;
  onSend: (to: string, subject: string, content: string, cc?: string) => Promise<void>;
  isSending?: boolean;
}) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [cc, setCc] = useState('');

  const handleSend = async () => {
    if (!to || !content.trim()) return;
    await onSend(to, subject, content, cc || undefined);
    setSubject('');
    setContent('');
    setCc('');
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-muted-foreground">To</label>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="email@example.com"
          className="w-full h-8 text-sm px-3 border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">CC (optional)</label>
        <input
          value={cc}
          onChange={(e) => setCc(e.target.value)}
          placeholder="cc@example.com"
          className="w-full h-8 text-sm px-3 border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject line..."
          className="w-full h-8 text-sm px-3 border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Message</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your email..."
          rows={4}
          className="w-full text-sm p-3 border rounded-md bg-background resize-none"
        />
      </div>
      <Button
        onClick={handleSend}
        disabled={isSending || !to || !content.trim()}
        size="sm"
      >
        {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
        Send Email
      </Button>
    </div>
  );
}

// ==========================================
// Channel Icon + Color mapping
// ==========================================

const channelConfig: Record<string, { icon: typeof Mail; color: string; label: string }> = {
  email: { icon: Mail, color: 'text-blue-500', label: 'Email' },
  sms: { icon: Smartphone, color: 'text-purple-500', label: 'SMS' },
  whatsapp: { icon: MessageCircle, color: 'text-green-500', label: 'WhatsApp' },
  phone: { icon: Phone, color: 'text-orange-500', label: 'Call' },
  note: { icon: StickyNote, color: 'text-gray-500', label: 'Note' },
  in_person: { icon: MessageSquare, color: 'text-teal-500', label: 'In Person' },
};

function getChannelConfig(channel: string) {
  return channelConfig[channel] || channelConfig.note;
}

// ==========================================
// Format relative time
// ==========================================

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ==========================================
// Timeline Entry
// ==========================================

function TimelineEntry({ record }: { record: CommunicationRecord }) {
  const config = getChannelConfig(record.channel);
  const Icon = config.icon;
  const isInbound = record.direction === 'inbound';

  // For phone calls, use the special CallHistoryItem
  if (record.channel === 'phone' && record.source === 'voice_call') {
    return (
      <div className="border-b last:border-0 py-3 px-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-xs text-muted-foreground">{formatRelativeTime(record.timestamp)}</span>
          </div>
          <Badge variant="outline" className="text-xs h-5">{record.status}</Badge>
        </div>
        <CallHistoryItem record={record} />
      </div>
    );
  }

  return (
    <div className="border-b last:border-0 py-3 px-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3">
        {/* Channel icon + direction */}
        <div className="flex flex-col items-center gap-0.5 pt-0.5">
          <Icon className={`h-4 w-4 ${config.color}`} />
          {isInbound ? (
            <ArrowDownLeft className="h-3 w-3 text-blue-400" />
          ) : (
            <ArrowUpRight className="h-3 w-3 text-green-400" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{config.label}</span>
              <Badge
                variant={record.status === 'failed' ? 'destructive' : 'outline'}
                className="text-[10px] h-4 px-1"
              >
                {record.status}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(record.timestamp)}
            </span>
          </div>

          {record.subject && (
            <p className="text-sm font-medium mt-0.5 truncate">{record.subject}</p>
          )}

          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
            {record.content}
          </p>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Main Panel
// ==========================================

export default function UnifiedCommunicationPanel({
  entityType,
  entityId,
  contactName,
  contactEmail,
  contactPhone,
  defaultChannel = 'all',
  compact = false,
}: UnifiedCommunicationPanelProps) {
  const { toast } = useToast();
  const [channelFilter, setChannelFilter] = useState(defaultChannel);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerChannel, setComposerChannel] = useState<string>('email');

  const { history, isLoading, sendMessage, logCommunication, initiateCall } = useCommunications(
    entityType,
    entityId,
    channelFilter
  );

  // ---- Send handlers ----

  const handleSendEmail = async (to: string, subject: string, content: string, cc?: string) => {
    try {
      await sendMessage.mutateAsync({
        channel: 'email',
        to,
        content,
        subject,
        cc,
        contentHtml: `<p>${content.replace(/\n/g, '<br/>')}</p>`,
        entityType,
        entityId,
        contactName,
      });
      toast({ title: 'Email sent', description: `Sent to ${to}` });
    } catch (err: any) {
      toast({ title: 'Email failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleSendWhatsApp = async (phone: string, message: string) => {
    try {
      await sendMessage.mutateAsync({
        channel: 'whatsapp',
        to: phone,
        content: message,
        entityType,
        entityId,
        contactName,
      });
      toast({ title: 'WhatsApp sent', description: `Sent to ${phone}` });
    } catch (err: any) {
      toast({ title: 'WhatsApp failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleSendSms = async (phone: string, message: string) => {
    try {
      await sendMessage.mutateAsync({
        channel: 'sms',
        to: phone,
        content: message,
        entityType,
        entityId,
        contactName,
      });
      toast({ title: 'SMS sent', description: `Sent to ${phone}` });
    } catch (err: any) {
      toast({ title: 'SMS failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleSendNote = async (content: string) => {
    try {
      await logCommunication.mutateAsync({
        channel: 'note',
        direction: 'outbound',
        content,
        entityType,
        entityId,
        contactName,
      });
      toast({ title: 'Note saved' });
    } catch (err: any) {
      toast({ title: 'Failed to save note', description: err.message, variant: 'destructive' });
    }
  };

  const handleCall = async () => {
    if (!contactPhone) {
      toast({ title: 'No phone number', description: 'No phone number available for this contact', variant: 'destructive' });
      return;
    }
    try {
      await initiateCall.mutateAsync({
        to: contactPhone,
        entityType,
        entityId,
        contactName,
      });
      toast({
        title: 'Call initiated',
        description: `Calling your phone now. When you answer, you'll be connected to ${contactName || contactPhone}.`,
      });
    } catch (err: any) {
      toast({ title: 'Call failed', description: err.message, variant: 'destructive' });
    }
  };

  const openComposer = (channel: string) => {
    setComposerChannel(channel);
    setComposerOpen(true);
  };

  const isSending = sendMessage.isPending || logCommunication.isPending;

  return (
    <div className={`flex flex-col border rounded-lg bg-background ${compact ? 'max-h-[500px]' : 'h-full'}`}>
      {/* Header: Quick actions */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#791E75]" />
          <span className="text-sm font-semibold">Communications</span>
          <Badge variant="secondary" className="text-xs">{history.length}</Badge>
        </div>
        <div className="flex items-center gap-1">
          {contactEmail && (
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openComposer('email')}>
              <Mail className="h-3.5 w-3.5 text-blue-500" />
            </Button>
          )}
          {contactPhone && (
            <>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openComposer('whatsapp')}>
                <MessageCircle className="h-3.5 w-3.5 text-green-500" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openComposer('sms')}>
                <Smartphone className="h-3.5 w-3.5 text-purple-500" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleCall} disabled={initiateCall.isPending}>
                <Phone className="h-3.5 w-3.5 text-orange-500" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openComposer('note')}>
            <StickyNote className="h-3.5 w-3.5 text-gray-500" />
          </Button>
        </div>
      </div>

      {/* Channel filter tabs */}
      <Tabs value={channelFilter} onValueChange={setChannelFilter} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0 px-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'email', label: 'Email' },
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'sms', label: 'SMS' },
            { value: 'phone', label: 'Calls' },
            { value: 'note', label: 'Notes' },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-[#791E75] data-[state=active]:text-[#791E75] data-[state=active]:shadow-none px-3 py-2"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Timeline content (same for all tabs, filtered by API) */}
        <div className="flex-1 min-h-0">
          <ScrollArea className={compact ? 'h-[280px]' : 'h-[400px]'}>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mb-2" />
                <p className="text-sm">No communications yet</p>
                <p className="text-xs mt-1">Send a message to get started</p>
              </div>
            ) : (
              history.map((record) => (
                <TimelineEntry key={`${record.source}-${record.id}`} record={record} />
              ))
            )}
          </ScrollArea>
        </div>
      </Tabs>

      {/* Inline Composer (collapsible) */}
      <Collapsible open={composerOpen} onOpenChange={setComposerOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <Send className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">
                {composerOpen ? 'Compose' : 'New message...'}
              </span>
            </div>
            {composerOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t p-4">
            {/* Channel selector for composer */}
            <div className="flex gap-1 mb-3">
              {[
                { ch: 'email', icon: Mail, color: 'text-blue-500', disabled: !contactEmail },
                { ch: 'whatsapp', icon: MessageCircle, color: 'text-green-500', disabled: !contactPhone },
                { ch: 'sms', icon: Smartphone, color: 'text-purple-500', disabled: !contactPhone },
                { ch: 'note', icon: StickyNote, color: 'text-gray-500', disabled: false },
              ].map(({ ch, icon: BtnIcon, color, disabled }) => (
                <Button
                  key={ch}
                  variant={composerChannel === ch ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  disabled={disabled}
                  onClick={() => setComposerChannel(ch)}
                >
                  <BtnIcon className={`h-3.5 w-3.5 mr-1 ${composerChannel === ch ? '' : color}`} />
                  {ch.charAt(0).toUpperCase() + ch.slice(1)}
                </Button>
              ))}
            </div>

            {/* Render the appropriate composer */}
            {composerChannel === 'email' && (
              <EmailComposer
                defaultTo={contactEmail}
                onSend={handleSendEmail}
                isSending={isSending}
              />
            )}
            {composerChannel === 'whatsapp' && (
              <WhatsAppComposer
                defaultPhone={contactPhone}
                onSend={handleSendWhatsApp}
                isSending={isSending}
              />
            )}
            {composerChannel === 'sms' && (
              <SmsComposer
                defaultPhone={contactPhone}
                onSend={handleSendSms}
                isSending={isSending}
              />
            )}
            {composerChannel === 'note' && (
              <NoteComposer
                onSend={handleSendNote}
                isSending={isSending}
              />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
