import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Phone, PhoneIncoming, X, User, Building, Home,
  Mail, ExternalLink, Wrench,
} from 'lucide-react';
import { useLocation } from 'wouter';

interface CallerContact {
  entityType: string;
  entityId: number;
  name: string;
  email: string | null;
  phone: string;
  additionalInfo?: Record<string, any>;
}

interface InboundCallerPopupProps {
  /** The inbound phone number to look up */
  incomingPhone: string | null;
  /** Call this to dismiss the popup */
  onDismiss: () => void;
}

const entityIcons: Record<string, typeof User> = {
  tenant: Home,
  landlord: Building,
  lead: User,
};

const entityColors: Record<string, string> = {
  tenant: 'bg-blue-500',
  landlord: 'bg-purple-500',
  lead: 'bg-amber-500',
};

const entityPaths: Record<string, string> = {
  tenant: '/crm/tenants',
  landlord: '/crm/landlords',
  lead: '/crm/leads',
};

export function InboundCallerPopup({ incomingPhone, onDismiss }: InboundCallerPopupProps) {
  const [, setLocation] = useLocation();

  const { data: lookupResult } = useQuery<{ found: boolean; contacts: CallerContact[] }>({
    queryKey: ['/api/crm/communications/lookup-phone', incomingPhone],
    queryFn: async () => {
      const res = await fetch(`/api/crm/communications/lookup-phone/${encodeURIComponent(incomingPhone!)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Lookup failed');
      return res.json();
    },
    enabled: !!incomingPhone,
  });

  if (!incomingPhone || !lookupResult) return null;

  const { found, contacts } = lookupResult;

  return (
    <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 duration-300 w-80">
      <Card className="border-2 border-[#791E75] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 bg-[#791E75] text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <PhoneIncoming className="h-5 w-5 animate-pulse" />
            <span className="font-semibold text-sm">Incoming Call</span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-white hover:bg-white/20" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">{incomingPhone}</p>

          {!found ? (
            <div className="text-center py-3">
              <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Unknown Caller</p>
              <p className="text-xs text-muted-foreground">Not found in CRM</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 text-xs"
                onClick={() => {
                  setLocation(`/crm/leads?action=create&phone=${encodeURIComponent(incomingPhone)}`);
                  onDismiss();
                }}
              >
                Create Lead
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {contacts.map((contact, i) => {
                const Icon = entityIcons[contact.entityType] || User;
                const colorClass = entityColors[contact.entityType] || 'bg-gray-500';
                const detailPath = entityPaths[contact.entityType];

                return (
                  <div
                    key={`${contact.entityType}-${contact.entityId}`}
                    className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => {
                      if (detailPath) {
                        setLocation(`${detailPath}/${contact.entityId}`);
                        onDismiss();
                      }
                    }}
                  >
                    <div className={`${colorClass} rounded-full p-1.5 text-white`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{contact.name}</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1 capitalize">
                          {contact.entityType}
                        </Badge>
                      </div>
                      {contact.email && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3" /> {contact.email}
                        </p>
                      )}
                      {contact.additionalInfo?.status && (
                        <Badge variant="secondary" className="text-[10px] h-4 mt-1 capitalize">
                          {contact.additionalInfo.leadType}: {contact.additionalInfo.status}
                        </Badge>
                      )}
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground mt-1" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==========================================
// Hook for managing inbound call state
// ==========================================

export function useInboundCallPopup() {
  const [incomingPhone, setIncomingPhone] = useState<string | null>(null);

  const showCallerPopup = useCallback((phone: string) => {
    setIncomingPhone(phone);
  }, []);

  const dismissCallerPopup = useCallback(() => {
    setIncomingPhone(null);
  }, []);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    if (incomingPhone) {
      const timer = setTimeout(() => setIncomingPhone(null), 30000);
      return () => clearTimeout(timer);
    }
  }, [incomingPhone]);

  return { incomingPhone, showCallerPopup, dismissCallerPopup };
}
