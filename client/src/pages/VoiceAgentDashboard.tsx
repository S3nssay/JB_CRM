import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Phone, PhoneIncoming, PhoneOutgoing, Mic, MicOff, Volume2, BarChart3, TrendingUp, Clock, Users, MapPin, MessageSquare, Settings, Play, Pause, AlertCircle, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Form schemas
const outboundCallSchema = z.object({
  phoneNumber: z.string().min(10, "Valid phone number required"),
  purpose: z.string(),
  customerName: z.string().min(2, "Customer name required"),
  context: z.string().optional(),
  propertyId: z.string().optional()
});

// Call status component
const CallStatusCard = ({ call }: { call: any }) => {
  const statusColors: { [key: string]: string } = {
    'in-progress': 'bg-[#791E75] text-white 500',
    'completed': 'bg-[#791E75] text-white 500',
    'failed': 'bg-red-500',
    'ringing': 'bg-[#F8B324] text-black 500'
  };
  
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {call.direction === 'inbound' ? (
                <PhoneIncoming className="h-4 w-4" />
              ) : (
                <PhoneOutgoing className="h-4 w-4" />
              )}
              <span className="font-semibold">{call.from}</span>
            </div>
            <p className="text-sm text-gray-500">
              {format(new Date(call.startTime), 'HH:mm:ss')} • {call.duration || 'Ongoing'}
            </p>
            {call.summary && (
              <p className="text-sm mt-2">{call.summary}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={statusColors[call.status]}>
              {call.status}
            </Badge>
            {call.sentiment && (
              <Badge variant="outline">
                {call.sentiment}
              </Badge>
            )}
          </div>
        </div>
        {call.actionItems && call.actionItems.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-sm font-medium mb-1">Action Items:</p>
            <ul className="text-sm text-gray-600 list-disc list-inside">
              {call.actionItems.map((item: string, index: number) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function VoiceAgentDashboard() {
  const [showOutboundDialog, setShowOutboundDialog] = useState(false);
  const [agentEnabled, setAgentEnabled] = useState(true);
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Fetch call analytics
  const { data: analytics, isLoading: loadingAnalytics } = useQuery({
    queryKey: ['/api/voice/analytics'],
    queryFn: async () => {
      // Mock data for demonstration
      return {
        totalCalls: 147,
        inboundCalls: 89,
        outboundCalls: 58,
        averageDuration: 4.5,
        conversionRate: 32,
        
        callsByPurpose: [
          { name: 'Property Enquiry', value: 45, color: '#3B82F6' },
          { name: 'Viewing Booking', value: 38, color: '#10B981' },
          { name: 'Valuation Request', value: 21, color: '#F59E0B' },
          { name: 'Offer Discussion', value: 15, color: '#EF4444' },
          { name: 'General', value: 28, color: '#8B5CF6' }
        ],
        
        sentiment: [
          { name: 'Positive', value: 78, color: '#10B981' },
          { name: 'Neutral', value: 52, color: '#6B7280' },
          { name: 'Negative', value: 17, color: '#EF4444' }
        ],
        
        hourlyDistribution: [
          { hour: '09:00', calls: 12 },
          { hour: '10:00', calls: 18 },
          { hour: '11:00', calls: 22 },
          { hour: '12:00', calls: 15 },
          { hour: '13:00', calls: 11 },
          { hour: '14:00', calls: 19 },
          { hour: '15:00', calls: 21 },
          { hour: '16:00', calls: 17 },
          { hour: '17:00', calls: 12 }
        ],
        
        topEnquiryAreas: [
          { area: 'W10', count: 31 },
          { area: 'W9', count: 28 },
          { area: 'NW6', count: 24 },
          { area: 'W11', count: 22 },
          { area: 'NW10', count: 19 }
        ]
      };
    }
  });
  
  // Fetch recent calls
  const { data: recentCalls, isLoading: loadingCalls } = useQuery({
    queryKey: ['/api/voice/calls'],
    queryFn: async () => {
      // Mock data for demonstration
      return [
        {
          id: 'call_1',
          from: '+447700900123',
          to: 'John Barclay',
          direction: 'inbound',
          status: 'completed',
          startTime: new Date(Date.now() - 3600000),
          duration: '5:23',
          summary: 'Customer enquired about 2-bed flats in W10. Budget £600k. Booked viewing for Saturday.',
          sentiment: 'positive',
          actionItems: ['Send property details', 'Confirm viewing time']
        },
        {
          id: 'call_2',
          from: '+447700900456',
          to: 'John Barclay',
          direction: 'inbound',
          status: 'completed',
          startTime: new Date(Date.now() - 7200000),
          duration: '3:45',
          summary: 'Valuation request for 3-bed house in NW6. Scheduled for next Tuesday.',
          sentiment: 'neutral',
          actionItems: ['Send valuation confirmation', 'Prepare comparable properties']
        },
        {
          id: 'call_3',
          from: 'John Barclay',
          to: '+447700900789',
          direction: 'outbound',
          status: 'completed',
          startTime: new Date(Date.now() - 10800000),
          duration: '2:15',
          summary: 'Follow-up call about offer. Client considering counter-offer.',
          sentiment: 'positive',
          actionItems: ['Await decision by Friday']
        }
      ];
    }
  });
  
  // Outbound call form
  const outboundForm = useForm({
    resolver: zodResolver(outboundCallSchema),
    defaultValues: {
      phoneNumber: '',
      purpose: 'new_property_alert',
      customerName: '',
      context: '',
      propertyId: ''
    }
  });
  
  // Make outbound call
  const makeCall = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/voice/outbound', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice/calls'] });
      toast({ 
        title: "Call initiated",
        description: "The AI agent is now calling the customer."
      });
      setShowOutboundDialog(false);
      outboundForm.reset();
    }
  });
  
  // Toggle agent status
  const toggleAgent = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest('/api/voice/agent/toggle', 'POST', { enabled });
    },
    onSuccess: () => {
      toast({ 
        title: agentEnabled ? "Agent paused" : "Agent activated",
        description: agentEnabled ? "Voice agent is now offline" : "Voice agent is now taking calls"
      });
    }
  });
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/portal">
            <Button variant="ghost" size="icon" data-testid="button-back-to-portal">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">AI Voice Agent</h1>
            <p className="text-gray-500 mt-1">Powered by Retell AI + Twilio</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Agent Status</span>
            <Switch
              checked={agentEnabled}
              onCheckedChange={(checked) => {
                setAgentEnabled(checked);
                toggleAgent.mutate(checked);
              }}
            />
            <Badge className={agentEnabled ? 'bg-[#791E75] text-white 500' : 'bg-gray-500'}>
              {agentEnabled ? 'Active' : 'Paused'}
            </Badge>
          </div>
          <Button onClick={() => setShowOutboundDialog(true)}>
            <PhoneOutgoing className="h-4 w-4 mr-2" />
            Make Call
          </Button>
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Calls Today</p>
                <p className="text-2xl font-bold">{analytics?.totalCalls || 0}</p>
                <p className="text-sm text-[#791E75]600 mt-1">+12% from yesterday</p>
              </div>
              <Phone className="h-8 w-8 text-[#791E75]500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Duration</p>
                <p className="text-2xl font-bold">{analytics?.averageDuration || 0}m</p>
                <p className="text-sm text-gray-500 mt-1">Per call</p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Conversion Rate</p>
                <p className="text-2xl font-bold">{analytics?.conversionRate || 0}%</p>
                <p className="text-sm text-[#791E75]600 mt-1">+5% this week</p>
              </div>
              <TrendingUp className="h-8 w-8 text-[#791E75]500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Inbound</p>
                <p className="text-2xl font-bold">{analytics?.inboundCalls || 0}</p>
                <Progress value={(analytics?.inboundCalls / analytics?.totalCalls) * 100} className="mt-2" />
              </div>
              <PhoneIncoming className="h-8 w-8 text-[#F8B324]500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Outbound</p>
                <p className="text-2xl font-bold">{analytics?.outboundCalls || 0}</p>
                <Progress value={(analytics?.outboundCalls / analytics?.totalCalls) * 100} className="mt-2" />
              </div>
              <PhoneOutgoing className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recent">Recent Calls</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Call Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Call Distribution by Purpose</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analytics?.callsByPurpose || []}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {analytics?.callsByPurpose?.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            {/* Hourly Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Call Volume by Hour</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics?.hourlyDistribution || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="calls" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            {/* Sentiment Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Sentiment</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analytics?.sentiment || []}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                    >
                      {analytics?.sentiment?.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            {/* Top Areas */}
            <Card>
              <CardHeader>
                <CardTitle>Top Enquiry Areas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.topEnquiryAreas?.map((area: any) => (
                    <div key={area.area} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{area.area}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={(area.count / 31) * 100} className="w-24" />
                        <span className="text-sm text-gray-500 w-8">{area.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="recent" className="space-y-4">
          {loadingCalls ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {recentCalls?.map((call: any) => (
                <CallStatusCard key={call.id} call={call} />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Analytics</CardTitle>
              <CardDescription>
                Performance metrics and insights from AI voice interactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Conversion Metrics</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Viewing Bookings</span>
                      <span className="font-medium">38/147 (26%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Valuation Requests</span>
                      <span className="font-medium">21/147 (14%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Follow-up Required</span>
                      <span className="font-medium">43/147 (29%)</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-3">AI Performance</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Successful Resolutions</span>
                      <span className="font-medium">89%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Human Handoff Rate</span>
                      <span className="font-medium">11%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Avg Response Time</span>
                      <span className="font-medium">0.8s</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-3">Cost Analysis</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Minutes Used</span>
                      <span className="font-medium">661.5</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Cost (Retell AI)</span>
                      <span className="font-medium">£46.31</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Cost per Lead</span>
                      <span className="font-medium">£0.78</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Voice Agent Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Voice Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Voice Model</p>
                        <p className="text-sm text-gray-500">Professional British Female (Sarah)</p>
                      </div>
                      <Button variant="outline" size="sm">Change</Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Speaking Speed</p>
                        <p className="text-sm text-gray-500">1.0x (Normal)</p>
                      </div>
                      <Button variant="outline" size="sm">Adjust</Button>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-3">Business Hours</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Monday - Friday</span>
                      <span className="font-medium">9:00 AM - 6:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Saturday</span>
                      <span className="font-medium">9:00 AM - 4:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sunday</span>
                      <span className="font-medium">Closed (Voicemail)</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-3">Compliance</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Call Recording</p>
                        <p className="text-sm text-gray-500">With consent only</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">GDPR Compliant</p>
                        <p className="text-sm text-gray-500">Auto-redact PII</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Outbound Call Dialog */}
      <Dialog open={showOutboundDialog} onOpenChange={setShowOutboundDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Make Outbound Call</DialogTitle>
          </DialogHeader>
          <Form {...outboundForm}>
            <form onSubmit={outboundForm.handleSubmit((data) => makeCall.mutate(data))} 
                  className="space-y-4">
              <FormField
                control={outboundForm.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+447700900000" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={outboundForm.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={outboundForm.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Call Purpose</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="new_property_alert">New Property Alert</SelectItem>
                        <SelectItem value="viewing_reminder">Viewing Reminder</SelectItem>
                        <SelectItem value="valuation_follow_up">Valuation Follow-up</SelectItem>
                        <SelectItem value="offer_negotiation">Offer Negotiation</SelectItem>
                        <SelectItem value="general_follow_up">General Follow-up</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={outboundForm.control}
                name="context"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Context (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any specific details the AI should know..."
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="bg-[#791E75] text-white 50 p-3 rounded-lg text-sm">
                <p className="font-semibold text-[#791E75]800">AI Voice Agent</p>
                <p className="text-[#791E75]600">
                  Sarah will handle the call professionally, following the selected purpose and adapting to the conversation naturally.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowOutboundDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={makeCall.isPending}>
                  {makeCall.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Start Call
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}