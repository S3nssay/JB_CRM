import { useState, useRef, useEffect, ReactNode } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { MessageCircle, Send, Loader2, Calendar, Home } from 'lucide-react';
import ChatPropertyCard from './ChatPropertyCard';

type LeadType = 'rental' | 'purchase' | 'seller' | 'landlord';

interface ChatMessage {
  sender: 'bot' | 'user';
  content: string | ReactNode;
  isTyping?: boolean;
}

type ChatStep =
  | 'greeting'
  | 'ask_name'
  | 'ask_contact'
  | 'ask_preferences'
  | 'show_results'
  | 'book_viewing'
  | 'thank_you';

interface EnquiryChatbotProps {
  property: {
    id: number;
    title?: string;
    addressLine1?: string;
    address?: string;
    postcode?: string;
    price?: number;
    rentAmount?: number;
    bedrooms?: number;
    bathrooms?: number;
    propertyType?: string;
    images?: string[];
    isRental?: boolean;
    isListedRental?: boolean;
    isListedSale?: boolean;
  };
  isOpen: boolean;
  onClose: () => void;
}

export default function EnquiryChatbot({ property, isOpen, onClose }: EnquiryChatbotProps) {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Chat state
  const [step, setStep] = useState<ChatStep>('greeting');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Lead data
  const [leadId, setLeadId] = useState<number | null>(null);
  const [leadToken, setLeadToken] = useState<string | null>(null);
  const [leadType, setLeadType] = useState<LeadType>(property.isRental || property.isListedRental ? 'rental' : 'purchase');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Preferences
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [preferredAreas, setPreferredAreas] = useState('');
  const [moveInDate, setMoveInDate] = useState('');

  // Search results
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [bookingPropertyId, setBookingPropertyId] = useState<number | null>(null);
  const [viewingDate, setViewingDate] = useState('');
  const [viewingTime, setViewingTime] = useState('10:00');
  const [viewingSlots, setViewingSlots] = useState<any>(null); // { groupViewingsOnly, slots?, busySlots?, groupSlots? }
  const [selectedGroupSlotId, setSelectedGroupSlotId] = useState<number | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset state when sheet opens
  useEffect(() => {
    if (isOpen) {
      const initialLeadType: LeadType = property.isRental || property.isListedRental ? 'rental' : 'purchase';
      setLeadType(initialLeadType);
      setStep('greeting');
      setMessages([]);
      setLeadId(null);
      setLeadToken(null);
      setFullName('');
      setEmail('');
      setPhone('');
      setMinBudget('');
      setMaxBudget('');
      setBedrooms('');
      setPreferredAreas('');
      setMoveInDate('');
      setSearchResults([]);
      setBookingPropertyId(null);
      setViewingDate('');
      setViewingTime('10:00');
      setViewingSlots(null);
      setSelectedGroupSlotId(null);

      // Start conversation
      const propertyName = property.title || property.addressLine1 || property.address || 'this property';
      const typeLabel = initialLeadType === 'rental' ? 'rent' : 'buy';

      setTimeout(() => {
        addBotMessage(`Hi there! I see you're interested in **${propertyName}** — great choice!`);
        setTimeout(() => {
          addBotMessage(`Could I get your name so we can help you with your ${typeLabel === 'rent' ? 'rental' : 'property'} search?`);
          setStep('ask_name');
        }, 800);
      }, 400);
    }
  }, [isOpen]);

  const addBotMessage = (content: string | ReactNode) => {
    setMessages(prev => [...prev, { sender: 'bot', content }]);
  };

  const addUserMessage = (content: string) => {
    setMessages(prev => [...prev, { sender: 'user', content }]);
  };

  // Step handlers

  const handleNameSubmit = () => {
    if (!fullName.trim()) return;
    addUserMessage(fullName);
    setTimeout(() => {
      addBotMessage(`Nice to meet you, ${fullName.split(' ')[0]}! What's the best email and phone number to reach you on?`);
      setStep('ask_contact');
    }, 500);
  };

  const handleContactSubmit = async () => {
    // Smart parsing: user may type both email and phone into either field
    let parsedEmail = email.trim();
    let parsedPhone = phone.trim();

    // If email field contains comma/space-separated values, try to extract email + phone
    if (parsedEmail && !parsedPhone) {
      const parts = parsedEmail.split(/[,;\/]+/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const emailPart = parts.find(p => p.includes('@'));
        const phonePart = parts.find(p => !p.includes('@') && /[\d\s+()-]{7,}/.test(p));
        if (emailPart) parsedEmail = emailPart;
        if (phonePart) {
          parsedPhone = phonePart;
          if (!emailPart) parsedEmail = '';
        }
      }
    }

    if (!parsedEmail && !parsedPhone) {
      toast({ title: 'Please provide an email or phone number', variant: 'destructive' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (parsedEmail && !emailRegex.test(parsedEmail)) {
      toast({ title: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }

    // Update state with parsed values
    setEmail(parsedEmail);
    setPhone(parsedPhone);

    addUserMessage(`${parsedEmail}${parsedEmail && parsedPhone ? ' / ' : ''}${parsedPhone}`);
    setIsLoading(true);

    try {
      // Create the lead immediately
      const result = await apiRequest('/api/public/leads', 'POST', {
        fullName,
        email: parsedEmail || undefined,
        phone: parsedPhone || undefined,
        leadType,
        sourceDetail: `enquiry_property_${property.id}`,
      });

      setLeadId(result.id);
      setLeadToken(result.leadToken);

      // Record the property they enquired about
      await apiRequest(`/api/public/leads/${result.id}/property-views`, 'POST', {
        leadToken: result.leadToken,
        propertyId: property.id,
      });

      setTimeout(() => {
        addBotMessage(
          `Perfect, ${fullName.split(' ')[0]}! To find you the best properties, could you tell me a bit about what you're looking for?`
        );
        setStep('ask_preferences');
      }, 500);
    } catch (error) {
      console.error('Error creating lead:', error);
      toast({ title: 'Something went wrong. Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreferencesSubmit = async () => {
    const prefParts: string[] = [];
    if (minBudget || maxBudget) {
      prefParts.push(`Budget: £${minBudget || '0'} - £${maxBudget || 'any'}`);
    }
    if (bedrooms) prefParts.push(`${bedrooms} bedrooms`);
    if (preferredAreas) prefParts.push(`Areas: ${preferredAreas}`);
    if (moveInDate) prefParts.push(`Move in: ${moveInDate}`);

    addUserMessage(prefParts.length > 0 ? prefParts.join(', ') : 'No specific preferences');
    setIsLoading(true);

    try {
      // Update lead with preferences
      if (leadId && leadToken) {
        await apiRequest(`/api/public/leads/${leadId}`, 'PUT', {
          leadToken,
          preferredBedrooms: bedrooms ? parseInt(bedrooms) : undefined,
          preferredAreas: preferredAreas ? preferredAreas.split(',').map(a => a.trim()) : undefined,
          minBudget: minBudget ? parseInt(minBudget) : undefined,
          maxBudget: maxBudget ? parseInt(maxBudget) : undefined,
          moveInDate: moveInDate || undefined,
        });
      }

      // Search for matching properties
      const listingType = leadType === 'rental' ? 'rental' : 'sale';
      const params = new URLSearchParams({ listingType });
      if (minBudget) params.set('minPrice', minBudget);
      if (maxBudget) params.set('maxPrice', maxBudget);
      if (bedrooms) params.set('bedrooms', bedrooms);
      if (preferredAreas) params.set('postcode', preferredAreas.split(',')[0].trim());

      const properties = await apiRequest(`/api/properties?${params.toString()}`);
      const results = Array.isArray(properties) ? properties : [];

      // Put the enquired property first, remove dupes
      const filtered = results.filter((p: any) => p.id !== property.id).slice(0, 5);
      const allResults = [{ ...property, _isCurrentProperty: true }, ...filtered];

      setSearchResults(allResults);

      setTimeout(() => {
        if (allResults.length > 1) {
          addBotMessage(`Great news! I found ${allResults.length} properties matching your criteria. Here they are — click "Book Viewing" on any that catch your eye!`);
        } else {
          addBotMessage(`Here's the property you enquired about. Click "Book Viewing" to schedule a visit!`);
        }
        setStep('show_results');
      }, 500);
    } catch (error) {
      console.error('Error searching properties:', error);
      // Still show the enquired property
      setSearchResults([{ ...property, _isCurrentProperty: true }]);
      setTimeout(() => {
        addBotMessage(`Here's the property you enquired about. Would you like to book a viewing?`);
        setStep('show_results');
      }, 500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipPreferences = () => {
    addUserMessage("I'd just like to enquire about this property");
    setSearchResults([{ ...property, _isCurrentProperty: true }]);
    setTimeout(() => {
      addBotMessage(`No problem! Here's the property. Would you like to book a viewing?`);
      setStep('show_results');
    }, 500);
  };

  const handleBookViewing = async (propertyId: number) => {
    setBookingPropertyId(propertyId);
    setSelectedGroupSlotId(null);
    setViewingSlots(null);
    const prop = searchResults.find(p => p.id === propertyId);
    const propName = prop?.title || prop?.addressLine1 || 'the property';
    addUserMessage(`I'd like to view ${propName}`);

    // Default to next weekday
    const now = new Date();
    const nextDay = new Date(now);
    nextDay.setDate(now.getDate() + (now.getDay() >= 5 ? 8 - now.getDay() : 1));
    setViewingDate(nextDay.toISOString().split('T')[0]);

    // Fetch available viewing slots
    try {
      const res = await fetch(`/api/public/properties/${propertyId}/viewing-slots`);
      if (res.ok) {
        const slotsData = await res.json();
        setViewingSlots(slotsData);

        if (slotsData.groupViewingsOnly) {
          if (slotsData.slots && slotsData.slots.length > 0) {
            setTimeout(() => {
              addBotMessage(`This property has scheduled group viewing sessions. Please select one of the available slots below.`);
              setStep('book_viewing');
            }, 500);
          } else {
            setTimeout(() => {
              addBotMessage(`Sorry, there are no group viewing slots available for this property at the moment. Please check back later or contact us directly.`);
              setStep('thank_you');
            }, 500);
          }
          return;
        }
      }
    } catch (err) {
      console.error('Failed to fetch viewing slots:', err);
    }

    setTimeout(() => {
      addBotMessage(`When works best for you? Pick a date and time below.`);
      setStep('book_viewing');
    }, 500);
  };

  const handleConfirmViewing = async () => {
    const isGroupSlot = !!selectedGroupSlotId;
    if (!isGroupSlot && !viewingDate) {
      toast({ title: 'Please select a date', variant: 'destructive' });
      return;
    }
    if (!leadId || !leadToken || !bookingPropertyId) return;

    const prop = searchResults.find(p => p.id === bookingPropertyId);
    const propName = prop?.title || prop?.addressLine1 || 'the property';

    if (isGroupSlot) {
      const slot = viewingSlots?.slots?.find((s: any) => s.id === selectedGroupSlotId)
        || viewingSlots?.groupSlots?.find((s: any) => s.id === selectedGroupSlotId);
      const slotTime = slot ? new Date(slot.startTime) : null;
      const timeStr = slotTime ? slotTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
      const dateStr = slotTime ? slotTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
      addUserMessage(`Group viewing on ${dateStr} at ${timeStr}`);
    } else {
      addUserMessage(`${viewingDate} at ${viewingTime}`);
    }

    setIsLoading(true);

    try {
      const payload: any = {
        leadToken,
        propertyId: bookingPropertyId,
      };
      if (isGroupSlot) {
        payload.groupSlotId = selectedGroupSlotId;
      } else {
        payload.scheduledAt = `${viewingDate}T${viewingTime}:00`;
      }

      const result = await apiRequest(`/api/public/leads/${leadId}/viewings`, 'POST', payload);

      const bookedAt = isGroupSlot
        ? new Date(result.scheduled_at || result.scheduledAt)
        : new Date(`${viewingDate}T${viewingTime}:00`);
      const bookedDateStr = bookedAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      const bookedTimeStr = bookedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      setTimeout(() => {
        addBotMessage(
          `Your viewing for **${propName}** is booked for **${bookedDateStr} at ${bookedTimeStr}**. One of our agents will confirm shortly.`
        );
        setTimeout(() => {
          addBotMessage(`Is there anything else I can help with?`);
          setStep('thank_you');
        }, 800);
      }, 500);

      toast({ title: 'Viewing booked!', description: `${propName} on ${bookedDateStr} at ${bookedTimeStr}` });
    } catch (error: any) {
      console.error('Error booking viewing:', error);
      const errMsg = error?.message || 'Failed to book viewing. Please try again.';
      if (errMsg.includes('not available') || errMsg.includes('full')) {
        toast({ title: 'Slot unavailable', description: errMsg, variant: 'destructive' });
        addBotMessage(`Sorry, that time slot is no longer available. Please choose a different time.`);
      } else {
        toast({ title: errMsg, variant: 'destructive' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchMore = () => {
    setBookingPropertyId(null);
    addUserMessage("I'd like to see more properties");
    setTimeout(() => {
      addBotMessage("Let's refine your search. Tell me what you're looking for:");
      setStep('ask_preferences');
    }, 500);
  };

  // Render helper for bot/user message bubbles
  const renderMessage = (msg: ChatMessage, index: number) => {
    const isBotMsg = msg.sender === 'bot';
    return (
      <div key={index} className={`flex ${isBotMsg ? 'justify-start' : 'justify-end'} mb-3`}>
        <div
          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isBotMsg
              ? 'bg-gray-100 text-gray-800 rounded-bl-sm'
              : 'bg-[#791E75] text-white rounded-br-sm'
          }`}
        >
          {typeof msg.content === 'string' ? (
            <span dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
          ) : (
            msg.content
          )}
        </div>
      </div>
    );
  };

  // Render the input area based on current step
  const renderInputArea = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-4 text-gray-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Just a moment...
        </div>
      );
    }

    switch (step) {
      case 'ask_name':
        return (
          <div className="flex gap-2">
            <Input
              placeholder="Your name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNameSubmit()}
              autoFocus
              className="flex-1"
            />
            <Button
              onClick={handleNameSubmit}
              disabled={!fullName.trim()}
              className="bg-[#791E75] hover:bg-[#631560]"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        );

      case 'ask_contact':
        return (
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <Input
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleContactSubmit()}
                className="flex-1"
              />
              <Button
                onClick={handleContactSubmit}
                disabled={!email.trim() && !phone.trim()}
                className="bg-[#791E75] hover:bg-[#631560]"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case 'ask_preferences':
        return (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min budget (£)"
                value={minBudget}
                onChange={e => setMinBudget(e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="Max budget (£)"
                value={maxBudget}
                onChange={e => setMaxBudget(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex gap-2">
              <Select value={bedrooms} onValueChange={setBedrooms}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Bedrooms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 bed</SelectItem>
                  <SelectItem value="2">2 beds</SelectItem>
                  <SelectItem value="3">3 beds</SelectItem>
                  <SelectItem value="4">4 beds</SelectItem>
                  <SelectItem value="5">5+ beds</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Areas (e.g. W9, NW6)"
                value={preferredAreas}
                onChange={e => setPreferredAreas(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                placeholder="Move-in date"
                value={moveInDate}
                onChange={e => setMoveInDate(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handlePreferencesSubmit}
                className="bg-[#791E75] hover:bg-[#631560]"
              >
                Search
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-500 w-full"
              onClick={handleSkipPreferences}
            >
              Skip — just enquire about this property
            </Button>
          </div>
        );

      case 'show_results':
        return (
          <div className="space-y-3">
            <div className="max-h-[350px] overflow-y-auto space-y-3 pr-1">
              {searchResults.map(p => (
                <ChatPropertyCard
                  key={p.id}
                  property={p}
                  onBookViewing={handleBookViewing}
                  isCurrentProperty={p._isCurrentProperty}
                />
              ))}
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={handleSearchMore}
              >
                Refine search
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-xs"
                onClick={onClose}
              >
                Done for now
              </Button>
            </div>
          </div>
        );

      case 'book_viewing': {
        const isGroupOnly = viewingSlots?.groupViewingsOnly;
        const groupSlots = isGroupOnly ? viewingSlots?.slots : viewingSlots?.groupSlots;
        const hasGroupSlots = groupSlots && groupSlots.length > 0;

        return (
          <div className="space-y-2">
            {/* Group viewing slot picker */}
            {hasGroupSlots && (
              <div className="space-y-1.5">
                {isGroupOnly && <p className="text-xs text-gray-500 font-medium">Available group viewing slots:</p>}
                {!isGroupOnly && <p className="text-xs text-gray-500 font-medium">Join a group viewing:</p>}
                <div className="max-h-[140px] overflow-y-auto space-y-1">
                  {groupSlots.map((slot: any) => {
                    const dt = new Date(slot.startTime);
                    const dateStr = dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                    const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                    const selected = selectedGroupSlotId === slot.id;
                    return (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedGroupSlotId(selected ? null : slot.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                          selected ? 'border-[#791E75] bg-[#791E75]/10 text-[#791E75]' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="font-medium">{dateStr}</span> at <span className="font-medium">{timeStr}</span>
                        <span className="text-gray-400 ml-2">({slot.spotsLeft} spots left)</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Individual date/time picker (hidden when group-only) */}
            {!isGroupOnly && (
              <>
                {hasGroupSlots && <div className="text-xs text-gray-400 text-center">— or pick your own time —</div>}
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={viewingDate}
                    onChange={e => { setViewingDate(e.target.value); setSelectedGroupSlotId(null); }}
                    min={new Date().toISOString().split('T')[0]}
                    className="flex-1"
                  />
                  <Select value={viewingTime} onValueChange={(v) => { setViewingTime(v); setSelectedGroupSlotId(null); }}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="09:00">09:00</SelectItem>
                      <SelectItem value="10:00">10:00</SelectItem>
                      <SelectItem value="11:00">11:00</SelectItem>
                      <SelectItem value="12:00">12:00</SelectItem>
                      <SelectItem value="13:00">13:00</SelectItem>
                      <SelectItem value="14:00">14:00</SelectItem>
                      <SelectItem value="15:00">15:00</SelectItem>
                      <SelectItem value="16:00">16:00</SelectItem>
                      <SelectItem value="17:00">17:00</SelectItem>
                      <SelectItem value="18:00">18:00</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <Button
              onClick={handleConfirmViewing}
              disabled={isGroupOnly ? !selectedGroupSlotId : (!viewingDate && !selectedGroupSlotId)}
              className="w-full bg-[#791E75] hover:bg-[#631560]"
            >
              <Calendar className="h-4 w-4 mr-2" />
              {selectedGroupSlotId ? 'Join Group Viewing' : 'Confirm Viewing'}
            </Button>
          </div>
        );
      }

      case 'thank_you':
        return (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleSearchMore}
            >
              Search for more
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-[#791E75] hover:bg-[#631560]"
              onClick={onClose}
            >
              That's all, thanks!
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        {/* Header */}
        <div className="bg-[#791E75] text-white px-6 py-4">
          <SheetHeader>
            <SheetTitle className="text-white flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Property Enquiry
            </SheetTitle>
            <SheetDescription className="text-purple-200 text-xs">
              John Barclay Estate & Management
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {messages.map((msg, i) => renderMessage(msg, i))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t bg-white px-4 py-3">
          {renderInputArea()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
