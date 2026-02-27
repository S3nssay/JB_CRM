import { useState } from 'react';
import { useLocation } from 'wouter';
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
  ChevronLeft, ChevronRight, Clock, MapPin, Building,
  CheckCircle, AlertCircle, LayoutDashboard, Send, Inbox,
  TrendingUp, Phone, Eye
} from 'lucide-react';

// Event type colors
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
  return normalizeDate(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
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
  return normalizeDate(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

export default function DashboardOverview() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState('calendar');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');

  const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
  const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // Build calendar URL with filters
  const calendarUrl = (() => {
    const params = new URLSearchParams({ startDate, endDate });
    if (staffFilter !== 'all') params.set('userId', staffFilter);
    if (eventTypeFilter !== 'all') params.set('eventTypes', eventTypeFilter);
    return `/api/crm/dashboard-overview/calendar?${params.toString()}`;
  })();

  // Fetch data
  const { data: stats } = useQuery<any>({
    queryKey: ['/api/crm/dashboard-overview/stats'],
    queryFn: async () => {
      const res = await fetch('/api/crm/dashboard-overview/stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  const { data: calendarData, isLoading: loadingCalendar } = useQuery<any>({
    queryKey: ['/api/crm/dashboard-overview/calendar', startDate, endDate, staffFilter, eventTypeFilter],
    queryFn: async () => {
      const res = await fetch(calendarUrl, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch calendar');
      return res.json();
    },
  });

  const { data: commsData, isLoading: loadingComms } = useQuery<any>({
    queryKey: ['/api/crm/dashboard-overview/communications'],
    queryFn: async () => {
      const res = await fetch('/api/crm/dashboard-overview/communications?days=7', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch communications');
      return res.json();
    },
  });

  const { data: propertiesData, isLoading: loadingProps } = useQuery<any>({
    queryKey: ['/api/crm/dashboard-overview/properties'],
    queryFn: async () => {
      const res = await fetch('/api/crm/dashboard-overview/properties', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch properties');
      return res.json();
    },
  });

  const events = calendarData?.events || [];

  // Collect unique staff members from calendar data for the filter dropdown
  const staffMembers = (() => {
    const map = new Map<number, string>();
    events.forEach((e: any) => {
      if (e.organizerId && e.organizerName) {
        map.set(e.organizerId, e.organizerName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  })();

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

  const selectedDayEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  // Communication stats helpers
  const commOverview = commsData?.overview || { totalReceived: 0, totalSent: 0, totalUnread: 0, openWhatsapp: 0 };
  const commByUser = commsData?.byUser || [];
  const maxActivity = Math.max(...commByUser.map((u: any) => u.emailsReceived + u.emailsSent + u.whatsappConversations), 1);

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
              <LayoutDashboard className="h-5 w-5 text-[#791E75]" />
              Management Dashboard
            </h1>
          </div>
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            Clearance Level {user?.securityClearance || '?'}
          </Badge>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Users className="h-5 w-5 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{stats?.totalStaff ?? '-'}</p>
              <p className="text-xs text-gray-500">Active Staff</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Building className="h-5 w-5 text-amber-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{stats?.managedProperties ?? '-'}</p>
              <p className="text-xs text-gray-500">Managed Properties</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Calendar className="h-5 w-5 text-purple-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{stats?.todayEvents ?? '-'}</p>
              <p className="text-xs text-gray-500">Today's Events</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <MessageSquare className="h-5 w-5 text-green-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{stats?.openWhatsappConversations ?? '-'}</p>
              <p className="text-xs text-gray-500">Open WhatsApp</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Inbox className="h-5 w-5 text-red-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{stats?.unreadEmails ?? '-'}</p>
              <p className="text-xs text-gray-500">Unread Emails</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Send className="h-5 w-5 text-indigo-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{stats?.sentToday ?? '-'}</p>
              <p className="text-xs text-gray-500">Sent Today</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Shared Calendar
            </TabsTrigger>
            <TabsTrigger value="communications" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Communications
            </TabsTrigger>
            <TabsTrigger value="properties" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Properties
            </TabsTrigger>
          </TabsList>

          {/* SHARED CALENDAR TAB */}
          <TabsContent value="calendar">
            {/* Filters */}
            <div className="flex items-center gap-3 mb-4">
              <Select value={staffFilter} onValueChange={setStaffFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {staffMembers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Event Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Event Types</SelectItem>
                  {Object.entries(eventTypeLabels).map(([type, label]) => (
                    <SelectItem key={type} value={type}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                      <div className="grid grid-cols-7 mb-1">
                        {daysOfWeek.map((day) => (
                          <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                            {day}
                          </div>
                        ))}
                      </div>
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
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
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
                            {event.organizerName && (
                              <div className="flex items-center gap-1.5">
                                <Users className="h-3 w-3" />
                                {event.organizerName}
                              </div>
                            )}
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
                          <div className="mt-2 flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-[10px]">
                              {eventTypeLabels[event.eventType] || event.eventType}
                            </Badge>
                            {event.status && event.status !== 'scheduled' && (
                              <Badge variant="secondary" className="text-[10px]">{event.status}</Badge>
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
            <div className="space-y-6">
              {/* Overview Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Inbox className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{commOverview.totalReceived}</p>
                        <p className="text-xs text-gray-500">Emails Received (7d)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <Send className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{commOverview.totalSent}</p>
                        <p className="text-xs text-gray-500">Emails Sent (7d)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                        <Mail className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{commOverview.totalUnread}</p>
                        <p className="text-xs text-gray-500">Unread Emails</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{commOverview.openWhatsapp}</p>
                        <p className="text-xs text-gray-500">Open WhatsApp</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Per-User Activity */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Staff Communication Activity (Last 7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingComms ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#791E75]" />
                    </div>
                  ) : commByUser.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">No communication activity in the last 7 days</p>
                  ) : (
                    <div className="space-y-4">
                      {/* Visual Bar Chart */}
                      <div className="space-y-3">
                        {commByUser.map((u: any) => {
                          const total = u.emailsReceived + u.emailsSent + u.whatsappConversations;
                          const pct = Math.round((total / maxActivity) * 100);
                          return (
                            <div key={u.userId} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">{u.userName}</span>
                                <span className="text-gray-500">{total} total</span>
                              </div>
                              <div className="flex h-5 rounded-full overflow-hidden bg-gray-100">
                                {u.emailsReceived > 0 && (
                                  <div
                                    className="bg-blue-400 h-full"
                                    style={{ width: `${(u.emailsReceived / maxActivity) * 100}%` }}
                                    title={`${u.emailsReceived} received`}
                                  />
                                )}
                                {u.emailsSent > 0 && (
                                  <div
                                    className="bg-indigo-400 h-full"
                                    style={{ width: `${(u.emailsSent / maxActivity) * 100}%` }}
                                    title={`${u.emailsSent} sent`}
                                  />
                                )}
                                {u.whatsappConversations > 0 && (
                                  <div
                                    className="bg-green-400 h-full"
                                    style={{ width: `${(u.whatsappConversations / maxActivity) * 100}%` }}
                                    title={`${u.whatsappConversations} WhatsApp`}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Legend */}
                      <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-400" /> Received</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-400" /> Sent</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400" /> WhatsApp</span>
                      </div>

                      {/* Data Table */}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Staff Member</TableHead>
                            <TableHead className="text-center">Emails Received</TableHead>
                            <TableHead className="text-center">Emails Sent</TableHead>
                            <TableHead className="text-center">Unread</TableHead>
                            <TableHead className="text-center">WhatsApp</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {commByUser.map((u: any) => (
                            <TableRow key={u.userId}>
                              <TableCell className="font-medium">{u.userName}</TableCell>
                              <TableCell className="text-center">{u.emailsReceived}</TableCell>
                              <TableCell className="text-center">{u.emailsSent}</TableCell>
                              <TableCell className="text-center">
                                {u.unreadEmails > 0 ? (
                                  <Badge variant="destructive" className="text-xs">{u.unreadEmails}</Badge>
                                ) : (
                                  <span className="text-gray-400">0</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {u.whatsappConversations > 0 ? (
                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700">{u.whatsappConversations}</Badge>
                                ) : (
                                  <span className="text-gray-400">0</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Activity Feed */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Recent Emails
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(commsData?.recentActivity?.emails || []).length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No recent emails</p>
                    ) : (
                      <div className="space-y-2">
                        {(commsData?.recentActivity?.emails || []).map((email: any) => (
                          <div key={email.id} className="flex items-start gap-2 p-2 rounded border border-gray-100 hover:bg-gray-50">
                            <Inbox className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{email.fromName || email.fromAddress}</p>
                              <p className="text-xs text-gray-600 truncate">{email.subject || '(No subject)'}</p>
                              <p className="text-[10px] text-gray-400">{formatRelativeTime(email.timestamp)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Recent WhatsApp Messages
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(commsData?.recentActivity?.whatsapp || []).length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No recent WhatsApp messages</p>
                    ) : (
                      <div className="space-y-2">
                        {(commsData?.recentActivity?.whatsapp || []).map((msg: any) => (
                          <div key={msg.id} className="flex items-start gap-2 p-2 rounded border border-gray-100 hover:bg-gray-50">
                            <MessageSquare className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="text-[10px]">{msg.direction}</Badge>
                                <span className="text-xs text-gray-500">{msg.fromAddress}</span>
                              </div>
                              <p className="text-sm text-gray-700 truncate">{msg.content}</p>
                              <p className="text-[10px] text-gray-400">{formatRelativeTime(msg.timestamp)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* PROPERTIES TAB */}
          <TabsContent value="properties">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Managed Properties ({propertiesData?.totalCount || 0})</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {loadingProps ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#791E75]" />
                  </div>
                ) : (propertiesData?.properties || []).length === 0 ? (
                  <div className="text-center py-12">
                    <Building className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No managed properties</p>
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
                          <TableHead>Agent</TableHead>
                          <TableHead>Property Manager</TableHead>
                          <TableHead>Management</TableHead>
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
                              <Badge variant={prop.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                                {prop.status || 'N/A'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {prop.price ? `£${Number(prop.price).toLocaleString()}` :
                               prop.rentAmount ? `£${Number(prop.rentAmount).toLocaleString()} ${prop.rentPeriod || 'pcm'}` :
                               'N/A'}
                            </TableCell>
                            <TableCell className="text-sm">{prop.agentName || '-'}</TableCell>
                            <TableCell className="text-sm">{prop.propertyManagerName || '-'}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {prop.managementType && (
                                  <Badge variant="outline" className="text-[10px]">{prop.managementType}</Badge>
                                )}
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
