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

  const isTrialing =
    billingSummary?.subscription?.status === 'TRIALING' ||
    billingSummary?.subscription?.trialStatus === 'ACTIVE';

  let trialDaysRemaining: number | null = null;
  if (billingSummary?.subscription?.trialEnd) {
    const end = new Date(billingSummary.subscription.trialEnd).getTime();
    const diff = end - Date.now();
    trialDaysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return {
    workspaceId,
    plan,
    planConfig,
    subscription: billingSummary?.subscription ?? null,
    creditAccount: billingSummary?.creditAccount ?? null,
    usage: billingSummary?.usage,
    entitlements: billingSummary?.entitlements,
    canManageBilling: isOwner || (billingSummary?.canManageBilling ?? false),
    activePromotion: billingSummary?.activePromotion ?? null,
    canUpgradeAgent: planConfig.machineLimits.agentUpgrades,
    microAgentLimit: planConfig.machineLimits.microAgents,
    microAgentsUsed: billingSummary?.usage?.microAgents?.used ?? 0,
    creditBalance: billingSummary?.creditAccount?.balance ?? 0,
    isTrialing,
    trialDaysRemaining,
    hasFeature,
    getLimit,
    isNearLimit,
    isLimitReached,
    isLoading,
    isError,
    refetch,
  };
}
