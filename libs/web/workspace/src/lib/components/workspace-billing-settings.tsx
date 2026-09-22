import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  PlanBadge,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  UsageMeter,
} from '@org/ui';
import { billingApi, queryKeys } from '@org/api-client';
import {
  PLAN_TIERS,
  type InvoiceItemDto,
  type PlanTier,
} from '@org/types';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bot,
  Calendar,
  ChevronDown,
  ChevronUp,
  Coins,
  Database,
  FileText,
  Plus,
  Sparkles,
  Tag,
  Zap,
} from 'lucide-react';
import { usePlanEntitlements } from '../hooks/use-plan-entitlements.js';
import { useCurrentWorkspace } from '../use-workspaces.js';
import {
  CheckoutModal,
  CreditTopupModal,
  DowngradeConfirmModal,
  EnterpriseContactModal,
  PlanComparisonTable,
  PricingCard,
} from './pricing/index.js';

export interface WorkspaceBillingSettingsProps {
  totalMembers?: number;
  workspaceName?: string;
  isOwner?: boolean;
}

export function WorkspaceBillingSettings({
  workspaceName: propWorkspaceName,
}: WorkspaceBillingSettingsProps) {
  const { workspaceId, workspace } = useCurrentWorkspace();
  const {
    plan,
    planConfig,
    subscription,
    usage,
    canManageBilling,
    microAgentLimit,
    microAgentsUsed,
    creditBalance,
    isTrialing,
    trialDaysRemaining,
    activePromotion,
  } = usePlanEntitlements(workspaceId);

  const [isAnnual, setIsAnnual] = useState(true);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] =
    useState<PlanTier | null>(null);
  const [selectedPlanForDowngrade, setSelectedPlanForDowngrade] =
    useState<PlanTier | null>(null);
  const [isEnterpriseModalOpen, setIsEnterpriseModalOpen] = useState(false);
  const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
  const [showFullComparison, setShowFullComparison] = useState(false);

  // Query Invoices
  const { data: invoices = [] } = useQuery<InvoiceItemDto[]>({
    queryKey: queryKeys.billing.invoices(workspaceId ?? ''),
    queryFn: () => billingApi.invoices(workspaceId as string),
    enabled: !!workspaceId && plan !== 'starter',
  });

  const handlePlanAction = (targetTier: PlanTier) => {
    if (targetTier === plan) return;

    if (targetTier === 'enterprise') {
      setIsEnterpriseModalOpen(true);
      return;
    }

    const currentIdx = PLAN_TIERS.indexOf(plan);
    const targetIdx = PLAN_TIERS.indexOf(targetTier);

    if (targetIdx > currentIdx) {
      setSelectedPlanForCheckout(targetTier);
    } else {
      setSelectedPlanForDowngrade(targetTier);
    }
  };

  const currentWorkspaceName =
    propWorkspaceName || workspace?.name || 'Workspace';

  return (
    <div className="space-y-10">
      {/* 1. Header & Active Plan Overview */}
      <div className="sm:flex-row sm:items-center gap-4 p-6 flex flex-col items-start justify-between rounded-2xl border border-border bg-gradient-to-br from-card via-card to-surface-muted/40 shadow-xs">
        <div className="space-y-1.5">
          <div className="gap-3 flex items-center">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Plans & Billing
            </h2>
            <PlanBadge plan={plan} size="md" variant="gradient" />
            {subscription?.status === 'ACTIVE' && (
              <Badge variant="primary" className="font-semibold text-[10px]">
                ACTIVE
              </Badge>
            )}
            {isTrialing && (
              <Badge
                variant="secondary"
                className="font-semibold text-[10px] border border-primary/20 bg-primary/10 text-primary"
              >
                7-DAY TRIAL
              </Badge>
            )}
          </div>
          <p className="text-xs md:text-sm text-muted-foreground">
            Manage your subscription tier, micro-agent compute limits, shared AI credits,
            and billing settings for{' '}
            <strong className="text-foreground">{currentWorkspaceName}</strong>.
          </p>
        </div>

        {subscription?.renewAt && plan !== 'starter' && (
          <div className="gap-2 text-xs px-3 py-1.5 flex shrink-0 items-center rounded-lg border border-border bg-surface-muted text-muted-foreground">
            <Calendar className="size-3.5 text-primary" />
            <span>
              Renews {new Date(subscription.renewAt).toLocaleDateString()} (
              {subscription.billingInterval})
            </span>
          </div>
        )}
      </div>

      {/* 2. Active Trial & Promo Alerts */}
      <div className="space-y-3">
        {/* Trial Status Banner */}
        {isTrialing && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20 text-primary shrink-0">
                <Sparkles className="size-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground">
                  7-Day Free Trial Active ({trialDaysRemaining ?? 7} days remaining)
                </p>
                <p className="text-[11px] text-muted-foreground">
                  You are experiencing the full {planConfig.name} plan. You can cancel or change your plan anytime.
                </p>
              </div>
            </div>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setSelectedPlanForCheckout(plan)}
              className="text-xs"
            >
              Manage Subscription
            </Button>
          </div>
        )}

        {/* Active Promotion Banner */}
        {(activePromotion || subscription?.appliedPromotionCode) && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3 text-emerald-800 dark:text-emerald-200">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Tag className="size-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold">
                  Promotional Code Active: {subscription?.appliedPromotionCode || activePromotion?.code}
                </p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                  {subscription?.discountPercent || activePromotion?.discountPercent || 100}% discount applied to your workspace subscription.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Micro-Agent Limit Warning */}
        {microAgentLimit !== -1 && microAgentsUsed >= microAgentLimit && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 text-amber-800 dark:text-amber-200">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="size-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold">
                  Micro-Agent Limit Reached ({microAgentsUsed}/{microAgentLimit} Agents Active)
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80">
                  Your workspace has deployed all available micro-agents on the {planConfig.name} plan.
                </p>
              </div>
            </div>
            <Button
              size="xs"
              variant="primary"
              onClick={() => handlePlanAction(plan === 'starter' ? 'pro' : 'business')}
              className="text-xs shrink-0"
            >
              Upgrade Micro-Agents
            </Button>
          </div>
        )}

        {/* Low Shared AI Credits Warning */}
        {creditBalance <= 0.50 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 text-amber-800 dark:text-amber-200">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                <Coins className="size-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold">
                  Low Shared AI Credits (${creditBalance.toFixed(2)} Available)
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80">
                  Automated agent runs and workflow executions may pause when credit balance reaches $0.
                </p>
              </div>
            </div>
            <Button
              size="xs"
              variant="primary"
              onClick={() => setIsTopupModalOpen(true)}
              className="text-xs shrink-0"
            >
              Top Up Credits
            </Button>
          </div>
        )}
      </div>

      {/* 3. Live Resource Utilization Meters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold gap-2 flex items-center text-foreground">
              <Zap className="size-4 text-primary" />
              Real-Time Resource Quotas & AI Credits
            </h3>
            <p className="text-xs text-muted-foreground">
              Current consumption against your {planConfig.name} plan quotas.
            </p>
          </div>

          <Button
            variant="outline"
            size="xs"
            onClick={() => setIsTopupModalOpen(true)}
            className="text-xs gap-1.5"
          >
            <Coins className="size-3.5 text-primary" />
            Add AI Credits
          </Button>
        </div>

        <div className="sm:grid-cols-2 lg:grid-cols-4 gap-4 grid grid-cols-1">
          {/* Micro Agents Meter */}
          <UsageMeter
            metric={
              usage?.microAgents ?? {
                key: 'micro_agents',
                label: 'Micro Agents',
                used: microAgentsUsed,
                limit: microAgentLimit,
                percentage:
                  microAgentLimit === -1
                    ? 0
                    : Math.min(100, Math.round((microAgentsUsed / microAgentLimit) * 100)),
                isNearLimit:
                  microAgentLimit !== -1 && microAgentsUsed >= microAgentLimit * 0.8,
                isLimitReached:
                  microAgentLimit !== -1 && microAgentsUsed >= microAgentLimit,
                unit: 'agents',
              }
            }
            icon={Bot}
            onUpgradeClick={() => handlePlanAction(plan === 'starter' ? 'pro' : 'business')}
          />

          {/* Shared AI Credits Meter / Card */}
          <Card className="border-border bg-card p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Coins className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Shared AI Credits</p>
                  <p className="text-[10px] text-muted-foreground">
                    Allocated: ${planConfig.machineLimits.aiCreditsUsd === -1 ? 'Custom' : `${planConfig.machineLimits.aiCreditsUsd}/mo`}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsTopupModalOpen(true)}
                className="size-7 text-primary hover:bg-primary/10"
              >
                <Plus className="size-3.5" />
              </Button>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-extrabold text-foreground">
                  ${creditBalance.toFixed(2)}
                </span>
                <span className="text-[11px] text-muted-foreground">balance remaining</span>
              </div>
              <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    creditBalance < 1
                      ? 'bg-amber-500'
                      : 'bg-primary'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      planConfig.machineLimits.aiCreditsUsd > 0
                        ? (creditBalance / planConfig.machineLimits.aiCreditsUsd) * 100
                        : 100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          </Card>

          {/* AI Monthly Requests Meter */}
          {usage && (
            <>
              <UsageMeter
                metric={usage.aiRequests}
                icon={Sparkles}
                onUpgradeClick={() => handlePlanAction('pro')}
              />
              <UsageMeter
                metric={usage.storage}
                icon={Database}
                onUpgradeClick={() => handlePlanAction('pro')}
              />
            </>
          )}
        </div>
      </div>

      {/* 4. Interactive 4-Tier Pricing Grid */}
      <div className="space-y-6">
        <div className="sm:flex-row sm:items-center gap-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Workspace Plans & Upgrades
            </h3>
            <p className="text-xs text-muted-foreground">
              Flexible monthly and annual subscriptions with transparent micro-agent allocations.
            </p>
          </div>

          {/* Monthly / Annual Toggle Switch */}
          <div className="gap-3 p-1.5 sm:self-auto text-xs flex items-center self-start rounded-xl border border-border bg-surface-muted/80">
            <span
              className={`font-medium ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              Monthly
            </span>
            <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
            <span
              className={`font-medium gap-1.5 flex items-center ${
                isAnnual ? 'font-semibold text-foreground' : 'text-muted-foreground'
              }`}
            >
              Annual Billing
              <Badge
                variant="primary"
                className="px-1.5 py-0 font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]"
              >
                SAVE 20%
              </Badge>
            </span>
          </div>
        </div>

        {/* 4 Cards Grid */}
        <div className="md:grid-cols-2 lg:grid-cols-4 gap-5 grid grid-cols-1">
          {PLAN_TIERS.map((tier) => (
            <PricingCard
              key={tier}
              tier={tier}
              isAnnual={isAnnual}
              isCurrent={plan === tier}
              canManageBilling={canManageBilling}
              onSelectPlan={handlePlanAction}
            />
          ))}
        </div>

        {/* Expandable Comparison Matrix Toggle */}
        <div className="pt-2 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFullComparison(!showFullComparison)}
            className="text-xs gap-1.5"
          >
            {showFullComparison ? (
              <>
                <ChevronUp className="size-3.5" />
                Hide Full Comparison Matrix
              </>
            ) : (
              <>
                <ChevronDown className="size-3.5" />
                View Full Feature Comparison Matrix
              </>
            )}
          </Button>
        </div>

        {showFullComparison && (
          <div className="pt-4">
            <PlanComparisonTable
              currentPlan={plan}
              onSelectPlan={handlePlanAction}
            />
          </div>
        )}
      </div>

      {/* 5. Invoices & Billing History */}
      {invoices.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold gap-2 flex items-center text-foreground">
              <FileText className="size-4 text-primary" />
              Invoices & Payment Receipts
            </h3>
            <p className="text-xs text-muted-foreground">
              View and download previous billing receipts and statements.
            </p>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-muted/50 text-xs">
                  <TableHead>Invoice ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs text-foreground">
                      {inv.invoiceNumber}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(inv.periodStart).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs text-foreground">
                      {inv.description}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-foreground">
                      ${(inv.amountCents / 100).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="primary"
                        className="font-bold bg-emerald-500/15 text-emerald-600 border-emerald-500/20 text-[10px]"
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      <CheckoutModal
        open={Boolean(selectedPlanForCheckout)}
        onOpenChange={(open) => !open && setSelectedPlanForCheckout(null)}
        targetPlan={selectedPlanForCheckout}
        isAnnual={isAnnual}
        workspaceId={workspaceId}
        onSuccess={() => setSelectedPlanForCheckout(null)}
      />

      {/* Downgrade Confirm Modal */}
      <DowngradeConfirmModal
        open={Boolean(selectedPlanForDowngrade)}
        onOpenChange={(open) => !open && setSelectedPlanForDowngrade(null)}
        targetPlan={selectedPlanForDowngrade}
        workspaceId={workspaceId}
        onSuccess={() => setSelectedPlanForDowngrade(null)}
      />

      {/* Enterprise Contact Modal */}
      <EnterpriseContactModal
        open={isEnterpriseModalOpen}
        onOpenChange={setIsEnterpriseModalOpen}
        workspaceId={workspaceId}
      />

      {/* Credit Top-Up Modal */}
      <CreditTopupModal
        open={isTopupModalOpen}
        onOpenChange={setIsTopupModalOpen}
        workspaceId={workspaceId}
        currentBalance={creditBalance}
      />
    </div>
  );
}
