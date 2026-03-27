import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar as CalendarIcon, TableIcon, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle, Clock, XCircle, RefreshCw, FileText,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO,
} from "date-fns";
import { Link } from "wouter";

const POUND = "\u00A3";

interface TenancyExpiry {
  id: number;
  propertyId: number;
  propertyAddress: string;
  tenantName: string;
  landlordName: string;
  startDate: string | null;
  endDate: string | null;
  rentAmount: number | null;
  rentFrequency: string | null;
  depositAmount: number | null;
  status: string;
  daysUntilExpiry: number | null;
  urgency: "expired" | "critical" | "warning" | "upcoming" | "active" | "periodic";
  isPeriodic: boolean;
}

const URGENCY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  expired: { bg: "bg-red-600", text: "text-white", border: "border-red-600" },
  critical: { bg: "bg-amber-600", text: "text-white", border: "border-amber-600" },
  warning: { bg: "bg-yellow-500", text: "text-white", border: "border-yellow-500" },
  upcoming: { bg: "bg-blue-500", text: "text-white", border: "border-blue-500" },
  active: { bg: "bg-green-600", text: "text-white", border: "border-green-600" },
  periodic: { bg: "bg-purple-600", text: "text-white", border: "border-purple-600" },
};

function getUrgencyBadge(urgency: string, daysUntilExpiry: number | null, isPeriodic: boolean) {
  if (isPeriodic) {
    return (
      <Badge className="bg-purple-600 text-white hover:bg-purple-600">
        Periodic
      </Badge>
    );
  }
  switch (urgency) {
    case "expired":
      return <Badge variant="destructive" className="bg-red-600">EXPIRED</Badge>;
    case "critical":
      return (
        <Badge variant="destructive" className="bg-amber-600">
          {"Expires in " + (daysUntilExpiry || 0) + " days"}
        </Badge>
      );
    case "warning":
      return (
        <Badge className="bg-yellow-500 text-white hover:bg-yellow-500">
          {"Expires in " + (daysUntilExpiry || 0) + " days"}
        </Badge>
      );
    case "upcoming":
      return (
        <Badge className="bg-blue-500 text-white hover:bg-blue-500">
          {"Expires in " + (daysUntilExpiry || 0) + " days"}
        </Badge>
      );
    case "active":
      return (
        <Badge className="bg-green-600 text-white hover:bg-green-600">Active</Badge>
      );
    default:
      return <Badge variant="secondary">{urgency}</Badge>;
  }
}

function getRowClass(urgency: string): string {
  if (urgency === "expired") return "bg-red-50";
  if (urgency === "critical") return "bg-amber-50";
  return "";
}

