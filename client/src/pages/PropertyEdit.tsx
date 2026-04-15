import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation, useParams, Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Save, Loader2, Home, Building2, MapPin,
  Bed, Bath, Square, Tag, Globe, Send, Share2, Upload, X, Image, FileText,
  Key, Download, Trash2, ExternalLink, Calendar, ArrowRightLeft, Shield, Eye,
  Users, Plus
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import ApplicantMatchCriteria from '@/components/ApplicantMatchCriteria';

interface PropertyData {
  id: number;
  title: string;
  address?: string;
  description: string;
  isRental: boolean; // true = rental, false = sale
  isResidential: boolean;
  propertyType: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  receptions?: number;
  squareFootage?: number;
  addressLine1: string;
  addressLine2?: string;
  city?: string;
  postcode: string;
  status: string;
  tenure?: string;
  councilTaxBand?: string;
  energyRating?: string;
  features?: string[];
  furnished?: string;
  images?: string[];
  floorPlan?: string;
  isListed?: boolean;
  isManaged?: boolean;
  isListedRental?: boolean;
  isListedSale?: boolean;
  isPublishedWebsite?: boolean;
  isPublishedZoopla?: boolean;
  isPublishedRightmove?: boolean;
  isPublishedOnTheMarket?: boolean;
  isPublishedSocial?: boolean;
  rentAmount?: number;
  rentPeriod?: string;
  deposit?: number;
  // Identification & Access Codes (still on properties table)
  keyCode?: string;
  propCode?: string;
  // Property Classification (still on properties table)
  blockManagementCompany?: string;
  blockManagementContact?: string;
  isHmo?: boolean;
  isStudentLet?: boolean;
  isHolidayLet?: boolean;
  isCouncilLet?: boolean;
}

