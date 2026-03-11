import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Building, Users, Eye, Banknote, TrendingUp, Clock, AlertCircle,
  Home, Phone, Mail, MapPin, Star, ArrowRight, Globe, Search,
  Calendar, ChevronRight, Flame, User, Tag, Megaphone
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-gray-100 text-gray-700 border-gray-200',
};

const actionTypeIcons: Record<string, any> = {
  new_lead: Users,
  upcoming_viewing: Eye,
  pending_offer: Banknote,
  follow_up_due: Phone,
  landlord_lead: Building,
  unlisted_property: Megaphone,
};

const pipelineStageLabels: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  viewing_booked: 'Viewing Booked',
  offer_made: 'Offer Made',
};

const pipelineStageColors: Record<string, string> = {
  new: 'bg-blue-500',
  contacted: 'bg-indigo-500',
  qualified: 'bg-purple-500',
  viewing_booked: 'bg-amber-500',
  offer_made: 'bg-green-500',
};

export default function SalesLettingsDashboard() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState('actions');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [leadFilter, setLeadFilter] = useState('all');

  const { data: summary } = useQuery({
    queryKey: ['/api/crm/sl-command-centre/summary'],
    queryFn: () => apiRequest('/api/crm/sl-command-centre/summary'),
  });

  const { data: actionQueue } = useQuery({
    queryKey: ['/api/crm/sl-command-centre/action-queue'],
    queryFn: () => apiRequest('/api/crm/sl-command-centre/action-queue'),
  });

  const { data: propertyBoard } = useQuery({
    queryKey: ['/api/crm/sl-command-centre/property-board', propertyFilter],
    queryFn: () => apiRequest('/api/crm/sl-command-centre/property-board?type=' + propertyFilter),
    enabled: activeTab === 'properties',
  });

  const { data: leadPipeline } = useQuery({
    queryKey: ['/api/crm/sl-command-centre/lead-pipeline', leadFilter],
    queryFn: () => apiRequest('/api/crm/sl-command-centre/lead-pipeline?type=' + leadFilter),
    enabled: activeTab === 'pipeline',
  });

  const { data: activityFeed } = useQuery({
    queryKey: ['/api/crm/sl-command-centre/activity-feed'],
    queryFn: () => apiRequest('/api/crm/sl-command-centre/activity-feed'),
    enabled: activeTab === 'activity',
  });

  const props = summary?.properties || {};
  const leads = summary?.leads || {};
  const viewings = summary?.viewings || {};
  const offers = summary?.offers || {};
  const portals = summary?.portals || {};

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-8 w-8" style={{ color: '#791E75' }} />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#791E75' }}>
              Sales & Lettings Command Centre
            </h1>
            <p className="text-sm text-muted-foreground">
              Properties, leads, viewings, offers - all in one place
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/crm/properties/create')}>
            <Home className="h-4 w-4 mr-2" /> Add Property
          </Button>
          <Button style={{ backgroundColor: '#791E75' }} onClick={() => navigate('/crm/leads')}>
            <Users className="h-4 w-4 mr-2" /> Manage Leads
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-7 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveTab('properties'); }}>
          <CardContent className="p-4 text-center">
            <Building className="h-5 w-5 mx-auto mb-1" style={{ color: '#791E75' }} />
            <p className="text-2xl font-bold">{props.total_listed || 0}</p>
            <p className="text-xs text-muted-foreground">Listed</p>
            <div className="flex justify-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">S: {props.for_sale || 0}</Badge>
              <Badge variant="outline" className="text-xs">L: {props.for_let || 0}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveTab('pipeline'); }}>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <p className="text-2xl font-bold">{leads.total || 0}</p>
            <p className="text-xs text-muted-foreground">Active Leads</p>
            {leads.hot_leads > 0 && (
              <Badge className="mt-1 bg-red-100 text-red-700 text-xs">
                <Flame className="h-3 w-3 mr-1" /> {leads.hot_leads} hot
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/crm/viewings-calendar')}>
          <CardContent className="p-4 text-center">
            <Eye className="h-5 w-5 mx-auto mb-1 text-amber-600" />
            <p className="text-2xl font-bold">{viewings.total_upcoming || 0}</p>
            <p className="text-xs text-muted-foreground">Viewings</p>
            {viewings.today > 0 && (
              <Badge className="mt-1 bg-amber-100 text-amber-700 text-xs">{viewings.today} today</Badge>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/crm/offers')}>
          <CardContent className="p-4 text-center">
            <Banknote className="h-5 w-5 mx-auto mb-1 text-green-600" />
            <p className="text-2xl font-bold">{offers.total_active || 0}</p>
            <p className="text-xs text-muted-foreground">Active Offers</p>
            {offers.pending_count > 0 && (
              <Badge className="mt-1 bg-green-100 text-green-700 text-xs">{offers.pending_count} pending</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Tag className="h-5 w-5 mx-auto mb-1 text-purple-600" />
            <p className="text-2xl font-bold">{(props.under_offer || 0) + (props.let_agreed || 0) + (props.sold_stc || 0)}</p>
            <p className="text-xs text-muted-foreground">Under Offer / STC</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Star className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
            <p className="text-2xl font-bold">{summary?.newLeadsThisWeek || 0}</p>
            <p className="text-xs text-muted-foreground">New This Week</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Globe className="h-5 w-5 mx-auto mb-1 text-indigo-600" />
            <div className="flex justify-center gap-1 mt-1">
              {portals.rightmove > 0 && <Badge variant="outline" className="text-xs">RM: {portals.rightmove}</Badge>}
              {portals.zoopla > 0 && <Badge variant="outline" className="text-xs">Z: {portals.zoopla}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">On Portals</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5">
          <TabsTrigger value="actions">Action Queue</TabsTrigger>
          <TabsTrigger value="properties">Property Board</TabsTrigger>
          <TabsTrigger value="pipeline">Lead Pipeline</TabsTrigger>
          <TabsTrigger value="activity">Activity Feed</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Action Queue Tab */}
        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5" style={{ color: '#791E75' }} />
                Actions Requiring Attention ({actionQueue?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {actionQueue && actionQueue.length > 0 ? (
                actionQueue.map((action: any, idx: number) => {
                  const Icon = actionTypeIcons[action.type] || AlertCircle;
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border"
                      onClick={() => action.link && navigate(action.link)}
                    >
                      <Icon className="h-5 w-5 text-gray-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{action.title}</p>
                        {action.subtitle && <p className="text-xs text-muted-foreground truncate">{action.subtitle}</p>}
                      </div>
                      <Badge variant="outline" className={priorityColors[action.priority] || ''}>
                        {action.priority}
                      </Badge>
                      {action.dueDate && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(action.dueDate), 'dd/MM HH:mm')}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No pending actions - all caught up!
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Property Board Tab */}
        <TabsContent value="properties">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Listed</SelectItem>
                  <SelectItem value="sale">For Sale</SelectItem>
                  <SelectItem value="rental">For Rent</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">{propertyBoard?.length || 0} properties</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {propertyBoard && propertyBoard.map((p: any) => (
                <Card key={p.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/crm/properties/' + p.id + '/edit')}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{p.address}</p>
                        {p.postcode && <p className="text-xs text-muted-foreground">{p.postcode}</p>}
                      </div>
                      <Badge variant={p.status === 'available' ? 'default' : 'secondary'} className="text-xs ml-2 shrink-0">
                        {(p.status || 'available').replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      {p.price && <span className="font-bold">{'\u00A3'}{Number(p.price).toLocaleString()}</span>}
                      {p.rent_amount && <span className="font-bold">{'\u00A3'}{Number(p.rent_amount).toLocaleString()}/{p.rent_period || 'pcm'}</span>}
                      <span className="text-muted-foreground">
                        {p.property_type && <span className="capitalize">{p.property_type}</span>}
                        {p.bedrooms && <span> {'\u2022'} {p.bedrooms} bed</span>}
                      </span>
                    </div>

                    {/* Portal badges */}
                    <div className="flex flex-wrap gap-1">
                      {p.is_published_rightmove && <Badge variant="outline" className="text-xs bg-green-50">Rightmove</Badge>}
                      {p.is_published_zoopla && <Badge variant="outline" className="text-xs bg-purple-50">Zoopla</Badge>}
                      {p.is_published_onthemarket && <Badge variant="outline" className="text-xs bg-blue-50">OTM</Badge>}
                      {p.is_published_website && <Badge variant="outline" className="text-xs bg-gray-50">Website</Badge>}
                      {!p.is_published_rightmove && !p.is_published_zoopla && (
                        <Badge variant="outline" className="text-xs text-red-600 border-red-200">Not on portals</Badge>
                      )}
                    </div>

                    {/* Activity stats */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-2">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {p.viewing_count || 0} viewings</span>
                      <span className="flex items-center gap-1"><Banknote className="h-3 w-3" /> {p.active_offer_count || 0} offers</span>
                      <span className="flex items-center gap-1"><Search className="h-3 w-3" /> {p.enquiry_count || 0} enquiries</span>
                    </div>

                    {p.landlord_name && (
                      <p className="text-xs text-muted-foreground">Owner: {p.landlord_name}</p>
                    )}
                  </CardContent>
                </Card>
              ))}

              {(!propertyBoard || propertyBoard.length === 0) && (
                <div className="col-span-3 text-center text-muted-foreground py-12">
                  No listed properties found. Add properties and mark them for sale or rental.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Lead Pipeline Tab */}
        <TabsContent value="pipeline">
          <div className="space-y-4">
            <Select value={leadFilter} onValueChange={setLeadFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leads</SelectItem>
                <SelectItem value="rental">Rental Only</SelectItem>
                <SelectItem value="purchase">Purchase Only</SelectItem>
              </SelectContent>
            </Select>

            <div className="grid grid-cols-5 gap-3">
              {Object.entries(pipelineStageLabels).map(([stage, label]) => {
                const stageLeads = leadPipeline?.[stage] || [];
                return (
                  <div key={stage} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className={"w-3 h-3 rounded-full " + (pipelineStageColors[stage] || 'bg-gray-400')} />
                      <h3 className="text-sm font-semibold">{label}</h3>
                      <Badge variant="secondary" className="text-xs">{stageLeads.length}</Badge>
                    </div>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {stageLeads.map((lead: any) => (
                        <Card
                          key={lead.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => navigate('/crm/leads/' + lead.id)}
                        >
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between">
                              <p className="text-sm font-medium">{lead.full_name}</p>
                              {lead.priority === 'hot' && <Flame className="h-4 w-4 text-red-500 shrink-0" />}
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <p className="flex items-center gap-1">
                                <Tag className="h-3 w-3" /> {lead.lead_type || 'Unknown'}
                              </p>
                              {lead.max_budget && (
                                <p>Budget: up to {'\u00A3'}{Number(lead.max_budget).toLocaleString()}</p>
                              )}
                              {lead.preferred_areas && (
                                <p className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" /> {lead.preferred_areas}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              {lead.viewing_count > 0 && (
                                <Badge variant="outline" className="text-xs">{lead.viewing_count} viewings</Badge>
                              )}
                              {lead.offer_count > 0 && (
                                <Badge variant="outline" className="text-xs bg-green-50">{lead.offer_count} offers</Badge>
                              )}
                            </div>
                            {lead.source && (
                              <p className="text-xs text-muted-foreground">via {lead.source}</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                      {stageLeads.length === 0 && (
                        <div className="text-xs text-center text-muted-foreground py-4 border rounded-lg border-dashed">
                          No leads
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Activity Feed Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activityFeed && activityFeed.length > 0 ? (
                  activityFeed.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 border-b last:border-0">
                      <div className={"p-2 rounded-full " + (
                        item.type === 'viewing' ? 'bg-amber-100' :
                        item.type === 'offer' ? 'bg-green-100' : 'bg-blue-100'
                      )}>
                        {item.type === 'viewing' ? <Eye className="h-4 w-4 text-amber-600" /> :
                         item.type === 'offer' ? <Banknote className="h-4 w-4 text-green-600" /> :
                         <User className="h-4 w-4 text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
                        {item.feedback && <p className="text-xs text-blue-600 mt-1">Feedback: {item.feedback}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {item.timestamp ? format(new Date(item.timestamp), 'dd/MM HH:mm') : ''}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No recent activity to display.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <div className="grid grid-cols-2 gap-6">
            {/* Lead Funnel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Lead Funnel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'New Leads', value: leads.new_leads || 0, color: 'bg-blue-500', max: leads.total || 1 },
                  { label: 'Contacted', value: leads.contacted || 0, color: 'bg-indigo-500', max: leads.total || 1 },
                  { label: 'Qualified', value: leads.qualified || 0, color: 'bg-purple-500', max: leads.total || 1 },
                  { label: 'Viewing Booked', value: leads.viewing_booked || 0, color: 'bg-amber-500', max: leads.total || 1 },
                  { label: 'Offer Made', value: leads.offer_made || 0, color: 'bg-green-500', max: leads.total || 1 },
                ].map((stage) => (
                  <div key={stage.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{stage.label}</span>
                      <span className="font-bold">{stage.value}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={"h-full rounded-full " + stage.color}
                        style={{ width: Math.max(2, (stage.value / stage.max) * 100) + '%' }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Property Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Property Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'For Sale', value: props.for_sale || 0, color: 'text-blue-600' },
                  { label: 'For Rent', value: props.for_let || 0, color: 'text-green-600' },
                  { label: 'Under Offer', value: props.under_offer || 0, color: 'text-amber-600' },
                  { label: 'Let Agreed', value: props.let_agreed || 0, color: 'text-purple-600' },
                  { label: 'Sold STC', value: props.sold_stc || 0, color: 'text-indigo-600' },
                  { label: 'Exchanged', value: props.exchanged || 0, color: 'text-teal-600' },
                  { label: 'Completed', value: props.completed_count || 0, color: 'text-emerald-600' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{item.label}</span>
                    <span className={"text-xl font-bold " + item.color}>{item.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Portal Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Portal Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Website', value: portals.website || 0, icon: Globe },
                  { label: 'Rightmove', value: portals.rightmove || 0, icon: Home },
                  { label: 'Zoopla', value: portals.zoopla || 0, icon: Search },
                  { label: 'OnTheMarket', value: portals.onthemarket || 0, icon: MapPin },
                ].map((portal) => (
                  <div key={portal.label} className="flex items-center gap-3 py-2">
                    <portal.icon className="h-5 w-5 text-gray-500" />
                    <span className="flex-1 text-sm">{portal.label}</span>
                    <span className="text-lg font-bold">{portal.value}</span>
                    <span className="text-xs text-muted-foreground">
                      / {props.total_listed || 0}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Offers Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Offer Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-amber-50 rounded-lg">
                    <p className="text-3xl font-bold text-amber-700">{offers.pending_count || 0}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-3xl font-bold text-green-700">{offers.accepted || 0}</p>
                    <p className="text-xs text-muted-foreground">Accepted</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-3xl font-bold text-blue-700">{offers.counter_offered || 0}</p>
                    <p className="text-xs text-muted-foreground">Counter Offered</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-3xl font-bold text-purple-700">
                      {offers.avg_accepted ? '\u00A3' + Math.round(Number(offers.avg_accepted)).toLocaleString() : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg Accepted</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
