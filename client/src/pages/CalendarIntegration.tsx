import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar, Plus, ChevronLeft, ChevronRight, Clock,
  MapPin, User, Users, Home, Video, Phone, Edit,
  Trash2, CheckCircle, AlertCircle, RefreshCw, Settings,
  ExternalLink, ArrowLeft
} from 'lucide-react';

interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  eventType: string;
  startTime: Date | string;
  endTime: Date | string;
  location?: string;
  propertyId?: number;
  status?: string;
  isVirtual?: boolean;
  virtualMeetingUrl?: string;
  organizerId?: number;
}

// Helper to safely convert event dates
const normalizeEventDate = (date: Date | string | undefined): Date => {
  if (!date) return new Date();
  return typeof date === 'string' ? new Date(date) : date;
};

// Days of the week
const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Event type colors
const eventTypeColors: Record<string, string> = {
  viewing: 'bg-blue-100 text-blue-800 border-blue-200',
  valuation: 'bg-purple-100 text-purple-800 border-purple-200',
  meeting: 'bg-green-100 text-green-800 border-green-200',
  inspection: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  maintenance: 'bg-red-100 text-red-800 border-red-200',
  other: 'bg-gray-100 text-gray-800 border-gray-200'
};

const getEventIcon = (type: string) => {
  switch (type) {
    case 'viewing': return <Home className="h-4 w-4" />;
    case 'valuation': return <CheckCircle className="h-4 w-4" />;
    case 'meeting': return <Users className="h-4 w-4" />;
    case 'inspection': return <CheckCircle className="h-4 w-4" />;
    case 'maintenance': return <AlertCircle className="h-4 w-4" />;
    default: return <Calendar className="h-4 w-4" />;
  }
};

