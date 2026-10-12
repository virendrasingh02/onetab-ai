import { ApiError, billingApi } from '@org/api-client';
import type { ResourceUsageMetric } from '@org/types';
import { Badge, Button, ErrorState, LoadingState, UsageMeter } from '@org/ui';
import { useQuery } from '@tanstack/react-query';
import { Bot, ExternalLink, Gauge, Layers, Workflow } from 'lucide-react';
import { WEB_APP_URL } from '../../auth-redirect.js';
import { useStudioSession } from '../../session-guard.js';

const errorText = (err: unknown): string =>
  err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong.';

/** Plan, credit balance and what has been used, straight from the workspace's billing record. */
export function UsageTab() {
  const { activeWorkspace } = useStudioSession();
  const query = useQuery({
    queryKey: ['workspace-billing', activeWorkspace.id],
    queryFn: () => billingApi.summary(activeWorkspace.id),
  });

  if (query.isLoading) return <LoadingState label="Loading usage…" />;
  if (query.isError || !query.data) {
    return <ErrorState title="Couldn’t load usage" description={errorText(query.error)} onRetry={() => void query.refetch()} />;
  }

  const { plan, creditAccount, usage, canManageBilling } = query.data;
  const meters: Array<{ metric: ResourceUsageMetric; icon: typeof Bot }> = [
    { metric: usage.aiRequests, icon: Gauge },
    { metric: usage.microAgents, icon: Bot },
    { metric: usage.automations, icon: Workflow },
    { metric: usage.concurrentExecutions, icon: Layers },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Usage & credits</h3>
          <p className="text-xs text-muted-foreground">What {activeWorkspace.name} has used on its current plan.</p>
        </div>
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
          <a href={`${WEB_APP_URL}/w/${activeWorkspace.slug}/settings/billing`}>
            {canManageBilling ? 'Manage plan & credits' : 'View billing'} <ExternalLink className="size-3" />
          </a>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs text-muted-foreground">Plan</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xl font-bold capitalize text-foreground">{String(plan).toLowerCase()}</span>
            <Badge variant="outline" className="text-[10px]">
              current
            </Badge>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs text-muted-foreground">Credit balance</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {creditAccount.balance.toLocaleString(undefined, { style: 'currency', currency: creditAccount.currency || 'USD' })}
          </div>
          <div className="text-[11px] text-muted-foreground">Updated {new Date(creditAccount.updatedAt).toLocaleString()}</div>
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
