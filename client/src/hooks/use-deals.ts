import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Types
export interface DealStep {
  id: number;
  dealId: number;
  stepId: string;
  name: string;
  agentType: string;
  status: string;
  isOptional: boolean;
  dependsOn: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  retryCount: number;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

export interface DealEvent {
  id: number;
  dealId: number;
  eventType: string;
  stepId: string | null;
  title: string;
  description: string | null;
  actor: string;
  actorType: string;
  payload: any;
  createdAt: string;
}

export interface Deal {
  id: number;
  dealType: string;
  propertyId: number | null;
  propertyAddress: string | null;
  tenancyId: number | null;
  landlordId: number | null;
  tenantId: number | null;
  pipelineTemplate: string;
  status: string;
  currentStepId: string | null;
  triggeredBy: string | null;
  triggeredByType: string | null;
  sourceEventId: string | null;
  pausedAt: string | null;
  pauseReason: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  completedAt: string | null;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

export interface DealWithDetails extends Deal {
  steps: DealStep[];
  events: DealEvent[];
}

// Queries
export function useDeals(filters?: { status?: string; dealType?: string; propertyId?: number }) {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== "all") params.set("status", filters.status);
  if (filters?.dealType && filters.dealType !== "all") params.set("dealType", filters.dealType);
  if (filters?.propertyId) params.set("propertyId", String(filters.propertyId));
  const qs = params.toString();
  const url = `/api/crm/deals${qs ? `?${qs}` : ""}`;

  return useQuery<Deal[]>({
    queryKey: [url],
  });
}

export function useDeal(id: number | string | undefined) {
  return useQuery<DealWithDetails>({
    queryKey: [`/api/crm/deals/${id}`],
    enabled: !!id,
  });
}

export function useDealEvents(id: number | string | undefined, limit?: number) {
  const params = limit ? `?limit=${limit}` : "";
  return useQuery<DealEvent[]>({
    queryKey: [`/api/crm/deals/${id}/events${params}`],
    enabled: !!id,
  });
}

// Mutations
export function usePauseDeal() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiRequest(`/api/crm/deals/${id}/pause`, "POST", { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
    },
  });
}

export function useResumeDeal() {
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiRequest(`/api/crm/deals/${id}/resume`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
    },
  });
}

export function useCancelDeal() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiRequest(`/api/crm/deals/${id}/cancel`, "POST", { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
    },
  });
}

export function useSkipStep() {
  return useMutation({
    mutationFn: ({ dealId, stepId }: { dealId: number; stepId: number }) =>
      apiRequest(`/api/crm/deals/${dealId}/steps/${stepId}/skip`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
    },
  });
}

export function useCompleteStep() {
  return useMutation({
    mutationFn: ({ dealId, stepId }: { dealId: number; stepId: number }) =>
      apiRequest(`/api/crm/deals/${dealId}/steps/${stepId}/complete`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
    },
  });
}
