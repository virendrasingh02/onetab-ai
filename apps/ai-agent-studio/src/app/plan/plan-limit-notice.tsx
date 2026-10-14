import { Alert, AlertDescription, AlertTitle, Button } from '@org/ui';
import { Coins, Gauge, Sparkles } from 'lucide-react';
import type { PlanLimitInfo } from './plan-limit.js';
import { useStudioPlan } from './use-studio-plan.js';

const TITLES: Record<PlanLimitInfo['kind'], string> = {
  plan: 'You’ve reached your plan limit',
  credits: 'You’re out of AI credits',
  trial: 'Your free trial has ended',
  execution: 'Too many runs at once',
};

/**
 * Explains a plan/credit refusal in place: which limit, what you have against
 * what's allowed, and the way to fix it. Billing happens in the main app, so
 * the action link carries a `returnTo` that brings the user back to this page.
 * Members who can't manage billing are told who can.
 */
export function PlanLimitNotice({ limit, className }: { limit: PlanLimitInfo; className?: string }) {
  const { planName, canManageBilling, billingUrl } = useStudioPlan();
  const wantsCredits = limit.kind === 'credits';
  const Icon = wantsCredits ? Coins : limit.kind === 'execution' ? Gauge : Sparkles;

  return (
    <Alert variant="warning" className={className}>
      <Icon aria-hidden />
      <AlertTitle>{TITLES[limit.kind]}</AlertTitle>
      <AlertDescription>
        <p>{limit.message}</p>
        {limit.limit !== undefined && limit.used !== undefined ? (
          <p className="mt-1 text-xs tabular-nums">
            In use: <strong>{limit.used}</strong> of <strong>{limit.limit}</strong>
            {planName ? ` on ${planName}` : ''}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {canManageBilling ? (
            <>
              <Button size="xs" asChild>
                <a href={billingUrl({ topUp: wantsCredits })}>{wantsCredits ? 'Top up credits' : 'Upgrade plan'}</a>
              </Button>
              {wantsCredits ? (
                <Button size="xs" variant="outline" asChild>
                  <a href={billingUrl()}>See plans</a>
                </Button>
              ) : null}
            </>
          ) : (
            <span className="text-xs">Ask a workspace owner or admin to change the plan.</span>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
