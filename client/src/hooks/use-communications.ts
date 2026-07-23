import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface CommunicationRecord {
  id: number;
  source: string;
  channel: string;
  direction: string;
  content: string;
  subject: string | null;
  status: string;
  timestamp: string;
  contactName: string | null;
  staffUserId: number | null;
  externalMessageId: string | null;
  metadata: any;
  duration?: number;
  recordingUrl?: string;
  aiSummary?: string;
  transcript?: string;
}

interface SendMessageParams {
  channel: 'email' | 'sms' | 'whatsapp' | 'phone' | 'note' | 'in_person';
  to: string;
  content: string;
  subject?: string;
  cc?: string;
  contentHtml?: string;
  entityType: string;
  entityId: number;
  contactName?: string;
}

interface LogParams {
  channel: string;
  direction: 'inbound' | 'outbound';
  content: string;
  subject?: string;
  entityType: string;
  entityId: number;
  contactName?: string;
}

export function useCommunications(entityType: string, entityId: number, channel?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['/api/crm/communications', entityType, entityId, channel || 'all'];

  const { data: history = [], isLoading } = useQuery<CommunicationRecord[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (channel && channel !== 'all') params.set('channel', channel);
      params.set('limit', '50');
      const res = await fetch(`/api/crm/communications/${entityType}/${entityId}?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch communications');
      return res.json();
    },
    refetchInterval: 30000, // Poll every 30s
    enabled: !!entityId,
  });

  const sendMessage = useMutation({
    mutationFn: async (params: SendMessageParams) => {
      const res = await fetch('/api/crm/communications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/communications', entityType, entityId] });
    },
  });

  const logCommunication = useMutation({
    mutationFn: async (params: LogParams) => {
      const res = await fetch('/api/crm/communications/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to log');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/communications', entityType, entityId] });
    },
  });

  const initiateCall = useMutation({
    mutationFn: async (params: { to: string; entityType: string; entityId: number; contactName?: string; agentPhone?: string }) => {
      const res = await fetch('/api/crm/communications/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to initiate call');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/communications', entityType, entityId] });
    },
  });

  return { history, isLoading, sendMessage, logCommunication, initiateCall };
}

export type { CommunicationRecord, SendMessageParams };
