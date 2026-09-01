import { useQuery } from '@tanstack/react-query';
import { billingApi, queryKeys } from '@org/api-client';
import {
  PLANS_CONFIG,
  hasFeature as checkHasFeature,
  getPlanLimit as checkGetPlanLimit,
  normalizePlanTier,
  WorkspaceRole,
  type PlanFeature,
  type PlanLimit,
  type PlanTier,
} from '@org/types';
import { useCurrentWorkspace } from '../use-workspaces.js';

export function usePlanEntitlements(workspaceIdOverride?: string) {
  const { workspaceId: currentWorkspaceId, role } = useCurrentWorkspace();
  const workspaceId = workspaceIdOverride || currentWorkspaceId;
  const isOwner = role === WorkspaceRole.OWNER;

  const {
    data: billingSummary,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.billing.summary(workspaceId ?? ''),
    queryFn: () => billingApi.summary(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  const plan: PlanTier = normalizePlanTier(billingSummary?.plan ?? 'starter');
  const planConfig = PLANS_CONFIG[plan];

  const hasFeature = (feature: PlanFeature): boolean => {
    if (billingSummary?.entitlements) {
      return billingSummary.entitlements[feature] ?? false;
    }
    return checkHasFeature(plan, feature);
  };

  const getLimit = (limit: PlanLimit): number => {
    return checkGetPlanLimit(plan, limit);
  };

  const isNearLimit = (resource: string): boolean => {
    if (!billingSummary?.usage) return false;
    return (billingSummary.usage as any)[resource]?.isNearLimit ?? false;
  };

  const isLimitReached = (resource: string): boolean => {
    if (!billingSummary?.usage) return false;
    return (billingSummary.usage as any)[resource]?.isLimitReached ?? false;
  };

  return {
    workspaceId,
    plan,
    planConfig,
    subscription: billingSummary?.subscription ?? null,
    usage: billingSummary?.usage,
    entitlements: billingSummary?.entitlements,
    canManageBilling: isOwner || (billingSummary?.canManageBilling ?? false),
    hasFeature,
    getLimit,
    isNearLimit,
    isLimitReached,
    isLoading,
    isError,
    refetch,
  };
}
