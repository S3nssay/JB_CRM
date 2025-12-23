import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Calendar,
  Clock,
  Home,
  Users,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  MapPin,
  Building2,
  Bed,
  Bath,
  Search,
} from "lucide-react";
import { format } from "date-fns";

interface Property {
  id: number;
  title: string;
  addressLine1: string;
  addressLine2?: string;
  postcode: string;
  propertyType: string;
  bedrooms?: number;
  bathrooms?: number;
  price?: number;
  images?: string[];
  status?: string;
  listingType?: string;
}

interface ScheduleViewingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedPropertyId?: number;
  onSuccess?: () => void;
}

const attendeeSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
});

const viewingFormSchema = z.object({
  viewingDate: z.string().min(1, "Date is required"),
  viewingTime: z.string().min(1, "Time is required"),
  duration: z.string().default("30"),
  isGroupBooking: z.boolean().default(false),
  notes: z.string().optional(),
  attendees: z.array(attendeeSchema).min(1, "At least one attendee is required"),
});

type ViewingFormValues = z.infer<typeof viewingFormSchema>;
type WizardStep = "property" | "datetime" | "attendees" | "confirm";

export function ScheduleViewingWizard({
  isOpen,
  onClose,
  preselectedPropertyId,
  onSuccess,
}: ScheduleViewingWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WizardStep>("property");
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [propertySearch, setPropertySearch] = useState("");

  const form = useForm<ViewingFormValues>({
    resolver: zodResolver(viewingFormSchema),
    defaultValues: {
      viewingDate: "",
      viewingTime: "10:00",
      duration: "30",
      isGroupBooking: false,
      notes: "",
      attendees: [{ name: "", email: "", phone: "" }],
    },
  });

  const { data: properties = [], isLoading: propertiesLoading } = useQuery<
    Property[]
  >({
    queryKey: ["/api/crm/properties"],
    enabled: isOpen,
  });

  useEffect(() => {
    if (preselectedPropertyId && properties.length > 0 && isOpen) {
      const property = properties.find((p) => p.id === preselectedPropertyId);
      if (property) {
        setSelectedProperty(property);
        if (step === "property") {
          setStep("datetime");
        }
      }
    }
  }, [preselectedPropertyId, properties, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      if (!preselectedPropertyId) {
        setSelectedProperty(null);
        setStep("property");
      } else {
        setStep("datetime");
      }
      setPropertySearch("");
      form.reset({
        viewingDate: "",
        viewingTime: "10:00",
        duration: "30",
        isGroupBooking: false,
        notes: "",
        attendees: [{ name: "", email: "", phone: "" }],
      });
    }
  }, [isOpen, preselectedPropertyId, form]);

  const filteredProperties = properties.filter((p) => {
    const searchLower = propertySearch.toLowerCase();
    return (
      p.title?.toLowerCase().includes(searchLower) ||
      p.addressLine1?.toLowerCase().includes(searchLower) ||
      p.postcode?.toLowerCase().includes(searchLower)
    );
  });

  const scheduleViewingMutation = useMutation({
    mutationFn: async (data: {
      propertyId: number;
      startTime: string;
      endTime: string;
      attendees: { name: string; email: string; phone?: string }[];
      isGroupBooking: boolean;
      notes?: string;
    }) => {
      const response = await apiRequest("/api/crm/viewings", "POST", data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Viewing Scheduled",
        description: "The viewing has been successfully scheduled.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/viewings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/calendar-events"] });
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule viewing",
        variant: "destructive",
      });
    },
  });

  const onFormSubmit = (values: ViewingFormValues) => {
    if (!selectedProperty) {
      toast({
        title: "No Property Selected",
        description: "Please select a property first.",
        variant: "destructive",
      });
      return;
    }

    const startDateTime = new Date(`${values.viewingDate}T${values.viewingTime}`);
    const endDateTime = new Date(
      startDateTime.getTime() + parseInt(values.duration) * 60000
    );

    scheduleViewingMutation.mutate({
      propertyId: selectedProperty.id,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      attendees: values.attendees,
      isGroupBooking: values.isGroupBooking,
      notes: values.notes || undefined,
    });
  };

  const handleConfirmClick = () => {
    form.handleSubmit(onFormSubmit)();
  };

  const addAttendee = () => {
    const current = form.getValues("attendees");
    form.setValue("attendees", [...current, { name: "", email: "", phone: "" }]);
  };

  const removeAttendee = (index: number) => {
    const current = form.getValues("attendees");
    if (current.length > 1) {
      form.setValue(
        "attendees",
        current.filter((_, i) => i !== index)
      );
    }
  };

  const getStepNumber = (s: WizardStep): number => {
    const steps: WizardStep[] = ["property", "datetime", "attendees", "confirm"];
    return steps.indexOf(s) + 1;
  };

  const canProceed = (): boolean => {
    switch (step) {
      case "property":
        return selectedProperty !== null;
      case "datetime": {
        const values = form.getValues();
        return values.viewingDate !== "" && values.viewingTime !== "";
      }
      case "attendees": {
        const attendees = form.getValues("attendees");
        return attendees.some((a) => a.name.trim() && a.email.trim());
      }
      default:
        return true;
    }
  };

  const goNext = async () => {
    const steps: WizardStep[] = ["property", "datetime", "attendees", "confirm"];
    const currentIndex = steps.indexOf(step);

    let isValid = true;

    if (step === "datetime") {
      isValid = await form.trigger(["viewingDate", "viewingTime", "duration", "isGroupBooking"]);
    } else if (step === "attendees") {
      isValid = await form.trigger("attendees");
      if (!isValid) {
        toast({
          title: "Validation Error",
          description: "Please ensure all attendees have valid names (2+ characters) and email addresses.",
          variant: "destructive",
        });
      }
    }

    if (isValid && currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const goBack = () => {
    const steps: WizardStep[] = ["property", "datetime", "attendees", "confirm"];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6" data-testid="wizard-step-indicator">
      {["property", "datetime", "attendees", "confirm"].map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div
            data-testid={`step-indicator-${s}`}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              getStepNumber(step) > i + 1
                ? "bg-primary text-primary-foreground"
                : getStepNumber(step) === i + 1
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {getStepNumber(step) > i + 1 ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          {i < 3 && (
            <div
              className={`w-8 h-0.5 ${
                getStepNumber(step) > i + 1 ? "bg-primary" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderPropertyStep = () => (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          data-testid="input-property-search"
          placeholder="Search properties..."
          value={propertySearch}
          onChange={(e) => setPropertySearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="h-[300px]" data-testid="property-list-container">
        <div className="space-y-2">
          {propertiesLoading ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-loading-properties">
              Loading properties...
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-properties">
              No properties found
            </div>
          ) : (
            filteredProperties.map((property) => (
              <Card
                key={property.id}
                data-testid={`card-property-${property.id}`}
                className={`cursor-pointer transition-colors hover-elevate ${
                  selectedProperty?.id === property.id
                    ? "ring-2 ring-primary bg-primary/5"
                    : ""
                }`}
                onClick={() => setSelectedProperty(property)}
              >
                <CardContent className="p-3 flex gap-3">
                  <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center shrink-0">
                    {property.images?.[0] ? (
                      <img
                        src={property.images[0]}
                        alt=""
                        className="w-full h-full object-cover rounded-md"
                      />
                    ) : (
                      <Building2 className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate" data-testid={`text-property-title-${property.id}`}>
                      {property.title || property.addressLine1}
                    </h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-property-address-${property.id}`}>
                      <MapPin className="w-3 h-3" />
                      {property.addressLine1}, {property.postcode}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {property.bedrooms && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Bed className="w-3 h-3" /> {property.bedrooms}
                        </span>
                      )}
                      {property.bathrooms && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Bath className="w-3 h-3" /> {property.bathrooms}
                        </span>
                      )}
                      {property.listingType && (
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-listing-type-${property.id}`}>
                          {property.listingType}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {selectedProperty?.id === property.id && (
                    <Check className="w-5 h-5 text-primary shrink-0" data-testid={`icon-selected-${property.id}`} />
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const renderDateTimeStep = () => (
    <Form {...form}>
      <div className="space-y-4">
        {selectedProperty && (
          <Card data-testid="card-selected-property">
            <CardContent className="p-3 flex gap-3">
              <Home className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm" data-testid="text-selected-property-title">
                  {selectedProperty.title || selectedProperty.addressLine1}
                </h4>
                <p className="text-xs text-muted-foreground" data-testid="text-selected-property-address">
                  {selectedProperty.addressLine1}, {selectedProperty.postcode}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="viewingDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Date
                </FormLabel>
                <FormControl>
                  <Input
                    data-testid="input-viewing-date"
                    type="date"
                    min={format(new Date(), "yyyy-MM-dd")}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="viewingTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Time
                </FormLabel>
                <FormControl>
                  <Input
                    data-testid="input-viewing-time"
                    type="time"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="duration"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Duration</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-duration">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="15" data-testid="select-item-15">15 minutes</SelectItem>
                  <SelectItem value="30" data-testid="select-item-30">30 minutes</SelectItem>
                  <SelectItem value="45" data-testid="select-item-45">45 minutes</SelectItem>
                  <SelectItem value="60" data-testid="select-item-60">1 hour</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isGroupBooking"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <FormLabel>Group Booking</FormLabel>
                <p className="text-xs text-muted-foreground">
                  Enable for multiple attendees at the same viewing
                </p>
              </div>
              <FormControl>
                <Switch
                  data-testid="switch-group-booking"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </Form>
  );

  const renderAttendeesStep = () => {
    const attendees = form.watch("attendees");
    const isGroupBooking = form.watch("isGroupBooking");

    return (
      <Form {...form}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Attendees
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isGroupBooking
                  ? "Add all attendees for the group viewing"
                  : "Add the primary attendee"}
              </p>
            </div>
            {isGroupBooking && (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={addAttendee}
                data-testid="button-add-attendee"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            )}
          </div>

          <ScrollArea className="h-[260px]" data-testid="attendee-list-container">
            <div className="space-y-4 pr-2">
              {attendees.map((_, index) => (
                <Card key={index} data-testid={`card-attendee-${index}`}>
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" data-testid={`text-attendee-label-${index}`}>
                        Attendee {index + 1}
                      </span>
                      {attendees.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() => removeAttendee(index)}
                          data-testid={`button-remove-attendee-${index}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <FormField
                        control={form.control}
                        name={`attendees.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                data-testid={`input-attendee-name-${index}`}
                                placeholder="Full name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`attendees.${index}.email`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                data-testid={`input-attendee-email-${index}`}
                                type="email"
                                placeholder="Email address"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`attendees.${index}.phone`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                data-testid={`input-attendee-phone-${index}`}
                                type="tel"
                                placeholder="Phone (optional)"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      </Form>
    );
  };

  const renderConfirmStep = () => {
    const values = form.getValues();
    const startDateTime =
      values.viewingDate && values.viewingTime
        ? new Date(`${values.viewingDate}T${values.viewingTime}`)
        : null;
    const validAttendees = values.attendees.filter(
      (a) => a.name.trim() && a.email.trim()
    );

    return (
      <Form {...form}>
        <div className="space-y-4">
          <Card data-testid="card-confirmation-summary">
            <CardContent className="p-4 space-y-4">
              <div>
                <h4 className="text-xs text-muted-foreground uppercase tracking-wide">
                  Property
                </h4>
                <p className="font-medium" data-testid="text-confirm-property-title">
                  {selectedProperty?.title || selectedProperty?.addressLine1}
                </p>
                <p className="text-sm text-muted-foreground" data-testid="text-confirm-property-address">
                  {selectedProperty?.addressLine1}, {selectedProperty?.postcode}
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs text-muted-foreground uppercase tracking-wide">
                    Date & Time
                  </h4>
                  <p className="font-medium" data-testid="text-confirm-date">
                    {startDateTime
                      ? format(startDateTime, "EEEE, d MMMM yyyy")
                      : "-"}
                  </p>
                  <p className="text-sm text-muted-foreground" data-testid="text-confirm-time">
                    {startDateTime ? format(startDateTime, "HH:mm") : "-"} ({values.duration} min)
                  </p>
                </div>
                <div>
                  <h4 className="text-xs text-muted-foreground uppercase tracking-wide">
                    Booking Type
                  </h4>
                  <Badge variant={values.isGroupBooking ? "default" : "secondary"} data-testid="badge-booking-type">
                    {values.isGroupBooking ? "Group Viewing" : "Individual"}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  Attendees ({validAttendees.length})
                </h4>
                <div className="space-y-2" data-testid="attendee-summary-list">
                  {validAttendees.map((attendee, index) => (
                    <div
                      key={index}
                      className="text-sm flex items-center gap-2"
                      data-testid={`text-confirm-attendee-${index}`}
                    >
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                        {attendee.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-medium">{attendee.name}</span>
                        <span className="text-muted-foreground ml-2">
                          {attendee.email}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (optional)</FormLabel>
                <FormControl>
                  <Textarea
                    data-testid="input-viewing-notes"
                    placeholder="Any additional notes for the viewing..."
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Form>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-schedule-viewing">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="dialog-title">
            <Calendar className="w-5 h-5" />
            Schedule Viewing
          </DialogTitle>
          <DialogDescription data-testid="dialog-description">
            {step === "property" && "Select a property for the viewing"}
            {step === "datetime" && "Choose the date and time"}
            {step === "attendees" && "Add attendee details"}
            {step === "confirm" && "Review and confirm the booking"}
          </DialogDescription>
        </DialogHeader>

        {renderStepIndicator()}

        {step === "property" && renderPropertyStep()}
        {step === "datetime" && renderDateTimeStep()}
        {step === "attendees" && renderAttendeesStep()}
        {step === "confirm" && renderConfirmStep()}

        <DialogFooter className="flex gap-2 mt-4">
          {step !== "property" && (
            <Button
              variant="outline"
              onClick={goBack}
              data-testid="button-wizard-back"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          )}
          <div className="flex-1" />
          {step !== "confirm" ? (
            <Button
              onClick={goNext}
              disabled={!canProceed()}
              data-testid="button-wizard-next"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleConfirmClick}
              disabled={scheduleViewingMutation.isPending}
              data-testid="button-confirm-viewing"
            >
              {scheduleViewingMutation.isPending ? (
                "Scheduling..."
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Confirm Viewing
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