function GroupViewingSection({ propertyId }: { propertyId: number }) {
  const { toast } = useToast();
  const [groupOnly, setGroupOnly] = useState(false);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSlotDate, setNewSlotDate] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('10:00');
  const [newSlotMaxAttendees, setNewSlotMaxAttendees] = useState('10');
  const [adding, setAdding] = useState(false);

  // Fetch current state
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [propRes, slotsRes] = await Promise.all([
          fetch(`/api/crm/properties/${propertyId}`, { credentials: 'include' }),
          fetch(`/api/crm/properties/${propertyId}/viewing-slots`, { credentials: 'include' }),
        ]);
        if (propRes.ok) {
          const prop = await propRes.json();
          setGroupOnly(prop.groupViewingsOnly || false);
        }
        if (slotsRes.ok) {
          const data = await slotsRes.json();
          // Merge group slots from both fields
          const allGroupSlots = [...(data.slots || []), ...(data.groupSlots || [])].filter((s: any) => s.isGroupViewing);
          setSlots(allGroupSlots);
        }
      } catch (err) {
        console.error('Failed to load group viewing data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [propertyId]);

  const handleToggleGroupOnly = async (checked: boolean) => {
    setGroupOnly(checked);
    try {
      await fetch(`/api/crm/properties/${propertyId}/group-viewings-mode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ groupViewingsOnly: checked }),
      });
      toast({ title: checked ? 'Group viewings enabled' : 'Individual viewings allowed', description: checked ? 'Chatbot will only offer group slots' : 'Chatbot will allow any time' });
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
      setGroupOnly(!checked);
    }
  };

  const handleAddSlot = async () => {
    if (!newSlotDate || !newSlotTime) {
      toast({ title: 'Select date and time', variant: 'destructive' });
      return;
    }
    setAdding(true);
    try {
      const startTime = `${newSlotDate}T${newSlotTime}:00`;
      const endTime = new Date(new Date(startTime).getTime() + 30 * 60000).toISOString();
      const res = await fetch(`/api/crm/properties/${propertyId}/group-viewing-slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slots: [{ startTime, endTime, maxAttendees: parseInt(newSlotMaxAttendees) || 10 }] }),
      });
      if (res.ok) {
        const data = await res.json();
        const newSlots = (data.slots || []).map((s: any) => ({
          id: s.id,
          startTime: s.start_time,
          endTime: s.end_time,
          maxAttendees: s.max_attendees,
          spotsLeft: s.max_attendees - (s.current_attendees_count || 0),
          isGroupViewing: true,
        }));
        setSlots(prev => [...prev, ...newSlots]);
        setNewSlotDate('');
        toast({ title: 'Group viewing slot added' });
      } else {
        toast({ title: 'Failed to add slot', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error adding slot', variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteSlot = async (slotId: number) => {
    try {
      const res = await fetch(`/api/crm/calendar-events/${slotId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setSlots(prev => prev.filter(s => s.id !== slotId));
        toast({ title: 'Slot removed' });
      }
    } catch {
      toast({ title: 'Failed to remove slot', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-[#791E75]" />
            <div>
              <CardTitle className="text-lg">Group Viewings</CardTitle>
              <CardDescription>Manage group viewing slots and settings for this property</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="group-only" className="text-sm">Group only</Label>
            <Switch
              id="group-only"
              checked={groupOnly}
              onCheckedChange={handleToggleGroupOnly}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {groupOnly && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            Chatbot enquiries will only be able to book into group viewing slots below. Individual time selection is disabled.
          </div>
        )}

        {/* Add new slot */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={newSlotDate}
              onChange={e => setNewSlotDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div className="w-24 space-y-1">
            <Label className="text-xs">Time</Label>
            <Select value={newSlotTime} onValueChange={setNewSlotTime}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'].map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-20 space-y-1">
            <Label className="text-xs">Max</Label>
            <Input
              type="number"
              value={newSlotMaxAttendees}
              onChange={e => setNewSlotMaxAttendees(e.target.value)}
              min="2"
              max="50"
            />
          </div>
          <Button onClick={handleAddSlot} disabled={adding || !newSlotDate} size="sm" className="bg-[#791E75] hover:bg-[#60175d]">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        {/* Existing slots */}
        {loading ? (
          <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" /></div>
        ) : slots.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No group viewing slots set up yet</p>
        ) : (
          <div className="space-y-2">
            {slots.map((slot: any) => {
              const dt = new Date(slot.startTime);
              return (
                <div key={slot.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-[#791E75]" />
                    <div>
                      <span className="text-sm font-medium">
                        {dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">
                        {dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {slot.spotsLeft}/{slot.maxAttendees} spots
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteSlot(slot.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PropertyEdit() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const propertyId = params.id;
  const { toast } = useToast();

  const [formData, setFormData] = useState<Partial<PropertyData>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isUploadingFloorPlan, setIsUploadingFloorPlan] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docType, setDocType] = useState('certificate');
  const [showPreview, setShowPreview] = useState(false);
  const [showConvertManagedDialog, setShowConvertManagedDialog] = useState(false);
  const [showConvertTypeDialog, setShowConvertTypeDialog] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const { data: property, isLoading, error } = useQuery({
    queryKey: [`/api/crm/properties/${propertyId}`],
    queryFn: async () => {
      const res = await fetch(`/api/crm/properties/${propertyId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch property');
      return res.json();
    },
    enabled: !!propertyId
  });

  // Fetch tenancies for this property
  const { data: propertyTenancies = [] } = useQuery({
    queryKey: ['property-tenancies', propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/pm/tenancies?propertyId=${propertyId}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!propertyId
  });

  // Fetch documents for this property
  const { data: propertyDocs = [] } = useQuery({
    queryKey: ['property-documents', propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/documents?propertyId=${propertyId}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!propertyId
  });

  // Fetch meters for this property
  const { data: meters = [], refetch: refetchMeters } = useQuery<any[]>({
    queryKey: ['property-meters', propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/properties/${propertyId}/meters`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!propertyId,
  });

  // Fetch access codes for this property
  const { data: accessCodes = [], refetch: refetchAccessCodes } = useQuery<any[]>({
    queryKey: ['property-access-codes', propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/properties/${propertyId}/access-codes`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!propertyId,
  });

  // Add meter state
  const [showAddMeter, setShowAddMeter] = useState(false);
  const [newMeterType, setNewMeterType] = useState('gas');
  const [newMeterSerial, setNewMeterSerial] = useState('');
  const [newMeterLocation, setNewMeterLocation] = useState('');
  const [isSavingMeter, setIsSavingMeter] = useState(false);

  // Add access code state
  const [showAddCode, setShowAddCode] = useState(false);
  const [newCodeType, setNewCodeType] = useState('lock');
  const [newCodeValue, setNewCodeValue] = useState('');
  const [newCodeNotes, setNewCodeNotes] = useState('');
  const [isSavingCode, setIsSavingCode] = useState(false);

  const handleAddMeter = async () => {
    if (!newMeterSerial) {
      toast({ title: 'Serial number required', variant: 'destructive' });
      return;
    }
    setIsSavingMeter(true);
    try {
      const res = await fetch(`/api/crm/properties/${propertyId}/meters`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meterType: newMeterType, serialNumber: newMeterSerial, location: newMeterLocation }),
      });
      if (!res.ok) throw new Error('Failed to add meter');
      setNewMeterSerial('');
      setNewMeterLocation('');
      setShowAddMeter(false);
      refetchMeters();
      toast({ title: 'Meter added' });
    } catch (err: any) {
      toast({ title: 'Failed to add meter', description: err.message, variant: 'destructive' });
    } finally {
      setIsSavingMeter(false);
    }
  };

  const handleDeleteMeter = async (meterId: number) => {
    try {
      const res = await fetch(`/api/crm/meters/${meterId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed');
      refetchMeters();
      toast({ title: 'Meter removed' });
    } catch {
      toast({ title: 'Failed to remove meter', variant: 'destructive' });
    }
  };

  const handleAddCode = async () => {
    if (!newCodeValue) {
      toast({ title: 'Code value required', variant: 'destructive' });
      return;
    }
    setIsSavingCode(true);
    try {
      const res = await fetch(`/api/crm/properties/${propertyId}/access-codes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeType: newCodeType, codeValue: newCodeValue, notes: newCodeNotes }),
      });
      if (!res.ok) throw new Error('Failed to add code');
      setNewCodeValue('');
      setNewCodeNotes('');
      setShowAddCode(false);
      refetchAccessCodes();
      toast({ title: 'Access code added' });
    } catch (err: any) {
      toast({ title: 'Failed to add code', description: err.message, variant: 'destructive' });
    } finally {
      setIsSavingCode(false);
    }
  };

  const handleDeleteCode = async (codeId: number) => {
    try {
      const res = await fetch(`/api/crm/access-codes/${codeId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed');
      refetchAccessCodes();
      toast({ title: 'Access code removed' });
    } catch {
      toast({ title: 'Failed to remove access code', variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (property) {
      setFormData(property);
    }
  }, [property]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<PropertyData>) => {
      return apiRequest(`/api/crm/properties/${propertyId}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/properties'] });
      queryClient.invalidateQueries({ queryKey: [`/api/crm/properties/${propertyId}`] });
      toast({
        title: "Property updated",
        description: "Changes have been saved successfully.",
      });
      setLocation('/crm/properties');
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update",
        description: error.message || "Could not save changes.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateMutation.mutateAsync(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof PropertyData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Convert listed property to managed/tenanted property
  const handleConvertToManaged = async () => {
    setIsConverting(true);
    try {
      await apiRequest(`/api/crm/properties/${propertyId}`, 'PATCH', {
        isManaged: true,
        isListedRental: false,
        isListedSale: false,
        isListed: false,
        status: 'managed',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/crm/properties/${propertyId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/properties'] });
      setFormData(prev => ({ ...prev, isManaged: true, isListed: false, isListedRental: false, isListedSale: false, status: 'managed' }));
      setShowConvertManagedDialog(false);
      toast({ title: 'Property converted', description: 'This property is now a managed/tenanted property.' });
    } catch (err: any) {
      toast({ title: 'Conversion failed', description: err.message || 'Could not convert property.', variant: 'destructive' });
    } finally {
      setIsConverting(false);
    }
  };

  // Convert between sale and rental listing
  const handleConvertListingType = async () => {
    setIsConverting(true);
    const isCurrentlyRental = formData.isRental;
    try {
      await apiRequest(`/api/crm/properties/${propertyId}`, 'PATCH', {
        isRental: !isCurrentlyRental,
        isListedRental: !isCurrentlyRental,
        isListedSale: isCurrentlyRental,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/crm/properties/${propertyId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/properties'] });
      setFormData(prev => ({
        ...prev,
        isRental: !isCurrentlyRental,
        isListedRental: !isCurrentlyRental,
        isListedSale: !!isCurrentlyRental,
      }));
      setShowConvertTypeDialog(false);
      toast({
        title: 'Listing type changed',
        description: `Property is now listed for ${!isCurrentlyRental ? 'rental' : 'sale'}.`,
      });
    } catch (err: any) {
      toast({ title: 'Conversion failed', description: err.message || 'Could not change listing type.', variant: 'destructive' });
    } finally {
      setIsConverting(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImages(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: formDataUpload,
        });

        if (!response.ok) throw new Error('Upload failed');
        const data = await response.json();
        return data.url;
      });

      const newUrls = await Promise.all(uploadPromises);
      const currentImages = formData.images || [];
      updateField('images', [...currentImages, ...newUrls]);

      toast({
        title: "Images uploaded",
        description: `${newUrls.length} image(s) uploaded successfully.`,
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload one or more images.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingImages(false);
      event.target.value = '';
    }
  };

  const handleFloorPlanUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingFloorPlan(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formDataUpload,
      });

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      updateField('floorPlan', data.url);

      toast({
        title: "Floor plan uploaded",
        description: "Floor plan uploaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload floor plan.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingFloorPlan(false);
      event.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    const currentImages = formData.images || [];
    const newImages = currentImages.filter((_, i) => i !== index);
    updateField('images', newImages);
  };

  const removeFloorPlan = () => {
    updateField('floorPlan', null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-red-600">Property not found or failed to load.</p>
            <Button onClick={() => setLocation('/crm/properties')} className="mt-4">
              Back to Properties
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Property</h1>
          <p className="text-muted-foreground">Update property details and settings</p>
        </div>
        <Button variant="outline" onClick={() => setShowPreview(true)} className="border-[#791E75] text-[#791E75] hover:bg-purple-50">
          <Eye className="h-4 w-4 mr-2" /> Preview Card
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Property Title</Label>
                <Input
                  id="title"
                  value={formData.title || ''}
                  onChange={(e) => updateField('title', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status || 'active'}
                  onValueChange={(value) => updateField('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="under_offer">Under Offer</SelectItem>
                    <SelectItem value="sstc">SSTC</SelectItem>
                    <SelectItem value="exchanged">Exchanged</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="fallen_through">Fallen Through</SelectItem>
                    <SelectItem value="withdrawn">Withdrawn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={4}
                value={formData.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Listing Type</Label>
                <Select
                  value={formData.isRental ? 'rental' : 'sale'}
                  onValueChange={(value) => updateField('isRental', value === 'rental')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">For Sale</SelectItem>
                    <SelectItem value="rental">To Rent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Property Category</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={formData.isResidential !== false ? 'default' : 'outline'}
                    className={formData.isResidential !== false ? 'bg-[#791E75] hover:bg-[#60175d]' : ''}
                    onClick={() => updateField('isResidential', true)}
                  >
                    <Home className="mr-2 h-4 w-4" />
                    Residential
                  </Button>
                  <Button
                    type="button"
                    variant={formData.isResidential === false ? 'default' : 'outline'}
                    className={formData.isResidential === false ? 'bg-[#791E75] hover:bg-[#60175d]' : ''}
                    onClick={() => updateField('isResidential', false)}
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    Commercial
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Property Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Property Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (£)</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price || ''}
                  onChange={(e) => updateField('price', Math.round(parseFloat(e.target.value)))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Input
                  id="bedrooms"
                  type="number"
                  value={formData.bedrooms || ''}
                  onChange={(e) => updateField('bedrooms', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bathrooms">Bathrooms</Label>
                <Input
                  id="bathrooms"
                  type="number"
                  value={formData.bathrooms || ''}
                  onChange={(e) => updateField('bathrooms', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="receptions">Receptions</Label>
                <Input
                  id="receptions"
                  type="number"
                  value={formData.receptions || ''}
                  onChange={(e) => updateField('receptions', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="propertyType">Property Type</Label>
                <Select
                  value={formData.propertyType || 'flat'}
                  onValueChange={(value) => updateField('propertyType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.isResidential !== false ? (
                      <>
                        <SelectItem value="flat">Flat</SelectItem>
                        <SelectItem value="house">House</SelectItem>
                        <SelectItem value="maisonette">Maisonette</SelectItem>
                        <SelectItem value="penthouse">Penthouse</SelectItem>
                        <SelectItem value="studio">Studio</SelectItem>
                        <SelectItem value="bungalow">Bungalow</SelectItem>
                        <SelectItem value="detached">Detached</SelectItem>
                        <SelectItem value="semi_detached">Semi-Detached</SelectItem>
                        <SelectItem value="terraced">Terraced</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="office">Office</SelectItem>
                        <SelectItem value="retail">Retail</SelectItem>
                        <SelectItem value="restaurant">Restaurant</SelectItem>
                        <SelectItem value="warehouse">Warehouse</SelectItem>
                        <SelectItem value="industrial">Industrial</SelectItem>
                        <SelectItem value="mixed_use">Mixed Use</SelectItem>
                        <SelectItem value="shop">Shop</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="squareFootage">Square Footage</Label>
                <Input
                  id="squareFootage"
                  type="number"
                  value={formData.squareFootage || ''}
                  onChange={(e) => updateField('squareFootage', parseInt(e.target.value))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="addressLine1">Address Line 1</Label>
                <Input
                  id="addressLine1"
                  value={formData.addressLine1 || ''}
                  onChange={(e) => updateField('addressLine1', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input
                  id="addressLine2"
                  value={formData.addressLine2 || ''}
                  onChange={(e) => updateField('addressLine2', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  value={formData.postcode || ''}
                  onChange={(e) => updateField('postcode', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenure">Tenure</Label>
                <Select
                  value={formData.tenure || 'leasehold'}
                  onValueChange={(value) => updateField('tenure', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="freehold">Freehold</SelectItem>
                    <SelectItem value="leasehold">Leasehold</SelectItem>
                    <SelectItem value="share_of_freehold">Share of Freehold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="energyRating">EPC Rating</Label>
                <Select
                  value={formData.energyRating || ''}
                  onValueChange={(value) => updateField('energyRating', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                    <SelectItem value="D">D</SelectItem>
                    <SelectItem value="E">E</SelectItem>
                    <SelectItem value="F">F</SelectItem>
                    <SelectItem value="G">G</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Property Images */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Property Images
            </CardTitle>
            <CardDescription>Upload photos of the property (first image will be the main image)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Images */}
            {formData.images && formData.images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {formData.images.map((imageUrl, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={imageUrl}
                      alt={`Property image ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    {index === 0 && (
                      <span className="absolute top-2 left-2 bg-[#791E75] text-white text-xs px-2 py-1 rounded">
                        Main
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Button */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#791E75] transition-colors">
              <input
                type="file"
                id="imageUpload"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                disabled={isUploadingImages}
              />
              <label htmlFor="imageUpload" className="cursor-pointer">
                {isUploadingImages ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
                    <span className="mt-2 text-sm text-gray-500">Uploading...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="h-8 w-8 text-gray-400" />
                    <span className="mt-2 text-sm text-gray-500">Click to upload images</span>
                    <span className="text-xs text-gray-400">PNG, JPG up to 10MB each</span>
                  </div>
                )}
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Floor Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Floor Plan
            </CardTitle>
            <CardDescription>Upload a floor plan image</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Floor Plan */}
            {formData.floorPlan && (
              <div className="relative inline-block">
                <img
                  src={formData.floorPlan}
                  alt="Floor plan"
                  className="max-w-full h-48 object-contain rounded-lg border"
                />
                <button
                  type="button"
                  onClick={removeFloorPlan}
                  className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Upload Button */}
            {!formData.floorPlan && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#791E75] transition-colors">
                <input
                  type="file"
                  id="floorPlanUpload"
                  accept="image/*,.pdf"
                  onChange={handleFloorPlanUpload}
                  className="hidden"
                  disabled={isUploadingFloorPlan}
                />
                <label htmlFor="floorPlanUpload" className="cursor-pointer">
                  {isUploadingFloorPlan ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
                      <span className="mt-2 text-sm text-gray-500">Uploading...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="h-8 w-8 text-gray-400" />
                      <span className="mt-2 text-sm text-gray-500">Click to upload floor plan</span>
                      <span className="text-xs text-gray-400">PNG, JPG, or PDF</span>
                    </div>
                  )}
                </label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Publishing Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Publishing Settings
                </CardTitle>
                <CardDescription>Control where this property is visible</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => setShowConvertTypeDialog(true)}
              >
                <ArrowRightLeft className="h-4 w-4 mr-1" />
                {formData.isRental ? 'Convert to Sale' : 'Convert to Rental'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="isListed"
                checked={formData.isListed ?? false}
                onCheckedChange={(checked) => updateField('isListed', !!checked)}
              />
              <Label htmlFor="isListed" className="cursor-pointer">
                Listed ({formData.isRental ? 'For Rent' : 'For Sale'})
              </Label>
            </div>

            <Separator />

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="isPublishedWebsite"
                  checked={formData.isPublishedWebsite ?? false}
                  onCheckedChange={(checked) => updateField('isPublishedWebsite', !!checked)}
                />
                <Label htmlFor="isPublishedWebsite" className="flex items-center gap-2 cursor-pointer">
                  <Globe className="h-4 w-4 text-blue-600" />
                  Website
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="isPublishedZoopla"
                  checked={formData.isPublishedZoopla ?? false}
                  onCheckedChange={(checked) => updateField('isPublishedZoopla', !!checked)}
                />
                <Label htmlFor="isPublishedZoopla" className="flex items-center gap-2 cursor-pointer">
                  <Send className="h-4 w-4 text-purple-600" />
                  Zoopla
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="isPublishedRightmove"
                  checked={formData.isPublishedRightmove ?? false}
                  onCheckedChange={(checked) => updateField('isPublishedRightmove', !!checked)}
                />
                <Label htmlFor="isPublishedRightmove" className="flex items-center gap-2 cursor-pointer">
                  <Send className="h-4 w-4 text-green-600" />
                  Rightmove
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="isPublishedOnTheMarket"
                  checked={formData.isPublishedOnTheMarket ?? false}
                  onCheckedChange={(checked) => updateField('isPublishedOnTheMarket', !!checked)}
                />
                <Label htmlFor="isPublishedOnTheMarket" className="flex items-center gap-2 cursor-pointer">
                  <Send className="h-4 w-4 text-orange-600" />
                  OnTheMarket
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="isPublishedSocial"
                  checked={formData.isPublishedSocial ?? false}
                  onCheckedChange={(checked) => updateField('isPublishedSocial', !!checked)}
                />
                <Label htmlFor="isPublishedSocial" className="flex items-center gap-2 cursor-pointer">
                  <Share2 className="h-4 w-4 text-pink-600" />
                  Social Media
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tenancy History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Tenancy History
                </CardTitle>
                <CardDescription>Current and past tenancies for this property</CardDescription>
              </div>
              {!formData.isManaged && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                  onClick={() => setShowConvertManagedDialog(true)}
                >
                  <Shield className="h-4 w-4 mr-1" />
                  Convert to Managed
                </Button>
              )}
              {formData.isManaged && (
                <Badge className="bg-green-100 text-green-800">Managed Property</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {propertyTenancies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <Key className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p>No tenancy records found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {propertyTenancies.map((t: any) => (
                  <div
                    key={t.id}
                    className={`p-4 rounded-lg border ${t.status === 'active' ? 'bg-green-50 border-green-200' : 'bg-white'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={t.status === 'active' ? 'default' : 'secondary'}>
                          {t.status === 'active' ? 'Active' : t.status}
                        </Badge>
                        {t.tenantName && <span className="text-sm font-medium">{t.tenantName}</span>}
                      </div>
                      <Link href={`/crm/tenancies/${t.id}`}>
                        <Button variant="outline" size="sm">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View Tenancy
                        </Button>
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground block">Rent</span>
                        <span className="font-medium">{t.rentAmount ? `£${Number(t.rentAmount).toLocaleString()}/${t.rentFrequency || 'month'}` : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Deposit</span>
                        <span className="font-medium">{t.depositAmount ? `£${Number(t.depositAmount).toLocaleString()}` : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Start</span>
                        <span className="font-medium">{t.startDate ? format(new Date(t.startDate), 'dd MMM yyyy') : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">End</span>
                        <span className="font-medium">{t.endDate ? format(new Date(t.endDate), 'dd MMM yyyy') : 'Periodic'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Property Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Property Documents
            </CardTitle>
            <CardDescription>Certificates, EPC, gas safety and other property documents</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Upload Section */}
            <div className="flex items-center gap-3 mb-4">
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="epc">EPC Certificate</SelectItem>
                  <SelectItem value="gas_safety">Gas Safety Certificate</SelectItem>
                  <SelectItem value="eicr">EICR Certificate</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="floor_plan">Floor Plan</SelectItem>
                  <SelectItem value="certificate">Certificate</SelectItem>
                  <SelectItem value="report">Report</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                disabled={isUploadingDoc}
                onClick={() => {
                  const input = window.document.createElement('input');
                  input.type = 'file';
                  input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx';
                  input.onchange = async (e: any) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsUploadingDoc(true);
                    try {
                      // Upload file
                      const formDataUpload = new FormData();
                      formDataUpload.append('document', file);
                      const uploadRes = await fetch('/api/crm/upload/document', {
                        method: 'POST',
                        credentials: 'include',
                        body: formDataUpload
                      });
                      if (!uploadRes.ok) throw new Error('Upload failed');
                      const uploadResult = await uploadRes.json();

                      // Create document record
                      const docRes = await fetch('/api/crm/documents', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: file.name,
                          originalName: file.name,
                          documentType: docType,
                          storageUrl: uploadResult.url,
                          mimeType: file.type,
                          size: file.size,
                          propertyId: parseInt(propertyId!),
                          entityType: 'property',
                          entityId: parseInt(propertyId!)
                        })
                      });
                      if (!docRes.ok) throw new Error('Failed to save document record');

                      queryClient.invalidateQueries({ queryKey: ['property-documents', propertyId] });
                      toast({ title: 'Document uploaded', description: file.name });
                    } catch (err: any) {
                      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
                    } finally {
                      setIsUploadingDoc(false);
                    }
                  };
                  input.click();
                }}
              >
                {isUploadingDoc ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                Upload Document
              </Button>
            </div>

            {/* Documents List */}
            {propertyDocs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p>No documents uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {propertyDocs.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-white">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-[#791E75]" />
                      <div>
                        <p className="font-medium text-sm">{doc.name || doc.originalName}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.documentType} {doc.createdAt && `• ${format(new Date(doc.createdAt), 'dd MMM yyyy')}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={doc.storageUrl} target="_blank" rel="noopener noreferrer">
                        <Button type="button" variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/crm/documents/${doc.id}`, {
                              method: 'DELETE',
                              credentials: 'include'
                            });
                            if (!res.ok) throw new Error('Delete failed');
                            queryClient.invalidateQueries({ queryKey: ['property-documents', propertyId] });
                            toast({ title: 'Document deleted' });
                          } catch {
                            toast({ title: 'Delete failed', variant: 'destructive' });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Group Viewing Management */}
        {property && (property.isListedSale || property.isListedRental) && (
          <GroupViewingSection propertyId={property.id} />
        )}

        {/* Identification & Access Codes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Identification &amp; Access Codes
            </CardTitle>
            <CardDescription>Internal reference codes and security access information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Key Code and Prop Code still on properties table */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="keyCode">Key Code</Label>
                <Input
                  id="keyCode"
                  value={formData.keyCode || ''}
                  onChange={(e) => updateField('keyCode', e.target.value)}
                  placeholder="e.g., 733"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="propCode">Property Code</Label>
                <Input
                  id="propCode"
                  value={formData.propCode || ''}
                  onChange={(e) => updateField('propCode', e.target.value)}
                />
              </div>
            </div>

            {/* Lock / alarm codes via access-codes endpoint */}
            {propertyId && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Lock &amp; Alarm Codes</Label>
                    <Button type="button" size="sm" variant="outline" onClick={() => setShowAddCode(v => !v)}>
                      <Plus className="h-4 w-4 mr-1" /> Add Code
                    </Button>
                  </div>

                  {showAddCode && (
                    <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Type</Label>
                          <Select value={newCodeType} onValueChange={setNewCodeType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="lock">Lock Code</SelectItem>
                              <SelectItem value="security_alarm">Security Alarm</SelectItem>
                              <SelectItem value="fire_alarm">Fire Alarm</SelectItem>
                              <SelectItem value="gate">Gate Code</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Code Value</Label>
                          <Input value={newCodeValue} onChange={e => setNewCodeValue(e.target.value)} placeholder="e.g., 1234#" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Notes</Label>
                          <Input value={newCodeNotes} onChange={e => setNewCodeNotes(e.target.value)} placeholder="Optional" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" className="bg-[#791E75] hover:bg-[#60175d]" onClick={handleAddCode} disabled={isSavingCode}>
                          {isSavingCode ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                          Save
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddCode(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {accessCodes.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No access codes recorded</p>
                  ) : (
                    <div className="space-y-1">
                      {accessCodes.map((code: any) => (
                        <div key={code.id} className="flex items-center justify-between border rounded px-3 py-2 text-sm">
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground capitalize">{(code.code_type || '').replace(/_/g, ' ')}</span>
                            <span className="font-mono font-medium">{code.code_value}</span>
                            {code.notes && <span className="text-muted-foreground text-xs">— {code.notes}</span>}
                          </div>
                          <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteCode(code.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Meter References */}
        {propertyId && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Square className="h-5 w-5" />
                    Meter References
                  </CardTitle>
                  <CardDescription>Utility meter serial numbers for this property</CardDescription>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowAddMeter(v => !v)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Meter
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showAddMeter && (
                <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Meter Type</Label>
                      <Select value={newMeterType} onValueChange={setNewMeterType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gas">Gas</SelectItem>
                          <SelectItem value="electricity">Electricity</SelectItem>
                          <SelectItem value="water">Water</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Serial Number</Label>
                      <Input value={newMeterSerial} onChange={e => setNewMeterSerial(e.target.value)} placeholder="e.g., G4A12345" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Location</Label>
                      <Input value={newMeterLocation} onChange={e => setNewMeterLocation(e.target.value)} placeholder="e.g., Cupboard under stairs" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" className="bg-[#791E75] hover:bg-[#60175d]" onClick={handleAddMeter} disabled={isSavingMeter}>
                      {isSavingMeter ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddMeter(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {meters.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No meter records added yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Type</th>
                        <th className="pb-2 pr-4 font-medium">Serial Number</th>
                        <th className="pb-2 pr-4 font-medium">Location</th>
                        <th className="pb-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {meters.map((meter: any) => (
                        <tr key={meter.id} className="border-b last:border-0">
                          <td className="py-2 pr-4 capitalize">{meter.meter_type}</td>
                          <td className="py-2 pr-4 font-mono">{meter.serial_number}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{meter.location || '—'}</td>
                          <td className="py-2 text-right">
                            <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteMeter(meter.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Property Classification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Property Classification
            </CardTitle>
            <CardDescription>Additional classification details and block management information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="blockManagementCompany">Block Management Company</Label>
                <Input
                  id="blockManagementCompany"
                  value={formData.blockManagementCompany || ''}
                  onChange={(e) => updateField('blockManagementCompany', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blockManagementContact">Block Management Contact</Label>
                <Input
                  id="blockManagementContact"
                  value={formData.blockManagementContact || ''}
                  onChange={(e) => updateField('blockManagementContact', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Classification Flags</Label>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                {[
                  { id: 'isHmo', label: 'HMO' },
                  { id: 'isStudentLet', label: 'Student Let' },
                  { id: 'isHolidayLet', label: 'Holiday Let' },
                  { id: 'isCouncilLet', label: 'Council Let' },
                ].map(({ id, label }) => (
                  <div key={id} className="flex items-center space-x-2">
                    <Checkbox
                      id={id}
                      checked={(formData as any)[id] ?? false}
                      onCheckedChange={(checked) => updateField(id as keyof PropertyData, !!checked)}
                    />
                    <Label htmlFor={id} className="cursor-pointer text-sm font-normal">{label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Applicant Match Criteria */}
        {propertyId && (
          <ApplicantMatchCriteria propertyId={parseInt(propertyId)} />
        )}

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation('/crm/properties')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-[#791E75] hover:bg-[#60175d]"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Convert to Managed Dialog */}
      <Dialog open={showConvertManagedDialog} onOpenChange={setShowConvertManagedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Managed Property</DialogTitle>
            <DialogDescription>
              This will mark the property as managed by John Barclay and remove it from the active listings.
              The property will appear in the Property Management section where you can assign tenants and tenancies.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <p className="font-medium mb-1">This will:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>Set the property as <strong>Managed</strong></li>
              <li>Remove it from sale/rental listings</li>
              <li>Un-publish from all portals</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertManagedDialog(false)} disabled={isConverting}>
              Cancel
            </Button>
            <Button onClick={handleConvertToManaged} disabled={isConverting} className="bg-purple-700 hover:bg-purple-800">
              {isConverting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
              Convert to Managed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert Sale/Rental Dialog */}
      <Dialog open={showConvertTypeDialog} onOpenChange={setShowConvertTypeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Convert to {formData.isRental ? 'Sale' : 'Rental'} Listing
            </DialogTitle>
            <DialogDescription>
              This will change the property from a {formData.isRental ? 'rental' : 'sale'} listing
              to a {formData.isRental ? 'sale' : 'rental'} listing.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <p className="font-medium mb-1">This will:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>Change listing type to <strong>{formData.isRental ? 'For Sale' : 'For Rent'}</strong></li>
              <li>Update the listing category accordingly</li>
              <li>You may need to update the price/{formData.isRental ? 'asking price' : 'rent amount'} after conversion</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertTypeDialog(false)} disabled={isConverting}>
              Cancel
            </Button>
            <Button onClick={handleConvertListingType} disabled={isConverting}>
              {isConverting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
              Convert to {formData.isRental ? 'Sale' : 'Rental'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Property Card Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <div className="bg-white rounded-lg overflow-hidden">
            {/* Image */}
            <div className="relative h-64 bg-gray-200">
              {formData.images && formData.images.length > 0 ? (
                <img src={formData.images[0]} alt={formData.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <Image className="w-12 h-12 mx-auto mb-2" />
                    <p className="text-sm">No images uploaded</p>
                  </div>
                </div>
              )}
              {/* Listing Type Badge */}
              <div className={`absolute top-3 left-3 px-3 py-1 rounded text-sm font-semibold text-white ${!formData.isRental ? 'bg-[#791E75]' : 'bg-[#F8B324] text-black'}`}>
                {formData.isRental ? 'TO LET' : 'FOR SALE'}
              </div>
              {/* Image count */}
              {formData.images && formData.images.length > 1 && (
                <div className="absolute bottom-3 right-3 bg-black/70 text-white px-3 py-1 rounded text-sm">
                  1/{formData.images.length}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{formData.title || 'Untitled Property'}</h3>
              <div className="flex items-center text-sm text-gray-500 mb-2">
                <MapPin className="h-4 w-4 mr-1" />
                {formData.addressLine1 ? `${formData.addressLine1}, ` : ''}{formData.postcode || 'No postcode'}
              </div>

              {/* Price */}
              <div className="mb-3">
                <span className="text-2xl font-bold text-[#791E75]">
                  {formData.isRental
                    ? `£${Number(formData.rentAmount || formData.price || 0).toLocaleString()} pcm`
                    : `£${Number(formData.price || 0).toLocaleString()}`}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2 mb-4 pb-4 border-b">
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">TYPE</div>
                  <div className="flex items-center justify-center gap-1">
                    <Home className="w-4 h-4 text-[#791E75]" />
                    <span className="text-sm font-semibold capitalize">{formData.propertyType || 'N/A'}</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">BEDS</div>
                  <div className="flex items-center justify-center gap-1">
                    <Bed className="w-4 h-4 text-[#791E75]" />
                    <span className="text-sm font-semibold">{formData.bedrooms || 0}</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">BATHS</div>
                  <div className="flex items-center justify-center gap-1">
                    <Bath className="w-4 h-4 text-[#791E75]" />
                    <span className="text-sm font-semibold">{formData.bathrooms || 0}</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">TENURE</div>
                  <div className="flex items-center justify-center gap-1">
                    <Tag className="w-4 h-4 text-[#791E75]" />
                    <span className="text-sm font-semibold capitalize">{formData.tenure || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Features */}
              {formData.features && formData.features.length > 0 && (
                <div className="mb-4 pb-4 border-b">
                  <h4 className="text-sm font-bold mb-2">Key features</h4>
                  <ul className="grid grid-cols-2 gap-1.5">
                    {formData.features.slice(0, 4).map((f, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start">
                        <span className="text-[#791E75] mr-2">•</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Description */}
              {formData.description && (
                <div className="mb-4">
                  <h4 className="text-sm font-bold mb-2">Description</h4>
                  <p className="text-sm text-gray-700 line-clamp-3">{formData.description}</p>
                </div>
              )}

              {/* Action buttons (preview only) */}
              <div className="flex flex-col gap-2">
                <Button className="w-full bg-[#791E75] hover:bg-[#5d1759] text-white" disabled>
                  View Full Details
                </Button>
                <Button variant="outline" className="w-full border-[#791E75] text-[#791E75]" disabled>
                  Contact Agent
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
