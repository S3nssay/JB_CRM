import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useDeal,
  usePauseDeal,
  useResumeDeal,
  useCancelDeal,
  useSkipStep,
  useCompleteStep,
  type DealStep,
  type DealEvent,
} from "@/hooks/use-deals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, CheckCircle2, XCircle, SkipForward, Circle, Pause,
  Play, Ban, ArrowLeft, Bot, User, Cog, AlertTriangle,
  MessageSquare, Mail, GitBranch,
} from "lucide-react";

const EVENT_ICONS: Record<string, any> = {
  step_completed: CheckCircle2,
  step_failed: XCircle,
  agent_action: Bot,
  staff_override: User,
  escalation: AlertTriangle,
  message_sent: MessageSquare,
  email_sent: Mail,
};

const EVENT_COLORS: Record<string, string> = {
  step_completed: "text-green-600",
  step_failed: "text-red-600",
  agent_action: "text-blue-600",
  staff_override: "text-amber-600",
  escalation: "text-red-500",
  message_sent: "text-purple-600",
  email_sent: "text-purple-600",
};

const ACTOR_TYPE_COLORS: Record<string, string> = {
  agent: "bg-blue-100 text-blue-700",
  staff: "bg-amber-100 text-amber-700",
  system: "bg-gray-100 text-gray-600",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  paused: "bg-yellow-100 text-yellow-800",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  failed: "bg-red-200 text-red-800",
};

const DEAL_TYPE_COLORS: Record<string, string> = {
  letting: "bg-blue-100 text-blue-800",
  sale: "bg-green-100 text-green-800",
  renewal: "bg-amber-100 text-amber-800",
  end_of_tenancy: "bg-red-100 text-red-800",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case "in_progress":
      return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-red-600" />;
    case "skipped":
      return <SkipForward className="h-5 w-5 text-gray-400" />;
    default:
      return <Circle className="h-5 w-5 text-gray-300" />;
  }
}

export default function DealTimeline() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [reason, setReason] = useState("");

  const { data: dealData, isLoading } = useDeal(id);
  const pauseDeal = usePauseDeal();
  const resumeDeal = useResumeDeal();
  const cancelDeal = useCancelDeal();
  const skipStep = useSkipStep();
  const completeStep = useCompleteStep();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
      </div>
    );
  }

  if (!dealData) {
    return (
      <div className="text-center py-20">
        <h3 className="text-lg font-medium text-gray-600">Deal not found</h3>
        <Button variant="ghost" className="mt-4" onClick={() => setLocation("/crm/deals")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Deals
        </Button>
      </div>
    );
  }

  const { deal, steps, events } = dealData as any;
  const dealObj = deal || dealData;
  const dealSteps: DealStep[] = steps || dealObj.steps || [];
  const dealEvents: DealEvent[] = events || dealObj.events || [];

  const handlePause = () => {
    pauseDeal.mutate(
      { id: dealObj.id, reason },
      {
        onSuccess: () => {
          toast({ title: "Deal paused" });
          setPauseDialogOpen(false);
          setReason("");
        },
        onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleResume = () => {
    resumeDeal.mutate(
      { id: dealObj.id },
      {
        onSuccess: () => toast({ title: "Deal resumed" }),
        onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleCancel = () => {
    cancelDeal.mutate(
      { id: dealObj.id, reason },
      {
        onSuccess: () => {
          toast({ title: "Deal cancelled" });
          setCancelDialogOpen(false);
          setReason("");
        },
        onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleSkipStep = (stepId: number) => {
    skipStep.mutate(
      { dealId: dealObj.id, stepId },
      {
        onSuccess: () => toast({ title: "Step skipped" }),
        onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleCompleteStep = (stepId: number) => {
    completeStep.mutate(
      { dealId: dealObj.id, stepId },
      {
        onSuccess: () => toast({ title: "Step completed" }),
        onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/crm/deals")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Deals
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Badge className={DEAL_TYPE_COLORS[dealObj.dealType] || "bg-gray-100"}>
              {dealObj.dealType?.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline" className={STATUS_COLORS[dealObj.status] || ""}>
              {dealObj.status}
            </Badge>
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {dealObj.propertyAddress || `Deal #${dealObj.id}`}
          </h1>
          <p className="text-sm text-gray-500">Created {formatDate(dealObj.createdAt)}</p>
        </div>

        <div className="flex items-center gap-2">
          {dealObj.status === "active" && (
            <Button variant="outline" size="sm" onClick={() => setPauseDialogOpen(true)}>
              <Pause className="h-4 w-4 mr-1" /> Pause
            </Button>
          )}
          {dealObj.status === "paused" && (
            <Button variant="outline" size="sm" onClick={handleResume}>
              <Play className="h-4 w-4 mr-1" /> Resume
            </Button>
          )}
          {(dealObj.status === "active" || dealObj.status === "paused") && (
            <Button variant="destructive" size="sm" onClick={() => setCancelDialogOpen(true)}>
              <Ban className="h-4 w-4 mr-1" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Pipeline Steps */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-[#791E75]" /> Pipeline Steps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dealSteps.length === 0 && (
                <p className="text-sm text-gray-400">No steps recorded yet.</p>
              )}
              {dealSteps.map((step: DealStep) => (
                <div
                  key={step.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-white"
                >
                  <StepStatusIcon status={step.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{step.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {step.agentType}
                      </Badge>
                      {step.isOptional && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          optional
                        </Badge>
                      )}
                    </div>
                    {step.completedAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Completed {relativeTime(step.completedAt)}
                      </p>
                    )}
                    {step.startedAt && !step.completedAt && step.status === "in_progress" && (
                      <p className="text-xs text-blue-500 mt-0.5">
                        Started {relativeTime(step.startedAt)}
                      </p>
                    )}
                    {step.failureReason && (
                      <p className="text-xs text-red-500 mt-0.5">{step.failureReason}</p>
                    )}
                    {(step.status === "pending" || step.status === "in_progress" || step.status === "failed") && (
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => handleSkipStep(step.id)}
                          disabled={skipStep.isPending}
                        >
                          <SkipForward className="h-3 w-3 mr-1" /> Skip
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => handleCompleteStep(step.id)}
                          disabled={completeStep.isPending}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Event Timeline */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Cog className="h-4 w-4 text-[#791E75]" /> Event Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                {dealEvents.length === 0 && (
                  <p className="text-sm text-gray-400">No events recorded yet.</p>
                )}
                <div className="space-y-4">
                  {[...dealEvents].reverse().map((event: DealEvent, idx: number) => {
                    const Icon = EVENT_ICONS[event.eventType] || Cog;
                    const iconColor = EVENT_COLORS[event.eventType] || "text-gray-500";
                    return (
                      <div key={event.id || idx}>
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 ${iconColor}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-900">
                                {event.title}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${ACTOR_TYPE_COLORS[event.actorType] || ""}`}
                              >
                                {event.actorType}
                              </Badge>
                            </div>
                            {event.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{event.description}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">
                              {relativeTime(event.createdAt)}
                            </p>
                          </div>
                        </div>
                        {idx < dealEvents.length - 1 && <Separator className="mt-3" />}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pause Dialog */}
      <Dialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause Deal</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Reason for pausing (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePause} disabled={pauseDeal.isPending}>
              {pauseDeal.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Pause Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Deal</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to cancel this deal? This action cannot be undone.
          </p>
          <Textarea
            placeholder="Reason for cancelling"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Go Back
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelDeal.isPending}>
              {cancelDeal.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Cancel Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
