import { Badge, Button } from '@org/ui';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Crown,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';

import { PLANS_CONFIG, normalizePlanTier, type PlanTier } from '@org/types';

export interface UpgradePlanBannerProps {
  totalMembers?: number;
  maxSeats?: number;
  currentPlan?: PlanTier | string;
  onUpgradeClick?: () => void;
  className?: string;
  variant?: 'card' | 'compact' | 'hero';
}

export function UpgradePlanBanner({
  totalMembers = 1,
  maxSeats = 5,
  currentPlan = 'free',
  onUpgradeClick,
  className = '',
  variant = 'hero',
}: UpgradePlanBannerProps) {
  const normalizedPlan = normalizePlanTier(currentPlan);
  const isPaid = normalizedPlan !== 'free';
  const effectiveMaxSeats = maxSeats === -1 ? 100 : maxSeats;
  const percentUsed = Math.min(
    100,
    Math.round((totalMembers / effectiveMaxSeats) * 100),
  );
  const seatsRemaining = Math.max(0, effectiveMaxSeats - totalMembers);
  const isNearLimit = percentUsed >= 80;

  if (isPaid) {
    const isEnterprise = normalizedPlan === 'enterprise';
    const isMax = normalizedPlan === 'max';
    const Icon = isEnterprise ? Crown : isMax ? Building2 : Sparkles;

    return (
      <div
        className={`p-5 relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-surface text-card-foreground shadow-xs ${className}`}
      >
        <div className="sm:flex-row sm:items-center gap-4 flex flex-col items-start justify-between">
          <div className="gap-3.5 flex items-center">
            <div className="size-11 flex shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary ring-1 ring-primary/30">
              <Icon className="size-5" />
            </div>
            <div>
              <div className="gap-2 flex items-center">
                <h3 className="text-sm font-semibold text-foreground">
                  {PLANS_CONFIG[normalizedPlan]?.name || 'Pro'} Plan Active
                </h3>
                <Badge variant="primary" className="font-bold text-2xs">
                  ACTIVE
                </Badge>
              </div>
              <p className="text-xs mt-0.5 text-muted-foreground">
                {isEnterprise
                  ? 'Your workspace has custom private LLM integration, dedicated support, and enterprise governance.'
                  : isMax
                    ? 'Your workspace has the highest usage quotas, advanced agent capabilities, audit logs and SSO.'
                    : 'Your workspace has expanded member seats, priority compute, and advanced project views.'}
              </p>
            </div>
          </div>
          {onUpgradeClick ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onUpgradeClick}
              className="text-xs font-medium shrink-0"
            >
              Manage Subscription
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={`sm:flex-row sm:items-center gap-3 p-3.5 text-xs flex flex-col items-start justify-between rounded-xl border border-border bg-surface-inset/60 ${className}`}
      >
        <div className="gap-2.5 flex items-center">
          <div className="size-8 flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </div>
          <div>
            <span className="font-medium text-foreground">Free Tier:</span>{' '}
            <span className="text-muted-foreground">
              {totalMembers} of {maxSeats} seats used ({seatsRemaining} left)
            </span>
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={onUpgradeClick}
          className="h-7 text-xs font-semibold px-3 shrink-0"
        >
          <Zap className="size-3.5 mr-1" />
          Upgrade to Pro
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`p-5 md:p-6 relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-surface to-surface-inset/80 shadow-xs transition-all ${className}`}
    >
      {/* Background ambient decoration */}
      <div
        className="-right-12 -top-12 size-48 blur-3xl pointer-events-none absolute rounded-full bg-primary/10"
        aria-hidden="true"
      />

      <div className="lg:flex-row lg:items-center gap-5 relative flex flex-col justify-between">
        <div className="space-y-3.5 max-w-xl">
          <div className="gap-2 flex flex-wrap items-center">
            <Badge
              variant="primary"
              className="gap-1.5 px-2.5 py-0.5 text-xs font-semibold"
            >
              <Sparkles className="size-3.5 text-primary-foreground" />
              UPGRADE YOUR WORKSPACE
            </Badge>
            {isNearLimit ? (
              <Badge variant="destructive" className="font-medium text-meta">
                Seat limit almost reached ({totalMembers}/{maxSeats})
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                Current: <strong className="text-foreground">Free</strong>
              </span>
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-base md:text-lg font-semibold tracking-tight text-foreground">
              Supercharge your team with unlimited projects & AI power
            </h3>
            <p className="text-xs md:text-sm leading-relaxed text-muted-foreground">
              Unlock unlimited projects, Gantt/Timeline views, AI agent builder,
              100GB cloud storage, and priority support.
            </p>
          </div>

          {/* Seat Quota Meter */}
          <div className="space-y-1.5 pt-1">
            <div className="text-xs flex items-center justify-between">
              <span className="gap-1.5 font-medium flex items-center text-foreground">
                <Users className="size-3.5 text-muted-foreground" />
                Member Seats Utilization
              </span>
              <span className="font-semibold text-foreground">
                {totalMembers} / {maxSeats} seats used
                <span className="font-normal ml-1 text-muted-foreground">
                  ({seatsRemaining} remaining)
                </span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isNearLimit ? 'bg-warning' : 'bg-primary'
                }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>

          {/* Benefit Chips */}
          <div className="gap-x-4 gap-y-1.5 text-xs pt-1 flex flex-wrap items-center text-muted-foreground">
            <div className="gap-1 flex items-center">
              <CheckCircle2 className="size-3.5 text-primary" />
              <span>Unlimited active projects</span>
            </div>
            <div className="gap-1 flex items-center">
              <CheckCircle2 className="size-3.5 text-primary" />
              <span>Timeline & Gantt views</span>
            </div>
            <div className="gap-1 flex items-center">
              <CheckCircle2 className="size-3.5 text-primary" />
              <span>10,000 monthly AI requests</span>
            </div>
          </div>
        </div>

        {/* CTA Button Block */}
        <div className="sm:flex-row lg:flex-col sm:items-center lg:items-end gap-2.5 flex shrink-0 flex-col items-stretch justify-center">
          <Button
            variant="primary"
            size="md"
            onClick={onUpgradeClick}
            className="font-semibold text-xs md:text-sm px-5 py-2.5 group shadow-md shadow-primary/20"
          >
            <Zap className="size-4 mr-1.5 fill-current" />
            <span>Upgrade to Pro — $12/mo</span>
            <ArrowRight className="size-4 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
          </Button>
          <span className="text-center text-meta text-muted-foreground">
            Cancel anytime · Save 20% on annual plans
          </span>
        </div>
      </div>
    </div>
  );
}
