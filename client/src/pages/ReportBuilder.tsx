import { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  FileText, Plus, Download, Calendar, Clock,
  BarChart3, PieChart, TrendingUp, Users, Home,
  DollarSign, Wrench, Mail, Eye, Edit, Trash2,
  Play, Pause, Copy, Save, FileSpreadsheet, File, ArrowLeft
} from 'lucide-react';

// Mock saved reports
const mockReports = [
  {
    id: 1,
    name: 'Monthly Property Performance',
    description: 'Overview of property listings, views, and enquiries',
    reportType: 'property_performance',
    format: 'pdf',
    isScheduled: true,
    frequency: 'monthly',
    lastRunAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
    nextRunAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 23),
    recipients: ['manager@agency.com'],
    status: 'active'
  },
  {
    id: 2,
    name: 'Agent Performance Report',
    description: 'Individual agent metrics and KPIs',
    reportType: 'agent_performance',
    format: 'excel',
    isScheduled: true,
    frequency: 'weekly',
    lastRunAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    nextRunAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4),
    recipients: ['director@agency.com', 'manager@agency.com'],
    status: 'active'
  },
  {
    id: 3,
    name: 'Financial Summary',
    description: 'Revenue, commissions, and expenses breakdown',
    reportType: 'financial',
    format: 'pdf',
    isScheduled: false,
    frequency: null,
    lastRunAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
    nextRunAt: null,
    recipients: [],
    status: 'active'
  },
  {
    id: 4,
    name: 'Maintenance Report',
    description: 'Ticket status, resolution times, and costs',
    reportType: 'maintenance',
    format: 'pdf',
    isScheduled: true,
    frequency: 'monthly',
    lastRunAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    nextRunAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 28),
    recipients: ['maintenance@agency.com'],
    status: 'active'
  }
];

// Report templates
const reportTemplates = [
  {
    id: 'property_performance',
    name: 'Property Performance',
    description: 'Track listing performance, views, enquiries, and days on market',
    icon: Home,
    metrics: ['listings', 'views', 'enquiries', 'avgDays', 'conversions']
  },
  {
    id: 'agent_performance',
    name: 'Agent Performance',
    description: 'Individual and team performance metrics',
    icon: Users,
    metrics: ['deals', 'revenue', 'viewings', 'conversions', 'ratings']
  },
  {
    id: 'financial',
    name: 'Financial Summary',
    description: 'Revenue, commissions, fees, and expense breakdown',
    icon: DollarSign,
    metrics: ['revenue', 'commissions', 'fees', 'expenses', 'profit']
  },
  {
    id: 'maintenance',
    name: 'Maintenance Report',
    description: 'Ticket status, resolution times, and contractor performance',
    icon: Wrench,
    metrics: ['tickets', 'resolution', 'costs', 'contractors']
  },
  {
    id: 'marketing',
    name: 'Marketing Report',
    description: 'Campaign performance, lead sources, and ROI',
    icon: BarChart3,
    metrics: ['campaigns', 'leads', 'conversions', 'roi']
  },
  {
    id: 'custom',
    name: 'Custom Report',
    description: 'Build your own report with custom metrics',
    icon: FileText,
    metrics: []
  }
];

// Available metrics for custom reports
const availableMetrics = [
  { id: 'total_properties', name: 'Total Properties', category: 'Properties' },
  { id: 'active_listings', name: 'Active Listings', category: 'Properties' },
  { id: 'properties_sold', name: 'Properties Sold', category: 'Properties' },
  { id: 'properties_let', name: 'Properties Let', category: 'Properties' },
  { id: 'avg_days_market', name: 'Avg Days on Market', category: 'Properties' },
  { id: 'total_revenue', name: 'Total Revenue', category: 'Financial' },
  { id: 'sales_commission', name: 'Sales Commission', category: 'Financial' },
  { id: 'lettings_fees', name: 'Lettings Fees', category: 'Financial' },
  { id: 'management_fees', name: 'Management Fees', category: 'Financial' },
  { id: 'total_viewings', name: 'Total Viewings', category: 'Activity' },
  { id: 'total_valuations', name: 'Total Valuations', category: 'Activity' },
  { id: 'total_enquiries', name: 'Total Enquiries', category: 'Activity' },
  { id: 'conversion_rate', name: 'Conversion Rate', category: 'Activity' },
  { id: 'open_tickets', name: 'Open Tickets', category: 'Maintenance' },
  { id: 'resolved_tickets', name: 'Resolved Tickets', category: 'Maintenance' },
  { id: 'avg_resolution_time', name: 'Avg Resolution Time', category: 'Maintenance' }
];

