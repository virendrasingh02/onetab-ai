import { Badge, Button } from '@org/ui';
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';


export interface UpgradePlanBannerProps {
  totalMembers?: number;
  maxSeats?: number;
  currentPlan?: 'starter' | 'pro' | 'enterprise';
  onUpgradeClick?: () => void;
  className?: string;
  variant?: 'card' | 'compact' | 'hero';
}

export function UpgradePlanBanner({
  totalMembers = 1,
  maxSeats = 5,
  currentPlan = 'starter',
  onUpgradeClick,
  className = '',
  variant = 'hero',
}: UpgradePlanBannerProps) {
  const percentUsed = Math.min(
    100,
    Math.round((totalMembers / maxSeats) * 100),
  );
  const seatsRemaining = Math.max(0, maxSeats - totalMembers);
  const isNearLimit = percentUsed >= 80;

  if (currentPlan === 'pro' || currentPlan === 'enterprise') {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-surface p-5 text-card-foreground shadow-sm ${className}`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary ring-1 ring-primary/30">
              <Crown className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {currentPlan === 'enterprise'
                    ? 'Enterprise Plan Active'
                    : 'Pro Team Plan Active'}
                </h3>
                <Badge variant="primary" className="text-[10px] font-bold">
                  ACTIVE
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your workspace has unlimited member seats, priority compute, and
                advanced multi-agent workflows.
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
        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-border bg-surface-inset/60 p-3.5 text-xs ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Sparkles className="size-4" />
          </div>
          <div>
            <span className="font-medium text-foreground">
              Free Starter Plan:
            </span>{' '}
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
      className={`relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-surface to-surface-inset/80 p-5 md:p-6 shadow-sm transition-all ${className}`}
    >
      {/* Background ambient decoration */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-primary/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-3.5 max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="primary"
              className="gap-1.5 px-2.5 py-0.5 text-xs font-semibold"
            >
              <Sparkles className="size-3.5 text-primary-foreground" />
              PRO PLAN UPGRADE
            </Badge>
            {isNearLimit ? (
              <Badge
                variant="destructive"
                className="text-[11px] font-medium"
              >
                Seat limit almost reached ({totalMembers}/{maxSeats})
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                Current: <strong className="text-foreground">Free Starter Tier</strong>
              </span>
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-base md:text-lg font-semibold tracking-tight text-foreground">
              Supercharge your team with unlimited members & AI agents
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              Unlock unlimited member seats, GPT-4o & Claude 3.5 Sonnet agent
              workflows, 500GB cloud storage, and granular channel permissions.
            </p>
          </div>

          {/* Seat Quota Meter */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Users className="size-3.5 text-muted-foreground" />
                Member Seats Utilization
              </span>
              <span className="font-semibold text-foreground">
                {totalMembers} / {maxSeats} seats used
                <span className="text-muted-foreground font-normal ml-1">
                  ({seatsRemaining} remaining)
                </span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  isNearLimit ? 'bg-amber-500' : 'bg-primary'
                }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>

          {/* Benefit Chips */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="size-3.5 text-primary" />
              <span>Unlimited team members</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="size-3.5 text-primary" />
              <span>Priority AI compute</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="size-3.5 text-primary" />
              <span>Export & Slack/Notion sync</span>
            </div>
          </div>
        </div>

        {/* CTA Button Block */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-center gap-2.5 shrink-0">
          <Button
            variant="primary"
            size="md"
            onClick={onUpgradeClick}
            className="font-semibold text-xs md:text-sm px-5 py-2.5 shadow-md shadow-primary/20 group"
          >
            <Zap className="size-4 mr-1.5 fill-current" />
            <span>Upgrade to Pro — $12/mo</span>
            <ArrowRight className="size-4 ml-1.5 transition-transform group-hover:translate-x-0.5" />
          </Button>
          <span className="text-center text-[11px] text-muted-foreground">
            Cancel anytime · 14-day free trial
          </span>
        </div>
      </div>
    </div>
  );
}
