import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Separator,
  Skeleton,
} from '@org/ui';
import { PLANS_CONFIG, PLAN_HIERARCHY, type PlanTier } from '@org/types';
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  Database,
  Minus,
  Sparkles,
  Zap,
} from 'lucide-react';

export interface PricingCardProps {
  tier: PlanTier;
  isAnnual: boolean;
  isCurrent?: boolean;
  /** The workspace's current plan, so lower tiers read "Downgrade" rather than "Choose". */
  currentTier?: PlanTier;
  canManageBilling?: boolean;
  isLoading?: boolean;
  onSelectPlan: (tier: PlanTier) => void;
}

export function PricingCardSkeleton() {
  return (
    <Card className="p-6 space-y-6 flex flex-col justify-between border-border bg-card">
      <div className="space-y-3">
        <Skeleton className="h-6 w-24 rounded" />
        <Skeleton className="h-4 w-48 rounded" />
        <Skeleton className="h-10 w-32 rounded mt-4" />
      </div>
      <div className="space-y-3 flex-1">
        <Skeleton className="h-4 rounded w-full" />
        <Skeleton className="h-4 rounded w-3/4" />
        <Skeleton className="h-4 rounded w-5/6" />
        <Skeleton className="h-4 rounded w-2/3" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
    </Card>
  );
}

