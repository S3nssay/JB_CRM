import { useAuth } from './use-auth';
import { useQuery } from '@tanstack/react-query';
import { SECURITY_CLEARANCE_LEVELS, SECURITY_CLEARANCE_LABELS, DEFAULT_ACCESS_LEVEL_PERMISSIONS } from '@shared/schema';

/**
 * Hook for checking user permissions and security clearance levels
 */
export function usePermissions() {
  const { user, isLoading } = useAuth();

  // Fetch user's custom permissions (if any)
  const { data: userPermissions } = useQuery({
    queryKey: ['/api/crm/security/my-permissions'],
    queryFn: async () => {
      const res = await fetch('/api/crm/security/my-permissions', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user
  });

  /**
   * Check if user has at least the minimum required clearance level
   */
  const hasMinClearance = (requiredLevel: number): boolean => {
    if (!user) return false;
    return (user.securityClearance ?? 0) >= requiredLevel;
  };

  /**
   * Check if user is an admin (clearance level 10)
   */
  const isAdmin = (): boolean => {
    return user?.role === 'admin' || hasMinClearance(10);
  };

  /**
   * Check if user is branch manager or above (clearance level 9+)
   */
  const isBranchManagerOrAbove = (): boolean => {
    return hasMinClearance(9);
  };

  /**
   * Check if user is senior staff or above (clearance level 7+)
   */
  const isSeniorStaffOrAbove = (): boolean => {
    return hasMinClearance(7);
  };

  /**
   * Check if user is staff or above (clearance level 5+)
   */
  const isStaffOrAbove = (): boolean => {
    return hasMinClearance(5);
  };

  /**
   * Check if user can access a specific feature by its required clearance
   */
  const canAccessFeature = (requiredClearance: number): boolean => {
    return hasMinClearance(requiredClearance);
  };

  /**
   * Check if user has access to a specific feature key
   * Takes into account: base access level permissions and custom overrides
   */
  const hasFeatureAccess = (featureKey: string): boolean => {
    if (!user) return false;

    // Check custom permissions first (overrides)
    if (userPermissions?.customPermissions) {
      const customPerm = userPermissions.customPermissions.find(
        (p: { featureKey: string; accessGranted: boolean }) => p.featureKey === featureKey
      );
      if (customPerm) {
        return customPerm.accessGranted;
      }
    }

    // Check base access level permissions
    const accessLevelCode = userPermissions?.accessLevelCode || user.accessLevelCode;
    if (accessLevelCode) {
      const levelPermissions = DEFAULT_ACCESS_LEVEL_PERMISSIONS[accessLevelCode as keyof typeof DEFAULT_ACCESS_LEVEL_PERMISSIONS];
      if (levelPermissions) {
        return levelPermissions.includes(featureKey as any);
      }
    }

    // Fallback: check clearance level against feature's required clearance
    const featureClearance = FEATURE_CLEARANCE[featureKey as keyof typeof FEATURE_CLEARANCE];
    if (featureClearance) {
      return hasMinClearance(featureClearance);
    }

    // Admin always has access
    if (isAdmin()) return true;

    return false;
  };

  /**
   * Get the user's clearance level label
   */
  const getClearanceLabel = (): string => {
    if (!user) return 'Not Authenticated';
    const level = user.securityClearance ?? 0;
    return SECURITY_CLEARANCE_LABELS[level as keyof typeof SECURITY_CLEARANCE_LABELS] || `Level ${level}`;
  };

  /**
   * Get clearance level for a specific role
   */
  const getRoleClearance = (role: string): number => {
    return SECURITY_CLEARANCE_LEVELS[role as keyof typeof SECURITY_CLEARANCE_LEVELS] || 3;
  };

  return {
    user,
    isLoading,
    hasMinClearance,
    isAdmin,
    isBranchManagerOrAbove,
    isSeniorStaffOrAbove,
    isStaffOrAbove,
    canAccessFeature,
    hasFeatureAccess,
    getClearanceLabel,
    getRoleClearance,
    clearanceLevel: user?.securityClearance ?? 0,
    role: user?.role ?? 'guest',
    accessLevelCode: userPermissions?.accessLevelCode || user?.accessLevelCode
  };
}

// Export clearance level constants for convenience
export { SECURITY_CLEARANCE_LEVELS, SECURITY_CLEARANCE_LABELS };

// Feature clearance requirements (can be fetched from API for dynamic control)
export const FEATURE_CLEARANCE = {
  integrations: 9,
  security_matrix: 10,
  user_management: 10,
  role_management: 10,
  financial_reports: 9,
  staff_management: 7,
  property_management: 6,
  crm_dashboard: 5,
  maintenance_tickets: 5,
  portal_dashboard: 3
} as const;