function TenancyTable({ tenancies }: { tenancies: TenancyExpiry[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Property</TableHead>
          <TableHead>Tenant</TableHead>
          <TableHead>Landlord</TableHead>
          <TableHead>Start Date</TableHead>
          <TableHead>End Date</TableHead>
          <TableHead>Rent</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Urgency</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tenancies.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
              No tenancies found for this filter.
            </TableCell>
          </TableRow>
        ) : (
          tenancies.map((t) => (
            <TableRow key={t.id} className={getRowClass(t.urgency)}>
              <TableCell>
                <Link
                  href={"/crm/properties/" + t.propertyId}
                  className="text-sm font-medium hover:underline"
                  style={{ color: "#791E75" }}
                >
                  {t.propertyAddress}
                </Link>
              </TableCell>
              <TableCell className="text-sm">{t.tenantName}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{t.landlordName}</TableCell>
              <TableCell className="text-sm">
                {t.startDate ? format(parseISO(t.startDate), "dd MMM yyyy") : "-"}
              </TableCell>
              <TableCell className="text-sm">
                {t.endDate ? format(parseISO(t.endDate), "dd MMM yyyy") : "-"}
              </TableCell>
              <TableCell className="text-sm">
                {t.rentAmount != null ? POUND + t.rentAmount.toLocaleString() + (t.rentFrequency ? "/" + t.rentFrequency : "") : "-"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs capitalize">
                  {t.status}
                </Badge>
              </TableCell>
              <TableCell>
                {getUrgencyBadge(t.urgency, t.daysUntilExpiry, t.isPeriodic)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function getDayCellClass(day: Date, currentMonth: Date, dayTenancies: TenancyExpiry[]): string {
  let cls = "min-h-[80px] p-1 border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors";
  if (!isSameMonth(day, currentMonth)) {
    cls += " bg-gray-50 opacity-50";
  }
  if (dayTenancies.some((t) => t.urgency === "expired")) {
    cls += " bg-red-50";
  } else if (dayTenancies.some((t) => t.urgency === "critical")) {
    cls += " bg-amber-50";
  }
  return cls;
}

function getDayNumberClass(day: Date): string {
  const today = new Date();
  let cls = "text-xs font-medium";
  if (isSameDay(day, today)) {
    cls += " bg-[#791E75] text-white rounded-full w-6 h-6 flex items-center justify-center";
  }
  return cls;
}

export default function TenancyExpiryCalendar() {
  const [view, setView] = useState<"table" | "calendar">("table");
  const [activeTab, setActiveTab] = useState("all");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const { data: tenancies = [], isLoading } = useQuery<TenancyExpiry[]>({
    queryKey: ["/api/crm/tenancy-expiry/calendar"],
    queryFn: async () => {
      const res = await fetch("/api/crm/tenancy-expiry/calendar", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tenancy expiry data");
      return res.json();
    },
  });

  const stats = useMemo(() => {
    const s = { total: 0, expired: 0, critical: 0, warning: 0, active: 0, periodic: 0 };
    tenancies.forEach((t) => {
      s.total++;
      if (t.isPeriodic) s.periodic++;
      else if (t.urgency === "expired") s.expired++;
      else if (t.urgency === "critical") s.critical++;
      else if (t.urgency === "warning") s.warning++;
      else s.active++;
    });
    return s;
  }, [tenancies]);

  const filteredTenancies = useMemo(() => {
    return tenancies.filter((t) => {
      if (activeTab === "all") return true;
      if (activeTab === "expiring") return t.urgency === "expired" || t.urgency === "critical" || t.urgency === "warning";
      if (activeTab === "active") return t.urgency === "active" || t.urgency === "upcoming";
      if (activeTab === "periodic") return t.isPeriodic;
      return true;
    });
  }, [tenancies, activeTab]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days: Date[] = [];
    let day = calStart;
    while (day <= calEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const tenanciesByDate = useMemo(() => {
    const map: Record<string, TenancyExpiry[]> = {};
    tenancies.forEach((t) => {
      if (t.endDate) {
        const key = t.endDate.split("T")[0];
        if (!map[key]) map[key] = [];
        map[key].push(t);
      }
    });
    return map;
  }, [tenancies]);

  const selectedDayTenancies = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, "yyyy-MM-dd");
    return tenanciesByDate[key] || [];
  }, [selectedDay, tenanciesByDate]);

  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8" style={{ color: "#791E75" }} />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#791E75" }}>
              Tenancy Expiry Calendar
            </h1>
            <p className="text-muted-foreground">
              Track tenancy contract expiry dates and renewals
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("table")}
            style={view === "table" ? { backgroundColor: "#791E75" } : {}}
          >
            <TableIcon className="h-4 w-4 mr-1" />
            Table
          </Button>
          <Button
            variant={view === "calendar" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("calendar")}
            style={view === "calendar" ? { backgroundColor: "#791E75" } : {}}
          >
            <CalendarIcon className="h-4 w-4 mr-1" />
            Calendar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-l-4" style={{ borderLeftColor: "#791E75" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-red-600">Expired</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-amber-600">Critical (30d)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.critical}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-yellow-500">Warning (60d)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats.warning}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-green-600">Active</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <RefreshCw className="h-4 w-4 text-purple-600" />
              <span className="text-purple-600">Periodic</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.periodic}</div>
          </CardContent>
        </Card>
      </div>

      {/* Table View */}
      {view === "table" && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">
              {"All (" + tenancies.length + ")"}
            </TabsTrigger>
            <TabsTrigger value="expiring" className="text-amber-600">
              {"Expiring (" + tenancies.filter((t) => t.urgency === "expired" || t.urgency === "critical" || t.urgency === "warning").length + ")"}
            </TabsTrigger>
            <TabsTrigger value="active" className="text-green-600">
              {"Active (" + tenancies.filter((t) => t.urgency === "active" || t.urgency === "upcoming").length + ")"}
            </TabsTrigger>
            <TabsTrigger value="periodic" className="text-purple-600">
              {"Periodic (" + tenancies.filter((t) => t.isPeriodic).length + ")"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading tenancies...
                  </div>
                ) : (
                  <TenancyTable tenancies={filteredTenancies} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Calendar View */}
      {view === "calendar" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <CardTitle className="text-lg" style={{ color: "#791E75" }}>
                    {format(currentMonth, "MMMM yyyy")}
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-0">
                  {WEEKDAYS.map((day) => (
                    <div key={day} className="p-2 text-center text-xs font-semibold text-muted-foreground border-b">
                      {day}
                    </div>
                  ))}
                  {calendarDays.map((day, idx) => {
                    const key = format(day, "yyyy-MM-dd");
                    const dayTenancies = tenanciesByDate[key] || [];
                    return (
                      <div
                        key={idx}
                        className={getDayCellClass(day, currentMonth, dayTenancies)}
                        onClick={() => setSelectedDay(day)}
                      >
                        <div className={getDayNumberClass(day)}>
                          {format(day, "d")}
                        </div>
                        {dayTenancies.slice(0, 2).map((t) => {
                          const colors = URGENCY_COLORS[t.urgency] || URGENCY_COLORS.active;
                          return (
                            <div
                              key={t.id}
                              className={"text-[10px] truncate px-1 rounded mt-0.5 " + colors.bg + " " + colors.text}
                              title={t.propertyAddress}
                            >
                              {t.propertyAddress.split(",")[0]}
                            </div>
                          );
                        })}
                        {dayTenancies.length > 2 && (
                          <div className="text-[10px] text-muted-foreground px-1">
                            {"+" + (dayTenancies.length - 2) + " more"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Day Detail Panel */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-sm" style={{ color: "#791E75" }}>
                  {selectedDay ? format(selectedDay, "EEEE, dd MMMM yyyy") : "Select a day"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedDay ? (
                  <p className="text-sm text-muted-foreground">
                    Click on a day in the calendar to see tenancy details.
                  </p>
                ) : selectedDayTenancies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No tenancies expiring on this date.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedDayTenancies.map((t) => (
                      <div key={t.id} className="border rounded-lg p-3 space-y-2">
                        <Link
                          href={"/crm/properties/" + t.propertyId}
                          className="text-sm font-medium hover:underline block"
                          style={{ color: "#791E75" }}
                        >
                          {t.propertyAddress}
                        </Link>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>Tenant: {t.tenantName}</div>
                          <div>Landlord: {t.landlordName}</div>
                          {t.rentAmount != null && (
                            <div>{"Rent: " + POUND + t.rentAmount.toLocaleString() + (t.rentFrequency ? "/" + t.rentFrequency : "")}</div>
                          )}
                        </div>
                        {getUrgencyBadge(t.urgency, t.daysUntilExpiry, t.isPeriodic)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
