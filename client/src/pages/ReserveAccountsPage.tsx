import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PiggyBank, Plus, RefreshCw, Loader2, ChevronLeft, ArrowRight } from "lucide-react";

const formatPence = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";

interface ReserveAccount {
  id: number;
  landlordId: number;
  landlordName: string | null;
  balance: number;
  targetAmount: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ReserveTransaction {
  id: number;
  reserveAccountId: number;
  transactionType: string;
  amount: number;
  description: string | null;
  reference: string | null;
  transactionDate: string;
  createdAt: string;
}

const EMPTY_ACCOUNT_FORM = {
  landlordId: "",
  targetAmount: "",
  notes: "",
};

const EMPTY_TX_FORM = {
  transactionType: "transfer_in",
  amount: "",
  description: "",
  reference: "",
  transactionDate: new Date().toISOString().slice(0, 10),
};

export default function ReserveAccountsPage() {
  const { toast } = useToast();
  const [selectedAccount, setSelectedAccount] = useState<ReserveAccount | null>(null);
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [addTxOpen, setAddTxOpen] = useState(false);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM);
  const [txForm, setTxForm] = useState(EMPTY_TX_FORM);

  const { data: accounts = [], isLoading: accountsLoading, refetch } = useQuery<ReserveAccount[]>({
    queryKey: ["/api/crm/reserve-accounts"],
    queryFn: () => apiRequest("GET", "/api/crm/reserve-accounts").then((r) => r.json()),
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery<ReserveTransaction[]>({
    queryKey: ["/api/crm/reserve-accounts", selectedAccount?.id, "transactions"],
    queryFn: () =>
      apiRequest("GET", `/api/crm/reserve-accounts/${selectedAccount!.id}`).then((r) => r.json()).then((d) => d.transactions || []),
    enabled: !!selectedAccount,
  });

  const createAccountMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("POST", "/api/crm/reserve-accounts", body).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/reserve-accounts"] });
      toast({ title: "Reserve account created" });
      setCreateAccountOpen(false);
      setAccountForm(EMPTY_ACCOUNT_FORM);
    },
    onError: () => toast({ title: "Failed to create account", variant: "destructive" }),
  });

  const addTxMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("POST", `/api/crm/reserve-accounts/${selectedAccount!.id}/transactions`, body).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/reserve-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/reserve-accounts", selectedAccount?.id, "transactions"] });
      toast({ title: "Transaction added" });
      setAddTxOpen(false);
      setTxForm(EMPTY_TX_FORM);
    },
    onError: () => toast({ title: "Failed to add transaction", variant: "destructive" }),
  });

  const handleCreateAccount = () => {
    if (!accountForm.landlordId) {
      toast({ title: "Landlord ID is required", variant: "destructive" });
      return;
    }
    const targetPence = accountForm.targetAmount
      ? Math.round(parseFloat(accountForm.targetAmount) * 100)
      : null;
    createAccountMutation.mutate({
      landlordId: parseInt(accountForm.landlordId),
      targetAmount: targetPence,
      notes: accountForm.notes || null,
    });
  };

  const handleAddTx = () => {
    const amountPence = Math.round(parseFloat(txForm.amount) * 100);
    if (isNaN(amountPence) || amountPence <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    addTxMutation.mutate({
      transactionType: txForm.transactionType,
      amount: amountPence,
      description: txForm.description || null,
      reference: txForm.reference || null,
      transactionDate: txForm.transactionDate,
    });
  };

  const getProgressPercent = (balance: number, target: number | null) => {
    if (!target || target === 0) return 0;
    return Math.min(100, Math.round((balance / target) * 100));
  };

  const isOutflow = (type: string) => type === "transfer_out" || type === "charge";

  return (
    <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedAccount && (
              <Button variant="ghost" size="sm" className="mr-1 px-2" onClick={() => setSelectedAccount(null)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="h-9 w-9 rounded-lg bg-[#791E75]/10 flex items-center justify-center">
              <PiggyBank className="h-5 w-5 text-[#791E75]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {selectedAccount ? `${selectedAccount.landlordName || `Account #${selectedAccount.id}`}` : "Reserve Accounts"}
              </h1>
              <p className="text-sm text-gray-500">
                {selectedAccount ? "Transaction history" : "Per-landlord reserve pots"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Refresh
            </Button>
            {selectedAccount ? (
              <Button size="sm" className="bg-[#791E75] hover:bg-[#5a1558]" onClick={() => setAddTxOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Transaction
              </Button>
            ) : (
              <Button size="sm" className="bg-[#791E75] hover:bg-[#5a1558]" onClick={() => setCreateAccountOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Create Reserve Account
              </Button>
            )}
          </div>
        </div>

        {/* Account list */}
        {!selectedAccount && (
          <>
            {accountsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
              </div>
            ) : accounts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <PiggyBank className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">No reserve accounts yet</p>
                  <Button
                    size="sm"
                    className="mt-4 bg-[#791E75] hover:bg-[#5a1558]"
                    onClick={() => setCreateAccountOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create First Account
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((account) => {
                  const pct = getProgressPercent(account.balance, account.targetAmount);
                  return (
                    <Card
                      key={account.id}
                      className="cursor-pointer hover:border-[#791E75]/40 transition-colors group"
                      onClick={() => setSelectedAccount(account)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-sm font-semibold text-gray-900 group-hover:text-[#791E75]">
                              {account.landlordName || `Landlord #${account.landlordId}`}
                            </CardTitle>
                            <p className="text-[10px] text-gray-400 mt-0.5">Account #{account.id}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {account.isActive ? (
                              <Badge className="text-[10px] bg-green-100 text-green-700">Active</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-gray-400">Inactive</Badge>
                            )}
                            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-[#791E75] transition-colors" />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-[10px] text-gray-400">Balance</p>
                              <p className="text-xl font-bold text-gray-900">{formatPence(account.balance)}</p>
                            </div>
                            {account.targetAmount && (
                              <div className="text-right">
                                <p className="text-[10px] text-gray-400">Target</p>
                                <p className="text-sm font-medium text-gray-600">{formatPence(account.targetAmount)}</p>
                              </div>
                            )}
                          </div>
                          {account.targetAmount ? (
                            <div>
                              <div className="flex justify-between mb-1">
                                <span className="text-[10px] text-gray-400">{pct}% of target</span>
                              </div>
                              <Progress value={pct} className="h-1.5" />
                            </div>
                          ) : (
                            <p className="text-[10px] text-gray-400">No target set</p>
                          )}
                          {account.notes && (
                            <p className="text-xs text-gray-500 truncate">{account.notes}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Transaction history for selected account */}
        {selectedAccount && (
          <>
            {/* Summary card */}
            <Card className="border-[#791E75]/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Current Balance</p>
                    <p className="text-3xl font-bold text-gray-900">{formatPence(selectedAccount.balance)}</p>
                    {selectedAccount.targetAmount && (
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Target: {formatPence(selectedAccount.targetAmount)}</span>
                          <span>{getProgressPercent(selectedAccount.balance, selectedAccount.targetAmount)}%</span>
                        </div>
                        <Progress value={getProgressPercent(selectedAccount.balance, selectedAccount.targetAmount)} className="h-2" />
                      </div>
                    )}
                  </div>
                  <div className="h-16 w-16 rounded-2xl bg-[#791E75]/10 flex items-center justify-center">
                    <PiggyBank className="h-8 w-8 text-[#791E75]" />
                  </div>
                </div>
              </CardContent>
            </Card>

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
                  <div className="text-center py-12 text-gray-400 text-sm">No transactions yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-xs">Reference</TableHead>
                          <TableHead className="text-xs text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((tx) => (
                          <TableRow key={tx.id} className="hover:bg-gray-50/50">
                            <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                              {formatDate(tx.transactionDate)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {tx.transactionType.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-gray-700">
                              {tx.description || "-"}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500 font-mono">
                              {tx.reference || "-"}
                            </TableCell>
                            <TableCell className={`text-xs font-medium text-right whitespace-nowrap ${isOutflow(tx.transactionType) ? "text-red-600" : "text-green-600"}`}>
                              {isOutflow(tx.transactionType) ? "-" : "+"}{formatPence(Math.abs(tx.amount))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Create Account Dialog */}
        <Dialog open={createAccountOpen} onOpenChange={setCreateAccountOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Reserve Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs mb-1 block">Landlord ID *</Label>
                <Input
                  type="number"
                  placeholder="Enter landlord ID"
                  value={accountForm.landlordId}
                  onChange={(e) => setAccountForm({ ...accountForm, landlordId: e.target.value })}
                  className="h-8 text-sm"
                />
                <p className="text-[10px] text-gray-400 mt-1">Enter the landlord's ID from the system</p>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Target Amount (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={accountForm.targetAmount}
                  onChange={(e) => setAccountForm({ ...accountForm, targetAmount: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Notes</Label>
                <Input
                  placeholder="Optional notes"
                  value={accountForm.notes}
                  onChange={(e) => setAccountForm({ ...accountForm, notes: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateAccountOpen(false)}>Cancel</Button>
              <Button
                className="bg-[#791E75] hover:bg-[#5a1558]"
                onClick={handleCreateAccount}
                disabled={createAccountMutation.isPending}
              >
                {createAccountMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Create Account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Transaction Dialog */}
        <Dialog open={addTxOpen} onOpenChange={setAddTxOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Transaction</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Type *</Label>
                  <Select value={txForm.transactionType} onValueChange={(v) => setTxForm({ ...txForm, transactionType: v })}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transfer_in">Transfer In</SelectItem>
                      <SelectItem value="transfer_out">Transfer Out</SelectItem>
                      <SelectItem value="charge">Charge</SelectItem>
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
                    value={txForm.amount}
                    onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Description</Label>
                <Input
                  placeholder="Transaction description"
                  value={txForm.description}
                  onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Reference</Label>
                  <Input
                    placeholder="Ref number"
                    value={txForm.reference}
                    onChange={(e) => setTxForm({ ...txForm, reference: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Date *</Label>
                  <Input
                    type="date"
                    value={txForm.transactionDate}
                    onChange={(e) => setTxForm({ ...txForm, transactionDate: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddTxOpen(false)}>Cancel</Button>
              <Button
                className="bg-[#791E75] hover:bg-[#5a1558]"
                onClick={handleAddTx}
                disabled={addTxMutation.isPending}
              >
                {addTxMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Add Transaction
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
