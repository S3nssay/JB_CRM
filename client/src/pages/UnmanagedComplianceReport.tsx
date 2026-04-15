import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import CRMLayout from '@/components/CRMLayout';
import { AlertTriangle } from 'lucide-react';

interface UnmanagedProperty {
  id: number;
  addressLine1?: string;
  address?: string;
  postcode?: string;
  landlordName?: string;
  manageGas?: boolean;
  manageElectrical?: boolean;
}

export default function UnmanagedComplianceReport() {
  const { data: properties = [], isLoading } = useQuery<UnmanagedProperty[]>({
    queryKey: ['/api/crm/compliance/unmanaged-report'],
    queryFn: async () => {
      const res = await fetch('/api/crm/compliance/unmanaged-report', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const total = properties.length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-red-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Unmanaged Compliance Report</h1>
          <p className="text-sm text-gray-500">Properties with unmanaged gas or electrical compliance areas</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Badge variant={total > 0 ? 'destructive' : 'default'} className="text-sm px-3 py-1">
              {total} {total === 1 ? 'property' : 'properties'} with unmanaged compliance areas
            </Badge>
          </div>

          {total === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">All properties have compliance areas managed.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Properties Requiring Attention</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead>Postcode</TableHead>
                      <TableHead>Landlord</TableHead>
                      <TableHead>Gas</TableHead>
                      <TableHead>Electrical</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {properties.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {p.addressLine1 || p.address || `Property #${p.id}`}
                        </TableCell>
                        <TableCell>{p.postcode || '—'}</TableCell>
                        <TableCell>{p.landlordName || '—'}</TableCell>
                        <TableCell>
                          {p.manageGas ? (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">Managed</Badge>
                          ) : (
                            <Badge variant="destructive">Gas Not Managed</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {p.manageElectrical ? (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">Managed</Badge>
                          ) : (
                            <Badge variant="destructive">Electrical Not Managed</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
