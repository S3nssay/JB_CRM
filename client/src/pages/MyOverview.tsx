import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import {
  ArrowLeft, Calendar, Mail, MessageSquare, Home, Users,
  ChevronLeft, ChevronRight, Clock, MapPin, Eye, Phone,
  Building, CheckCircle, AlertCircle, Inbox, Send
} from 'lucide-react';

// Event type colors and icons
const eventTypeColors: Record<string, string> = {
  viewing: 'bg-blue-100 text-blue-800 border-blue-200',
  valuation: 'bg-purple-100 text-purple-800 border-purple-200',
  meeting: 'bg-green-100 text-green-800 border-green-200',
  internal_meeting: 'bg-teal-100 text-teal-800 border-teal-200',
  client_meeting: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  landlord_meeting: 'bg-amber-100 text-amber-800 border-amber-200',
  inspection: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  maintenance: 'bg-red-100 text-red-800 border-red-200',
  other: 'bg-gray-100 text-gray-800 border-gray-200',
};

const eventTypeLabels: Record<string, string> = {
  viewing: 'Viewing',
  valuation: 'Valuation',
  meeting: 'Meeting',
  internal_meeting: 'Internal Meeting',
  client_meeting: 'Client Meeting',
  landlord_meeting: 'Landlord Meeting',
  inspection: 'Inspection',
  maintenance: 'Maintenance',
  other: 'Other',
};

const getEventIcon = (type: string) => {
  switch (type) {
    case 'viewing': return <Home className="h-3.5 w-3.5" />;
    case 'valuation': return <CheckCircle className="h-3.5 w-3.5" />;
    case 'meeting': return <Users className="h-3.5 w-3.5" />;
    case 'internal_meeting': return <Users className="h-3.5 w-3.5" />;
    case 'client_meeting': return <Users className="h-3.5 w-3.5" />;
    case 'landlord_meeting': return <Building className="h-3.5 w-3.5" />;
    case 'inspection': return <Eye className="h-3.5 w-3.5" />;
    case 'maintenance': return <AlertCircle className="h-3.5 w-3.5" />;
    default: return <Calendar className="h-3.5 w-3.5" />;
  }
};

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const normalizeDate = (d: string | Date | undefined): Date => {
  if (!d) return new Date();
  return typeof d === 'string' ? new Date(d) : d;
};

