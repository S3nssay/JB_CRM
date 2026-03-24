import { useDeals, type Deal } from "@/hooks/use-deals";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { GitBranch, ExternalLink } from "lucide-react";

const DEAL_TYPE_COLORS: Record<string, string> = {
  letting: "bg-blue-100 text-blue-800",
  sale: "bg-green-100 text-green-800",
  renewal: "bg-amber-100 text-amber-800",
  end_of_tenancy: "bg-red-100 text-red-800",
};

interface DealTimelineWidgetProps {
  propertyId: number;
}

export default function DealTimelineWidget({ propertyId }: DealTimelineWidgetProps) {
  const [, setLocation] = useLocation();
  const { data: deals } = useDeals({ propertyId });

  const activeDeals = (deals || []).filter(
    (d: Deal) => d.status === "active" || d.status === "paused"
  );

  if (activeDeals.length === 0) {
    return null;
  }

  const displayDeals = activeDeals.slice(0, 3);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-[#791E75]" />
          Active Deals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayDeals.map((deal: Deal) => {
          const meta = deal.metadata || {};
          const totalSteps = meta.totalSteps || 0;
          const completedSteps = meta.completedSteps || 0;
          const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

          return (
            <div key={deal.id} className="flex items-center gap-3">
              <Badge className={`text-[10px] ${DEAL_TYPE_COLORS[deal.dealType] || "bg-gray-100"}`}>
                {deal.dealType.replace(/_/g, " ")}
              </Badge>
              <div className="flex-1">
                <Progress value={progressPct} className="h-1.5" />
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {completedSteps}/{totalSteps} steps
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setLocation(`/crm/deals/${deal.id}`)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}

        {activeDeals.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-[#791E75]"
            onClick={() => setLocation(`/crm/deals?propertyId=${propertyId}`)}
          >
            View all {activeDeals.length} deals
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
