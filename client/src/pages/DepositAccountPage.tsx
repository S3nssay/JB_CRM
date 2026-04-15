import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Shield, Plus, RefreshCw, Loader2, Search } from "lucide-react";

const formatPence = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";

interface DepositTransaction {
  id: number;
  transactionDate: string;
  transactionType: string;
  description: string | null;
  reference: string | null;
  tenantId: number | null;
  tenantName: string | null;
  propertyId: number | null;
  propertyAddress: string | null;
  amount: number;
  runningBalance: number;
  notes: string | null;
  createdAt: string;
}

interface Balance {
  balance: number;
  lastUpdated: string;
}

const EMPTY_FORM = {
  transactionType: "deposit_in",
  amount: "",
  description: "",
  reference: "",
  transactionDate: new Date().toISOString().slice(0, 10),
  tenantId: "",
  propertyId: "",
  notes: "",
};

const TYPE_COLORS: Record<string, string> = {
  deposit_in: "bg-green-100 text-green-700 border-green-200",
  deposit_out: "bg-red-100 text-red-700 border-red-200",
  interest: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function DepositAccountPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterTenant, setFilterTenant] = useState("");
  const [filterProperty, setFilterProperty] = useState("");

  const { data: balance, isLoading: balanceLoading } = useQuery<Balance>({
    queryKey: ["/api/crm/deposit-account/balance"],
    queryFn: () => apiRequest("GET", "/api/crm/deposit-account/balance").then((r) => r.json()),
  });

  const { data: allTransactions = [], isLoading: txLoading, refetch } = useQuery<DepositTransaction[]>({
    queryKey: ["/api/crm/deposit-account/transactions"],
    queryFn: () => apiRequest("GET", "/api/crm/deposit-account/transactions").then((r) => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("POST", "/api/crm/deposit-account/transactions", body).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deposit-account/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deposit-account/balance"] });
      toast({ title: "Deposit recorded successfully" });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: () => toast({ title: "Failed to record deposit", variant: "destructive" }),
  });

  const handleSubmit = () => {
    const amountPence = Math.round(parseFloat(form.amount) * 100);
    if (isNaN(amountPence) || amountPence <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    addMutation.mutate({
      transactionType: form.transactionType,
      amount: amountPence,
      description: form.description || null,
      reference: form.reference || null,
      transactionDate: form.transactionDate,
      tenantId: form.tenantId ? parseInt(form.tenantId) : null,
      propertyId: form.propertyId ? parseInt(form.propertyId) : null,
      notes: form.notes || null,
    });
  };

  // Client-side filtering
  const transactions = allTransactions.filter((tx) => {
    if (filterTenant && !tx.tenantName?.toLowerCase().includes(filterTenant.toLowerCase())) return false;
    if (filterProperty && !tx.propertyAddress?.toLowerCase().includes(filterProperty.toLowerCase())) return false;
    return true;
  });

  const isOutflow = (type: string) => type === "deposit_out";

  return (
    <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#791E75]/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-[#791E75]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Deposit Account</h1>
              <p className="text-sm text-gray-500">Deposit fund tracking</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Refresh
            </Button>
            <Button size="sm" className="bg-[#791E75] hover:bg-[#5a1558]" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Record Deposit
            </Button>
          </div>
        </div>

        {/* Balance Card */}
        <Card className="border-[#791E75]/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Deposits Held</p>
                {balanceLoading ? (
                  <div className="h-8 w-32 bg-gray-100 animate-pulse rounded" />
                ) : (
                  <p className="text-3xl font-bold text-gray-900">
                    {balance ? formatPence(balance.balance) : "£0.00"}
                  </p>
                )}
                {balance && (
                  <p className="text-xs text-gray-400 mt-1">Last updated: {formatDate(balance.lastUpdated)}</p>
                )}
              </div>
              <div className="h-16 w-16 rounded-2xl bg-[#791E75]/10 flex items-center justify-center">
                <Shield className="h-8 w-8 text-[#791E75]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700">Filter Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label className="text-xs text-gray-500 mb-1 block">By Tenant</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    placeholder="Tenant name..."
                    value={filterTenant}
                    onChange={(e) => setFilterTenant(e.target.value)}
                    className="h-8 text-sm pl-8"
                  />
                </div>
              </div>
              <div className="flex-1">
                <Label className="text-xs text-gray-500 mb-1 block">By Property</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    placeholder="Property address..."
                    value={filterProperty}
                    onChange={(e) => setFilterProperty(e.target.value)}
                    className="h-8 text-sm pl-8"
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setFilterTenant(""); setFilterProperty(""); }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700">
              Deposit Transactions {!txLoading && `(${transactions.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {txLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[#791E75]" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No deposit transactions found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Tenant</TableHead>
                      <TableHead className="text-xs">Property</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs">Reference</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs text-right">Running Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id} className="hover:bg-gray-50/50">
                        <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                          {formatDate(tx.transactionDate)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-[10px] capitalize border ${TYPE_COLORS[tx.transactionType] || "bg-gray-100 text-gray-600"}`}
                          >
                            {tx.transactionType.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-700">
                          {tx.tenantName || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600 max-w-[160px] truncate">
                          {tx.propertyAddress || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600 max-w-[140px] truncate">
                          {tx.description || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 font-mono">
                          {tx.reference || "-"}
                        </TableCell>
                        <TableCell className={`text-xs font-medium text-right whitespace-nowrap ${isOutflow(tx.transactionType) ? "text-red-600" : "text-green-600"}`}>
                          {isOutflow(tx.transactionType) ? "-" : "+"}{formatPence(Math.abs(tx.amount))}
                        </TableCell>
                        <TableCell className="text-xs text-gray-700 text-right whitespace-nowrap">
                          {formatPence(tx.runningBalance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Record Deposit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record Deposit</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Type *</Label>
                  <Select value={form.transactionType} onValueChange={(v) => setForm({ ...form, transactionType: v })}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deposit_in">Deposit In</SelectItem>
                      <SelectItem value="deposit_out">Deposit Out</SelectItem>
                      <SelectItem value="interest">Interest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Amount (£) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Description</Label>
                <Input
                  placeholder="Deposit description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Tenant ID</Label>
                  <Input
                    type="number"
                    placeholder="Tenant ID"
                    value={form.tenantId}
                    onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Property ID</Label>
                  <Input
                    type="number"
                    placeholder="Property ID"
                    value={form.propertyId}
                    onChange={(e) => setForm({ ...form, propertyId: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Reference</Label>
                  <Input
                    placeholder="Ref number"
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Date *</Label>
                  <Input
                    type="date"
                    value={form.transactionDate}
                    onChange={(e) => setForm({ ...form, transactionDate: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Notes</Label>
                <Input
                  placeholder="Optional notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                className="bg-[#791E75] hover:bg-[#5a1558]"
                onClick={handleSubmit}
                disabled={addMutation.isPending}
              >
                {addMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Record Deposit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
