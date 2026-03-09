import { useState } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, ShieldAlert, ShieldCheck, PoundSterling, Calendar, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

interface Deposit {
  tenancy_id: number;
  tenant_name: string;
  property_address: string;
  landlord_name: string;
  deposit_amount: number;
  deposit_scheme: string | null;
  deposit_holder_type: string | null;
  deposit_certificate_number: string | null;
  protected_date: string | null;
}

interface DepositsResponse {
  deposits: Deposit[];
  stats: {
    total: number;
    protected: number;
    unprotected: number;
    totalValue: number;
  };
}

function formatAmount(pence: number): string {
  return `\u00A3${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DepositManagement() {
  const [activeTab, setActiveTab] = useState('all');
  const [protectDialogOpen, setProtectDialogOpen] = useState(false);
  const [selectedTenancyId, setSelectedTenancyId] = useState<number | null>(null);

  const [scheme, setScheme] = useState('');
  const [holderType, setHolderType] = useState('');
  const [certificateNumber, setCertificateNumber] = useState('');
  const [protectedDate, setProtectedDate] = useState('');

  const { data, isLoading } = useQuery<DepositsResponse>({
    queryKey: ['/api/crm/deposits', activeTab],
    queryFn: () => apiRequest(`/api/crm/deposits?status=${activeTab === 'all' ? '' : activeTab}`),
  });

  const protectMutation = useMutation({
    mutationFn: async (tenancyId: number) => {
      return apiRequest(`/api/crm/deposits/${tenancyId}/protect`, 'PUT', {
        deposit_scheme: scheme,
        deposit_holder_type: holderType,
        deposit_certificate_number: certificateNumber,
        protected_date: protectedDate,
      });
    },
    onSuccess: () => {
      toast({ title: "Deposit protected", description: "Protection details have been recorded successfully." });
      queryClient.invalidateQueries({ queryKey: [`/api/crm/deposits?status=${activeTab}`] });
      setProtectDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setScheme('');
    setHolderType('');
    setCertificateNumber('');
    setProtectedDate('');
    setSelectedTenancyId(null);
  }

  function openProtectDialog(tenancyId: number) {
    resetForm();
    setSelectedTenancyId(tenancyId);
    setProtectDialogOpen(true);
  }

  function handleProtectSubmit() {
    if (selectedTenancyId !== null) {
      protectMutation.mutate(selectedTenancyId);
    }
  }

  const stats = data?.stats;
  const deposits = data?.deposits ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: '#791E75' }}>Deposit Management</h1>
        <p className="text-muted-foreground mt-1">Track and manage tenant deposit protection status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Protected</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.protected ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unprotected</CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.unprotected ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <PoundSterling className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAmount(stats?.totalValue ?? 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="protected">Protected</TabsTrigger>
          <TabsTrigger value="unprotected">Unprotected</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading deposits...</div>
          ) : deposits.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No deposits found.</div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Landlord</TableHead>
                      <TableHead className="text-right">Deposit Amount</TableHead>
                      <TableHead>Scheme</TableHead>
                      <TableHead>Holder Type</TableHead>
                      <TableHead>Certificate No</TableHead>
                      <TableHead>Protected Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deposits.map((deposit) => (
                      <TableRow key={deposit.tenancy_id}>
                        <TableCell className="font-medium">{deposit.tenant_name}</TableCell>
                        <TableCell>{deposit.property_address}</TableCell>
                        <TableCell>{deposit.landlord_name}</TableCell>
                        <TableCell className="text-right">{formatAmount(deposit.deposit_amount)}</TableCell>
                        <TableCell>{deposit.deposit_scheme ?? '-'}</TableCell>
                        <TableCell>{deposit.deposit_holder_type ?? '-'}</TableCell>
                        <TableCell>{deposit.deposit_certificate_number ?? '-'}</TableCell>
                        <TableCell>
                          {deposit.protected_date ? (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(deposit.protected_date), 'dd/MM/yyyy')}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {deposit.protected_date ? (
                            <Badge className="bg-green-100 text-green-800 border-green-300">Protected</Badge>
                          ) : (
                            <Badge variant="destructive">UNPROTECTED</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!deposit.protected_date && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openProtectDialog(deposit.tenancy_id)}
                              style={{ borderColor: '#791E75', color: '#791E75' }}
                            >
                              Protect
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={protectDialogOpen} onOpenChange={setProtectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Deposit Protection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Scheme</label>
              <Select value={scheme} onValueChange={setScheme}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scheme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DPS">DPS</SelectItem>
                  <SelectItem value="TDS">TDS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Holder Type</label>
              <Select value={holderType} onValueChange={setHolderType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select holder type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency_custodial">Agency Custodial</SelectItem>
                  <SelectItem value="agency_insurance">Agency Insurance</SelectItem>
                  <SelectItem value="landlord">Landlord</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Certificate Number</label>
              <Input
                value={certificateNumber}
                onChange={(e) => setCertificateNumber(e.target.value)}
                placeholder="Enter certificate number"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Protected Date</label>
              <Input
                type="date"
                value={protectedDate}
                onChange={(e) => setProtectedDate(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setProtectDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleProtectSubmit}
                disabled={protectMutation.isPending || !scheme || !holderType || !certificateNumber || !protectedDate}
                style={{ backgroundColor: '#791E75' }}
              >
                {protectMutation.isPending ? 'Saving...' : 'Record Protection'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
