import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Shield, AlertTriangle, CheckCircle, Clock, XCircle, Flame } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'wouter';

interface Certificate {
  id: number;
  propertyId: number;
  propertyAddress: string;
  certificateType: string;
  certificateNumber: string | null;
  issuedBy: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  daysUntilExpiry: number | null;
  urgency: 'expired' | 'critical' | 'warning' | 'upcoming' | 'valid' | 'no_expiry';
  documentUrl: string | null;
}

interface SummaryItem {
  type: string;
  total: number;
  valid: number;
  upcoming: number;
  critical: number;
  expired: number;
}

const CERT_TYPE_LABELS: Record<string, string> = {
  gas_safety: 'Gas Safety',
  epc: 'EPC',
  eicr: 'EICR',
  pat: 'PAT Testing',
  fire_safety: 'Fire Safety',
  legionella: 'Legionella',
  asbestos: 'Asbestos',
  other: 'Other',
};

const CERT_TYPE_ICONS: Record<string, React.ReactNode> = {
  gas_safety: <Flame className="h-5 w-5" />,
  epc: <Shield className="h-5 w-5" />,
  eicr: <Shield className="h-5 w-5" />,
  pat: <Shield className="h-5 w-5" />,
  fire_safety: <Flame className="h-5 w-5" />,
  legionella: <Shield className="h-5 w-5" />,
  asbestos: <AlertTriangle className="h-5 w-5" />,
  other: <Shield className="h-5 w-5" />,
};

function getCertLabel(type: string): string {
  return CERT_TYPE_LABELS[type] || type;
}

function getUrgencyBadge(urgency: string, daysUntilExpiry: number | null) {
  switch (urgency) {
    case 'expired':
      return <Badge variant="destructive" className="bg-red-600">EXPIRED</Badge>;
    case 'critical':
      return (
        <Badge variant="destructive" className="bg-amber-600">
          Expires in {daysUntilExpiry} days
        </Badge>
      );
    case 'warning':
      return (
        <Badge className="bg-amber-500 text-white hover:bg-amber-500">
          Expires in {daysUntilExpiry} days
        </Badge>
      );
    case 'upcoming':
      return (
        <Badge className="bg-blue-500 text-white hover:bg-blue-500">
          Expires in {daysUntilExpiry} days
        </Badge>
      );
    case 'valid':
      return (
        <Badge className="bg-green-600 text-white hover:bg-green-600">Valid</Badge>
      );
    case 'no_expiry':
      return (
        <Badge variant="secondary" className="bg-gray-400 text-white hover:bg-gray-400">
          No expiry set
        </Badge>
      );
    default:
      return <Badge variant="secondary">{urgency}</Badge>;
  }
}

