import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@org/ui';
import {
  ACTIVE_PROMOTION_CODE,
  PLAN_TIERS,
  PLANS_CONFIG,
  type PlanTier,
} from '@org/types';
import {
  Bot,
  Check,
  Coins,
  Cpu,
  Database,
  Layers,
  Minus,
  Shield,
  Sparkles,
  Tag,
  Zap,
} from 'lucide-react';

export function AdminPlansView() {
  const [selectedTier, setSelectedTier] = useState<PlanTier>('starter');

  const selectedPlan = PLANS_CONFIG[selectedTier];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
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
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Platform-wide subscription tiers, machine resource quotas, promotional codes, and micro-agent allocations.
          </p>
        </div>
      </div>

      {/* Active Promotion Summary Card */}
      <Card className="border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="size-11 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Tag className="size-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  Global Promotional Campaign Active
                </h3>
                <Badge
                  variant="primary"
                  className="font-mono text-xs font-bold bg-emerald-500 text-white"
                >
                  {ACTIVE_PROMOTION_CODE}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                100% discount applied across all tiers. Includes 7-day free trial and automated credit allocations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="text-right">
              <p className="font-semibold text-foreground">Discount Rate</p>
              <p className="text-emerald-600 dark:text-emerald-400 font-bold">100% OFF</p>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="text-right">
              <p className="font-semibold text-foreground">Trial Duration</p>
              <p className="text-foreground font-bold">7 Days</p>
            </div>
          </div>
        </div>
      </Card>

      {/* 4 Tiers Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLAN_TIERS.map((tier) => {
          const plan = PLANS_CONFIG[tier];
          const isSelected = selectedTier === tier;

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
                  {isSelected ? 'Viewing Config' : 'View Details'}
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
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Included Feature Capabilities ({selectedPlan.expandedFeatures.length} Items)
            </h4>
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-muted/40 text-xs">
                    <TableHead>Category</TableHead>
                    <TableHead>Feature Name</TableHead>
                    <TableHead>Included</TableHead>
                    <TableHead>Limit / Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPlan.expandedFeatures.map((feat) => (
                    <TableRow key={feat.id} className="text-xs">
                      <TableCell className="font-semibold text-muted-foreground">
                        {feat.category}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {feat.label}
                      </TableCell>
                      <TableCell>
                        {feat.included ? (
                          <Check className="size-4 text-emerald-500" />
                        ) : (
                          <Minus className="size-4 text-muted-foreground/40" />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {feat.valueText || (feat.included ? 'Supported' : '—')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
