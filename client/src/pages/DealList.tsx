import { useState } from "react";
import { useLocation } from "wouter";
import { useDeals, type Deal } from "@/hooks/use-deals";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Building2, GitBranch } from "lucide-react";

const DEAL_TYPE_COLORS: Record<string, string> = {
  letting: "bg-blue-100 text-blue-800",
  sale: "bg-green-100 text-green-800",
  renewal: "bg-amber-100 text-amber-800",
  end_of_tenancy: "bg-red-100 text-red-800",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  paused: "bg-yellow-100 text-yellow-800",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  failed: "bg-red-200 text-red-800",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function DealList() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: deals, isLoading } = useDeals({
    status: statusFilter,
    dealType: typeFilter,
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <GitBranch className="h-7 w-7 text-[#791E75]" />
        <h1 className="text-2xl font-bold text-gray-900">Deal Pipelines</h1>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Deal Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Deal Types</SelectItem>
            <SelectItem value="letting">Letting</SelectItem>
            <SelectItem value="sale">Sale</SelectItem>
            <SelectItem value="renewal">Renewal</SelectItem>
            <SelectItem value="end_of_tenancy">End of Tenancy</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!deals || deals.length === 0) && (
        <div className="text-center py-20">
          <GitBranch className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-1">No deals found</h3>
          <p className="text-sm text-gray-400">
            Deals will appear here as pipeline automations are triggered.
          </p>
        </div>
      )}

      {/* Deal Cards Grid */}
      {!isLoading && deals && deals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((deal: Deal) => {
            const meta = deal.metadata || {};
            const totalSteps = meta.totalSteps || 0;
            const completedSteps = meta.completedSteps || 0;
            const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

            return (
              <Card
                key={deal.id}
                className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                style={{ borderLeftColor: deal.status === "active" ? "#791E75" : "#d1d5db" }}
                onClick={() => setLocation(`/crm/deals/${deal.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Badge className={DEAL_TYPE_COLORS[deal.dealType] || "bg-gray-100 text-gray-800"}>
                      {deal.dealType.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="outline" className={STATUS_COLORS[deal.status] || ""}>
                      {deal.status}
                    </Badge>
                  </div>

                  <div className="flex items-start gap-2 mb-3">
                    <Building2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">
                      {deal.propertyAddress || `Deal #${deal.id}`}
                    </p>
                  </div>

                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{completedSteps}/{totalSteps} steps complete</span>
                      <span>{progressPct}%</span>
                    </div>
                    <Progress value={progressPct} className="h-2" />
                  </div>

                  <p className="text-xs text-gray-400 mt-2">
                    Created {formatDate(deal.createdAt)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
