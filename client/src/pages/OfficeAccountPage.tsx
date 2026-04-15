import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2, Plus, RefreshCw, Loader2, Settings2, PoundSterling } from "lucide-react";

const formatPence = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";

interface OfficeTransaction {
  id: number;
  transactionDate: string;
  transactionType: string;
  description: string | null;
  reference: string | null;
  categoryId: number | null;
  categoryName: string | null;
  supplierName: string | null;
  amount: number;
  runningBalance: number;
  isReconciled: boolean;
  notes: string | null;
  createdAt: string;
}

interface CategoryBalance {
  categoryId: number;
  categoryName: string;
  netAmount: number;
}

interface OfficeCategory {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Balance {
  balance: number;
  lastUpdated: string;
}

const EMPTY_TX_FORM = {
  transactionType: "credit",
  amount: "",
  description: "",
  reference: "",
  transactionDate: new Date().toISOString().slice(0, 10),
  categoryId: "",
  supplierName: "",
  notes: "",
};

const EMPTY_CAT_FORM = { name: "", description: "" };

export default function OfficeAccountPage() {
  const { toast } = useToast();
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editCat, setEditCat] = useState<OfficeCategory | null>(null);
  const [txForm, setTxForm] = useState(EMPTY_TX_FORM);
  const [catForm, setCatForm] = useState(EMPTY_CAT_FORM);

  const { data: balance, isLoading: balanceLoading } = useQuery<Balance>({
    queryKey: ["/api/crm/office-account/balance"],
    queryFn: () => apiRequest("GET", "/api/crm/office-account/balance").then((r) => r.json()),
  });

  const { data: transactions = [], isLoading: txLoading, refetch: refetchTx } = useQuery<OfficeTransaction[]>({
    queryKey: ["/api/crm/office-account/transactions"],
    queryFn: () => apiRequest("GET", "/api/crm/office-account/transactions").then((r) => r.json()),
  });

  const { data: categories = [], isLoading: catLoading, refetch: refetchCats } = useQuery<OfficeCategory[]>({
    queryKey: ["/api/crm/office-account/categories"],
    queryFn: () => apiRequest("GET", "/api/crm/office-account/categories").then((r) => r.json()),
  });

  const { data: categoryBalances = [], isLoading: catBalancesLoading } = useQuery<CategoryBalance[]>({
    queryKey: ["/api/crm/office-account/category-balances"],
    queryFn: () => apiRequest("GET", "/api/crm/office-account/category-balances").then((r) => r.json()),
  });

