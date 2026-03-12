import { AlertTriangle, CheckCircle2, XCircle, AlertCircle, ExternalLink, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export type ComplianceSeverity = 'critical' | 'warning' | 'info';

export interface ComplianceItem {
  id: string;
  label: string;
  description: string;
  passed: boolean;
  severity: ComplianceSeverity;
  actionLabel?: string;
  actionStep?: string;
  legalReference?: string;
  penalty?: string;
}

interface ComplianceChecklistProps {
  title: string;
  subtitle?: string;
  items: ComplianceItem[];
  onNavigateToStep?: (step: string) => void;
  showSummary?: boolean;
  blockOnCritical?: boolean;
}

export function ComplianceChecklist({
  title,
  subtitle,
  items,
  onNavigateToStep,
  showSummary = true,
  blockOnCritical = false,
}: ComplianceChecklistProps) {
  const criticalItems = items.filter(i => i.severity === 'critical');
  const warningItems = items.filter(i => i.severity === 'warning');
  const infoItems = items.filter(i => i.severity === 'info');

  const criticalFailing = criticalItems.filter(i => !i.passed);
  const warningFailing = warningItems.filter(i => !i.passed);
  const totalPassed = items.filter(i => i.passed).length;
  const progressPercent = items.length > 0 ? Math.round((totalPassed / items.length) * 100) : 0;

  const hasCriticalFailures = criticalFailing.length > 0;

  return (
    <Card className={hasCriticalFailures ? 'border-red-300 dark:border-red-800' : warningFailing.length > 0 ? 'border-amber-300 dark:border-amber-800' : 'border-green-300 dark:border-green-800'}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasCriticalFailures ? (
              <XCircle className="h-5 w-5 text-red-500" />
            ) : warningFailing.length > 0 ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            <span>{title}</span>
          </div>
          <Badge variant={hasCriticalFailures ? 'destructive' : warningFailing.length > 0 ? 'secondary' : 'default'}>
            {totalPassed}/{items.length} passed
          </Badge>
        </CardTitle>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        {showSummary && <Progress value={progressPercent} className="h-2 mt-2" />}
      </CardHeader>
      <CardContent className="space-y-2">
        {hasCriticalFailures && blockOnCritical && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-3">
            <div className="flex gap-2">
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-200 text-sm">
                  Cannot proceed - {criticalFailing.length} critical compliance {criticalFailing.length === 1 ? 'failure' : 'failures'}
                </p>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                  All critical items must be resolved before this process can be completed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Critical items first */}
        {criticalItems.map(item => (
          <ComplianceRow key={item.id} item={item} onNavigateToStep={onNavigateToStep} />
        ))}

        {/* Warning items */}
        {warningItems.length > 0 && criticalItems.length > 0 && (
          <div className="border-t pt-2 mt-2" />
        )}
        {warningItems.map(item => (
          <ComplianceRow key={item.id} item={item} onNavigateToStep={onNavigateToStep} />
        ))}

        {/* Info items */}
        {infoItems.length > 0 && (warningItems.length > 0 || criticalItems.length > 0) && (
          <div className="border-t pt-2 mt-2" />
        )}
        {infoItems.map(item => (
          <ComplianceRow key={item.id} item={item} onNavigateToStep={onNavigateToStep} />
        ))}
      </CardContent>
    </Card>
  );
}

function ComplianceRow({ item, onNavigateToStep }: { item: ComplianceItem; onNavigateToStep?: (step: string) => void }) {
  const severityStyles = {
    critical: {
      bg: item.passed ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20',
      border: item.passed ? 'border-green-200' : 'border-red-200',
      icon: item.passed ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />,
    },
    warning: {
      bg: item.passed ? 'bg-green-50 dark:bg-green-950/20' : 'bg-amber-50 dark:bg-amber-950/20',
      border: item.passed ? 'border-green-200' : 'border-amber-200',
      icon: item.passed ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />,
    },
    info: {
      bg: item.passed ? 'bg-green-50 dark:bg-green-950/20' : 'bg-blue-50 dark:bg-blue-950/20',
      border: item.passed ? 'border-green-200' : 'border-blue-200',
      icon: item.passed ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-blue-500" />,
    },
  };

  const styles = severityStyles[item.severity];

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${styles.bg} ${styles.border}`}>
      <div className="mt-0.5 flex-shrink-0">{styles.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{item.label}</p>
          {item.severity === 'critical' && !item.passed && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">REQUIRED</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
        {!item.passed && item.penalty && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Penalty: {item.penalty}
          </p>
        )}
      </div>
      {!item.passed && item.actionStep && onNavigateToStep && (
        <Button
          variant="outline"
          size="sm"
          className="flex-shrink-0 text-xs"
          onClick={() => onNavigateToStep(item.actionStep!)}
        >
          {item.actionLabel || 'Fix'}
        </Button>
      )}
    </div>
  );
}

// Helper to check if a date string is expired
export function isExpired(dateStr: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

// Helper to check if a date expires within N days
export function expiresWithin(dateStr: string, days: number): boolean {
  if (!dateStr) return false;
  const expiryDate = new Date(dateStr);
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  return expiryDate <= futureDate;
}

// Helper to check EPC rating is E or above
export function isEpcRatingValid(rating: string): boolean {
  const validRatings = ['A', 'B', 'C', 'D', 'E'];
  return validRatings.includes(rating?.toUpperCase());
}
