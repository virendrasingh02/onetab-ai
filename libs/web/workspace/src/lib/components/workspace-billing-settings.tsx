import { useEffect, useState } from 'react';
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
  confirm,
  toast,
} from '@org/ui';
import { billingApi, queryKeys } from '@org/api-client';
import {
  PLAN_TIERS,
  type InvoiceItemDto,
  type PlanTier,
} from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Bot,
  Calendar,
  ChevronDown,
  ChevronUp,
  Coins,
  CreditCard,
  Database,
  FileText,
  Plus,
  RotateCcw,
  Sparkles,
  Tag,
  Zap,
} from 'lucide-react';
import { clearReturnTo, readReturnTo, rememberReturnTo } from './billing-return.js';
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
    paymentsEnabled,
    billingMode,
  } = usePlanEntitlements(workspaceId);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isAnnual, setIsAnnual] = useState(true);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] =
    useState<PlanTier | null>(null);
  const [selectedPlanForDowngrade, setSelectedPlanForDowngrade] =
    useState<PlanTier | null>(null);
  const [isEnterpriseModalOpen, setIsEnterpriseModalOpen] = useState(false);
  const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
  const [showFullComparison, setShowFullComparison] = useState(false);

  // Arrived from another app (e.g. Agent Studio hit a limit): remember where to go back to,
  // and open the credit top-up straight away when that is what was asked for.
  useEffect(() => {
    rememberReturnTo(searchParams.get('returnTo'));
    const wantsTopUp = searchParams.get('topup') === 'open';
    if (wantsTopUp && !canManageBilling) return; // wait until permissions are known
    if (searchParams.has('returnTo') || wantsTopUp) {
      const next = new URLSearchParams(searchParams);
      next.delete('returnTo');
      if (wantsTopUp) {
        next.delete('topup');
        setIsTopupModalOpen(true);
      }
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageBilling]);
  const returnLink = readReturnTo();

  // Query Invoices
  const { data: invoices = [] } = useQuery<InvoiceItemDto[]>({
    queryKey: queryKeys.billing.invoices(workspaceId ?? ''),
    queryFn: () => billingApi.invoices(workspaceId as string),
    enabled: !!workspaceId,
  });

  const { data: redemptions = [] } = useQuery({
    queryKey: queryKeys.billing.redemptions(workspaceId ?? ''),
    queryFn: () => billingApi.redemptions(workspaceId as string),
    enabled: !!workspaceId && canManageBilling,
  });

  const refreshBilling = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.billing.all(workspaceId as string) });

  const cancelMutation = useMutation({
    mutationFn: () => billingApi.cancel(workspaceId as string),
    onSuccess: () => {
      toast.success('Cancellation scheduled. You keep your plan until the period ends.');
      void refreshBilling();
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const reactivateMutation = useMutation({
    mutationFn: () => billingApi.reactivate(workspaceId as string),
    onSuccess: () => {
      toast.success('Your plan will renew as normal.');
      void refreshBilling();
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const portalMutation = useMutation({
    mutationFn: () => billingApi.portal(workspaceId as string),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCancel = async () => {
    const ok = await confirm({
      title: 'Cancel your subscription?',
      description: `You keep ${planConfig.name} until ${
        subscription?.currentPeriodEnd
          ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
          : 'the end of the billing period'
      }, then the workspace moves to Free. Your data is kept.`,
      confirmLabel: 'Cancel subscription',
      cancelLabel: 'Keep my plan',
      destructive: true,
    });
    if (ok) cancelMutation.mutate();
  };

  // Returning from the payment provider: the webhook may land a moment after the
  // redirect, so poll the checkout until the server says it is settled.
  useEffect(() => {
    const checkoutId = searchParams.get('session');
    const outcome = searchParams.get('checkout') ?? searchParams.get('topup');
    if (!workspaceId || !checkoutId || !outcome) return;
    const clear = () => {
      const next = new URLSearchParams(searchParams);
      ['session', 'checkout', 'topup'].forEach((k) => next.delete(k));
      setSearchParams(next, { replace: true });
    };
    if (outcome === 'cancelled') {
      void billingApi.cancelCheckout(workspaceId, checkoutId).catch(() => undefined);
      toast.info('Checkout cancelled. You have not been charged.');
      clear();
      return;
    }
    let tries = 0;
    let stopped = false;
    const tick = async () => {
      try {
        const res = await billingApi.getCheckout(workspaceId, checkoutId);
        if (res.status === 'COMPLETED') {
          toast.success('Payment confirmed — your workspace is updated.');
          void refreshBilling();
          return clear();
        }
        if (res.status !== 'PENDING') {
          toast.error(res.failureReason ?? 'The payment did not complete.');
          return clear();
        }
      } catch {
        /* transient; retry */
      }
      if (!stopped && ++tries < 20) setTimeout(tick, 2000);
      else if (!stopped) {
        toast.info('Still waiting for payment confirmation. This page will update when it arrives.');
        clear();
      }
    };
    void tick();
    return () => {
      stopped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, searchParams]);

  const upgradeTarget: PlanTier = plan === 'free' ? 'pro' : 'max';
  const isPastDue = subscription?.status === 'PAST_DUE' || subscription?.status === 'UNPAID';
  const pendingChange =
    subscription?.cancelAtPeriodEnd || subscription?.scheduledPlanTier
      ? subscription?.scheduledPlanTier && subscription.scheduledPlanTier !== 'free'
        ? `Moves to ${subscription.scheduledPlanTier.toUpperCase()}`
        : 'Cancels'
      : null;

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
      {returnLink && (
        <a
          href={returnLink.href}
          onClick={clearReturnTo}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          ← {returnLink.label}
        </a>
      )}

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
                FREE TRIAL
              </Badge>
            )}
            {billingMode === 'test' && (
              <Badge variant="secondary" className="font-semibold text-[10px]">
                TEST MODE
              </Badge>
            )}
          </div>
          <p className="text-xs md:text-sm text-muted-foreground">
            Manage your subscription tier, micro-agent compute limits, shared AI credits,
            and billing settings for{' '}
            <strong className="text-foreground">{currentWorkspaceName}</strong>.
          </p>
        </div>

        {subscription?.renewAt && plan !== 'free' && (
          <div className="gap-2 text-xs px-3 py-1.5 flex shrink-0 items-center rounded-lg border border-border bg-surface-muted text-muted-foreground">
            <Calendar className="size-3.5 text-primary" />
            <span>
              {pendingChange
                ? `${pendingChange} on`
                : subscription.source === 'PROMOTION'
                  ? 'Coupon plan ends'
                  : 'Renews'}{' '}
              {new Date(subscription.currentPeriodEnd ?? subscription.renewAt).toLocaleDateString()} (
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
                  Free trial active ({trialDaysRemaining ?? 0} days remaining)
                </p>
                <p className="text-[11px] text-muted-foreground">
                  You are experiencing the full {planConfig.name} plan. You can cancel or change your plan anytime.
                </p>
              </div>
            </div>
            {paymentsEnabled && (
              <Button
                size="xs"
                variant="outline"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="text-xs"
              >
                Manage subscription
              </Button>
            )}
          </div>
        )}

        {/* Payment problems / pending changes / unavailable payments */}
        {isPastDue && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold">Your last payment failed</p>
                <p className="text-[11px] opacity-80">
                  Update your payment method to keep {planConfig.name}. Paid features pause if payment is not
                  received within the grace period.
                </p>
              </div>
            </div>
            {canManageBilling && paymentsEnabled && (
              <Button size="xs" variant="primary" onClick={() => portalMutation.mutate()} className="text-xs shrink-0">
                <CreditCard className="size-3.5 mr-1.5" />
                Update payment method
              </Button>
            )}
          </div>
        )}

        {pendingChange && plan !== 'free' && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <strong>
                {pendingChange} on{' '}
                {subscription?.currentPeriodEnd
                  ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                  : 'period end'}
                .
              </strong>{' '}
              You keep {planConfig.name} until then.
            </p>
            {canManageBilling && (
              <Button
                size="xs"
                variant="outline"
                disabled={reactivateMutation.isPending}
                onClick={() => reactivateMutation.mutate()}
                className="text-xs shrink-0"
              >
                <RotateCcw className="size-3.5 mr-1.5" />
                Keep my plan
              </Button>
            )}
          </div>
        )}

        {!paymentsEnabled && canManageBilling && (
          <div className="rounded-xl border border-border bg-surface-muted/40 p-3 text-[11px] text-muted-foreground">
            Online payments are not enabled on this deployment, so paid plans cannot be purchased yet.
          </div>
        )}

        {subscription?.appliedPromotionCode && (
          <div className="rounded-xl border border-success/30 bg-success/10 p-4 flex items-center gap-3 text-success-text">
            <div className="p-2 rounded-lg bg-success/20 text-success-text shrink-0">
              <Tag className="size-4" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-bold">Coupon applied: {subscription.appliedPromotionCode}</p>
              {subscription.discountPercent ? (
                <p className="text-[11px] text-success-text/80">
                  {subscription.discountPercent}% off your first payment.
                </p>
              ) : null}
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
              onClick={() => handlePlanAction(upgradeTarget)}
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
            onUpgradeClick={() => handlePlanAction(upgradeTarget)}
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
                onUpgradeClick={() => handlePlanAction(upgradeTarget)}
              />
              <UsageMeter
                metric={usage.storage}
                icon={Database}
                onUpgradeClick={() => handlePlanAction(upgradeTarget)}
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
                className="px-1.5 py-0 font-bold bg-success/15 text-success-text border-success/20 text-[10px]"
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
              currentTier={plan}
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

      {/* 5. Subscription management */}
      {plan !== 'free' && canManageBilling && (
        <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border">
          {paymentsEnabled && subscription?.provider && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5"
              disabled={portalMutation.isPending}
              onClick={() => portalMutation.mutate()}
            >
              <CreditCard className="size-3.5" />
              Payment method & invoices
            </Button>
          )}
          {!pendingChange && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-destructive"
              disabled={cancelMutation.isPending}
              onClick={() => void handleCancel()}
            >
              Cancel subscription
            </Button>
          )}
        </div>
      )}

      {/* 6. Invoices & Billing History */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="space-y-0.5">
          <h3 className="text-base font-bold gap-2 flex items-center text-foreground">
            <FileText className="size-4 text-primary" />
            Invoices & Payment Receipts
          </h3>
          <p className="text-xs text-muted-foreground">
            Receipts for subscription payments, credit top-ups and coupon activations.
          </p>
        </div>

        {invoices.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No invoices yet.
          </p>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-muted/50 text-xs">
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Download</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs text-foreground">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(inv.periodStart).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs text-foreground">{inv.description}</TableCell>
                    <TableCell className="text-xs font-semibold text-foreground">
                      {new Intl.NumberFormat(undefined, {
                        style: 'currency',
                        currency: inv.currency,
                      }).format(inv.amountCents / 100)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="primary"
                        className={`font-bold text-[10px] ${
                          inv.status === 'PAID'
                            ? 'bg-success/15 text-success-text border-success/20'
                            : 'bg-amber-500/15 text-amber-600 border-amber-500/20'
                        }`}
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {inv.pdfUrl || inv.hostedUrl ? (
                        <a
                          className="text-primary hover:underline"
                          href={inv.pdfUrl ?? inv.hostedUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Download
                        </a>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* 7. Coupon history */}
      {redemptions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold gap-2 flex items-center text-foreground">
            <Tag className="size-4 text-primary" />
            Coupon history
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border text-xs">
            {redemptions.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-mono text-foreground">{r.code}</span>
                <span className="text-muted-foreground">
                  {r.status === 'APPLIED' ? 'Redeemed' : r.status === 'RESERVED' ? 'Pending' : 'Released'} ·{' '}
                  {new Date(r.redeemedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Checkout Modal */}
      <CheckoutModal
        open={Boolean(selectedPlanForCheckout)}
        onOpenChange={(open) => !open && setSelectedPlanForCheckout(null)}
        targetPlan={selectedPlanForCheckout}
        isAnnual={isAnnual}
        workspaceId={workspaceId}
        paymentsEnabled={paymentsEnabled}
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
