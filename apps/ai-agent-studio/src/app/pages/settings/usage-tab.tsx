import { ApiError } from '@org/api-client';
import type { ResourceUsageMetric } from '@org/types';
import { Alert, AlertDescription, AlertTitle, Button, ErrorState, LoadingState, UsageMeter } from '@org/ui';
import { AlertTriangle, Bot, Calendar, Coins, ExternalLink, Gauge, Layers, Workflow } from 'lucide-react';
import { useStudioPlan } from '../../plan/use-studio-plan.js';
import { useStudioSession } from '../../session-guard.js';

const errorText = (err: unknown): string =>
  err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong.';

/**
 * Plan, credits and usage for the active workspace — the same server record as
 * the main app's billing page. Changing the plan happens there (checkout,
 * invoices, payment methods); every link here returns to this tab afterwards.
 */
export function UsageTab() {
  const { activeWorkspace } = useStudioSession();
  const { summary, subscription, planName, plan, canManageBilling, lowCredits, paymentsEnabled, billingUrl, isLoading, isError, error, refetch } =
    useStudioPlan();

  if (isLoading) return <LoadingState label="Loading usage…" />;
  if (isError || !summary) {
    return <ErrorState title="Couldn’t load usage" description={errorText(error)} onRetry={() => void refetch()} />;
  }

  const { creditAccount, usage, planConfig } = summary;
  const meters: Array<{ metric: ResourceUsageMetric; icon: typeof Bot }> = [
    { metric: usage.microAgents, icon: Bot },
    { metric: usage.automations, icon: Workflow },
    { metric: usage.aiRequests, icon: Gauge },
    { metric: usage.concurrentExecutions, icon: Layers },
  ];
  const atLimit = meters.filter((m) => m.metric.isLimitReached);
  const nearLimit = meters.filter((m) => !m.metric.isLimitReached && m.metric.isNearLimit);
  const pastDue = subscription?.status === 'PAST_DUE' || subscription?.status === 'UNPAID';
  const endsOn = subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : null;
  const pending = subscription?.cancelAtPeriodEnd
    ? 'Cancels'
    : subscription?.scheduledPlanTier && subscription.scheduledPlanTier !== 'free'
      ? `Moves to ${subscription.scheduledPlanTier.toUpperCase()}`
      : null;
  const upgradeLabel = plan === 'free' ? 'Upgrade plan' : 'Manage plan & billing';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Usage & credits</h3>
          <p className="text-xs text-muted-foreground">What {activeWorkspace.name} has used on its current plan.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageBilling ? (
            <Button size="sm" asChild className="gap-1.5 text-xs">
              <a href={billingUrl({ topUp: true })}>
                <Coins className="size-3" /> Top up credits
              </a>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
            <a href={billingUrl()}>
              {canManageBilling ? upgradeLabel : 'View plans'} <ExternalLink className="size-3" />
            </a>
          </Button>
        </div>
      </div>

      {pastDue ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertTitle>Your last payment failed</AlertTitle>
          <AlertDescription>
            {canManageBilling
              ? 'Update the payment method in billing to keep your plan. Paid features pause if payment isn’t received during the grace period.'
              : 'Ask a workspace owner or admin to update the payment method.'}
          </AlertDescription>
        </Alert>
      ) : null}

      {atLimit.length > 0 ? (
        <Alert variant="warning">
          <AlertTriangle aria-hidden />
          <AlertTitle>
            {atLimit.length === 1 ? `${atLimit[0].metric.label} limit reached` : `${atLimit.length} limits reached`}
          </AlertTitle>
          <AlertDescription>
            {atLimit.map((m) => `${m.metric.label}: ${m.metric.used} of ${m.metric.limit}`).join(' · ')}. New agents or runs
            that need more are blocked until you {canManageBilling ? 'upgrade' : 'ask an admin to upgrade'} or free some up.
          </AlertDescription>
        </Alert>
      ) : nearLimit.length > 0 ? (
        <Alert variant="info">
          <AlertTitle>Getting close to your limits</AlertTitle>
          <AlertDescription>{nearLimit.map((m) => `${m.metric.label} (${m.metric.percentage}%)`).join(' · ')}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs text-muted-foreground">Plan</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-xl font-bold text-foreground">{planName}</span>
          </div>
          {plan !== 'free' && endsOn ? (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="size-3" aria-hidden />
              {pending ? `${pending} on ${endsOn}` : subscription?.source === 'PROMOTION' ? `Coupon plan ends ${endsOn}` : `Renews ${endsOn}`}
            </div>
          ) : (
            <div className="mt-1 text-[11px] text-muted-foreground">{planConfig.tagline}</div>
          )}
          {!paymentsEnabled && canManageBilling ? (
            <div className="mt-2 text-[11px] text-muted-foreground">Online payments aren’t enabled on this deployment yet.</div>
          ) : null}
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs text-muted-foreground">Credit balance</div>
          <div className={`mt-1 text-xl font-bold tabular-nums ${lowCredits ? 'text-warning-text' : 'text-foreground'}`}>
            {creditAccount.balance.toLocaleString(undefined, { style: 'currency', currency: creditAccount.currency || 'USD' })}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {lowCredits ? 'Running low — runs stop at $0. ' : ''}
            {planConfig.machineLimits.aiCreditsUsd > 0 ? `${planName} includes $${planConfig.machineLimits.aiCreditsUsd} per period.` : 'Custom allowance.'}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {meters.map(({ metric, icon }) => (
          <UsageMeter key={metric.label} metric={metric} icon={icon} showUpgradeButton={false} />
        ))}
      </div>

      {creditAccount.transactions?.length ? (
        <section aria-labelledby="recent-credits" className="space-y-2">
          <h4 id="recent-credits" className="text-xs font-semibold text-foreground">
            Recent credit activity
          </h4>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface text-xs">
            {creditAccount.transactions.slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="min-w-0 truncate text-foreground">{t.description}</span>
                <span className="flex shrink-0 items-center gap-3 tabular-nums">
                  <span className={t.amount < 0 ? 'text-destructive' : 'text-success'}>
                    {t.amount > 0 ? '+' : ''}
                    {t.amount.toFixed(4)}
                  </span>
                  <span className="text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