  const addTxMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("POST", "/api/crm/office-account/transactions", body).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/office-account/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/office-account/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/office-account/category-balances"] });
      toast({ title: "Transaction added successfully" });
      setTxDialogOpen(false);
      setTxForm(EMPTY_TX_FORM);
    },
    onError: () => toast({ title: "Failed to add transaction", variant: "destructive" }),
  });

  const addCatMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("POST", "/api/crm/office-account/categories", body).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/office-account/categories"] });
      toast({ title: "Category added" });
      setCatDialogOpen(false);
      setCatForm(EMPTY_CAT_FORM);
      setEditCat(null);
    },
    onError: () => toast({ title: "Failed to add category", variant: "destructive" }),
  });

  const updateCatMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      apiRequest("PUT", `/api/crm/office-account/categories/${id}`, body).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/office-account/categories"] });
      toast({ title: "Category updated" });
      setCatDialogOpen(false);
      setCatForm(EMPTY_CAT_FORM);
      setEditCat(null);
    },
    onError: () => toast({ title: "Failed to update category", variant: "destructive" }),
  });

  const handleTxSubmit = () => {
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
      categoryId: txForm.categoryId ? parseInt(txForm.categoryId) : null,
      supplierName: txForm.supplierName || null,
      notes: txForm.notes || null,
    });
  };

  const handleCatSubmit = () => {
    if (!catForm.name.trim()) {
      toast({ title: "Category name is required", variant: "destructive" });
      return;
    }
    if (editCat) {
      updateCatMutation.mutate({ id: editCat.id, body: catForm });
    } else {
      addCatMutation.mutate(catForm);
    }
  };

  const openEditCat = (cat: OfficeCategory) => {
    setEditCat(cat);
    setCatForm({ name: cat.name, description: cat.description || "" });
    setCatDialogOpen(true);
  };

  const isCredit = (type: string) => ["credit", "transfer"].includes(type);

  return (
    <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#791E75]/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-[#791E75]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Office Account</h1>
              <p className="text-sm text-gray-500">Agency operating account</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { refetchTx(); refetchCats(); }}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setEditCat(null); setCatForm(EMPTY_CAT_FORM); setCatDialogOpen(true); }}>
              <Settings2 className="h-4 w-4 mr-1.5" />
              Manage Categories
            </Button>
            <Button size="sm" className="bg-[#791E75] hover:bg-[#5a1558]" onClick={() => setTxDialogOpen(true)}>
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
                  <p className="text-xs text-gray-400 mt-1">Last updated: {formatDate(balance.lastUpdated)}</p>
                )}
              </div>
              <div className="h-16 w-16 rounded-2xl bg-[#791E75]/10 flex items-center justify-center">
                <PoundSterling className="h-8 w-8 text-[#791E75]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="transactions">
          <TabsList>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="category-balances">Category Balances</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
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
                          <TableHead className="text-xs">Category</TableHead>
                          <TableHead className="text-xs">Supplier</TableHead>
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
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {tx.transactionType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-gray-700 max-w-[160px] truncate">
                              {tx.description || "-"}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500 font-mono">
                              {tx.reference || "-"}
                            </TableCell>
                            <TableCell className="text-xs text-gray-600">
                              {tx.categoryName ? (
                                <Badge variant="outline" className="text-[10px]">{tx.categoryName}</Badge>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="text-xs text-gray-600">
                              {tx.supplierName || "-"}
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
          </TabsContent>

          <TabsContent value="category-balances">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-700">Category Balances</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {catBalancesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-[#791E75]" />
                  </div>
                ) : categoryBalances.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">No category data available</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-xs">Category</TableHead>
                        <TableHead className="text-xs text-right">Net Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryBalances.map((cb) => (
                        <TableRow key={cb.categoryId} className="hover:bg-gray-50/50">
                          <TableCell className="text-sm font-medium text-gray-800">{cb.categoryName}</TableCell>
                          <TableCell className={`text-sm font-semibold text-right ${cb.netAmount >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {cb.netAmount >= 0 ? "+" : ""}{formatPence(cb.netAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Transaction Dialog */}
        <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Office Transaction</DialogTitle>
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
              <div>
                <Label className="text-xs mb-1 block">Category</Label>
                <Select value={txForm.categoryId} onValueChange={(v) => setTxForm({ ...txForm, categoryId: v })}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {catLoading ? (
                      <SelectItem value="_loading" disabled>Loading...</SelectItem>
                    ) : categories.length === 0 ? (
                      <SelectItem value="_none" disabled>No categories yet</SelectItem>
                    ) : (
                      categories.filter(c => c.isActive).map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Supplier Name</Label>
                <Input
                  placeholder="Supplier or payee name"
                  value={txForm.supplierName}
                  onChange={(e) => setTxForm({ ...txForm, supplierName: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Notes</Label>
                <Input
                  placeholder="Optional notes"
                  value={txForm.notes}
                  onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTxDialogOpen(false)}>Cancel</Button>
              <Button
                className="bg-[#791E75] hover:bg-[#5a1558]"
                onClick={handleTxSubmit}
                disabled={addTxMutation.isPending}
              >
                {addTxMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Add Transaction
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Category Management Dialog */}
        <Dialog open={catDialogOpen} onOpenChange={(open) => { setCatDialogOpen(open); if (!open) { setEditCat(null); setCatForm(EMPTY_CAT_FORM); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editCat ? "Edit Category" : "Category Management"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Category list */}
              {!editCat && (
                <div className="border rounded-lg overflow-hidden">
                  {catLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-[#791E75]" />
                    </div>
                  ) : categories.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm">No categories yet</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs">Active</TableHead>
                          <TableHead className="text-xs"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categories.map((cat) => (
                          <TableRow key={cat.id}>
                            <TableCell className="text-sm">{cat.name}</TableCell>
                            <TableCell>
                              {cat.isActive ? (
                                <Badge className="text-[10px] bg-green-100 text-green-700">Active</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-gray-400">Inactive</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEditCat(cat)}>
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}

              {/* Add/Edit form */}
              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">{editCat ? "Edit Category" : "Add New Category"}</p>
                <div>
                  <Label className="text-xs mb-1 block">Name *</Label>
                  <Input
                    placeholder="Category name"
                    value={catForm.name}
                    onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Description</Label>
                  <Input
                    placeholder="Optional description"
                    value={catForm.description}
                    onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  className="bg-[#791E75] hover:bg-[#5a1558]"
                  onClick={handleCatSubmit}
                  disabled={addCatMutation.isPending || updateCatMutation.isPending}
                >
                  {(addCatMutation.isPending || updateCatMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  )}
                  {editCat ? "Save Changes" : "Add Category"}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCatDialogOpen(false); setEditCat(null); setCatForm(EMPTY_CAT_FORM); }}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
