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
import {
  PLANS_CONFIG,
  type PlanTier,
} from '@org/types';
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
  canManageBilling?: boolean;
  isLoading?: boolean;
  onSelectPlan: (tier: PlanTier) => void;
}

export function PricingCardSkeleton() {
  return (
    <Card className="flex flex-col justify-between border-border bg-card p-6 space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-6 w-24 rounded" />
        <Skeleton className="h-4 w-48 rounded" />
        <Skeleton className="h-10 w-32 rounded mt-4" />
      </div>
      <div className="space-y-3 flex-1">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-4 w-5/6 rounded" />
        <Skeleton className="h-4 w-2/3 rounded" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
    </Card>
  );
}

export function PricingCard({
  tier,
  isAnnual,
  isCurrent = false,
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
  const promo = plan.promotionalDisplay;
  const hasPromo = Boolean(promo && promo.discountPercent > 0);
  const displayPrice = hasPromo ? promo?.discountedMonthlyPrice ?? 0 : basePrice;

  return (
    <Card
      className={`relative flex flex-col justify-between overflow-hidden transition-all duration-300 ${
        isCurrent
          ? 'border-primary ring-2 ring-primary/20 shadow-md'
          : plan.isPopular
            ? 'border-primary/50 shadow-lg shadow-primary/5 dark:shadow-primary/10 ring-1 ring-primary/30'
            : 'border-border hover:border-border-hover hover:shadow-md'
      }`}
    >
      {/* Top Banner (Popular or Current) */}
      {isCurrent ? (
        <div className="absolute top-0 right-0 rounded-bl-lg bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-xs">
          Current Plan
        </div>
      ) : plan.isPopular ? (
        <div className="absolute top-0 right-0 rounded-bl-lg bg-gradient-to-r from-primary to-primary/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-xs">
          {plan.badgeText || 'Most Popular'}
        </div>
      ) : null}

      <CardHeader className="p-6 pb-4">
        {/* Tier Name & Tagline */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl font-bold tracking-tight text-foreground">
              {plan.name}
            </CardTitle>
            {plan.trialDays ? (
              <Badge
                variant="secondary"
                className="text-[10px] font-medium border border-primary/20 bg-primary/5 text-primary"
              >
                {plan.trialDays}-Day Free Trial
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
            {plan.tagline}
          </p>
        </div>

        {/* Pricing Display */}
        <div className="pt-4">
          {plan.isCustomQuote ? (
            <div className="space-y-1">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  Custom
                </span>
                <span className="text-xs text-muted-foreground">/ negotiated</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tailored for high-scale enterprise deployment
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  ${displayPrice}
                </span>
                <span className="text-xs text-muted-foreground">/ month</span>

                {hasPromo && (
                  <span className="text-sm line-through text-muted-foreground/70">
                    ${basePrice}
                  </span>
                )}
              </div>

              {/* Promo Callout Banner */}
              {hasPromo && promo && (
                <div className="mt-1 flex items-center gap-1.5">
                  <Badge
                    variant="primary"
                    className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  >
                    <Sparkles className="size-3 mr-1 inline" />
                    {promo.label}
                  </Badge>
                </div>
              )}

              {/* Annual vs Monthly note */}
              <p className="text-[11px] text-muted-foreground pt-0.5">
                {isAnnual
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
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface-muted/50 p-2">
            <Bot className="size-3.5 text-primary shrink-0" />
            <span className="font-semibold truncate">
              {plan.machineLimits.microAgents === -1
                ? 'Unlimited'
                : `${plan.machineLimits.microAgents}`}{' '}
              Micro Agents
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface-muted/50 p-2">
            <Cpu className="size-3.5 text-primary shrink-0" />
            <span className="font-semibold truncate">
              {plan.machineLimits.cpu === -1
                ? 'Custom'
                : `${plan.machineLimits.cpu} CPUs • ${plan.machineLimits.ramGb} GB RAM`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface-muted/50 p-2">
            <Zap className="size-3.5 text-primary shrink-0" />
            <span className="font-semibold truncate">
              {plan.machineLimits.requestsPerMonth === -1
                ? 'Unlimited'
                : `${(plan.machineLimits.requestsPerMonth / 1000).toLocaleString()}K`}{' '}
              Requests
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface-muted/50 p-2">
            <Sparkles className="size-3.5 text-primary shrink-0" />
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
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            What's included:
          </p>
          <ul className="space-y-2 text-xs">
            {plan.highlightedFeatures.map((feature, idx) => {
              const isExcluded =
                feature.toLowerCase().includes('not included') ||
                feature.toLowerCase().includes('unavailable');

              return (
                <li key={idx} className="flex items-start gap-2">
                  {isExcluded ? (
                    <Minus className="size-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
                  ) : (
                    <Check className="size-3.5 mt-0.5 shrink-0 text-emerald-500" />
                  )}
                  <span
                    className={`leading-snug ${
                      isExcluded ? 'text-muted-foreground/70' : 'text-foreground/90'
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
              className="flex items-center justify-between w-full text-xs font-medium text-primary hover:text-primary/80 transition-colors py-1"
            >
              <span>{isExpanded ? 'Hide plan specs' : 'Show full plan specs'}</span>
              {isExpanded ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>

            {isExpanded && (
              <div className="mt-3 space-y-3 text-xs bg-surface-muted/30 p-3 rounded-xl border border-border/60">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3" /> Log Retention
                    </span>
                    <span className="font-semibold text-foreground">
                      {plan.machineLimits.logRetentionDays === -1
                        ? '365 Days'
                        : `${plan.machineLimits.logRetentionDays} Days`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Database className="size-3" /> Network Transfer
                    </span>
                    <span className="font-semibold text-foreground">
                      {plan.machineLimits.networkTransferGb === -1
                        ? 'Custom'
                        : `${plan.machineLimits.networkTransferGb} GB`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Zap className="size-3" /> Concurrent Runs
                    </span>
                    <span className="font-semibold text-foreground">
                      {plan.machineLimits.concurrentExecutions === -1
                        ? 'Unlimited'
                        : `Up to ${plan.machineLimits.concurrentExecutions}`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
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
          className="w-full text-xs font-semibold h-10 shadow-xs"
        >
          {isCurrent ? (
            'Current Plan'
          ) : plan.isCustomQuote ? (
            'Talk to Sales'
          ) : (
            plan.ctaLabel || `Choose ${plan.name}`
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
