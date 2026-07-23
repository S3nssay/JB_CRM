import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Phone, PhoneIncoming, PhoneOutgoing,
  Play, Clock, Users, BarChart3,
  Settings, Save, Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InboundCallerPopup, useInboundCallPopup } from '@/components/communication/InboundCallerPopup';

// Interface for call records
interface CallRecord {
  id: number;
  direction: string;
  callerPhone: string;
  agentPhone: string | null;
  startedAt: string;
  duration: number | null;
  status: string;
  aiSummary: string | null;
  recordingUrl: string | null;
  extractedName: string | null;
}

interface StaffMember {
  id: number;
  fullName: string;
  phone: string | null;
  department: string | null;
  role: string;
}

export default function CallManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { incomingPhone, showCallerPopup, dismissCallerPopup } = useInboundCallPopup();
  const [editingStaff, setEditingStaff] = useState<Record<number, string>>({});

  // Fetch recent calls from voice_call_records via raw query endpoint
  const { data: recentCalls = [], isLoading: callsLoading } = useQuery<CallRecord[]>({
    queryKey: ['/api/crm/call-log'],
    queryFn: async () => {
      const res = await fetch('/api/crm/call-log?limit=50', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch staff members
  const { data: staffMembers = [], isLoading: staffLoading } = useQuery<StaffMember[]>({
    queryKey: ['/api/crm/staff-phones'],
    queryFn: async () => {
      const res = await fetch('/api/crm/staff-phones', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Update staff phone
  const updatePhone = useMutation({
    mutationFn: async ({ userId, phone }: { userId: number; phone: string }) => {
      const res = await fetch(`/api/crm/staff/${userId}/phone`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) throw new Error('Failed to update phone');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/staff-phones'] });
      toast({ title: 'Phone number updated' });
    },
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  // Stats
  const totalCalls = recentCalls.length;
  const inboundCalls = recentCalls.filter(c => c.direction === 'inbound').length;
  const outboundCalls = recentCalls.filter(c => c.direction === 'outbound').length;
  const avgDuration = totalCalls > 0
    ? Math.round(recentCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / totalCalls)
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Caller ID Popup */}
      <InboundCallerPopup incomingPhone={incomingPhone} onDismiss={dismissCallerPopup} />

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Call Management</h1>
          <p className="text-sm text-muted-foreground">Manage calls, staff phone numbers, and call routing</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => showCallerPopup('+447700900000')}
        >
          <PhoneIncoming className="h-4 w-4 mr-2" />
          Test Caller ID
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Calls</p>
                <p className="text-2xl font-bold">{totalCalls}</p>
              </div>
              <Phone className="h-8 w-8 text-[#791E75] opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inbound</p>
                <p className="text-2xl font-bold">{inboundCalls}</p>
              </div>
              <PhoneIncoming className="h-8 w-8 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Outbound</p>
                <p className="text-2xl font-bold">{outboundCalls}</p>
              </div>
              <PhoneOutgoing className="h-8 w-8 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold">{formatDuration(avgDuration)}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Calls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Recent Calls
          </CardTitle>
        </CardHeader>
        <CardContent>
          {callsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : recentCalls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No call records yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Caller</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCalls.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell>
                      {call.direction === 'inbound' ? (
                        <PhoneIncoming className="h-4 w-4 text-blue-500" />
                      ) : (
                        <PhoneOutgoing className="h-4 w-4 text-green-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{call.extractedName || call.callerPhone}</div>
                      {call.extractedName && (
                        <div className="text-xs text-muted-foreground">{call.callerPhone}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatTime(call.startedAt)}</TableCell>
                    <TableCell className="text-sm">{formatDuration(call.duration)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={call.status === 'completed' ? 'default' : call.status === 'failed' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {call.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="text-xs text-muted-foreground truncate">{call.aiSummary || '-'}</p>
                    </TableCell>
                    <TableCell>
                      {call.recordingUrl && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Staff Phone Numbers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staff Phone Numbers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {staffLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : staffMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staff members found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffMembers.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">{staff.fullName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{staff.department || '-'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm capitalize">{staff.role}</TableCell>
                    <TableCell>
                      {editingStaff[staff.id] !== undefined ? (
                        <Input
                          value={editingStaff[staff.id]}
                          onChange={(e) => setEditingStaff({ ...editingStaff, [staff.id]: e.target.value })}
                          placeholder="+44..."
                          className="h-8 w-48 text-sm"
                        />
                      ) : (
                        <span className="text-sm">{staff.phone || <span className="text-muted-foreground italic">Not set</span>}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingStaff[staff.id] !== undefined ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={updatePhone.isPending}
                          onClick={() => {
                            updatePhone.mutate({ userId: staff.id, phone: editingStaff[staff.id] });
                            const next = { ...editingStaff };
                            delete next[staff.id];
                            setEditingStaff(next);
                          }}
                        >
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setEditingStaff({ ...editingStaff, [staff.id]: staff.phone || '' })}
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
