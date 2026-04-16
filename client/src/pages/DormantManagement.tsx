import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Moon, Zap } from 'lucide-react';

interface DormantProperty {
  id: number;
  title: string;
  address_line1: string;
  postcode: string;
  status: string;
  management_status: string | null;
  is_managed: boolean;
  updated_at: string;
  landlord_name: string | null;
}

interface DormantLandlord {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  is_active: boolean;
  updated_at: string;
}

export default function DormantManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>([]);
  const [selectedLandlordIds, setSelectedLandlordIds] = useState<number[]>([]);

  const { data: dormantProperties = [], isLoading: propertiesLoading } = useQuery<DormantProperty[]>({
    queryKey: ['/api/crm/dormant/properties'],
    queryFn: () => apiRequest('GET', '/api/crm/dormant/properties').then(r => r.json()),
  });

  const { data: dormantLandlords = [], isLoading: landlordsLoading } = useQuery<DormantLandlord[]>({
    queryKey: ['/api/crm/dormant/landlords'],
    queryFn: () => apiRequest('GET', '/api/crm/dormant/landlords').then(r => r.json()),
  });

  const propertyBulkMutation = useMutation({
    mutationFn: ({ propertyIds, action }: { propertyIds: number[]; action: string }) =>
      apiRequest('POST', '/api/crm/dormant/properties/bulk-update', { propertyIds, action }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['/api/crm/dormant/properties'] });
      toast({ title: `${data.updated} properties updated` });
      setSelectedPropertyIds([]);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const landlordBulkMutation = useMutation({
    mutationFn: ({ landlordIds, action }: { landlordIds: number[]; action: string }) =>
      apiRequest('POST', '/api/crm/dormant/landlords/bulk-update', { landlordIds, action }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['/api/crm/dormant/landlords'] });
      toast({ title: `${data.updated} landlords updated` });
      setSelectedLandlordIds([]);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleProperty = (id: number) =>
    setSelectedPropertyIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleLandlord = (id: number) =>
    setSelectedLandlordIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Moon className="h-6 w-6 text-[#791E75]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dormant Management</h1>
          <p className="text-sm text-gray-500">Bulk activate or mark dormant properties and landlords</p>
        </div>
      </div>

      <Tabs defaultValue="properties">
        <TabsList>
          <TabsTrigger value="properties">
            Properties ({dormantProperties.length})
          </TabsTrigger>
          <TabsTrigger value="landlords">
            Inactive Landlords ({dormantLandlords.length})
          </TabsTrigger>
        </TabsList>

        {/* Properties Tab */}
        <TabsContent value="properties" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Dormant Properties</CardTitle>
              {selectedPropertyIds.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => propertyBulkMutation.mutate({ propertyIds: selectedPropertyIds, action: 'activate' })}
                    disabled={propertyBulkMutation.isPending}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1" /> Activate ({selectedPropertyIds.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => propertyBulkMutation.mutate({ propertyIds: selectedPropertyIds, action: 'dormant' })}
                    disabled={propertyBulkMutation.isPending}
                  >
                    <Moon className="h-3.5 w-3.5 mr-1" /> Mark Dormant ({selectedPropertyIds.length})
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {propertiesLoading ? (
                <div className="p-6 text-center text-gray-400">Loading...</div>
              ) : dormantProperties.length === 0 ? (
                <div className="p-6 text-center text-gray-400">No dormant properties found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedPropertyIds.length === dormantProperties.length && dormantProperties.length > 0}
                          onCheckedChange={checked => {
                            if (checked) setSelectedPropertyIds(dormantProperties.map(p => p.id));
                            else setSelectedPropertyIds([]);
                          }}
                        />
                      </TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Postcode</TableHead>
                      <TableHead>Landlord</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Management Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dormantProperties.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedPropertyIds.includes(p.id)}
                            onCheckedChange={() => toggleProperty(p.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{p.title}</p>
                            <p className="text-xs text-gray-400">{p.address_line1}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600">{p.postcode}</TableCell>
                        <TableCell className="text-gray-600">{p.landlord_name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{p.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-orange-100 text-orange-800">
                            {p.management_status || 'dormant'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Landlords Tab */}
        <TabsContent value="landlords" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Inactive Landlords</CardTitle>
              {selectedLandlordIds.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => landlordBulkMutation.mutate({ landlordIds: selectedLandlordIds, action: 'activate' })}
                    disabled={landlordBulkMutation.isPending}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1" /> Activate ({selectedLandlordIds.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => landlordBulkMutation.mutate({ landlordIds: selectedLandlordIds, action: 'dormant' })}
                    disabled={landlordBulkMutation.isPending}
                  >
                    <Moon className="h-3.5 w-3.5 mr-1" /> Mark Inactive ({selectedLandlordIds.length})
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {landlordsLoading ? (
                <div className="p-6 text-center text-gray-400">Loading...</div>
              ) : dormantLandlords.length === 0 ? (
                <div className="p-6 text-center text-gray-400">No inactive landlords found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedLandlordIds.length === dormantLandlords.length && dormantLandlords.length > 0}
                          onCheckedChange={checked => {
                            if (checked) setSelectedLandlordIds(dormantLandlords.map(l => l.id));
                            else setSelectedLandlordIds([]);
                          }}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dormantLandlords.map(l => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedLandlordIds.includes(l.id)}
                            onCheckedChange={() => toggleLandlord(l.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{l.name}</TableCell>
                        <TableCell className="text-gray-600">{l.email || '—'}</TableCell>
                        <TableCell className="text-gray-600">{l.phone || l.mobile || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={l.is_active ? 'default' : 'secondary'}>
                            {l.is_active ? 'Active' : 'Inactive'}
                          </Badge>
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
    </div>
  );
}
