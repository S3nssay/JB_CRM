import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { X, Search, Loader2, Users, Home, Wrench } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CCRecipient {
  id: number;
  name: string;
  email: string;
  entity_type: 'landlord' | 'tenant' | 'contractor';
}

interface CCRecipientPickerProps {
  selectedRecipients: CCRecipient[];
  onRecipientsChange: (recipients: CCRecipient[]) => void;
}

// ── Sub-component: Recipient Search Tab ───────────────────────────────────────

function RecipientSearchTab({
  type,
  selected,
  onAdd,
}: {
  type: 'landlord' | 'tenant' | 'contractor';
  selected: CCRecipient[];
  onAdd: (recipient: CCRecipient) => void;
}) {
  const [search, setSearch] = useState('');

  const { data: results = [], isFetching } = useQuery<CCRecipient[]>({
    queryKey: ['/api/crm/cc-recipients', type, search],
    queryFn: async () => {
      const params = new URLSearchParams({ type, search });
      const resp = await fetch(`/api/crm/cc-recipients?${params.toString()}`, {
        credentials: 'include',
      });
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: true,
  });

  const selectedIds = new Set(selected.map((r) => r.id));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <Input
          placeholder={`Search ${type}s...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
        {isFetching && results.length === 0 ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          </div>
        ) : results.length === 0 ? (
          <div className="py-4 text-center text-xs text-gray-400">No {type}s found</div>
        ) : (
          results.map((r) => {
            const isSelected = selectedIds.has(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => !isSelected && onAdd(r)}
                disabled={isSelected}
                className={`w-full flex items-start gap-2 px-3 py-2 text-left transition-colors text-sm ${
                  isSelected
                    ? 'bg-gray-50 opacity-50 cursor-not-allowed'
                    : 'hover:bg-[#791E75]/5 cursor-pointer'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{r.name}</p>
                  <p className="text-xs text-gray-500 truncate">{r.email}</p>
                </div>
                {isSelected && (
                  <span className="text-[10px] text-[#791E75] font-medium mt-0.5 flex-shrink-0">Added</span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CCRecipientPicker({
  selectedRecipients,
  onRecipientsChange,
}: CCRecipientPickerProps) {
  function addRecipient(recipient: CCRecipient) {
    if (selectedRecipients.some((r) => r.id === recipient.id && r.entity_type === recipient.entity_type)) return;
    onRecipientsChange([...selectedRecipients, recipient]);
  }

  function removeRecipient(id: number, entity_type: string) {
    onRecipientsChange(
      selectedRecipients.filter((r) => !(r.id === id && r.entity_type === entity_type)),
    );
  }

  const entityTypeIcon = (type: string) => {
    switch (type) {
      case 'landlord': return <Home className="h-2.5 w-2.5" />;
      case 'tenant': return <Users className="h-2.5 w-2.5" />;
      case 'contractor': return <Wrench className="h-2.5 w-2.5" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-2">
      {/* Selected Chips */}
      {selectedRecipients.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg bg-gray-50 min-h-[40px]">
          {selectedRecipients.map((r) => (
            <Badge
              key={`${r.entity_type}-${r.id}`}
              variant="secondary"
              className="flex items-center gap-1 pr-1 text-[11px] max-w-[180px]"
            >
              <span className="text-gray-400">{entityTypeIcon(r.entity_type)}</span>
              <span className="truncate">{r.name}</span>
              <button
                type="button"
                onClick={() => removeRecipient(r.id, r.entity_type)}
                className="ml-0.5 rounded-full hover:bg-gray-300 p-0.5 flex-shrink-0"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {selectedRecipients.length === 0 && (
        <div className="p-2 border rounded-lg bg-gray-50 text-xs text-gray-400 min-h-[40px] flex items-center">
          No CC recipients added yet
        </div>
      )}

      {/* Search Tabs */}
      <Tabs defaultValue="landlord">
        <TabsList className="h-7 w-full">
          <TabsTrigger value="landlord" className="text-xs flex-1 h-6">
            <Home className="h-3 w-3 mr-1" />
            Landlords
          </TabsTrigger>
          <TabsTrigger value="tenant" className="text-xs flex-1 h-6">
            <Users className="h-3 w-3 mr-1" />
            Tenants
          </TabsTrigger>
          <TabsTrigger value="contractor" className="text-xs flex-1 h-6">
            <Wrench className="h-3 w-3 mr-1" />
            Contractors
          </TabsTrigger>
        </TabsList>
        <TabsContent value="landlord" className="mt-2">
          <RecipientSearchTab type="landlord" selected={selectedRecipients} onAdd={addRecipient} />
        </TabsContent>
        <TabsContent value="tenant" className="mt-2">
          <RecipientSearchTab type="tenant" selected={selectedRecipients} onAdd={addRecipient} />
        </TabsContent>
        <TabsContent value="contractor" className="mt-2">
          <RecipientSearchTab type="contractor" selected={selectedRecipients} onAdd={addRecipient} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