export default function ComplianceCalendar() {
  const [activeTab, setActiveTab] = useState('all');

  const { data: certificates = [], isLoading: loadingCerts } = useQuery<Certificate[]>({
    queryKey: ['/api/crm/compliance/calendar'],
    queryFn: async () => {
      const res = await fetch('/api/crm/compliance/calendar');
      if (!res.ok) throw new Error('Failed to fetch compliance calendar');
      return res.json();
    },
  });

  const { data: summary = [], isLoading: loadingSummary } = useQuery<SummaryItem[]>({
    queryKey: ['/api/crm/compliance/summary'],
    queryFn: async () => {
      const res = await fetch('/api/crm/compliance/summary');
      if (!res.ok) throw new Error('Failed to fetch compliance summary');
      return res.json();
    },
  });

  const filteredCertificates = certificates.filter((cert) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'expired') return cert.urgency === 'expired';
    if (activeTab === 'critical') return cert.urgency === 'critical';
    if (activeTab === 'warning') return cert.urgency === 'warning';
    if (activeTab === 'valid')
      return cert.urgency === 'valid' || cert.urgency === 'upcoming' || cert.urgency === 'no_expiry';
    return true;
  });

  const isLoading = loadingCerts || loadingSummary;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8" style={{ color: '#791E75' }} />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#791E75' }}>
            Compliance Calendar
          </h1>
          <p className="text-muted-foreground">
            Track all property certificates and their expiry status
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-20" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-12 mb-2" />
                <div className="h-2 bg-gray-200 rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {summary.map((item) => {
            const validPercent = item.total > 0 ? Math.round((item.valid / item.total) * 100) : 0;
            return (
              <Card key={item.type} className="border-l-4" style={{ borderLeftColor: '#791E75' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {CERT_TYPE_ICONS[item.type] || <Shield className="h-5 w-5" />}
                    {getCertLabel(item.type)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl font-bold">{item.total}</div>
                  <div className="flex flex-wrap gap-1 text-xs">
                    {item.valid > 0 && (
                      <span className="flex items-center gap-0.5 text-green-600">
                        <CheckCircle className="h-3 w-3" /> {item.valid}
                      </span>
                    )}
                    {item.upcoming > 0 && (
                      <span className="flex items-center gap-0.5 text-blue-500">
                        <Clock className="h-3 w-3" /> {item.upcoming}
                      </span>
                    )}
                    {item.critical > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-600">
                        <AlertTriangle className="h-3 w-3" /> {item.critical}
                      </span>
                    )}
                    {item.expired > 0 && (
                      <span className="flex items-center gap-0.5 text-red-600">
                        <XCircle className="h-3 w-3" /> {item.expired}
                      </span>
                    )}
                  </div>
                  <Progress value={validPercent} className="h-2" />
                  <p className="text-xs text-muted-foreground">{validPercent}% valid</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Tabs and Table */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            All ({certificates.length})
          </TabsTrigger>
          <TabsTrigger value="expired" className="text-red-600">
            Expired ({certificates.filter((c) => c.urgency === 'expired').length})
          </TabsTrigger>
          <TabsTrigger value="critical" className="text-amber-600">
            Critical (30 days) ({certificates.filter((c) => c.urgency === 'critical').length})
          </TabsTrigger>
          <TabsTrigger value="warning" className="text-amber-500">
            Warning (60 days) ({certificates.filter((c) => c.urgency === 'warning').length})
          </TabsTrigger>
          <TabsTrigger value="valid" className="text-green-600">
            Valid ({certificates.filter((c) => c.urgency === 'valid' || c.urgency === 'upcoming' || c.urgency === 'no_expiry').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Certificate Type</TableHead>
                    <TableHead>Certificate Number</TableHead>
                    <TableHead>Issued By</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Days Until Expiry</TableHead>
                    <TableHead>Urgency</TableHead>
                    <TableHead>Document</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Loading certificates...
                      </TableCell>
                    </TableRow>
                  ) : filteredCertificates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No certificates found for this filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCertificates.map((cert) => (
                      <TableRow key={cert.id}>
                        <TableCell>
                          <Link
                            href={`/crm/properties/${cert.propertyId}`}
                            className="text-sm font-medium hover:underline"
                            style={{ color: '#791E75' }}
                          >
                            {cert.propertyAddress}
                          </Link>
                        </TableCell>
                        <TableCell>{getCertLabel(cert.certificateType)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {cert.certificateNumber || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {cert.issuedBy || '-'}
                        </TableCell>
                        <TableCell>
                          {cert.issueDate
                            ? format(new Date(cert.issueDate), 'dd MMM yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {cert.expiryDate
                            ? format(new Date(cert.expiryDate), 'dd MMM yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {cert.daysUntilExpiry !== null ? cert.daysUntilExpiry : '-'}
                        </TableCell>
                        <TableCell>
                          {getUrgencyBadge(cert.urgency, cert.daysUntilExpiry)}
                        </TableCell>
                        <TableCell>
                          {cert.documentUrl ? (
                            <a
                              href={cert.documentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm hover:underline"
                              style={{ color: '#791E75' }}
                            >
                              View
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
