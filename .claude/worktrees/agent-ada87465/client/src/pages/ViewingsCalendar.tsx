import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  Video,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Viewing {
  id: number;
  lead_id: number;
  property_id: number;
  scheduled_at: string;
  duration: number;
  viewing_type: string;
  status: string;
  cancelled_reason: string | null;
  agent_notes: string | null;
  lead_name: string | null;
  lead_email: string | null;
  lead_phone: string | null;
  property_address: string | null;
  property_postcode: string | null;
  conducted_by_name: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  scheduled: { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500", label: "Scheduled" },
  confirmed: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500", label: "Confirmed" },
  completed: { bg: "bg-gray-100", text: "text-gray-800", dot: "bg-gray-500", label: "Completed" },
  cancelled: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500", label: "Cancelled" },
  no_show: { bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-500", label: "No Show" },
  rescheduled: { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500", label: "Rescheduled" },
};

const BORDER_COLORS: Record<string, string> = {
  scheduled: "#3b82f6",
  confirmed: "#22c55e",
  completed: "#6b7280",
  cancelled: "#ef4444",
  no_show: "#f59e0b",
  rescheduled: "#a855f7",
};

function getStatusColor(status: string) {
  return STATUS_COLORS[status] || STATUS_COLORS.scheduled;
}

function getViewingTypeIcon(type: string) {
  switch (type) {
    case "video":
      return <Video className="h-3.5 w-3.5" />;
    case "virtual_tour":
      return <Eye className="h-3.5 w-3.5" />;
    case "in_person":
    default:
      return <Users className="h-3.5 w-3.5" />;
  }
}

export default function ViewingsCalendar() {
  const [, setLocation] = useLocation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: viewings = [], isLoading } = useQuery<Viewing[]>({
    queryKey: ["/api/crm/viewings/calendar", format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const params = new URLSearchParams({
        start: format(monthStart, "yyyy-MM-dd"),
        end: format(monthEnd, "yyyy-MM-dd"),
      });
      const res = await fetch(`/api/crm/viewings/calendar?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch viewings");
      return res.json();
    },
  });

  const calendarDays = useMemo(() => {
    const weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [monthStart, monthEnd]);

  const viewingsByDay = useMemo(() => {
    const map = new Map<string, Viewing[]>();
    for (const viewing of viewings) {
      const dayKey = format(parseISO(viewing.scheduled_at), "yyyy-MM-dd");
      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey)!.push(viewing);
    }
    return map;
  }, [viewings]);

  const stats = useMemo(() => {
    const counts = {
      total: viewings.length,
      scheduled: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    };
    for (const v of viewings) {
      if (v.status in counts) {
        (counts as Record<string, number>)[v.status]++;
      }
    }
    return counts;
  }, [viewings]);

  const selectedDayViewings = useMemo(() => {
    if (!selectedDay) return [];
    const dayKey = format(selectedDay, "yyyy-MM-dd");
    const dayViewings = viewingsByDay.get(dayKey) || [];
    if (statusFilter === "all") return dayViewings;
    return dayViewings.filter((v) => v.status === statusFilter);
  }, [selectedDay, viewingsByDay, statusFilter]);

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Eye className="h-7 w-7" style={{ color: "#791E75" }} />
        <h1 className="text-2xl font-bold text-gray-900">Viewings Calendar</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold" style={{ color: "#791E75" }}>{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Scheduled</p>
            <p className="text-2xl font-bold text-blue-600">{stats.scheduled}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Confirmed</p>
            <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Completed</p>
            <p className="text-2xl font-bold text-gray-600">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Cancelled</p>
            <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">No Show</p>
            <p className="text-2xl font-bold text-amber-600">{stats.no_show}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-lg">
                  {format(currentMonth, "MMMM yyyy")}
                </CardTitle>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: "#791E75" }} />
                </div>
              ) : (
                <>
                  {/* Week day headers */}
                  <div className="grid grid-cols-7 mb-1">
                    {weekDays.map((day) => (
                      <div
                        key={day}
                        className="text-center text-xs font-medium text-gray-500 py-2"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar days */}
                  <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                    {calendarDays.map((day) => {
                      const dayKey = format(day, "yyyy-MM-dd");
                      const dayViewings = viewingsByDay.get(dayKey) || [];
                      const inMonth = isSameMonth(day, currentMonth);
                      const today = isToday(day);
                      const selected = selectedDay && isSameDay(day, selectedDay);

                      return (
                        <div
                          key={dayKey}
                          className={`bg-white min-h-[100px] p-1 cursor-pointer transition-colors hover:bg-gray-50 ${
                            !inMonth ? "opacity-40" : ""
                          } ${selected ? "ring-2 ring-inset ring-[#791E75]" : ""}`}
                          onClick={() => setSelectedDay(day)}
                        >
                          <div className="flex justify-center mb-1">
                            <span
                              className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                                today ? "text-white" : "text-gray-700"
                              }`}
                              style={today ? { backgroundColor: "#791E75" } : undefined}
                            >
                              {format(day, "d")}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            {dayViewings.slice(0, 3).map((viewing) => {
                              const color = getStatusColor(viewing.status);
                              return (
                                <div
                                  key={viewing.id}
                                  className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${color.bg} ${color.text}`}
                                >
                                  {format(parseISO(viewing.scheduled_at), "HH:mm")}{" "}
                                  {viewing.property_address
                                    ? viewing.property_address.substring(0, 20)
                                    : "No address"}
                                </div>
                              );
                            })}
                            {dayViewings.length > 3 && (
                              <div className="text-[10px] text-gray-500 px-1 font-medium">
                                +{dayViewings.length - 3} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t">
                    {Object.entries(STATUS_COLORS).map(([status, color]) => (
                      <div key={status} className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                        <span className="text-xs text-gray-600">{color.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Day Detail Panel */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {selectedDay ? format(selectedDay, "EEEE, d MMMM yyyy") : "Day Details"}
                </CardTitle>
                {selectedDay && (
                  <Badge variant="secondary">{selectedDayViewings.length}</Badge>
                )}
              </div>
              {selectedDay && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full mt-2">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                    <SelectItem value="rescheduled">Rescheduled</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </CardHeader>
            <CardContent>
              {!selectedDay ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Calendar className="h-12 w-12 mb-3" />
                  <p className="text-sm">Select a day to view details</p>
                </div>
              ) : selectedDayViewings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Eye className="h-10 w-10 mb-3" />
                  <p className="text-sm">No viewings on this day</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {selectedDayViewings.map((viewing) => {
                    const color = getStatusColor(viewing.status);
                    const borderColor = BORDER_COLORS[viewing.status] || BORDER_COLORS.scheduled;
                    return (
                      <Card
                        key={viewing.id}
                        className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                        style={{ borderLeftColor: borderColor }}
                        onClick={() => setLocation("/crm/leads")}
                      >
                        <CardContent className="p-3 space-y-2">
                          {/* Time and status */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-sm font-medium">
                              <Clock className="h-3.5 w-3.5 text-gray-500" />
                              {format(parseISO(viewing.scheduled_at), "HH:mm")}
                              <span className="text-gray-400 text-xs">
                                ({viewing.duration} min)
                              </span>
                            </div>
                            <Badge className={`${color.bg} ${color.text} text-[10px] border-0`}>
                              {color.label}
                            </Badge>
                          </div>

                          {/* Property address */}
                          {viewing.property_address && (
                            <div className="flex items-start gap-1.5 text-sm text-gray-700">
                              <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                              <span className="line-clamp-2">
                                {viewing.property_address}
                                {viewing.property_postcode && `, ${viewing.property_postcode}`}
                              </span>
                            </div>
                          )}

                          {/* Lead name */}
                          {viewing.lead_name && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-700">
                              <User className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                              <span>{viewing.lead_name}</span>
                            </div>
                          )}

                          {/* Lead phone */}
                          {viewing.lead_phone && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-500">
                              <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                              <span>{viewing.lead_phone}</span>
                            </div>
                          )}

                          {/* Viewing type */}
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            {getViewingTypeIcon(viewing.viewing_type)}
                            <span className="capitalize">
                              {viewing.viewing_type.replace(/_/g, " ")}
                            </span>
                          </div>

                          {/* Conducted by */}
                          {viewing.conducted_by_name && (
                            <div className="text-xs text-gray-400">
                              Conducted by: {viewing.conducted_by_name}
                            </div>
                          )}

                          {/* Agent notes */}
                          {viewing.agent_notes && (
                            <div className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded">
                              {viewing.agent_notes}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
