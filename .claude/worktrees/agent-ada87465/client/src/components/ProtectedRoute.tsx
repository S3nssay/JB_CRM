import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { usePermissions, SECURITY_CLEARANCE_LABELS } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Lock, ArrowLeft } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredClearance?: number;
  fallbackUrl?: string;
  featureKey?: string;
  showAccessDenied?: boolean;
}

/**
 * ProtectedRoute component for security clearance-based access control
 *
 * @param children - Content to render if access is granted
 * @param requiredClearance - Minimum clearance level required (1-10)
 * @param fallbackUrl - URL to redirect to if access denied (default: /crm/dashboard)
 * @param featureKey - Optional feature key for logging/tracking
 * @param showAccessDenied - Show access denied page instead of redirecting
 */
export function ProtectedRoute({
  children,
  requiredClearance = 3,
  fallbackUrl = '/crm/dashboard',
  featureKey,
  showAccessDenied = false
}: ProtectedRouteProps) {
  const { hasMinClearance, clearanceLevel, isLoading, user, getClearanceLabel } = usePermissions();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    // If not authenticated, redirect to login
    if (!user) {
      setLocation('/crm/login');
      return;
    }

    // Check clearance level
    if (!hasMinClearance(requiredClearance)) {
      if (!showAccessDenied) {
        toast({
          title: 'Access Denied',
          description: `This feature requires ${SECURITY_CLEARANCE_LABELS[requiredClearance] || `Level ${requiredClearance}`} clearance. Your current level: ${getClearanceLabel()}.`,
          variant: 'destructive'
        });
        setLocation(fallbackUrl);
      }
    }

    setHasChecked(true);
  }, [isLoading, user, hasMinClearance, requiredClearance, showAccessDenied, fallbackUrl, setLocation, toast, getClearanceLabel]);

  // Show loading state
  if (isLoading || !hasChecked) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return null; // Will redirect in useEffect
  }

  // Access denied - show page instead of redirecting
  if (!hasMinClearance(requiredClearance) && showAccessDenied) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-red-100 rounded-full w-fit">
              <Lock className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl">Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access this feature
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Required Clearance:</span>
                <span className="font-medium">{SECURITY_CLEARANCE_LABELS[requiredClearance] || `Level ${requiredClearance}`}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your Clearance:</span>
                <span className="font-medium">{getClearanceLabel()}</span>
              </div>
              {featureKey && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Feature:</span>
                  <span className="font-medium capitalize">{featureKey.replace(/_/g, ' ')}</span>
                </div>
              )}
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Contact your administrator if you believe you should have access to this feature.
            </p>

            <Button
              onClick={() => setLocation(fallbackUrl)}
              className="w-full"
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Access denied - redirect (handled in useEffect)
  if (!hasMinClearance(requiredClearance)) {
    return null;
  }

  // Access granted
  return <>{children}</>;
}

/**
 * Higher-order component for protecting routes
 */
export function withProtectedRoute<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredClearance: number = 3,
  options?: {
    fallbackUrl?: string;
    featureKey?: string;
    showAccessDenied?: boolean;
  }
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute
        requiredClearance={requiredClearance}
        fallbackUrl={options?.fallbackUrl}
        featureKey={options?.featureKey}
        showAccessDenied={options?.showAccessDenied}
      >
        <WrappedComponent {...props} />
      </ProtectedRoute>
    );
  };
}

/**
 * Component to conditionally render content based on clearance
 */
export function RequiresClearance({
  children,
  level,
  fallback = null
}: {
  children: ReactNode;
  level: number;
  fallback?: ReactNode;
}) {
  const { hasMinClearance, isLoading } = usePermissions();

  if (isLoading) return null;

  if (!hasMinClearance(level)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Badge component showing user's security clearance level
 */
export function ClearanceBadge({ className }: { className?: string }) {
  const { clearanceLevel, getClearanceLabel } = usePermissions();

  const getBadgeColor = (level: number) => {
    if (level >= 10) return 'bg-red-100 text-red-800 border-red-200';
    if (level >= 9) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (level >= 7) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (level >= 5) return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${getBadgeColor(clearanceLevel)} ${className}`}>
      <Shield className="h-3 w-3" />
      <span>{getClearanceLabel()}</span>
    </div>
  );
}