const formatTime = (d: string | Date | undefined): string => {
  const date = normalizeDate(d);
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (d: string | Date | undefined): string => {
  const date = normalizeDate(d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatRelativeTime = (d: string | Date | undefined): string => {
  const date = normalizeDate(d);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
};

export default function MyOverview() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState('calendar');
  const [commFilter, setCommFilter] = useState<'all' | 'emails' | 'whatsapp'>('all');

  // Calculate date range for calendar queries
  const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
  const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // Fetch data
  const { data: stats } = useQuery<any>({
    queryKey: ['/api/crm/my-overview/stats'],
    queryFn: async () => {
      const res = await fetch('/api/crm/my-overview/stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  const { data: calendarData, isLoading: loadingCalendar } = useQuery<any>({
    queryKey: ['/api/crm/my-overview/calendar', startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/crm/my-overview/calendar?startDate=${startDate}&endDate=${endDate}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch calendar');
      return res.json();
    },
  });

  const { data: commsData, isLoading: loadingComms } = useQuery<any>({
    queryKey: ['/api/crm/my-overview/communications'],
    queryFn: async () => {
      const res = await fetch('/api/crm/my-overview/communications?limit=30', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch communications');
      return res.json();
    },
  });

  const { data: propertiesData, isLoading: loadingProps } = useQuery<any>({
    queryKey: ['/api/crm/my-overview/properties'],
    queryFn: async () => {
      const res = await fetch('/api/crm/my-overview/properties', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch properties');
      return res.json();
    },
  });

  const events = calendarData?.events || [];

  // Calendar helpers
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.unshift(new Date(year, month, -i));
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }
    return days;
  };

  const getEventsForDate = (date: Date) => {
    return events.filter((e: any) => {
      const ed = normalizeDate(e.startTime);
      return ed.getDate() === date.getDate() && ed.getMonth() === date.getMonth() && ed.getFullYear() === date.getFullYear();
    });
  };

  const navigateMonth = (dir: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1));
    setSelectedDate(null);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  };

  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth();

  // Selected day events
  const selectedDayEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation('/crm')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="h-6 w-px bg-gray-200" />
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#791E75]" />
              My Overview
            </h1>
          </div>
          <div className="text-sm text-gray-500">
            Welcome, <span className="font-medium text-gray-700">{user?.fullName || user?.username}</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('calendar')}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Today's Events</p>
                  <p className="text-2xl font-bold">{stats?.todayEvents ?? '-'}</p>
                </div>
                <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveTab('communications'); setCommFilter('emails'); }}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Unread Emails</p>
                  <p className="text-2xl font-bold">{stats?.unreadEmails ?? '-'}</p>
                </div>
                <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Mail className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveTab('communications'); setCommFilter('whatsapp'); }}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">WhatsApp Conversations</p>
                  <p className="text-2xl font-bold">{stats?.openWhatsappConversations ?? '-'}</p>
                </div>
                <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('properties')}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">My Properties</p>
                  <p className="text-2xl font-bold">{stats?.myProperties ?? '-'}</p>
                </div>
                <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <Home className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="communications" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Communications
            </TabsTrigger>
            <TabsTrigger value="properties" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              My Properties
            </TabsTrigger>
          </TabsList>

          {/* CALENDAR TAB */}
          <TabsContent value="calendar">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calendar Grid */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigateMonth(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        setCurrentDate(new Date());
                        setSelectedDate(new Date());
                      }}>
                        Today
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigateMonth(1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingCalendar ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#791E75]" />
                    </div>
                  ) : (
                    <div>
                      {/* Day headers */}
                      <div className="grid grid-cols-7 mb-1">
                        {daysOfWeek.map((day) => (
                          <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                            {day}
                          </div>
                        ))}
                      </div>
                      {/* Calendar cells */}
                      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                        {getCalendarDays().map((day, i) => {
                          const dayEvents = getEventsForDate(day);
                          const selected = selectedDate && day.getDate() === selectedDate.getDate() &&
                            day.getMonth() === selectedDate.getMonth() && day.getFullYear() === selectedDate.getFullYear();
                          return (
                            <div
                              key={i}
                              onClick={() => setSelectedDate(day)}
                              className={`bg-white min-h-[80px] p-1 cursor-pointer transition-colors
                                ${!isCurrentMonth(day) ? 'text-gray-300' : ''}
                                ${isToday(day) ? 'bg-blue-50' : ''}
                                ${selected ? 'ring-2 ring-[#791E75] ring-inset' : 'hover:bg-gray-50'}
                              `}
                            >
                              <div className={`text-xs font-medium mb-1 ${isToday(day) ? 'text-blue-600 font-bold' : ''}`}>
                                {day.getDate()}
                              </div>
                              <div className="space-y-0.5">
                                {dayEvents.slice(0, 3).map((event: any) => (
                                  <div
                                    key={event.id}
                                    className={`text-[10px] px-1 py-0.5 rounded truncate border ${eventTypeColors[event.eventType] || eventTypeColors.other}`}
                                  >
                                    {formatTime(event.startTime)} {event.title}
                                  </div>
                                ))}
                                {dayEvents.length > 3 && (
                                  <div className="text-[10px] text-gray-500 px-1">+{dayEvents.length - 3} more</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Day Detail Sidebar */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">
                    {selectedDate
                      ? selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
                      : 'Select a day'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedDate ? (
                    <p className="text-sm text-gray-500">Click on a day to see events</p>
                  ) : selectedDayEvents.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No events on this day</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedDayEvents.map((event: any) => (
                        <div key={event.id} className={`p-3 rounded-lg border ${eventTypeColors[event.eventType] || eventTypeColors.other}`}>
                          <div className="flex items-center gap-2 mb-1">
                            {getEventIcon(event.eventType)}
                            <span className="text-sm font-medium">{event.title}</span>
                          </div>
                          <div className="text-xs space-y-1 mt-2">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3" />
                              {formatTime(event.startTime)} - {formatTime(event.endTime)}
                            </div>
                            {event.location && (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3 w-3" />
                                {event.location}
                              </div>
                            )}
                            {event.propertyAddress && (
                              <div className="flex items-center gap-1.5">
                                <Home className="h-3 w-3" />
                                {event.propertyAddress}
                              </div>
                            )}
                          </div>
                          <div className="mt-2">
                            <Badge variant="outline" className="text-[10px]">
                              {eventTypeLabels[event.eventType] || event.eventType}
                            </Badge>
                            {event.status && event.status !== 'scheduled' && (
                              <Badge variant="secondary" className="text-[10px] ml-1">
                                {event.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Event Type Legend */}
            <Card className="mt-4">
              <CardContent className="pt-4 pb-3">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(eventTypeLabels).map(([type, label]) => (
                    <Badge key={type} variant="outline" className={`${eventTypeColors[type]} text-xs`}>
                      {getEventIcon(type)}
                      <span className="ml-1">{label}</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* COMMUNICATIONS TAB */}
          <TabsContent value="communications">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Communications</CardTitle>
                  <Select value={commFilter} onValueChange={(v: any) => setCommFilter(v)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Channels</SelectItem>
                      <SelectItem value="emails">Emails Only</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loadingComms ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#791E75]" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Received Emails */}
                    {(commFilter === 'all' || commFilter === 'emails') && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <Inbox className="h-4 w-4" />
                          Received Emails ({commsData?.totalReceived || 0})
                        </h3>
                        {(commsData?.emails?.received || []).length === 0 ? (
                          <p className="text-sm text-gray-400 ml-6">No received emails</p>
                        ) : (
                          <div className="space-y-2">
                            {(commsData?.emails?.received || []).slice(0, 10).map((email: any) => (
                              <div key={email.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors hover:bg-gray-50 ${!email.isRead ? 'bg-blue-50 border-blue-200' : 'border-gray-100'}`}>
                                <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <Mail className="h-4 w-4 text-purple-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className={`text-sm ${!email.isRead ? 'font-semibold' : 'font-medium'} truncate`}>
                                      {email.fromName || email.fromAddress}
                                    </span>
                                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                                      {formatRelativeTime(email.receivedAt)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700 truncate">{email.subject || '(No subject)'}</p>
                                  {email.bodyPreview && (
                                    <p className="text-xs text-gray-400 truncate mt-0.5">{email.bodyPreview}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    {email.aiPriority && email.aiPriority !== 'normal' && (
                                      <Badge variant={email.aiPriority === 'urgent' ? 'destructive' : 'secondary'} className="text-[10px]">
                                        {email.aiPriority}
                                      </Badge>
                                    )}
                                    {email.aiCategory && (
                                      <Badge variant="outline" className="text-[10px]">{email.aiCategory}</Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sent Emails */}
                    {(commFilter === 'all' || commFilter === 'emails') && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <Send className="h-4 w-4" />
                          Sent Emails ({commsData?.totalSent || 0})
                        </h3>
                        {(commsData?.emails?.sent || []).length === 0 ? (
                          <p className="text-sm text-gray-400 ml-6">No sent emails</p>
                        ) : (
                          <div className="space-y-2">
                            {(commsData?.emails?.sent || []).slice(0, 10).map((email: any) => (
                              <div key={email.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <Send className="h-4 w-4 text-blue-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium truncate">
                                      To: {(email.toAddresses || []).join(', ')}
                                    </span>
                                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                                      {formatRelativeTime(email.sentAt || email.createdAt)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700 truncate">{email.subject || '(No subject)'}</p>
                                  <Badge variant="outline" className="text-[10px] mt-1">{email.status}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* WhatsApp Conversations */}
                    {(commFilter === 'all' || commFilter === 'whatsapp') && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          WhatsApp Conversations ({commsData?.totalWhatsappConversations || 0})
                        </h3>
                        {(commsData?.whatsapp?.conversations || []).length === 0 ? (
                          <p className="text-sm text-gray-400 ml-6">No active WhatsApp conversations</p>
                        ) : (
                          <div className="space-y-2">
                            {(commsData?.whatsapp?.conversations || []).map((conv: any) => (
                              <div key={conv.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <MessageSquare className="h-4 w-4 text-green-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium truncate">{conv.contactName}</span>
                                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                                      {conv.lastMessageAt ? formatRelativeTime(conv.lastMessageAt) : ''}
                                    </span>
                                  </div>
                                  {conv.contactPhone && (
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                      <Phone className="h-3 w-3" /> {conv.contactPhone}
                                    </p>
                                  )}
                                  {conv.lastMessagePreview && (
                                    <p className="text-sm text-gray-600 truncate mt-0.5">{conv.lastMessagePreview}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant={conv.status === 'open' ? 'default' : 'secondary'} className="text-[10px]">
                                      {conv.status}
                                    </Badge>
                                    {conv.priority && conv.priority !== 'normal' && (
                                      <Badge variant={conv.priority === 'urgent' ? 'destructive' : 'outline'} className="text-[10px]">
                                        {conv.priority}
                                      </Badge>
                                    )}
                                    {conv.unreadCount > 0 && (
                                      <Badge variant="destructive" className="text-[10px]">
                                        {conv.unreadCount} unread
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROPERTIES TAB */}
          <TabsContent value="properties">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">My Properties ({propertiesData?.totalCount || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingProps ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#791E75]" />
                  </div>
                ) : (propertiesData?.properties || []).length === 0 ? (
                  <div className="text-center py-12">
                    <Home className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No properties assigned to you</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Address</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Price/Rent</TableHead>
                          <TableHead>Your Role</TableHead>
                          <TableHead>Flags</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(propertiesData?.properties || []).map((prop: any) => (
                          <TableRow
                            key={prop.id}
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => setLocation(`/crm/properties/${prop.id}/edit`)}
                          >
                            <TableCell>
                              <div>
                                <div className="font-medium text-sm">{prop.addressLine1 || prop.address}</div>
                                <div className="text-xs text-gray-500">{prop.city} {prop.postcode}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{prop.propertyType || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={prop.status === 'active' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {prop.status || 'N/A'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {prop.price ? `£${Number(prop.price).toLocaleString()}` :
                               prop.rentAmount ? `£${Number(prop.rentAmount).toLocaleString()} ${prop.rentPeriod || 'pcm'}` :
                               'N/A'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs ${
                                prop.role === 'both' ? 'bg-purple-50 text-purple-700' :
                                prop.role === 'agent' ? 'bg-blue-50 text-blue-700' :
                                'bg-amber-50 text-amber-700'
                              }`}>
                                {prop.role === 'both' ? 'Agent & PM' :
                                 prop.role === 'agent' ? 'Agent' : 'Property Manager'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {prop.isManaged && <Badge variant="secondary" className="text-[10px]">Managed</Badge>}
                                {prop.isListedRental && <Badge variant="outline" className="text-[10px] bg-green-50">Rental</Badge>}
                                {prop.isListedSale && <Badge variant="outline" className="text-[10px] bg-blue-50">Sale</Badge>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
