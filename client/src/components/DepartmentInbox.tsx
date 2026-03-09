import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  Mail, Inbox, Send, RefreshCw, Loader2, Reply, Forward,
  Paperclip, Star, MailPlus, ChevronLeft, AlertCircle,
  CheckCircle, Clock, Wrench, Building2, Key, Bot,
  Ticket, Search, Eye
} from 'lucide-react';

interface DepartmentInboxProps {
  category: 'sales' | 'lettings' | 'maintenance';
  title: string;
  description: string;
}

const formatRelativeTime = (d: string | Date | undefined): string => {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const formatDate = (d: string | Date | undefined): string => {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const AiActionBadge = ({ actionType }: { actionType: string | null }) => {
  if (!actionType) return null;
  const config: Record<string, { label: string; color: string; icon: any }> = {
    support_ticket_created: { label: 'Ticket Created', color: 'bg-blue-100 text-blue-800', icon: Ticket },
    ticket_comment_added: { label: 'Ticket Updated', color: 'bg-cyan-100 text-cyan-800', icon: Ticket },
    enquiry_created: { label: 'Enquiry Created', color: 'bg-green-100 text-green-800', icon: Eye },
    contractor_response_processed: { label: 'Contractor Reply', color: 'bg-orange-100 text-orange-800', icon: Wrench },
    routed_to_pm: { label: 'Routed to PM', color: 'bg-purple-100 text-purple-800', icon: Forward },
    ignored: { label: 'Ignored', color: 'bg-gray-100 text-gray-600', icon: CheckCircle },
    failed: { label: 'Action Failed', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  };
  const c = config[actionType] || { label: actionType, color: 'bg-gray-100 text-gray-600', icon: Bot };
  const Icon = c.icon;
  return (
    <Badge className={`${c.color} text-[10px] gap-1 font-normal`}>
      <Icon className="h-3 w-3" />{c.label}
    </Badge>
  );
};

const PriorityDot = ({ priority }: { priority: string | null }) => {
  if (!priority || priority === 'normal') return null;
  const colors: Record<string, string> = {
    urgent: 'bg-red-500',
    high: 'bg-orange-500',
    low: 'bg-gray-400',
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[priority] || ''}`} title={`${priority} priority`} />;
};

export default function DepartmentInbox({ category, title, description }: DepartmentInboxProps) {
  const { toast } = useToast();
  const [folder, setFolder] = useState<'inbox' | 'sent'>('inbox');
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [replyToEmail, setReplyToEmail] = useState<any>(null);
  const [composeForm, setComposeForm] = useState({ to: '', cc: '', subject: '', body: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch system mailboxes to find this department's connection
  const { data: systemMailboxes = [] } = useQuery<any[]>({
    queryKey: ['/api/email-integration/system-mailboxes'],
    queryFn: async () => {
      const res = await fetch('/api/email-integration/system-mailboxes', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const mailbox = systemMailboxes.find((m: any) => m.mailboxCategory === category);

  // Fetch inbox emails
  const { data: inboxData, isLoading: loadingInbox, refetch: refetchInbox } = useQuery<any>({
    queryKey: ['/api/email-integration/department-emails', category],
    queryFn: async () => {
      const res = await fetch(`/api/email-integration/department-emails/${category}?limit=100`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!mailbox,
  });

  const inboxEmails = inboxData?.emails || [];

  // Fetch sent emails
  const { data: sentEmails = [], isLoading: loadingSent } = useQuery<any[]>({
    queryKey: ['/api/email-integration/department-sent', category],
    queryFn: async () => {
      const res = await fetch(`/api/email-integration/department-sent/${category}?limit=100`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: folder === 'sent' && !!mailbox,
  });

  // Fetch selected email detail
  const { data: selectedEmail, isLoading: loadingDetail } = useQuery<any>({
    queryKey: ['/api/email-integration/department-emails', category, selectedEmailId],
    queryFn: async () => {
      const res = await fetch(`/api/email-integration/department-emails/${category}/${selectedEmailId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!selectedEmailId && folder === 'inbox',
  });

  // Refetch inbox list after viewing an email (backend marks it as read)
  useEffect(() => {
    if (selectedEmail) {
      refetchInbox();
      queryClient.invalidateQueries({ queryKey: ["/api/email-integration/system-mailbox-counts"] });
    }
  }, [selectedEmail?.id]);

  // Sync handler
  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch(`/api/email-integration/system-mailboxes/${category}/sync`, {
        method: 'POST',
        credentials: 'include',
      });
      toast({ title: 'Sync Complete', description: `${title} mailbox synced.` });
      refetchInbox();
    } catch {
      toast({ title: 'Sync Failed', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  // Send handler
  const handleSendEmail = async () => {
    if (!composeForm.to || !composeForm.subject) {
      toast({ title: 'Missing Fields', description: 'To and Subject are required.', variant: 'destructive' });
      return;
    }
    setSendingEmail(true);
    try {
      const payload: any = {
        category,
        to: composeForm.to.split(',').map((e: string) => e.trim()).filter(Boolean),
        cc: composeForm.cc ? composeForm.cc.split(',').map((e: string) => e.trim()).filter(Boolean) : undefined,
        subject: composeForm.subject,
        bodyText: composeForm.body,
        bodyHtml: `<p>${composeForm.body.replace(/\n/g, '<br/>')}</p>`,
      };
      if (replyToEmail?.internetMessageId) {
        payload.inReplyToMessageId = replyToEmail.internetMessageId;
      }
      const res = await fetch('/api/email-integration/department-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send');
      }
      toast({ title: 'Email Sent', description: `Sent to ${composeForm.to}` });
      setShowComposeDialog(false);
      setReplyToEmail(null);
      setComposeForm({ to: '', cc: '', subject: '', body: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/email-integration/department-sent', category] });
    } catch (err) {
      toast({ title: 'Send Failed', description: err instanceof Error ? err.message : 'Error sending email', variant: 'destructive' });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleReply = (email: any) => {
    setReplyToEmail(email);
    setComposeForm({
      to: email.fromAddress || '',
      cc: '',
      subject: `Re: ${email.subject || ''}`,
      body: `\n\n--- Original Message ---\nFrom: ${email.fromName || email.fromAddress}\nDate: ${formatDate(email.receivedAt)}\nSubject: ${email.subject || ''}\n\n${email.bodyPreview || ''}`,
    });
    setShowComposeDialog(true);
  };

  const handleForward = (email: any) => {
    setReplyToEmail(null);
    setComposeForm({
      to: '',
      cc: '',
      subject: `Fwd: ${email.subject || ''}`,
      body: `\n\n--- Forwarded Message ---\nFrom: ${email.fromName || email.fromAddress}\nDate: ${formatDate(email.receivedAt)}\nSubject: ${email.subject || ''}\n\n${email.bodyText || email.bodyPreview || ''}`,
    });
    setShowComposeDialog(true);
  };

  // Filter emails by search
  const filteredEmails = (folder === 'inbox' ? inboxEmails : sentEmails).filter((e: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (e.fromAddress || '').toLowerCase().includes(q) ||
      (e.fromName || '').toLowerCase().includes(q) ||
      (e.subject || '').toLowerCase().includes(q) ||
      (e.bodyPreview || '').toLowerCase().includes(q)
    );
  });

  const isLoading = folder === 'inbox' ? loadingInbox : loadingSent;

  // Not configured state
  if (!mailbox) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Mailbox Not Configured</h3>
              <p className="text-gray-500 mb-4">
                The {category} mailbox has not been set up yet. An administrator needs to configure it.
              </p>
              <p className="text-sm text-gray-400">
                Go to Settings to connect the {category} email account.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={mailbox.status === 'active' ? 'default' : 'destructive'} className="text-xs">
            {mailbox.status === 'active' ? 'Connected' : mailbox.status}
          </Badge>
          <span className="text-xs text-gray-400">
            {mailbox.mailboxUpn}
          </span>
          {mailbox.lastSyncAt && (
            <span className="text-xs text-gray-400">
              Synced {formatRelativeTime(mailbox.lastSyncAt)}
            </span>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => { setFolder('inbox'); setSelectedEmailId(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              folder === 'inbox' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Inbox className="h-4 w-4" />
            Inbox
            {inboxEmails.filter((e: any) => !e.isRead).length > 0 && (
              <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0 h-4 min-w-[16px]">
                {inboxEmails.filter((e: any) => !e.isRead).length}
              </Badge>
            )}
          </button>
          <button
            onClick={() => { setFolder('sent'); setSelectedEmailId(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              folder === 'sent' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Send className="h-4 w-4" />
            Sent
          </button>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search emails..."
            className="pl-9 h-9 w-64"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
          Sync
        </Button>
        <Button size="sm" onClick={() => {
          setReplyToEmail(null);
          setComposeForm({ to: '', cc: '', subject: '', body: '' });
          setShowComposeDialog(true);
        }}>
          <MailPlus className="h-4 w-4 mr-1" />
          Compose
        </Button>
      </div>

      {/* Email Client */}
      <div className="flex gap-4 h-[calc(100vh-240px)]">
        {/* Email List */}
        <Card className={`${selectedEmailId && folder === 'inbox' ? 'hidden md:block md:w-2/5' : 'w-full'} overflow-hidden`}>
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <Mail className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">{searchQuery ? 'No emails match your search' : `No ${folder} emails yet`}</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredEmails.map((email: any) => (
                  <button
                    key={email.id}
                    onClick={() => {
                      if (folder === 'inbox') setSelectedEmailId(email.id);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      selectedEmailId === email.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''
                    } ${!email.isRead && folder === 'inbox' ? 'bg-white' : 'bg-gray-50/30'}`}
                  >
                    <div className="flex items-start gap-2">
                      {/* Unread dot */}
                      {folder === 'inbox' && !email.isRead && (
                        <span className="mt-2 h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm truncate ${!email.isRead && folder === 'inbox' ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                            {folder === 'inbox' ? (email.fromName || email.fromAddress) : (email.toAddresses?.[0] || 'Unknown')}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {formatRelativeTime(email.receivedAt || email.sentAt || email.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <PriorityDot priority={email.aiPriority} />
                          <span className={`text-sm truncate ${!email.isRead && folder === 'inbox' ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                            {email.subject || '(no subject)'}
                          </span>
                          {email.hasAttachments && <Paperclip className="h-3 w-3 text-gray-400 flex-shrink-0" />}
                          {email.importance === 'high' && <Star className="h-3 w-3 text-yellow-500 flex-shrink-0 fill-yellow-500" />}
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {email.bodyPreview || email.bodyText?.substring(0, 100) || ''}
                        </p>
                        {/* AI badges */}
                        {folder === 'inbox' && (email.aiAgentActionType || email.aiCategory) && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <AiActionBadge actionType={email.aiAgentActionType} />
                            {email.aiCategory && !email.aiAgentActionType && (
                              <Badge variant="outline" className="text-[10px] font-normal">
                                {email.aiCategory.replace(/_/g, ' ')}
                              </Badge>
                            )}
                          </div>
                        )}
                        {/* Sent status */}
                        {folder === 'sent' && (
                          <Badge
                            className={`mt-1 text-[10px] ${
                              email.status === 'sent' ? 'bg-green-100 text-green-700' :
                              email.status === 'failed' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {email.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Email Detail / Reading Pane */}
        {folder === 'inbox' && (
          <Card className={`${selectedEmailId ? 'flex-1' : 'hidden md:flex md:flex-1'} overflow-hidden`}>
            {!selectedEmailId ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select an email to read</p>
                </div>
              </div>
            ) : loadingDetail ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : selectedEmail ? (
              <ScrollArea className="h-full">
                <div className="p-6">
                  {/* Back button (mobile) */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="md:hidden mb-4"
                    onClick={() => setSelectedEmailId(null)}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Back
                  </Button>

                  {/* Email header */}
                  <div className="space-y-3 mb-6">
                    <h2 className="text-xl font-semibold">{selectedEmail.subject || '(no subject)'}</h2>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {selectedEmail.fromName || selectedEmail.fromAddress}
                          </span>
                          {selectedEmail.fromName && (
                            <span className="text-xs text-gray-400">&lt;{selectedEmail.fromAddress}&gt;</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          To: {selectedEmail.toAddresses?.join(', ')}
                        </div>
                        {selectedEmail.ccAddresses?.length > 0 && (
                          <div className="text-xs text-gray-400">
                            CC: {selectedEmail.ccAddresses.join(', ')}
                          </div>
                        )}
                        <div className="text-xs text-gray-400">
                          {formatDate(selectedEmail.receivedAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleReply(selectedEmail)}>
                          <Reply className="h-4 w-4 mr-1" /> Reply
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleForward(selectedEmail)}>
                          <Forward className="h-4 w-4 mr-1" /> Forward
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* AI Summary */}
                  {selectedEmail.aiSummary && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Bot className="h-4 w-4 text-purple-600" />
                        <span className="text-xs font-medium text-purple-700">AI Summary</span>
                        {selectedEmail.aiPriority && selectedEmail.aiPriority !== 'normal' && (
                          <Badge className={`text-[10px] ${
                            selectedEmail.aiPriority === 'urgent' ? 'bg-red-100 text-red-700' :
                            selectedEmail.aiPriority === 'high' ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {selectedEmail.aiPriority}
                          </Badge>
                        )}
                        <AiActionBadge actionType={selectedEmail.aiAgentActionType} />
                      </div>
                      <p className="text-sm text-purple-800">{selectedEmail.aiSummary}</p>
                    </div>
                  )}

                  {/* Email body */}
                  <div className="border-t pt-4">
                    {selectedEmail.bodyHtml ? (
                      <div
                        className="prose prose-sm max-w-none text-gray-700"
                        dangerouslySetInnerHTML={{ __html: selectedEmail.bodyHtml }}
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                        {selectedEmail.bodyText || selectedEmail.bodyPreview || 'No content'}
                      </pre>
                    )}
                  </div>

                  {/* Attachments */}
                  {selectedEmail.hasAttachments && selectedEmail.attachments?.length > 0 && (
                    <div className="border-t pt-4 mt-4">
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                        <Paperclip className="h-4 w-4" /> Attachments
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedEmail.attachments.map((att: any, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs py-1.5 px-3">
                            {att.name} {att.size ? `(${Math.round(att.size / 1024)}KB)` : ''}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : null}
          </Card>
        )}
      </div>

      {/* Compose Dialog */}
      <Dialog open={showComposeDialog} onOpenChange={setShowComposeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {replyToEmail ? 'Reply' : 'New Email'}
              <span className="text-sm font-normal text-gray-400 ml-2">
                from {mailbox.mailboxUpn}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>To</Label>
              <Input
                value={composeForm.to}
                onChange={e => setComposeForm(f => ({ ...f, to: e.target.value }))}
                placeholder="recipient@example.com"
              />
            </div>
            <div>
              <Label>CC</Label>
              <Input
                value={composeForm.cc}
                onChange={e => setComposeForm(f => ({ ...f, cc: e.target.value }))}
                placeholder="cc@example.com"
              />
            </div>
            <div>
              <Label>Subject</Label>
              <Input
                value={composeForm.subject}
                onChange={e => setComposeForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Email subject"
              />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                value={composeForm.body}
                onChange={e => setComposeForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Write your message..."
                rows={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComposeDialog(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail}>
              {sendingEmail ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
