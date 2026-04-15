import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, Wrench, FileText, DollarSign, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface HistoryEvent {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  userName: string | null;
}

interface PropertyHistoryTimelineProps {
  propertyId: number;
}

function getEventIcon(type: string) {
  switch (type) {
    case 'tenancy':
      return <Home className="h-4 w-4 text-purple-600" />;
    case 'maintenance':
      return <Wrench className="h-4 w-4 text-orange-500" />;
    case 'document':
      return <FileText className="h-4 w-4 text-blue-500" />;
    case 'financial':
      return <DollarSign className="h-4 w-4 text-green-600" />;
    case 'calendar':
      return <Calendar className="h-4 w-4 text-indigo-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function getEventDotColor(type: string): string {
  switch (type) {
    case 'tenancy':
      return 'bg-purple-200 border-purple-400';
    case 'maintenance':
      return 'bg-orange-100 border-orange-400';
    case 'document':
      return 'bg-blue-100 border-blue-400';
    case 'financial':
      return 'bg-green-100 border-green-400';
    case 'calendar':
      return 'bg-indigo-100 border-indigo-400';
    default:
      return 'bg-gray-100 border-gray-300';
  }
}

export default function PropertyHistoryTimeline({ propertyId }: PropertyHistoryTimelineProps) {
  const { data: events, isLoading } = useQuery<HistoryEvent[]>({
    queryKey: ['/api/crm/properties', propertyId, 'history'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/crm/properties/${propertyId}/history`);
      return res.json();
    },
    enabled: !!propertyId,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#791E75]" />
          Property History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-sm text-gray-500">Loading history...</p>
        )}
        {!isLoading && (!events || events.length === 0) && (
          <p className="text-sm text-gray-500">No history recorded.</p>
        )}
        {!isLoading && events && events.length > 0 && (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

            <ul className="space-y-4">
              {events.map((event) => (
                <li key={event.id} className="flex items-start gap-3 pl-0">
                  {/* Dot with icon */}
                  <div
                    className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${getEventDotColor(event.type)}`}
                  >
                    {getEventIcon(event.type)}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm text-gray-800 leading-snug">{event.description}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                      <span>
                        {format(new Date(event.createdAt), 'dd MMM yyyy HH:mm')}
                      </span>
                      {event.userName && (
                        <>
                          <span>&middot;</span>
                          <span>{event.userName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
