import { billingApi } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { buildBillingUrl, rememberBillingWorkspace } from './billing-link.js';
import { useStudioSession } from '../session-guard.js';

/**
 * The active workspace's plan, as the server reports it. This is the same
 * record the main app's billing page reads, so both apps always agree; the
 * query key is shared with the Usage tab so it is fetched once.
 */
export function useStudioPlan() {
  const { activeWorkspace } = useStudioSession();
  const query = useQuery({
    queryKey: ['workspace-billing', activeWorkspace.id],
    queryFn: () => billingApi.summary(activeWorkspace.id),
    staleTime: 30_000,
  });
  const summary = query.data;
  useEffect(() => {
    rememberBillingWorkspace(activeWorkspace.slug);
  }, [activeWorkspace.slug]);

  /** Billing lives in the main app (checkout, invoices); `returnTo` brings the user back here. */
  const billingUrl = (opts: { returnTo?: string; topUp?: boolean } = {}): string => {
    return buildBillingUrl(activeWorkspace.slug, opts);
  };

  const credits = summary?.creditAccount.balance ?? null;
  return {
    ...query,
    summary,
    plan: summary?.plan ?? null,
    planName: summary?.planConfig.name ?? null,
    canManageBilling: summary?.canManageBilling ?? false,
    credits,
    lowCredits: credits !== null && credits < 1,
    paymentsEnabled: summary?.paymentsEnabled ?? false,
    subscription: summary?.subscription ?? null,
    billingUrl,
  };
}