export default function CalendarIntegration() {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    eventType: 'viewing',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    isVirtual: false,
    virtualMeetingUrl: '',
    attendeeEmail: ''
  });

  // Fetch events from API
  const { data: events = [], isLoading: loadingEvents } = useQuery<CalendarEvent[]>({
    queryKey: ['/api/crm/calendar-events'],
    queryFn: async () => {
      const response = await fetch('/api/crm/calendar-events', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    }
  });

  // Create event mutation
  const createEvent = useMutation({
    mutationFn: async (eventData: any) => {
      return apiRequest('/api/crm/calendar-events', 'POST', eventData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/calendar-events'] });
      toast({
        title: 'Event created',
        description: `"${eventForm.title}" has been scheduled.`
      });
      setShowEventDialog(false);
      setEventForm({
        title: '',
        description: '',
        eventType: 'viewing',
        date: '',
        startTime: '',
        endTime: '',
        location: '',
        isVirtual: false,
        virtualMeetingUrl: '',
        attendeeEmail: ''
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create event',
        description: error.message || 'Please try again',
        variant: 'destructive'
      });
    }
  });

  // Calendar settings
  const [calendarSettings, setCalendarSettings] = useState({
    googleCalendarEnabled: true,
    outlookCalendarEnabled: false,
    emailReminders: true,
    smsReminders: false,
    reminderMinutes: 30,
    workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    workingHoursStart: '09:00',
    workingHoursEnd: '17:00'
  });

  // Get calendar days for current month
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: Date[] = [];

    // Add previous month days
    for (let i = 0; i < firstDay.getDay(); i++) {
      const day = new Date(year, month, -i);
      days.unshift(day);
    }

    // Add current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    // Add next month days to complete grid
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  };

  const getEventsForDate = (date: Date) => {
    return events.filter((event: CalendarEvent) => {
      const eventDate = normalizeEventDate(event.startTime);
      return eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear();
    });
  };

  const formatTime = (date: Date | string | undefined) => {
    const d = normalizeEventDate(date);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const handleCreateEvent = () => {
    if (!eventForm.title || !eventForm.date || !eventForm.startTime) {
      toast({
        title: 'Missing required fields',
        description: 'Please fill in title, date, and start time.',
        variant: 'destructive'
      });
      return;
    }

    // Combine date and time into ISO strings
    const startDateTime = new Date(`${eventForm.date}T${eventForm.startTime}`);
    const endDateTime = eventForm.endTime 
      ? new Date(`${eventForm.date}T${eventForm.endTime}`)
      : new Date(startDateTime.getTime() + 60 * 60 * 1000); // Default 1 hour

    createEvent.mutate({
      title: eventForm.title,
      description: eventForm.description || undefined,
      eventType: eventForm.eventType,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      location: eventForm.location || undefined,
      isVirtual: eventForm.isVirtual,
      virtualMeetingUrl: eventForm.isVirtual ? eventForm.virtualMeetingUrl : undefined
    });
  };

  // Handle clicking on a day to drill down
  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setCurrentDate(day);
    setViewMode('day');
  };

  const handleSaveSettings = () => {
    toast({
      title: 'Settings saved',
      description: 'Calendar settings have been updated.'
    });
    setShowSettingsDialog(false);
  };

  const calendarDays = getCalendarDays();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/portal">
                <Button variant="ghost" size="icon" data-testid="button-back-to-portal">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <Calendar className="h-8 w-8 text-[#791E75] mr-3" />
              <h1 className="text-xl font-semibold">Calendar</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" onClick={() => setShowSettingsDialog(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Event
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create New Event</DialogTitle>
                    <DialogDescription>
                      Schedule a viewing, valuation, or meeting
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Event Title</Label>
                      <Input
                        placeholder="e.g., Property Viewing"
                        value={eventForm.title}
                        onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Event Type</Label>
                        <Select
                          value={eventForm.eventType}
                          onValueChange={(value) => setEventForm({ ...eventForm, eventType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewing">Viewing</SelectItem>
                            <SelectItem value="valuation">Valuation</SelectItem>
                            <SelectItem value="meeting">Meeting</SelectItem>
                            <SelectItem value="inspection">Inspection</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={eventForm.date}
                          onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Time</Label>
                        <Input
                          type="time"
                          value={eventForm.startTime}
                          onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Time</Label>
                        <Input
                          type="time"
                          value={eventForm.endTime}
                          onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input
                        placeholder="Address or meeting room"
                        value={eventForm.location}
                        onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={eventForm.isVirtual}
                        onCheckedChange={(checked) => setEventForm({ ...eventForm, isVirtual: checked })}
                      />
                      <Label>Virtual Meeting</Label>
                    </div>
                    {eventForm.isVirtual && (
                      <div className="space-y-2">
                        <Label>Meeting URL</Label>
                        <Input
                          placeholder="https://meet.google.com/..."
                          value={eventForm.virtualMeetingUrl}
                          onChange={(e) => setEventForm({ ...eventForm, virtualMeetingUrl: e.target.value })}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Attendee Email</Label>
                      <Input
                        type="email"
                        placeholder="attendee@email.com"
                        value={eventForm.attendeeEmail}
                        onChange={(e) => setEventForm({ ...eventForm, attendeeEmail: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        placeholder="Event details..."
                        value={eventForm.description}
                        onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowEventDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateEvent}>
                      Create Event
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h2 className="text-lg font-semibold">
                      {currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </h2>
                    <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentDate(new Date())}
                    >
                      Today
                    </Button>
                    <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="month">Month</SelectItem>
                        <SelectItem value="week">Week</SelectItem>
                        <SelectItem value="day">Day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {viewMode === 'day' ? (
                  /* Day View */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <Button variant="ghost" size="sm" onClick={() => setViewMode('month')}>
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Back to Month
                      </Button>
                      <h3 className="font-semibold">
                        {currentDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {getEventsForDate(currentDate).length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          No events scheduled for this day
                        </div>
                      ) : (
                        getEventsForDate(currentDate).map((event: CalendarEvent) => (
                          <div key={event.id} className={`p-4 rounded-lg border ${eventTypeColors[event.eventType] || eventTypeColors.other}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3">
                                {getEventIcon(event.eventType)}
                                <div>
                                  <p className="font-medium">{event.title}</p>
                                  <p className="text-sm">{formatTime(event.startTime)} - {formatTime(event.endTime)}</p>
                                </div>
                              </div>
                              <Badge variant="outline">{event.eventType}</Badge>
                            </div>
                            {event.description && (
                              <p className="mt-2 text-sm">{event.description}</p>
                            )}
                            {event.location && (
                              <div className="mt-2 flex items-center text-sm">
                                <MapPin className="h-4 w-4 mr-1" />
                                {event.location}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  /* Month View - Calendar Grid */
                  <div className="grid grid-cols-7 gap-px bg-gray-200">
                    {/* Day Headers */}
                    {daysOfWeek.map((day) => (
                      <div key={day} className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-500">
                        {day}
                      </div>
                    ))}

                    {/* Calendar Days */}
                    {calendarDays.map((day, index) => {
                      const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                      const isToday = day.toDateString() === new Date().toDateString();
                      const isSelected = selectedDate?.toDateString() === day.toDateString();
                      const dayEvents = getEventsForDate(day);

                      return (
                        <div
                          key={index}
                          className={`bg-white min-h-[100px] p-1 cursor-pointer hover:bg-gray-50 ${
                            !isCurrentMonth ? 'text-gray-400' : ''
                          } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                          onClick={() => handleDayClick(day)}
                          data-testid={`calendar-day-${day.getDate()}-${day.getMonth()}`}
                        >
                          <div className={`text-sm p-1 ${
                            isToday ? 'bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center' : ''
                          }`}>
                            {day.getDate()}
                          </div>
                          <div className="space-y-1 mt-1">
                            {dayEvents.slice(0, 2).map((event: CalendarEvent) => (
                              <div
                                key={event.id}
                                className={`text-xs p-1 rounded truncate ${eventTypeColors[event.eventType] || eventTypeColors.other}`}
                                data-testid={`event-${event.id}`}
                              >
                                {formatTime(event.startTime)} {event.title}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-xs text-gray-500 p-1">
                                +{dayEvents.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Upcoming Events */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upcoming Events</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-[400px] overflow-y-auto">
                  {loadingEvents ? (
                    <div className="p-4 text-center text-gray-500">Loading events...</div>
                  ) : events.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">No upcoming events</div>
                  ) : (
                    events.slice(0, 10).map((event: CalendarEvent) => (
                      <div key={event.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start space-x-3">
                            <div className={`p-2 rounded ${eventTypeColors[event.eventType] || eventTypeColors.other}`}>
                              {getEventIcon(event.eventType)}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{event.title}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(event.startTime).toLocaleDateString('en-GB', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short'
                                })}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatTime(event.startTime)} - {formatTime(event.endTime)}
                              </p>
                            </div>
                          </div>
                          <Badge variant={event.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">
                            {event.status || 'scheduled'}
                          </Badge>
                        </div>
                        {event.location && (
                          <div className="mt-2 flex items-center text-xs text-gray-500">
                            <MapPin className="h-3 w-3 mr-1" />
                            {event.location}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Calendar Sync Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Calendar Sync</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center mr-3">
                      <span className="text-red-600 font-bold text-sm">G</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Google Calendar</p>
                      <p className="text-xs text-gray-500">
                        {calendarSettings.googleCalendarEnabled ? 'Connected' : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  {calendarSettings.googleCalendarEnabled ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <Button size="sm" variant="outline">Connect</Button>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center mr-3">
                      <span className="text-blue-600 font-bold text-sm">O</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Outlook Calendar</p>
                      <p className="text-xs text-gray-500">
                        {calendarSettings.outlookCalendarEnabled ? 'Connected' : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  {calendarSettings.outlookCalendarEnabled ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <Button size="sm" variant="outline">Connect</Button>
                  )}
                </div>

                <Button variant="outline" className="w-full" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Calendar Settings</DialogTitle>
            <DialogDescription>
              Configure your calendar preferences and integrations
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium mb-3">Working Hours</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={calendarSettings.workingHoursStart}
                    onChange={(e) => setCalendarSettings({
                      ...calendarSettings,
                      workingHoursStart: e.target.value
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={calendarSettings.workingHoursEnd}
                    onChange={(e) => setCalendarSettings({
                      ...calendarSettings,
                      workingHoursEnd: e.target.value
                    })}
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-3">Reminders</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Email Reminders</Label>
                  <Switch
                    checked={calendarSettings.emailReminders}
                    onCheckedChange={(checked) => setCalendarSettings({
                      ...calendarSettings,
                      emailReminders: checked
                    })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>SMS Reminders</Label>
                  <Switch
                    checked={calendarSettings.smsReminders}
                    onCheckedChange={(checked) => setCalendarSettings({
                      ...calendarSettings,
                      smsReminders: checked
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reminder Time (minutes before)</Label>
                  <Select
                    value={calendarSettings.reminderMinutes.toString()}
                    onValueChange={(value) => setCalendarSettings({
                      ...calendarSettings,
                      reminderMinutes: parseInt(value)
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="1440">1 day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-3">Calendar Integrations</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Google Calendar</p>
                    <p className="text-sm text-gray-500">Sync events with Google</p>
                  </div>
                  <Switch
                    checked={calendarSettings.googleCalendarEnabled}
                    onCheckedChange={(checked) => setCalendarSettings({
                      ...calendarSettings,
                      googleCalendarEnabled: checked
                    })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Outlook Calendar</p>
                    <p className="text-sm text-gray-500">Sync events with Outlook</p>
                  </div>
                  <Switch
                    checked={calendarSettings.outlookCalendarEnabled}
                    onCheckedChange={(checked) => setCalendarSettings({
                      ...calendarSettings,
                      outlookCalendarEnabled: checked
                    })}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