export function PricingCard({
  tier,
  isAnnual,
  isCurrent = false,
  currentTier,
  canManageBilling = true,
  isLoading = false,
  onSelectPlan,
}: PricingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const plan = PLANS_CONFIG[tier];

  if (isLoading) {
    return <PricingCardSkeleton />;
  }

  const basePrice = isAnnual ? plan.pricing.annual : plan.pricing.monthly;
  const displayPrice = basePrice;
  const isDowngrade =
    !!currentTier && PLAN_HIERARCHY[tier] < PLAN_HIERARCHY[currentTier];

  return (
    <Card
      className={`relative flex flex-col justify-between overflow-hidden transition-all duration-300 ${
        isCurrent
          ? 'border-primary shadow-md ring-2 ring-primary/20'
          : plan.isPopular
            ? 'border-primary/50 shadow-lg ring-1 shadow-primary/5 ring-primary/30 dark:shadow-primary/10'
            : 'hover:border-border-hover border-border hover:shadow-md'
      }`}
    >
      {/* Top Banner (Popular or Current) */}
      {isCurrent ? (
        <div className="top-0 right-0 px-3 py-1 font-bold tracking-wider absolute rounded-bl-lg bg-primary text-2xs text-primary-foreground uppercase shadow-xs">
          Current Plan
        </div>
      ) : plan.isPopular ? (
        <div className="top-0 right-0 px-3 py-1 font-bold tracking-wider absolute rounded-bl-lg bg-gradient-to-r from-primary to-primary/80 text-2xs text-primary-foreground uppercase shadow-xs">
          {plan.badgeText || 'Most Popular'}
        </div>
      ) : null}

      <CardHeader className="p-6 pb-4">
        {/* Tier Name & Tagline */}
        <div className="space-y-1.5">
          <div className="gap-2 flex items-center">
            <CardTitle className="text-xl font-bold tracking-tight text-foreground">
              {plan.name}
            </CardTitle>
            {plan.trialDays ? (
              <Badge
                variant="secondary"
                className="font-medium border border-brand/20 bg-brand/5 text-2xs text-brand-text"
              >
                {plan.trialDays}-Day Free Trial
              </Badge>
            ) : null}
          </div>
          <p className="text-xs line-clamp-2 min-h-[32px] text-muted-foreground">
            {plan.tagline}
          </p>
        </div>

        {/* Pricing Display */}
        <div className="pt-4">
          {plan.isCustomQuote ? (
            <div className="space-y-1">
              <div className="gap-1 flex items-baseline">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  Custom
                </span>
                <span className="text-xs text-muted-foreground">
                  / negotiated
                </span>
              </div>
              <p className="text-meta text-muted-foreground">
                Tailored for high-scale enterprise deployment
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="gap-2 flex items-baseline">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  ${displayPrice}
                </span>
                <span className="text-xs text-muted-foreground">/ month</span>
              </div>

              {/* Annual vs Monthly note */}
              <p className="pt-0.5 text-meta text-muted-foreground">
                {plan.pricing.monthly === 0
                  ? 'Free forever, no card required'
                  : isAnnual
                    ? `Billed annually ($${plan.pricing.annual * 12}/yr)`
                    : 'Billed monthly, cancel anytime'}
              </p>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6 pt-0 space-y-5 flex-1">
        <Separator className="bg-border/60" />

        {/* Core Specs Pills / Callouts */}
        <div className="gap-2 text-xs grid grid-cols-2">
          <div className="gap-1.5 p-2 flex items-center rounded-lg border border-border/80 bg-surface-muted/50">
            <Bot className="size-3.5 shrink-0 text-primary" />
            <span className="font-semibold truncate">
              {plan.machineLimits.microAgents === -1
                ? 'Unlimited'
                : `${plan.machineLimits.microAgents}`}{' '}
              Micro Agents
            </span>
          </div>

          <div className="gap-1.5 p-2 flex items-center rounded-lg border border-border/80 bg-surface-muted/50">
            <Cpu className="size-3.5 shrink-0 text-primary" />
            <span className="font-semibold truncate">
              {plan.machineLimits.cpu === -1
                ? 'Custom'
                : `${plan.machineLimits.cpu} CPUs • ${plan.machineLimits.ramGb} GB RAM`}
            </span>
          </div>

          <div className="gap-1.5 p-2 flex items-center rounded-lg border border-border/80 bg-surface-muted/50">
            <Zap className="size-3.5 shrink-0 text-primary" />
            <span className="font-semibold truncate">
              {plan.machineLimits.requestsPerMonth === -1
                ? 'Unlimited'
                : `${(plan.machineLimits.requestsPerMonth / 1000).toLocaleString()}K`}{' '}
              Requests
            </span>
          </div>

          <div className="gap-1.5 p-2 flex items-center rounded-lg border border-border/80 bg-surface-muted/50">
            <Sparkles className="size-3.5 shrink-0 text-primary" />
            <span className="font-semibold truncate">
              {plan.machineLimits.aiCreditsUsd === -1
                ? 'Custom'
                : `$${plan.machineLimits.aiCreditsUsd}`}{' '}
              AI Credits
            </span>
          </div>
        </div>

        {/* Highlighted Key Features */}
        <div className="space-y-2.5">
          <p className="font-bold tracking-wider text-meta text-muted-foreground uppercase">
            What's included:
          </p>
          <ul className="space-y-2 text-xs">
            {plan.highlightedFeatures.map((feature, idx) => {
              const isExcluded =
                feature.toLowerCase().includes('not included') ||
                feature.toLowerCase().includes('unavailable');

              return (
                <li key={idx} className="gap-2 flex items-start">
                  {isExcluded ? (
                    <Minus className="size-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
                  ) : (
                    <Check className="size-3.5 mt-0.5 shrink-0 text-success-text" />
                  )}
                  <span
                    className={`leading-snug ${
                      isExcluded
                        ? 'text-muted-foreground/70'
                        : 'text-foreground/90'
                    }`}
                  >
                    {feature}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Expandable Feature Details */}
        {plan.expandedFeatures && plan.expandedFeatures.length > 0 && (
          <div className="pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs font-medium py-1 flex w-full items-center justify-between text-primary transition-colors hover:text-primary/80"
            >
              <span>
                {isExpanded ? 'Hide plan specs' : 'Show full plan specs'}
              </span>
              {isExpanded ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>

            {isExpanded && (
              <div className="mt-3 space-y-3 text-xs p-3 rounded-xl border border-border/60 bg-surface-muted/30">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="gap-1.5 flex items-center">
                      <Clock className="size-3" /> Log Retention
                    </span>
                    <span className="font-semibold text-foreground">
                      {plan.machineLimits.logRetentionDays === -1
                        ? '365 Days'
                        : `${plan.machineLimits.logRetentionDays} Days`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="gap-1.5 flex items-center">
                      <Database className="size-3" /> Network Transfer
                    </span>
                    <span className="font-semibold text-foreground">
                      {plan.machineLimits.networkTransferGb === -1
                        ? 'Custom'
                        : `${plan.machineLimits.networkTransferGb} GB`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="gap-1.5 flex items-center">
                      <Zap className="size-3" /> Concurrent Runs
                    </span>
                    <span className="font-semibold text-foreground">
                      {plan.machineLimits.concurrentExecutions === -1
                        ? 'Unlimited'
                        : `Up to ${plan.machineLimits.concurrentExecutions}`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="gap-1.5 flex items-center">
                      <Clock className="size-3" /> Max Runtime Limit
                    </span>
                    <span className="font-semibold text-foreground">
                      {plan.machineLimits.maxExecutionTimeMs === -1
                        ? 'Extended'
                        : `${plan.machineLimits.maxExecutionTimeMs}ms`}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="p-6 pt-0">
        <Button
          variant={
            isCurrent
              ? 'outline'
              : plan.isPopular
                ? 'primary'
                : plan.isCustomQuote
                  ? 'secondary'
                  : 'primary'
          }
          size="md"
          disabled={isCurrent || !canManageBilling}
          onClick={() => onSelectPlan(tier)}
          className="text-xs font-semibold h-10 w-full shadow-xs"
        >
          {isCurrent
            ? 'Current Plan'
            : plan.isCustomQuote
              ? 'Talk to Sales'
              : isDowngrade
                ? `Downgrade to ${plan.name}`
                : plan.ctaLabel || `Choose ${plan.name}`}
        </Button>
      </CardFooter>
    </Card>
  );
}
