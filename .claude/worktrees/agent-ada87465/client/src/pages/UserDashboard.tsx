import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Home,
  Heart,
  Bell,
  Search,
  User,
  LogOut,
  MapPin,
  Bed,
  Bath,
  Square,
  Calendar,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Edit,
  Eye,
  MessageSquare,
  Phone,
  Mail,
  Settings,
  Save
} from "lucide-react";

interface SavedProperty {
  id: number;
  propertyId: number;
  property: {
    id: number;
    title: string;
    address: string;
    postcode: string;
    price: number;
    propertyType: string;
    bedrooms: number;
    bathrooms: number;
    squareFeet: number;
    status: string;
    images: string[];
    description: string;
  };
  notes: string;
  priceAlerts: boolean;
  statusAlerts: boolean;
  savedAt: string;
}

interface PropertyAlert {
  id: number;
  alertName: string;
  searchCriteria: {
    minPrice?: number;
    maxPrice?: number;
    minBedrooms?: number;
    propertyType?: string;
    areas?: string[];
    features?: string[];
  };
  frequency: string;
  emailAlert: boolean;
  smsAlert: boolean;
  isActive: boolean;
  lastTriggered?: string;
  matchCount: number;
}

export default function UserDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [selectedProperty, setSelectedProperty] = useState<SavedProperty | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [propertyNotes, setPropertyNotes] = useState("");

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      setLocation("/login");
    }
  }, [setLocation]);

  // Fetch saved properties
  const { data: savedProperties = [], isLoading: loadingProperties } = useQuery({
    queryKey: ["/api/user/saved-properties"],
    enabled: !!user,
  });

  // Fetch property alerts
  const { data: propertyAlerts = [], isLoading: loadingAlerts } = useQuery({
    queryKey: ["/api/user/property-alerts"],
    enabled: !!user,
  });

  // Save property mutation
  const savePropertyMutation = useMutation({
    mutationFn: (propertyId: number) =>
      fetch("/api/user/saved-properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "Property saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/saved-properties"] });
    },
  });

  // Remove saved property mutation
  const removeSavedMutation = useMutation({
    mutationFn: (propertyId: number) =>
      fetch(`/api/user/saved-properties/${propertyId}`, {
        method: "DELETE",
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "Property removed from saved list" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/saved-properties"] });
      setSelectedProperty(null);
    },
  });

  // Update property notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: ({ propertyId, notes }: { propertyId: number; notes: string }) =>
      fetch(`/api/user/saved-properties/${propertyId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "Notes updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/saved-properties"] });
      setEditingNotes(false);
    },
  });

  // Update alert settings mutation
  const updateAlertsMutation = useMutation({
    mutationFn: ({ propertyId, priceAlerts, statusAlerts }: any) =>
      fetch(`/api/user/saved-properties/${propertyId}/alerts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceAlerts, statusAlerts }),
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "Alert settings updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/saved-properties"] });
    },
  });

  // Toggle property alert mutation
  const toggleAlertMutation = useMutation({
    mutationFn: ({ alertId, isActive }: { alertId: number; isActive: boolean }) =>
      fetch(`/api/user/property-alerts/${alertId}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "Alert status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/property-alerts"] });
    },
  });

  const handleLogout = () => {
    localStorage.removeItem("user");
    setLocation("/login");
  };

  const handleSaveNotes = () => {
    if (selectedProperty) {
      updateNotesMutation.mutate({
        propertyId: selectedProperty.propertyId,
        notes: propertyNotes,
      });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Home className="h-8 w-8 text-[#791E75]600" />
              <h1 className="text-xl font-bold">My Property Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/")}
                data-testid="button-browse"
              >
                <Search className="h-4 w-4 mr-2" />
                Browse Properties
              </Button>
              <span className="text-sm text-gray-600">
                Welcome, <strong>{user.fullName || user.username}</strong>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="saved" className="space-y-4">
          <TabsList>
            <TabsTrigger value="saved">
              <Heart className="h-4 w-4 mr-2" />
              Saved Properties ({savedProperties.length})
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <Bell className="h-4 w-4 mr-2" />
              Property Alerts ({propertyAlerts.length})
            </TabsTrigger>
            <TabsTrigger value="profile">
              <Settings className="h-4 w-4 mr-2" />
              Profile Settings
            </TabsTrigger>
          </TabsList>

          {/* Saved Properties Tab */}
          <TabsContent value="saved" className="space-y-4">
            {loadingProperties ? (
              <p>Loading saved properties...</p>
            ) : savedProperties.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Heart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No saved properties yet</h3>
                  <p className="text-gray-600 mb-4">
                    Start browsing and save properties you're interested in
                  </p>
                  <Button onClick={() => setLocation("/")} data-testid="button-start-browsing">
                    <Search className="h-4 w-4 mr-2" />
                    Browse Properties
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedProperties.map((saved: SavedProperty) => (
                  <Card key={saved.id} className="overflow-hidden" data-testid={`card-saved-${saved.id}`}>
                    <div className="aspect-video bg-gray-200 relative">
                      {saved.property.images?.[0] ? (
                        <img
                          src={saved.property.images[0]}
                          alt={saved.property.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Home className="h-12 w-12 text-gray-400" />
                        </div>
                      )}
                      <Badge className="absolute top-2 right-2">
                        {saved.property.status}
                      </Badge>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute top-2 left-2"
                        onClick={() => removeSavedMutation.mutate(saved.propertyId)}
                        data-testid={`button-remove-${saved.id}`}
                      >
                        <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                      </Button>
                    </div>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {formatPrice(saved.property.price)}
                      </CardTitle>
                      <CardDescription>{saved.property.title}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-1" />
                        {saved.property.address}, {saved.property.postcode}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center">
                          <Bed className="h-4 w-4 mr-1" />
                          {saved.property.bedrooms} beds
                        </span>
                        <span className="flex items-center">
                          <Bath className="h-4 w-4 mr-1" />
                          {saved.property.bathrooms} baths
                        </span>
                        <span className="flex items-center">
                          <Square className="h-4 w-4 mr-1" />
                          {saved.property.squareFeet} sqft
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Saved {new Date(saved.savedAt).toLocaleDateString()}
                      </div>
                      {saved.notes && (
                        <div className="p-2 bg-gray-50 rounded text-sm">
                          <p className="text-gray-700">{saved.notes}</p>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProperty(saved);
                          setPropertyNotes(saved.notes || "");
                        }}
                        data-testid={`button-details-${saved.id}`}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/properties/${saved.propertyId}`)}
                        data-testid={`button-view-${saved.id}`}
                      >
                        <Home className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Property Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Property Search Alerts</CardTitle>
                    <CardDescription>
                      Get notified when properties matching your criteria become available
                    </CardDescription>
                  </div>
                  <Button data-testid="button-new-alert">
                    <Plus className="h-4 w-4 mr-2" />
                    New Alert
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAlerts ? (
                  <p>Loading alerts...</p>
                ) : propertyAlerts.length === 0 ? (
                  <Alert>
                    <Bell className="h-4 w-4" />
                    <AlertDescription>
                      No property alerts set up yet. Create an alert to get notified about new properties.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {propertyAlerts.map((alert: PropertyAlert) => (
                      <Card key={alert.id} data-testid={`card-alert-${alert.id}`}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <h3 className="font-semibold">{alert.alertName}</h3>
                              <div className="flex flex-wrap gap-2">
                                {alert.searchCriteria.minPrice && (
                                  <Badge variant="secondary">
                                    Min: {formatPrice(alert.searchCriteria.minPrice)}
                                  </Badge>
                                )}
                                {alert.searchCriteria.maxPrice && (
                                  <Badge variant="secondary">
                                    Max: {formatPrice(alert.searchCriteria.maxPrice)}
                                  </Badge>
                                )}
                                {alert.searchCriteria.minBedrooms && (
                                  <Badge variant="secondary">
                                    {alert.searchCriteria.minBedrooms}+ beds
                                  </Badge>
                                )}
                                {alert.searchCriteria.propertyType && (
                                  <Badge variant="secondary">
                                    {alert.searchCriteria.propertyType}
                                  </Badge>
                                )}
                                {alert.searchCriteria.areas?.map((area) => (
                                  <Badge key={area} variant="secondary">
                                    {area}
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                <span>Frequency: {alert.frequency}</span>
                                {alert.emailAlert && <Mail className="h-4 w-4" />}
                                {alert.smsAlert && <Phone className="h-4 w-4" />}
                                <span>{alert.matchCount} matches</span>
                              </div>
                              {alert.lastTriggered && (
                                <p className="text-xs text-gray-500">
                                  Last triggered: {new Date(alert.lastTriggered).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={alert.isActive}
                                onCheckedChange={(checked) =>
                                  toggleAlertMutation.mutate({
                                    alertId: alert.id,
                                    isActive: checked,
                                  })
                                }
                                data-testid={`switch-alert-${alert.id}`}
                              />
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Settings Tab */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal details and preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Full Name</Label>
                    <Input value={user.fullName || ""} disabled />
                  </div>
                  <div>
                    <Label>Username</Label>
                    <Input value={user.username || ""} disabled />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={user.email || ""} disabled />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={user.phone || ""} disabled />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold">Notification Preferences</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Email Notifications</Label>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>SMS Notifications</Label>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Property Price Alerts</Label>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>New Property Alerts</Label>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>
                <Button data-testid="button-save-profile">
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Property Details Dialog */}
      <Dialog open={!!selectedProperty} onOpenChange={() => setSelectedProperty(null)}>
        <DialogContent className="max-w-2xl">
          {selectedProperty && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedProperty.property.title}</DialogTitle>
                <DialogDescription>
                  {selectedProperty.property.address}, {selectedProperty.property.postcode}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden">
                  {selectedProperty.property.images?.[0] ? (
                    <img
                      src={selectedProperty.property.images[0]}
                      alt={selectedProperty.property.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Home className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Price</Label>
                    <p className="text-lg font-semibold">
                      {formatPrice(selectedProperty.property.price)}
                    </p>
                  </div>
                  <div>
                    <Label>Property Type</Label>
                    <p className="text-lg">{selectedProperty.property.propertyType}</p>
                  </div>
                  <div>
                    <Label>Bedrooms</Label>
                    <p className="text-lg">{selectedProperty.property.bedrooms}</p>
                  </div>
                  <div>
                    <Label>Bathrooms</Label>
                    <p className="text-lg">{selectedProperty.property.bathrooms}</p>
                  </div>
                </div>

                <div>
                  <Label>Description</Label>
                  <p className="text-sm text-gray-700">
                    {selectedProperty.property.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Your Notes</Label>
                  {editingNotes ? (
                    <div className="space-y-2">
                      <Textarea
                        value={propertyNotes}
                        onChange={(e) => setPropertyNotes(e.target.value)}
                        placeholder="Add your personal notes about this property..."
                        className="min-h-[100px]"
                        data-testid="textarea-notes"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveNotes}
                          disabled={updateNotesMutation.isPending}
                          data-testid="button-save-notes"
                        >
                          Save Notes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingNotes(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                      onClick={() => setEditingNotes(true)}
                    >
                      {selectedProperty.notes ? (
                        <p className="text-sm">{selectedProperty.notes}</p>
                      ) : (
                        <p className="text-sm text-gray-500">
                          Click to add notes about this property...
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Alert Settings</Label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Price change alerts</span>
                      <Switch
                        checked={selectedProperty.priceAlerts}
                        onCheckedChange={(checked) =>
                          updateAlertsMutation.mutate({
                            propertyId: selectedProperty.propertyId,
                            priceAlerts: checked,
                            statusAlerts: selectedProperty.statusAlerts,
                          })
                        }
                        data-testid="switch-price-alerts"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Status change alerts</span>
                      <Switch
                        checked={selectedProperty.statusAlerts}
                        onCheckedChange={(checked) =>
                          updateAlertsMutation.mutate({
                            propertyId: selectedProperty.propertyId,
                            priceAlerts: selectedProperty.priceAlerts,
                            statusAlerts: checked,
                          })
                        }
                        data-testid="switch-status-alerts"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/properties/${selectedProperty.propertyId}`)}
                  data-testid="button-view-full"
                >
                  View Full Listing
                </Button>
                <Button
                  variant="outline"
                  onClick={() => removeSavedMutation.mutate(selectedProperty.propertyId)}
                  data-testid="button-unsave"
                >
                  <Heart className="h-4 w-4 mr-2" />
                  Unsave
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}