import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PoundSterling, Wrench, Shield, AlertTriangle, Trash2, Settings } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

const formatGBP = (pence: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);

interface CostLedgerProps {
  mode: 'property' | 'landlord';
  entityId: number;
}

export default function CostLedger({ mode, entityId }: CostLedgerProps) {
  const queryClient = useQueryClient();
  const [thresholdDialog, setThresholdDialog] = useState(false);
  const [annualLimit, setAnnualLimit] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');

  const endpoint = mode === 'property'
    ? `/api/crm/properties/${entityId}/costs`
    : `/api/crm/landlords/${entityId}/costs`;

  const { data: costs, isLoading } = useQuery({
    queryKey: [endpoint],
    queryFn: async () => {
      const res = await fetch(endpoint, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch costs');
      return res.json();
    },
  });

  // Threshold query (property mode only)
  const { data: threshold } = useQuery({
    queryKey: [`/api/crm/properties/${entityId}/cost-threshold`],
    queryFn: async () => {
      const res = await fetch(`/api/crm/properties/${entityId}/cost-threshold`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: mode === 'property',
  });

  const thresholdMutation = useMutation({
    mutationFn: async (body: { annualLimit: number; notificationEmail: string }) => {
      const res = await apiRequest('PUT', `/api/crm/properties/${entityId}/cost-threshold`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/properties/${entityId}/cost-threshold`] });
      setThresholdDialog(false);
    },
  });

  const deleteThresholdMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/crm/properties/${entityId}/cost-threshold`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/properties/${entityId}/cost-threshold`] });
    },
  });

  const handleSaveThreshold = () => {
    if (!annualLimit || !notificationEmail) return;
    const limitPence = Math.round(parseFloat(annualLimit) * 100);
    thresholdMutation.mutate({ annualLimit: limitPence, notificationEmail });
  };

  const openThresholdDialog = () => {
    if (threshold) {
      setAnnualLimit(String(threshold.annualLimit / 100));
      setNotificationEmail(threshold.notificationEmail || '');
    } else {
      setAnnualLimit('');
      setNotificationEmail('');
    }
    setThresholdDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!costs || (mode === 'property' && !costs.maintenance && !costs.compliance) ||
      (mode === 'landlord' && (!costs.properties || costs.properties.length === 0))) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg bg-gray-50">
        <PoundSterling className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No costs recorded yet</p>
      </div>
    );
  }

  // Property mode
  if (mode === 'property') {
    return (
      <div className="space-y-4">
        {/* Totals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Grand Total</p>
                  <p className="text-2xl font-bold">{formatGBP(costs.grandTotal || 0)}</p>
                </div>
                <PoundSterling className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Maintenance</p>
                  <p className="text-xl font-semibold">{formatGBP(costs.maintenance?.total || 0)}</p>
                </div>
                <Wrench className="h-6 w-6 text-orange-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Compliance</p>
                  <p className="text-xl font-semibold">{formatGBP(costs.compliance?.total || 0)}</p>
                </div>
                <Shield className="h-6 w-6 text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Threshold Config */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Cost Threshold</span>
                {threshold ? (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700">
                    Limit: {formatGBP(threshold.annualLimit)}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Not configured</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={openThresholdDialog}>
                  <Settings className="h-3.5 w-3.5 mr-1" />
                  {threshold ? 'Edit' : 'Set Threshold'}
                </Button>
                {threshold && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => deleteThresholdMutation.mutate()}
                    disabled={deleteThresholdMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Maintenance Table */}
        {costs.maintenance?.items && costs.maintenance.items.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Maintenance Expenses
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Work Order</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Issue Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costs.maintenance.items.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-sm">{item.workOrderNumber || '-'}</TableCell>
                      <TableCell>{item.scope || '-'}</TableCell>
                      <TableCell>{item.issueType || '-'}</TableCell>
                      <TableCell className="font-semibold">{formatGBP(item.invoiceAmount || 0)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.date ? new Date(item.date).toLocaleDateString('en-GB') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Compliance Table */}
        {costs.compliance?.items && costs.compliance.items.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Compliance Expenses
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Certification Type</TableHead>
                    <TableHead>Issued By</TableHead>
                    <TableHead>Inspection Date</TableHead>
                    <TableHead>Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costs.compliance.items.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{item.certificationType || '-'}</TableCell>
                      <TableCell>{item.issuedBy || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.inspectionDate ? new Date(item.inspectionDate).toLocaleDateString('en-GB') : '-'}
                      </TableCell>
                      <TableCell className="font-semibold">{formatGBP(item.cost || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Threshold Dialog */}
        <Dialog open={thresholdDialog} onOpenChange={setThresholdDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Cost Threshold</DialogTitle>
              <DialogDescription>
                Set an annual cost limit. You will be notified by email when costs approach this threshold.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Annual Limit (GBP)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={annualLimit}
                  onChange={(e) => setAnnualLimit(e.target.value)}
                  placeholder="e.g. 5000"
                />
              </div>
              <div className="space-y-2">
                <Label>Notification Email</Label>
                <Input
                  type="email"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  placeholder="e.g. manager@example.com"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setThresholdDialog(false)}>Cancel</Button>
              <Button
                onClick={handleSaveThreshold}
                disabled={!annualLimit || !notificationEmail || thresholdMutation.isPending}
              >
                {thresholdMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save Threshold
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Landlord mode
  return (
    <div className="space-y-4">
      {/* Grand Total */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Total Costs Across All Properties</p>
              <p className="text-2xl font-bold">{formatGBP(costs.grandTotal || 0)}</p>
            </div>
            <PoundSterling className="h-8 w-8 text-muted-foreground opacity-50" />
          </div>
        </CardContent>
      </Card>

      {/* Per-Property Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Per-Property Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Maintenance</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs.properties.map((prop: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{prop.address || `Property #${prop.propertyId}`}</TableCell>
                  <TableCell>{formatGBP(prop.maintenanceTotal || 0)}</TableCell>
                  <TableCell>{formatGBP(prop.complianceTotal || 0)}</TableCell>
                  <TableCell className="font-semibold">
                    {formatGBP((prop.maintenanceTotal || 0) + (prop.complianceTotal || 0))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
