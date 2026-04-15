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
import { Landmark, Plus, RefreshCw, Loader2 } from "lucide-react";

const formatPence = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";

interface ClientTransaction {
  id: number;
  transactionDate: string;
  transactionType: string;
  description: string | null;
  reference: string | null;
  landlordId: number | null;
  landlordName: string | null;
  tenantId: number | null;
  tenantName: string | null;
  propertyId: number | null;
  propertyAddress: string | null;
  amount: number;
  runningBalance: number;
  isReconciled: boolean;
  category: string | null;
  notes: string | null;
  createdAt: string;
}

interface Balance {
  balance: number;
  lastUpdated: string;
}

const EMPTY_FORM = {
  transactionType: "credit",
  amount: "",
  description: "",
  reference: "",
  transactionDate: new Date().toISOString().slice(0, 10),
  landlordId: "",
  tenantId: "",
  propertyId: "",
  category: "",
  notes: "",
};

export default function ClientAccountPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const params = new URLSearchParams();
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  const queryString = params.toString() ? `?${params.toString()}` : "";

  const { data: balance, isLoading: balanceLoading } = useQuery<Balance>({
    queryKey: ["/api/crm/client-account/balance"],
    queryFn: () => apiRequest("GET", "/api/crm/client-account/balance").then((r) => r.json()),
  });

  const { data: transactions = [], isLoading: txLoading, refetch } = useQuery<ClientTransaction[]>({
    queryKey: ["/api/crm/client-account/transactions", dateFrom, dateTo],
    queryFn: () =>
      apiRequest("GET", `/api/crm/client-account/transactions${queryString}`).then((r) => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("POST", "/api/crm/client-account/transactions", body).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/client-account/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/client-account/balance"] });
      toast({ title: "Transaction added successfully" });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: () => toast({ title: "Failed to add transaction", variant: "destructive" }),
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
      landlordId: form.landlordId ? parseInt(form.landlordId) : null,
      tenantId: form.tenantId ? parseInt(form.tenantId) : null,
      propertyId: form.propertyId ? parseInt(form.propertyId) : null,
      category: form.category || null,
      notes: form.notes || null,
    });
  };

  const isCredit = (type: string) => ["credit", "transfer"].includes(type);

  return (
    <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#791E75]/10 flex items-center justify-center">
              <Landmark className="h-5 w-5 text-[#791E75]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Client Account</h1>
              <p className="text-sm text-gray-500">Client money cashbook (trust account)</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Refresh
            </Button>
            <Button size="sm" className="bg-[#791E75] hover:bg-[#5a1558]" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Transaction
            </Button>
          </div>
        </div>

        {/* Balance Card */}
        <Card className="border-[#791E75]/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Current Balance</p>
                {balanceLoading ? (
                  <div className="h-8 w-32 bg-gray-100 animate-pulse rounded" />
                ) : (
                  <p className="text-3xl font-bold text-gray-900">
                    {balance ? formatPence(balance.balance) : "£0.00"}
                  </p>
                )}
                {balance && (
                  <p className="text-xs text-gray-400 mt-1">
                    Last updated: {formatDate(balance.lastUpdated)}
                  </p>
                )}
              </div>
              <div className="h-16 w-16 rounded-2xl bg-[#791E75]/10 flex items-center justify-center">
                <Landmark className="h-8 w-8 text-[#791E75]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700">Date Range Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label className="text-xs text-gray-500 mb-1 block">From</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-gray-500 mb-1 block">To</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-sm" />
              </div>
              <Button variant="outline" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700">
              Transactions {!txLoading && `(${transactions.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {txLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[#791E75]" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No transactions found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs">Reference</TableHead>
                      <TableHead className="text-xs">Landlord / Property</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs text-right">Balance</TableHead>
                      <TableHead className="text-xs">Reconciled</TableHead>
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
                            variant="outline"
                            className="text-[10px] capitalize"
                          >
                            {tx.transactionType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-700 max-w-[180px] truncate">
                          {tx.description || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 font-mono">
                          {tx.reference || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">
                          {tx.landlordName ? (
                            <div>
                              <p>{tx.landlordName}</p>
                              {tx.propertyAddress && (
                                <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{tx.propertyAddress}</p>
                              )}
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell className={`text-xs font-medium text-right whitespace-nowrap ${isCredit(tx.transactionType) ? "text-green-600" : "text-red-600"}`}>
                          {isCredit(tx.transactionType) ? "+" : "-"}{formatPence(Math.abs(tx.amount))}
                        </TableCell>
                        <TableCell className="text-xs text-gray-700 text-right whitespace-nowrap">
                          {formatPence(tx.runningBalance)}
                        </TableCell>
                        <TableCell>
                          {tx.isReconciled ? (
                            <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200">
                              Reconciled
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-gray-400">
                              Pending
                            </Badge>
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

        {/* Add Transaction Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Transaction</DialogTitle>
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
                      <SelectItem value="credit">Credit</SelectItem>
                      <SelectItem value="debit">Debit</SelectItem>
                      <SelectItem value="withdrawal">Withdrawal</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
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
                  placeholder="Transaction description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="h-8 text-sm"
                />
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
                <Label className="text-xs mb-1 block">Category</Label>
                <Input
                  placeholder="e.g. rent, deposit, fees"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="h-8 text-sm"
                />
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
                Add Transaction
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
