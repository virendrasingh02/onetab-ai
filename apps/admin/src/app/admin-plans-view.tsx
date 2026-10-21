import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminBillingApi } from '@org/api-client';
import { cn } from '@org/utils';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@org/ui';
import {
  PLAN_TIERS,
  PLANS_CONFIG,
  type PlanTier,
} from '@org/types';
import {
  AlertTriangle,
  Bot,
  Check,
  Coins,
  Cpu,
  Database,
  DollarSign,
  Layers,
  Minus,
  RefreshCw,
  Shield,
  Sparkles,
  Tag,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    cents / 100,
  );

export function AdminPlansView() {
  const [selectedTier, setSelectedTier] = useState<PlanTier>('free');

  const {
    data: stats,
    isLoading: isStatsLoading,
    refetch: refetchStats,
    isFetching: isStatsFetching,
  } = useQuery({
    queryKey: ['admin-billing', 'stats'],
    queryFn: () => adminBillingApi.stats(),
    staleTime: 30_000,
  });

  const selectedPlan = PLANS_CONFIG[selectedTier];

  const planSubscribersMap = new Map<string, number>();
  if (stats?.subscriptionsByPlan) {
    for (const item of stats.subscriptionsByPlan) {
      planSubscribersMap.set(item.plan.toLowerCase(), item.count);
    }
  }

  const totalSubscribers = stats?.subscriptionsByPlan
    ? stats.subscriptionsByPlan.reduce((acc, p) => acc + p.count, 0)
    : 0;

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Plans & Entitlements Management
            </h1>
            <Badge variant="primary" className="text-xs uppercase font-mono">
              Live Config
            </Badge>
            {isStatsFetching && (
              <RefreshCw className="size-3.5 text-primary animate-spin" />
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Platform-wide subscription tiers, machine resource quotas, promotional codes, and micro-agent allocations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchStats()}
            disabled={isStatsFetching}
            className="text-xs"
          >
            <RefreshCw className={cn('size-3.5 mr-1.5', isStatsFetching && 'animate-spin')} />
            Refresh Telemetry
          </Button>
          <Button asChild size="sm" className="text-xs">
            <Link to="/billing">Manage Subscriptions</Link>
          </Button>
        </div>
      </div>

      {/* Real Live Billing & Subscription Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 rounded-xl border border-border bg-card/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Paid Revenue (30d)</span>
            <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <DollarSign className="size-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-foreground mt-2">
            {isStatsLoading ? <Skeleton className="h-7 w-24" /> : formatCurrency(stats?.paidRevenueCents ?? 0)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {stats?.paidInvoiceCount ?? 0} settled invoices
          </p>
        </Card>

        <Card className="p-4 rounded-xl border border-border bg-card/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Estimated Platform MRR</span>
            <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <TrendingUp className="size-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-foreground mt-2">
            {isStatsLoading ? <Skeleton className="h-7 w-24" /> : formatCurrency(stats?.estimatedMrrCents ?? 0)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            {stats?.estimatedMrrNote || 'Recurring monthly revenue'}
          </p>
        </Card>

        <Card className="p-4 rounded-xl border border-border bg-card/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Active Workspaces</span>
            <div className="size-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Users className="size-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-foreground mt-2">
            {isStatsLoading ? <Skeleton className="h-7 w-16" /> : totalSubscribers.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Across {PLAN_TIERS.length} plan tiers
          </p>
        </Card>

        <Card className="p-4 rounded-xl border border-border bg-card/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Payment Health</span>
            <div className="size-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertTriangle className="size-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-foreground mt-2">
            {isStatsLoading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              `${stats?.failedPaymentSubscriptions ?? 0} At Risk`
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {stats?.trialConversionRate != null
              ? `${(stats.trialConversionRate * 100).toFixed(0)}% trial conversion`
              : 'Past due or unpaid invoices'}
          </p>
        </Card>
      </div>

      {/* Coupons moved to the persisted, audited billing console */}
      <Card className="border-border bg-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Tag className="size-5" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-foreground">Coupons & promotions</h3>
              <p className="text-xs text-muted-foreground">
                Create, edit, disable and audit coupons (including the DEMO test coupon) in Billing & Coupons.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="text-xs">
            <Link to="/billing">Open Billing & Coupons</Link>
          </Button>
        </div>
      </Card>

      {/* 4 Tiers Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLAN_TIERS.map((tier) => {
          const plan = PLANS_CONFIG[tier];
          const isSelected = selectedTier === tier;
          const subscriberCount = planSubscribersMap.get(tier.toLowerCase()) ?? 0;

          return (
            <Card
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`p-5 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                isSelected
                  ? 'border-primary ring-2 ring-primary/20 shadow-md bg-card'
                  : 'border-border hover:border-border-hover bg-card/60'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-foreground">
                    {plan.name}
                  </span>
                  {plan.isPopular && (
                    <Badge variant="primary" className="text-[9px] uppercase">
                      Popular
                    </Badge>
                  )}
                </div>

                <div>
                  <div className="text-2xl font-black text-foreground">
                    {plan.isCustomQuote
                      ? 'Custom'
                      : `$${plan.pricing.monthly}`}
                    {!plan.isCustomQuote && (
                      <span className="text-xs font-normal text-muted-foreground">
                        /mo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Annual: {plan.isCustomQuote ? 'Negotiated' : `$${plan.pricing.annual}/mo`}
                  </p>
                </div>

                {/* Real Live Subscribers count */}
                <div className="p-2 rounded-lg bg-surface-muted/50 border border-border/40 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Active Tenants:</span>
                  <span className="font-mono font-bold text-foreground">
                    {isStatsLoading ? '…' : `${subscriberCount} ${subscriberCount === 1 ? 'workspace' : 'workspaces'}`}
                  </span>
                </div>

                <div className="pt-2 border-t border-border/60 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between items-center">
                    <span>Micro Agents:</span>
                    <strong className="text-foreground">
                      {plan.machineLimits.microAgents === -1
                        ? 'Unlimited'
                        : plan.machineLimits.microAgents}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>AI Credits:</span>
                    <strong className="text-foreground">
                      {plan.machineLimits.aiCreditsUsd === -1
                        ? 'Custom'
                        : `$${plan.machineLimits.aiCreditsUsd}`}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  variant={isSelected ? 'primary' : 'outline'}
                  size="xs"
                  className="w-full text-xs"
                >
                  {isSelected ? 'Viewing Specification' : 'Inspect Entitlements'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Selected Tier Deep-Dive Details */}
      <Card className="border-border bg-card">
        <CardHeader className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Layers className="size-5 text-primary" />
                {selectedPlan.name} Specification & Quotas
              </CardTitle>
              <CardDescription className="text-xs">
                {selectedPlan.tagline}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              ID: {selectedPlan.id}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Machine Limits Grid */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Machine Resource Limits
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-border bg-surface-muted/40 space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Bot className="size-3.5 text-primary" /> Micro Agents
                </span>
                <p className="font-bold text-foreground text-sm">
                  {selectedPlan.machineLimits.microAgents === -1
                    ? 'Unlimited'
                    : `${selectedPlan.machineLimits.microAgents} Agents`}
                </p>
              </div>

              <div className="p-3 rounded-xl border border-border bg-surface-muted/40 space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Cpu className="size-3.5 text-primary" /> Compute
                </span>
                <p className="font-bold text-foreground text-sm">
                  {selectedPlan.machineLimits.cpu === -1
                    ? 'Custom'
                    : `${selectedPlan.machineLimits.cpu} CPUs • ${selectedPlan.machineLimits.ramGb} GB RAM`}
                </p>
              </div>

              <div className="p-3 rounded-xl border border-border bg-surface-muted/40 space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Zap className="size-3.5 text-primary" /> Monthly Requests
                </span>
                <p className="font-bold text-foreground text-sm">
                  {selectedPlan.machineLimits.requestsPerMonth === -1
                    ? 'Unlimited'
                    : `${selectedPlan.machineLimits.requestsPerMonth.toLocaleString()} Req`}
                </p>
              </div>

              <div className="p-3 rounded-xl border border-border bg-surface-muted/40 space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Coins className="size-3.5 text-primary" /> Shared AI Credits
                </span>
                <p className="font-bold text-foreground text-sm">
                  {selectedPlan.machineLimits.aiCreditsUsd === -1
                    ? 'Custom'
                    : `$${selectedPlan.machineLimits.aiCreditsUsd} / month`}
                </p>
              </div>

              <div className="p-3 rounded-xl border border-border bg-surface-muted/40 space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Database className="size-3.5 text-primary" /> Network Transfer
                </span>
                <p className="font-bold text-foreground text-sm">
                  {selectedPlan.machineLimits.networkTransferGb === -1
                    ? 'Custom'
                    : `${selectedPlan.machineLimits.networkTransferGb} GB`}
                </p>
              </div>

              <div className="p-3 rounded-xl border border-border bg-surface-muted/40 space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Shield className="size-3.5 text-primary" /> Log Retention
                </span>
                <p className="font-bold text-foreground text-sm">
                  {selectedPlan.machineLimits.logRetentionDays === -1
                    ? '365 Days'
                    : `${selectedPlan.machineLimits.logRetentionDays} Days`}
                </p>
              </div>

              <div className="p-3 rounded-xl border border-border bg-surface-muted/40 space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Zap className="size-3.5 text-primary" /> Max Runtime
                </span>
                <p className="font-bold text-foreground text-sm">
                  {selectedPlan.machineLimits.maxExecutionTimeMs === -1
                    ? 'Extended'
                    : `${selectedPlan.machineLimits.maxExecutionTimeMs}ms`}
                </p>
              </div>

              <div className="p-3 rounded-xl border border-border bg-surface-muted/40 space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" /> Agent Upgrades
                </span>
                <p className="font-bold text-foreground text-sm">
                  {selectedPlan.machineLimits.agentUpgrades
                    ? 'Available'
                    : 'Not Included'}
                </p>
              </div>
            </div>
          </div>

          {/* Highlighted & Expanded Features */}
          <div>
            <div className="rounded-2xl border border-border/60 bg-card shadow-2xs overflow-hidden">
              <div className="flex items-center justify-between gap-4 p-4 sm:px-5 sm:py-3.5 border-b border-border/40">
                <div>
                  <h4 className="text-sm font-semibold text-foreground tracking-tight">
                    Included Feature Capabilities
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Plan tier quotas, feature gates, and operational limits
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full border border-border/80 bg-muted/60 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-foreground">
                  {selectedPlan.expandedFeatures.length} Features
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border/40 hover:bg-transparent">
                    <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight">Category</TableHead>
                    <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight">Feature Name</TableHead>
                    <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight">Included</TableHead>
                    <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground/90 tracking-tight">Limit / Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPlan.expandedFeatures.map((feat) => (
                    <TableRow key={feat.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                      <TableCell className="py-3.5 px-5 font-semibold text-muted-foreground text-xs">
                        {feat.category}
                      </TableCell>
                      <TableCell className="py-3.5 px-5 font-medium text-foreground text-xs">
                        {feat.label}
                      </TableCell>
                      <TableCell className="py-3.5 px-5">
                        {feat.included ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-success/25 bg-success/15 text-success-text px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
                            <Check className="size-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 text-muted-foreground/60 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
                            <Minus className="size-3" />
                            No
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5 px-5 text-muted-foreground text-xs">
                        {feat.valueText || (feat.included ? 'Supported' : '—')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t border-border/40 px-5 py-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing{' '}
                  <span className="font-semibold text-foreground">
                    {selectedPlan.expandedFeatures.length > 0 ? 1 : 0}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold text-foreground">
                    {selectedPlan.expandedFeatures.length}
                  </span>{' '}
                  of{' '}
                  <span className="font-semibold text-foreground">
                    {selectedPlan.expandedFeatures.length}
                  </span>{' '}
                  entries
                </span>
                <span className="font-medium text-foreground">
                  Page 1 of 1
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
