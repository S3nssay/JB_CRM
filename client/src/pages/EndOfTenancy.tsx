import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ClipboardList, CheckCircle, Clock, Play } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const checklistLabels: Record<string, string> = {
  serve_notice: 'Serve Notice',
  checkout_inspection: 'Checkout Inspection',
  inventory_checkout: 'Inventory Checkout',
  meter_readings: 'Meter Readings',
  key_return: 'Key Return',
  deposit_return: 'Deposit Return',
  final_account: 'Final Account',
  utility_notifications: 'Utility Notifications',
  council_tax_notification: 'Council Tax Notification',
  forwarding_address: 'Forwarding Address',
};

export default function EndOfTenancy() {
  const { toast } = useToast();
  const [selectedTenancyId, setSelectedTenancyId] = useState<number | null>(null);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [startTenancyId, setStartTenancyId] = useState('');

  const { data: endingTenancies } = useQuery({
    queryKey: ['/api/crm/pm/pm-dashboard/tenancies', 'ending'],
    queryFn: () => apiRequest('GET', '/api/crm/pm/pm-dashboard/tenancies?status=ending'),
  });

  const { data: activeTenancies } = useQuery({
    queryKey: ['/api/crm/pm/pm-dashboard/tenancies', 'active'],
    queryFn: () => apiRequest('GET', '/api/crm/pm/pm-dashboard/tenancies?status=active'),
    enabled: showStartDialog,
  });

  const { data: tenancyDetails } = useQuery({
    queryKey: ['/api/crm/pm/end-of-tenancy', selectedTenancyId],
    queryFn: () => apiRequest('GET', '/api/crm/pm/end-of-tenancy/' + selectedTenancyId),
    enabled: selectedTenancyId !== null,
  });

  const startMutation = useMutation({
    mutationFn: (tenancyId: string) =>
      apiRequest('POST', '/api/crm/pm/end-of-tenancy/' + tenancyId + '/start'),
    onSuccess: () => {
      toast({ title: 'End of tenancy process started' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pm/pm-dashboard/tenancies'] });
      setShowStartDialog(false);
      setStartTenancyId('');
    },
    onError: () => {
      toast({ title: 'Failed to start end of tenancy', variant: 'destructive' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isCompleted }: { id: number; isCompleted: boolean }) =>
      apiRequest('PATCH', '/api/crm/pm/checklist/' + id, { isCompleted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pm/end-of-tenancy', selectedTenancyId] });
    },
    onError: () => {
      toast({ title: 'Failed to update checklist item', variant: 'destructive' });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (tenancyId: number) =>
      apiRequest('POST', '/api/crm/pm/end-of-tenancy/' + tenancyId + '/complete'),
    onSuccess: () => {
      toast({ title: 'Tenancy closed successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pm/pm-dashboard/tenancies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pm/end-of-tenancy', selectedTenancyId] });
      setSelectedTenancyId(null);
    },
    onError: () => {
      toast({ title: 'Failed to close tenancy', variant: 'destructive' });
    },
  });

  const checklist = tenancyDetails?.checklist || [];
  const completedCount = checklist.filter((item: any) => item.is_completed).length;
  const totalCount = checklist.length;
  const allComplete = totalCount > 0 && completedCount === totalCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-8 w-8" style={{ color: '#791E75' }} />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#791E75' }}>
              End of Tenancy
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage checkout processes for ending tenancies
            </p>
          </div>
        </div>
        <Button onClick={() => setShowStartDialog(true)}>
          <Play className="h-4 w-4 mr-2" />
          Start New End of Tenancy
        </Button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Panel - Ending Tenancies */}
        <div className="col-span-1 space-y-4">
          <h2 className="text-lg font-semibold">Ending Tenancies</h2>
          {endingTenancies && endingTenancies.length > 0 ? (
            endingTenancies.map((tenancy: any) => (
              <Card
                key={tenancy.id}
                className={"cursor-pointer transition-colors " + (selectedTenancyId === tenancy.id ? "border-purple-600 ring-2 ring-purple-200" : "hover:border-gray-400")}
                onClick={() => setSelectedTenancyId(tenancy.id)}
              >
                <CardContent className="p-4 space-y-2">
                  <p className="font-medium">{tenancy.property_address}</p>
                  <p className="text-sm text-muted-foreground">
                    Tenant: {tenancy.tenant_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Landlord: {tenancy.landlord_name}
                  </p>
                  <Badge variant="secondary">
                    Ends: {tenancy.end_date ? format(new Date(tenancy.end_date), 'dd MMM yyyy') : 'N/A'}
                  </Badge>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No ending tenancies found.</p>
          )}
        </div>

        {/* Right Panel - Checkout Process */}
        <div className="col-span-2">
          {selectedTenancyId && tenancyDetails ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Checkout Process</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {completedCount} / {totalCount} completed
                  </span>
                </CardTitle>
                <Progress value={progressPercent} className="mt-2" />
              </CardHeader>
              <CardContent className="space-y-4">
                {checklist.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <Checkbox
                      checked={item.is_completed}
                      onCheckedChange={(checked: boolean) =>
                        toggleMutation.mutate({ id: item.id, isCompleted: checked })
                      }
                    />
                    <span className={"flex-1 " + (item.is_completed ? "line-through text-muted-foreground" : "")}>
                      {checklistLabels[item.item_type] || item.item_type}
                    </span>
                    {item.is_completed ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-amber-500" />
                    )}
                  </div>
                ))}

                <Separator className="my-4" />

                <Button
                  disabled={!allComplete || completeMutation.isPending}
                  onClick={() => completeMutation.mutate(selectedTenancyId)}
                  className="w-full"
                >
                  Close Tenancy
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Select an ending tenancy from the left panel to view its checkout process.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Start New End of Tenancy Dialog */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start End of Tenancy Process</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select value={startTenancyId} onValueChange={setStartTenancyId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an active tenancy" />
              </SelectTrigger>
              <SelectContent>
                {activeTenancies && activeTenancies.map((tenancy: any) => (
                  <SelectItem key={tenancy.id} value={String(tenancy.id)}>
                    {tenancy.property_address} - {tenancy.tenant_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={!startTenancyId || startMutation.isPending}
              onClick={() => startMutation.mutate(startTenancyId)}
            >
              Start Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
