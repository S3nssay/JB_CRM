import { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Pencil, ShieldCheck, Cpu, Wrench } from 'lucide-react';

// Types from API
interface Certification {
  id: number;
  propertyId: number;
  certificationType: string;
  certificateNumber: string | null;
  issuedBy: string | null;
  issuedByCompany: string | null;
  inspectionDate: string;
  issueDate: string;
  expiryDate: string;
  certificateUrl: string | null;
  status: string;
  complianceNotes: string | null;
  failureReasons: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SystemsInventoryEntry {
  id: number;
  propertyId: number;
  systemType: string;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  installedDate: string | null;
  installedBy: string | null;
  contractorId: number | null;
  warrantyExpiryDate: string | null;
  lastServiceDate: string | null;
  nextServiceDue: string | null;
  serviceIntervalMonths: number | null;
  location: string | null;
  notes: string | null;
  specifications: any;
  createdAt: string;
  updatedAt: string;
}

interface MaintenanceTicket {
  id: number;
  propertyId: number;
  title: string;
  description: string;
  category: string;
  urgency: string;
  status: string;
  createdAt: string;
}

interface KnowledgeBaseData {
  certifications: Certification[];
  systems: SystemsInventoryEntry[];
  recentMaintenance: MaintenanceTicket[];
}

const systemFormSchema = z.object({
  systemType: z.string().min(1, 'System type is required'),
  make: z.string().optional().or(z.literal('')),
  model: z.string().optional().or(z.literal('')),
  serialNumber: z.string().optional().or(z.literal('')),
  installedDate: z.string().optional().or(z.literal('')),
  warrantyExpiryDate: z.string().optional().or(z.literal('')),
  lastServiceDate: z.string().optional().or(z.literal('')),
  nextServiceDue: z.string().optional().or(z.literal('')),
  serviceIntervalMonths: z.string().optional().or(z.literal('')),
  location: z.string().optional().or(z.literal('')),
  installedBy: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

type SystemFormValues = z.infer<typeof systemFormSchema>;

const SYSTEM_TYPES = [
  { value: 'heating', label: 'Heating' },
  { value: 'hot_water', label: 'Hot Water' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'ventilation', label: 'Ventilation' },
  { value: 'fire_safety', label: 'Fire Safety' },
  { value: 'security', label: 'Security' },
  { value: 'other', label: 'Other' },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

function formatType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'valid':
      return 'default';
    case 'expiring_soon':
      return 'secondary';
    case 'expired':
      return 'destructive';
    default:
      return 'outline';
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'valid':
      return 'bg-green-100 text-green-800';
    case 'expiring_soon':
      return 'bg-amber-100 text-amber-800';
    case 'expired':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function urgencyColor(urgency: string): string {
  switch (urgency) {
    case 'emergency':
      return 'bg-red-100 text-red-800';
    case 'urgent':
      return 'bg-orange-100 text-orange-800';
    case 'routine':
      return 'bg-blue-100 text-blue-800';
    case 'low':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function maintenanceStatusColor(status: string): string {
  switch (status) {
    case 'completed':
    case 'closed':
      return 'bg-green-100 text-green-800';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800';
    case 'assigned':
      return 'bg-purple-100 text-purple-800';
    case 'new':
      return 'bg-yellow-100 text-yellow-800';
    case 'awaiting_parts':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Systems Inventory Form Dialog
function SystemFormDialog({
  propertyId,
  editEntry,
  onClose,
}: {
  propertyId: number;
  editEntry?: SystemsInventoryEntry | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editEntry;

  const form = useForm<SystemFormValues>({
    resolver: zodResolver(systemFormSchema),
    defaultValues: {
      systemType: editEntry?.systemType || '',
      make: editEntry?.make || '',
      model: editEntry?.model || '',
      serialNumber: editEntry?.serialNumber || '',
      installedDate: editEntry?.installedDate ? editEntry.installedDate.slice(0, 10) : '',
      warrantyExpiryDate: editEntry?.warrantyExpiryDate ? editEntry.warrantyExpiryDate.slice(0, 10) : '',
      lastServiceDate: editEntry?.lastServiceDate ? editEntry.lastServiceDate.slice(0, 10) : '',
      nextServiceDue: editEntry?.nextServiceDue ? editEntry.nextServiceDue.slice(0, 10) : '',
      serviceIntervalMonths: editEntry?.serviceIntervalMonths?.toString() || '',
      location: editEntry?.location || '',
      installedBy: editEntry?.installedBy || '',
      notes: editEntry?.notes || '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SystemFormValues) => {
      const body: Record<string, any> = { systemType: data.systemType };
      if (data.make) body.make = data.make;
      if (data.model) body.model = data.model;
      if (data.serialNumber) body.serialNumber = data.serialNumber;
      if (data.installedDate) body.installedDate = new Date(data.installedDate).toISOString();
      if (data.warrantyExpiryDate) body.warrantyExpiryDate = new Date(data.warrantyExpiryDate).toISOString();
      if (data.lastServiceDate) body.lastServiceDate = new Date(data.lastServiceDate).toISOString();
      if (data.nextServiceDue) body.nextServiceDue = new Date(data.nextServiceDue).toISOString();
      if (data.serviceIntervalMonths) body.serviceIntervalMonths = parseInt(data.serviceIntervalMonths);
      if (data.location) body.location = data.location;
      if (data.installedBy) body.installedBy = data.installedBy;
      if (data.notes) body.notes = data.notes;

      if (isEdit && editEntry) {
        const res = await apiRequest('PUT', `/api/crm/properties/${propertyId}/systems-inventory/${editEntry.id}`, body);
        return res.json();
      } else {
        const res = await apiRequest('POST', `/api/crm/properties/${propertyId}/systems-inventory`, body);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/properties/${propertyId}/knowledge-base`] });
      onClose();
    },
  });

  const onSubmit = (data: SystemFormValues) => {
    createMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="systemType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>System Type *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select system type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SYSTEM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="make"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Make</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Vaillant" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. EcoTEC Plus 832" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="serialNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Serial Number</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Kitchen cupboard" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="installedDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Installed Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="installedBy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Installed By</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="warrantyExpiryDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Warranty Expiry</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastServiceDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Service Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nextServiceDue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Next Service Due</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="serviceIntervalMonths"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Interval (months)</FormLabel>
                <FormControl>
                  <Input type="number" min={1} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function PropertyKnowledgeBase() {
  const params = useParams<{ id: string }>();
  const propertyId = parseInt(params.id || '0');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<SystemsInventoryEntry | null>(null);

  const { data, isLoading, error } = useQuery<KnowledgeBaseData>({
    queryKey: [`/api/crm/properties/${propertyId}/knowledge-base`],
    enabled: propertyId > 0,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Failed to load knowledge base data. Please try again.
        </div>
      </div>
    );
  }

  const certifications = data?.certifications || [];
  const systems = data?.systems || [];
  const recentMaintenance = data?.recentMaintenance || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Property Knowledge Base</h1>
        <p className="text-sm text-gray-500 mt-1">
          Certifications, systems inventory, and maintenance history for this property
        </p>
      </div>

      <Tabs defaultValue="certifications" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="certifications" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Certifications ({certifications.length})
          </TabsTrigger>
          <TabsTrigger value="systems" className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Systems Inventory ({systems.length})
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Maintenance History ({recentMaintenance.length})
          </TabsTrigger>
        </TabsList>

        {/* Certifications Tab */}
        <TabsContent value="certifications">
          {certifications.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No certifications recorded for this property.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Inspection Date</TableHead>
                    <TableHead>Issued By</TableHead>
                    <TableHead>Certificate No.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certifications.map((cert) => (
                    <TableRow key={cert.id}>
                      <TableCell className="font-medium">{formatType(cert.certificationType)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(cert.status)}`}>
                          {formatType(cert.status)}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(cert.expiryDate)}</TableCell>
                      <TableCell>{formatDate(cert.inspectionDate)}</TableCell>
                      <TableCell>{cert.issuedBy || cert.issuedByCompany || '-'}</TableCell>
                      <TableCell>{cert.certificateNumber || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Systems Inventory Tab */}
        <TabsContent value="systems">
          <div className="flex justify-end mb-4">
            <Button
              onClick={() => {
                setEditEntry(null);
                setDialogOpen(true);
              }}
              className="bg-[#791E75] hover:bg-[#691A65]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add System
            </Button>
          </div>

          {systems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No systems inventory entries for this property. Click "Add System" to create one.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>System Type</TableHead>
                    <TableHead>Make</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Last Service</TableHead>
                    <TableHead>Warranty Expiry</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {systems.map((sys) => (
                    <TableRow key={sys.id}>
                      <TableCell className="font-medium">{formatType(sys.systemType)}</TableCell>
                      <TableCell>{sys.make || '-'}</TableCell>
                      <TableCell>{sys.model || '-'}</TableCell>
                      <TableCell>{sys.location || '-'}</TableCell>
                      <TableCell>{formatDate(sys.lastServiceDate)}</TableCell>
                      <TableCell>{formatDate(sys.warrantyExpiryDate)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditEntry(sys);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editEntry ? 'Edit System' : 'Add System'}</DialogTitle>
              </DialogHeader>
              <SystemFormDialog
                propertyId={propertyId}
                editEntry={editEntry}
                onClose={() => setDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Maintenance History Tab */}
        <TabsContent value="maintenance">
          {recentMaintenance.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No maintenance history recorded for this property.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentMaintenance.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">{ticket.title}</TableCell>
                      <TableCell>{formatType(ticket.category)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${urgencyColor(ticket.urgency)}`}>
                          {formatType(ticket.urgency)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${maintenanceStatusColor(ticket.status)}`}>
                          {formatType(ticket.status)}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(ticket.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