export default function ReportBuilder() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('reports');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const [reportForm, setReportForm] = useState({
    name: '',
    description: '',
    reportType: '',
    format: 'pdf',
    dateRange: '30',
    customStartDate: '',
    customEndDate: '',
    selectedMetrics: [] as string[],
    isScheduled: false,
    frequency: 'monthly',
    recipients: ''
  });

  const handleCreateReport = () => {
    if (!reportForm.name) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for the report.',
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Report created',
      description: `"${reportForm.name}" has been created successfully.`
    });
    setShowCreateDialog(false);
    setSelectedTemplate(null);
    setReportForm({
      name: '',
      description: '',
      reportType: '',
      format: 'pdf',
      dateRange: '30',
      customStartDate: '',
      customEndDate: '',
      selectedMetrics: [],
      isScheduled: false,
      frequency: 'monthly',
      recipients: ''
    });
  };

  const handleGenerateReport = (report: any) => {
    toast({
      title: 'Generating report',
      description: `"${report.name}" is being generated. It will download shortly.`
    });
  };

  const handleRunNow = (report: any) => {
    toast({
      title: 'Running report',
      description: `"${report.name}" is being generated and will be sent to recipients.`
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const toggleMetric = (metricId: string) => {
    if (reportForm.selectedMetrics.includes(metricId)) {
      setReportForm({
        ...reportForm,
        selectedMetrics: reportForm.selectedMetrics.filter(m => m !== metricId)
      });
    } else {
      setReportForm({
        ...reportForm,
        selectedMetrics: [...reportForm.selectedMetrics, metricId]
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/portal">
                <Button variant="ghost" size="icon" data-testid="button-back-to-portal">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <FileText className="h-8 w-8 text-[#791E75] mr-3" />
              <h1 className="text-xl font-semibold">Report Builder</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Report
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Report</DialogTitle>
                    <DialogDescription>
                      Choose a template or build a custom report
                    </DialogDescription>
                  </DialogHeader>

                  {!selectedTemplate ? (
                    <div className="grid grid-cols-2 gap-4">
                      {reportTemplates.map((template) => {
                        const IconComponent = template.icon;
                        return (
                          <div
                            key={template.id}
                            className="p-4 border rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                            onClick={() => {
                              setSelectedTemplate(template.id);
                              setReportForm({ ...reportForm, reportType: template.id });
                            }}
                          >
                            <div className="flex items-center space-x-3 mb-2">
                              <IconComponent className="h-5 w-5 text-gray-600" />
                              <span className="font-medium">{template.name}</span>
                            </div>
                            <p className="text-sm text-gray-500">{template.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTemplate(null)}
                      >
                        ← Back to templates
                      </Button>

                      <div className="space-y-2">
                        <Label>Report Name</Label>
                        <Input
                          placeholder="e.g., Monthly Performance Report"
                          value={reportForm.name}
                          onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          placeholder="Brief description of this report"
                          value={reportForm.description}
                          onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Format</Label>
                          <Select
                            value={reportForm.format}
                            onValueChange={(value) => setReportForm({ ...reportForm, format: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pdf">PDF</SelectItem>
                              <SelectItem value="excel">Excel</SelectItem>
                              <SelectItem value="csv">CSV</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Date Range</Label>
                          <Select
                            value={reportForm.dateRange}
                            onValueChange={(value) => setReportForm({ ...reportForm, dateRange: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="7">Last 7 days</SelectItem>
                              <SelectItem value="30">Last 30 days</SelectItem>
                              <SelectItem value="90">Last 90 days</SelectItem>
                              <SelectItem value="365">Last 12 months</SelectItem>
                              <SelectItem value="custom">Custom range</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {reportForm.dateRange === 'custom' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input
                              type="date"
                              value={reportForm.customStartDate}
                              onChange={(e) => setReportForm({ ...reportForm, customStartDate: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input
                              type="date"
                              value={reportForm.customEndDate}
                              onChange={(e) => setReportForm({ ...reportForm, customEndDate: e.target.value })}
                            />
                          </div>
                        </div>
                      )}

                      {selectedTemplate === 'custom' && (
                        <div className="space-y-2">
                          <Label>Select Metrics</Label>
                          <div className="border rounded-lg p-4 max-h-[200px] overflow-y-auto">
                            {['Properties', 'Financial', 'Activity', 'Maintenance'].map((category) => (
                              <div key={category} className="mb-4">
                                <p className="text-sm font-medium text-gray-500 mb-2">{category}</p>
                                <div className="space-y-2">
                                  {availableMetrics
                                    .filter(m => m.category === category)
                                    .map((metric) => (
                                      <div key={metric.id} className="flex items-center space-x-2">
                                        <Checkbox
                                          id={metric.id}
                                          checked={reportForm.selectedMetrics.includes(metric.id)}
                                          onCheckedChange={() => toggleMetric(metric.id)}
                                        />
                                        <Label htmlFor={metric.id} className="text-sm">
                                          {metric.name}
                                        </Label>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="font-medium">Schedule Report</p>
                            <p className="text-sm text-gray-500">Automatically generate and send</p>
                          </div>
                          <Switch
                            checked={reportForm.isScheduled}
                            onCheckedChange={(checked) => setReportForm({ ...reportForm, isScheduled: checked })}
                          />
                        </div>

                        {reportForm.isScheduled && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Frequency</Label>
                              <Select
                                value={reportForm.frequency}
                                onValueChange={(value) => setReportForm({ ...reportForm, frequency: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Recipients (comma-separated emails)</Label>
                              <Input
                                placeholder="email1@example.com, email2@example.com"
                                value={reportForm.recipients}
                                onChange={(e) => setReportForm({ ...reportForm, recipients: e.target.value })}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedTemplate && (
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateReport}>
                        Create Report
                      </Button>
                    </DialogFooter>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Saved Reports</p>
                  <p className="text-2xl font-bold">12</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Scheduled</p>
                  <p className="text-2xl font-bold">8</p>
                </div>
                <Calendar className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Generated This Month</p>
                  <p className="text-2xl font-bold">24</p>
                </div>
                <Download className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Next Scheduled</p>
                  <p className="text-2xl font-bold">2h</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="reports">
              <FileText className="h-4 w-4 mr-2" />
              My Reports
            </TabsTrigger>
            <TabsTrigger value="templates">
              <Copy className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          {/* My Reports Tab */}
          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Saved Reports</CardTitle>
                <CardDescription>Your configured reports and schedules</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockReports.map((report) => (
                    <div key={report.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold">{report.name}</h3>
                            <Badge variant={report.format === 'pdf' ? 'default' : 'secondary'}>
                              {report.format.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleGenerateReport(report)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-4">
                          {report.isScheduled ? (
                            <>
                              <span className="flex items-center text-green-600">
                                <Play className="h-3 w-3 mr-1" />
                                Scheduled ({report.frequency})
                              </span>
                              <span className="text-gray-500">
                                Next: {report.nextRunAt ? formatDate(report.nextRunAt) : 'N/A'}
                              </span>
                            </>
                          ) : (
                            <span className="flex items-center text-gray-500">
                              <Pause className="h-3 w-3 mr-1" />
                              Not scheduled
                            </span>
                          )}
                        </div>
                        <span className="text-gray-500">
                          Last run: {formatDate(report.lastRunAt)}
                        </span>
                      </div>

                      {report.isScheduled && report.recipients.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center text-sm text-gray-500">
                            <Mail className="h-4 w-4 mr-2" />
                            Recipients: {report.recipients.join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportTemplates.map((template) => {
                const IconComponent = template.icon;
                return (
                  <Card key={template.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <IconComponent className="h-6 w-6 text-gray-600" />
                        </div>
                        <h3 className="font-semibold">{template.name}</h3>
                      </div>
                      <p className="text-sm text-gray-500 mb-4">{template.description}</p>
                      {template.metrics.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-medium text-gray-500 mb-2">Includes:</p>
                          <div className="flex flex-wrap gap-1">
                            {template.metrics.slice(0, 3).map((metric) => (
                              <Badge key={metric} variant="outline" className="text-xs">
                                {metric}
                              </Badge>
                            ))}
                            {template.metrics.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{template.metrics.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => {
                          setSelectedTemplate(template.id);
                          setReportForm({ ...reportForm, reportType: template.id });
                          setShowCreateDialog(true);
                        }}
                      >
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Report History</CardTitle>
                <CardDescription>Previously generated reports</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left p-3 font-medium">Report</th>
                        <th className="text-left p-3 font-medium">Generated</th>
                        <th className="text-left p-3 font-medium">Format</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: 'Monthly Property Performance', date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), format: 'pdf', status: 'completed' },
                        { name: 'Agent Performance Report', date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), format: 'excel', status: 'completed' },
                        { name: 'Financial Summary', date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), format: 'pdf', status: 'completed' },
                        { name: 'Maintenance Report', date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), format: 'pdf', status: 'completed' },
                        { name: 'Marketing Report', date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), format: 'excel', status: 'completed' },
                      ].map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">{item.name}</td>
                          <td className="p-3">{formatDate(item.date)}</td>
                          <td className="p-3">
                            <Badge variant="outline">
                              {item.format === 'pdf' ? (
                                <><File className="h-3 w-3 mr-1" /> PDF</>
                              ) : (
                                <><FileSpreadsheet className="h-3 w-3 mr-1" /> Excel</>
                              )}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge className="bg-green-100 text-green-800">
                              {item.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Button variant="ghost" size="sm">
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
