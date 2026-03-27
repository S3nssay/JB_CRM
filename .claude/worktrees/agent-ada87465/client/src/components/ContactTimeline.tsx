import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, MessageSquare, FileText, Video, Send } from 'lucide-react';

interface TimelineEntry {
  id: number;
  source: string;
  channel: string;
  direction: string;
  message: string;
  timestamp: string;
  status: string;
  subject: string | null;
}

interface ContactTimelineProps {
  entityType: 'tenant' | 'landlord' | 'lead';
  entityId: number;
}

const channelIcons: Record<string, any> = {
  email: Mail,
  phone: Phone,
  sms: MessageSquare,
  whatsapp: MessageSquare,
  note: FileText,
  video: Video,
  sent_email: Send,
};

const channelColors: Record<string, string> = {
  email: 'bg-blue-100 text-blue-800',
  phone: 'bg-green-100 text-green-800',
  sms: 'bg-purple-100 text-purple-800',
  whatsapp: 'bg-emerald-100 text-emerald-800',
  note: 'bg-gray-100 text-gray-800',
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ContactTimeline({ entityType, entityId }: ContactTimelineProps) {
  const { data: history = [], isLoading } = useQuery<TimelineEntry[]>({
    queryKey: ['/api/crm/contact-history', entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/contact-history?entityType=${entityType}&entityId=${entityId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch history');
      return res.json();
    },
    enabled: !!entityId,
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading history...</div>;
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No communication history found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Communication History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((entry) => {
            const Icon = channelIcons[entry.channel] || FileText;
            const colorClass = channelColors[entry.channel] || 'bg-gray-100 text-gray-800';

            return (
              <div key={`${entry.source}-${entry.id}`} className="flex gap-3 p-3 rounded-lg border">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{entry.channel}</Badge>
                    <Badge variant={entry.direction === 'inbound' ? 'default' : 'secondary'} className="text-xs">
                      {entry.direction}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{formatDate(entry.timestamp)}</span>
                  </div>
                  {entry.subject && <p className="text-sm font-medium mb-1">{entry.subject}</p>}
                  <p className="text-sm text-muted-foreground line-clamp-2">{entry.message || 'No content'}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
