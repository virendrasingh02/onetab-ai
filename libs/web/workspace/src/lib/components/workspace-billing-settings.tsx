import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  PlanBadge,
  Separator,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  UsageMeter,
  toast,
} from '@org/ui';
import { billingApi, queryKeys } from '@org/api-client';
import {
  PLANS_CONFIG,
  PLAN_TIERS,
  type DowngradeImpactSummary,
  type EnterpriseInquiryInput,
  type InvoiceItemDto,
  type PlanTier,
  type UpgradePlanInput,
  type WorkspaceBillingSummary,
} from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Calendar,
  Check,
  Database,
  FileText,
  Info,
  Minus,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import { usePlanEntitlements } from '../hooks/use-plan-entitlements.js';
import { useCurrentWorkspace } from '../use-workspaces.js';

export interface WorkspaceBillingSettingsProps {
  totalMembers?: number;
  workspaceName?: string;
  isOwner?: boolean;
}

export function WorkspaceBillingSettings({
  workspaceName: propWorkspaceName,
}: WorkspaceBillingSettingsProps) {
  const queryClient = useQueryClient();
  const { workspaceId, workspace } = useCurrentWorkspace();
  const { plan, planConfig, subscription, usage, canManageBilling } =
    usePlanEntitlements(workspaceId);

  const [isAnnual, setIsAnnual] = useState(true);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] =
    useState<PlanTier | null>(null);
  const [selectedPlanForDowngrade, setSelectedPlanForDowngrade] =
    useState<PlanTier | null>(null);
  const [isEnterpriseModalOpen, setIsEnterpriseModalOpen] = useState(false);
  const [additionalSeats, setAdditionalSeats] = useState<number>(5);

  // Enterprise inquiry form state
  const [enterpriseForm, setEnterpriseForm] = useState<EnterpriseInquiryInput>({
    name: '',
    email: '',
    companyName: '',
    teamSize: '50-200',
    customLlmRequirements: '',
    message: '',
  });

  // Query Invoices
  const { data: invoices = [] } = useQuery<InvoiceItemDto[]>({
    queryKey: queryKeys.billing.invoices(workspaceId ?? ''),
    queryFn: () => billingApi.invoices(workspaceId as string),
    enabled: !!workspaceId && plan !== 'starter',
  });

  // Query Downgrade Impact
  const { data: downgradeImpact, isLoading: isCheckingDowngrade } =
    useQuery<DowngradeImpactSummary>({
      queryKey: queryKeys.billing.downgradeImpact(
        workspaceId ?? '',
        selectedPlanForDowngrade ?? '',
      ),
      queryFn: () =>
        billingApi.downgradeImpact(
          workspaceId as string,
          selectedPlanForDowngrade as PlanTier,
        ),
      enabled: !!workspaceId && !!selectedPlanForDowngrade,
    });

  // Upgrade Mutation
  const upgradeMutation = useMutation<
    WorkspaceBillingSummary,
    Error,
    UpgradePlanInput
  >({
    mutationFn: (input: UpgradePlanInput) =>
      billingApi.upgrade(workspaceId as string, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.billing.all(workspaceId as string),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all() });
      setSelectedPlanForUpgrade(null);
      toast.success(
        `Your workspace has been upgraded to ${PLANS_CONFIG[updated.plan].name}. All new entitlements are now unlocked.`,
      );
    },
    onError: (err) => {
      toast.error(err.message || 'Could not complete plan upgrade.');
    },
  });

  // Downgrade Mutation
  const downgradeMutation = useMutation<
    WorkspaceBillingSummary,
    Error,
    PlanTier
  >({
    mutationFn: (targetPlan: PlanTier) =>
      billingApi.downgrade(workspaceId as string, {
        targetPlan,
        acknowledgeOverages: true,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.billing.all(workspaceId as string),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all() });
      setSelectedPlanForDowngrade(null);
      toast.success(
        `Workspace plan changed to ${PLANS_CONFIG[updated.plan].name}. Existing data has been preserved.`,
      );
    },
    onError: (err) => {
      toast.error(err.message || 'Could not downgrade plan.');
    },
  });

  // Enterprise Inquiry Mutation
  const enterpriseMutation = useMutation<
    { success: boolean; inquiryId: string; message: string },
    Error,
    EnterpriseInquiryInput
  >({
    mutationFn: (input: EnterpriseInquiryInput) =>
      billingApi.submitEnterpriseInquiry(workspaceId as string, input),
    onSuccess: (res) => {
      setIsEnterpriseModalOpen(false);
      setEnterpriseForm({
        name: '',
        email: '',
        companyName: '',
        teamSize: '50-200',
        customLlmRequirements: '',
        message: '',
      });
      toast.success(
        res.message ||
          'Our enterprise team will reach out within 1 business day.',
      );
    },
    onError: (err) => {
      toast.error(err.message || 'Could not submit inquiry.');
    },
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
      setSelectedPlanForUpgrade(targetTier);
      setAdditionalSeats(
        targetTier === 'pro'
          ? Math.max(usage?.members.used ?? 1, 5)
          : Math.max(usage?.members.used ?? 1, 10),
      );
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
          </div>
          <p className="text-xs md:text-sm text-muted-foreground">
            Manage your subscription tier, resource quotas, enterprise custom
            LLM, and payment invoices for{' '}
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

      {/* 2. Live Resource Utilization Meters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold gap-2 flex items-center text-foreground">
              <Zap className="size-4 text-primary" />
              Real-Time Resource Quotas
            </h3>
            <p className="text-xs text-muted-foreground">
              Current consumption against your {planConfig.name} plan quotas.
            </p>
          </div>
        </div>

        {usage && (
          <div className="sm:grid-cols-2 lg:grid-cols-4 gap-4 grid grid-cols-1">
            <UsageMeter
              metric={usage.members}
              icon={Users}
              onUpgradeClick={() => handlePlanAction('pro')}
            />
            <UsageMeter
              metric={usage.storage}
              icon={Database}
              onUpgradeClick={() => handlePlanAction('pro')}
            />
            <UsageMeter
              metric={usage.aiRequests}
              icon={Sparkles}
              onUpgradeClick={() => handlePlanAction('pro')}
            />
            <UsageMeter
              metric={usage.automations}
              icon={Workflow}
              onUpgradeClick={() => handlePlanAction('business')}
            />
          </div>
        )}
      </div>

      {/* 3. Interactive 4-Tier Pricing Comparison Matrix */}
      <div className="space-y-6">
        <div className="sm:flex-row sm:items-center gap-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Available Upgrade Plans
            </h3>
            <p className="text-xs text-muted-foreground">
              Scale your team with flexible monthly or discounted annual
              subscriptions.
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
              className={`font-medium gap-1.5 flex items-center ${isAnnual ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
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
          {PLAN_TIERS.map((tier) => {
            const def = PLANS_CONFIG[tier];
            const isCurrent = plan === tier;
            const isEnterprise = tier === 'enterprise';
            const price = isAnnual ? def.pricing.annual : def.pricing.monthly;

            return (
              <Card
                key={tier}
                className={`relative flex flex-col justify-between overflow-hidden transition-all duration-200 ${
                  isCurrent
                    ? 'border-primary shadow-md ring-2 ring-primary/20'
                    : def.isPopular
                      ? 'border-primary/40 shadow-sm'
                      : 'hover:border-border-hover border-border'
                }`}
              >
                {/* Popular / Plan Badge Banner */}
                {def.badgeText ? (
                  <div
                    className={`top-0 right-0 px-3 py-0.5 font-bold tracking-wider absolute rounded-bl-lg text-[9px] uppercase ${
                      isCurrent
                        ? 'bg-primary text-primary-foreground'
                        : isEnterprise
                          ? 'bg-warning text-warning-foreground'
                          : 'border-b border-l border-primary/30 bg-primary/20 text-primary'
                    }`}
                  >
                    {isCurrent ? 'CURRENT PLAN' : def.badgeText}
                  </div>
                ) : isCurrent ? (
                  <div className="top-0 right-0 px-3 py-0.5 font-bold tracking-wider absolute rounded-bl-lg bg-primary text-[9px] text-primary-foreground uppercase">
                    CURRENT PLAN
                  </div>
                ) : null}

                <CardHeader className="p-5 pb-3">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-bold gap-2 flex items-center">
                      {def.name}
                    </CardTitle>
                    <CardDescription className="text-xs line-clamp-2 min-h-[32px]">
                      {def.tagline}
                    </CardDescription>
                  </div>

                  {/* Price display */}
                  <div className="pt-3">
                    {isEnterprise ? (
                      <div className="gap-1 flex items-baseline">
                        <span className="text-2xl font-black tracking-tight text-foreground">
                          Custom
                        </span>
                        <span className="text-xs text-muted-foreground">
                          / negotiated
                        </span>
                      </div>
                    ) : (
                      <div className="gap-1 flex items-baseline">
                        <span className="text-2xl font-black tracking-tight text-foreground">
                          ${price}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          / seat / month
                        </span>
                      </div>
                    )}
                    {!isEnterprise &&
                    isAnnual &&
                    def.pricing.annualDiscountPercent > 0 ? (
                      <p className="text-emerald-600 dark:text-emerald-400 mt-0.5 text-[11px]">
                        Billed annually (${def.pricing.annual * 12}/seat/yr)
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {tier === 'starter' ? 'Free forever' : 'Billed monthly'}
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-2 space-y-4 flex-1">
                  <Separator className="bg-border/60" />

                  {/* Highlights */}
                  <div className="space-y-2.5">
                    <p className="font-bold tracking-wider text-[11px] text-muted-foreground uppercase">
                      What's included:
                    </p>
                    <ul className="space-y-2 text-xs">
                      {def.highlightedFeatures.map((feat, idx) => (
                        <li
                          key={idx}
                          className="gap-2 flex items-start text-muted-foreground"
                        >
                          <Check className="size-3.5 mt-0.5 shrink-0 text-primary" />
                          <span className="leading-snug">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>

                <CardFooter className="p-5 pt-0">
                  <Button
                    variant={
                      isCurrent
                        ? 'outline'
                        : isEnterprise
                          ? 'secondary'
                          : tier === 'business'
                            ? 'primary'
                            : 'primary'
                    }
                    size="sm"
                    disabled={isCurrent || !canManageBilling}
                    onClick={() => handlePlanAction(tier)}
                    className="text-xs font-semibold h-9 w-full shadow-xs"
                  >
                    {isCurrent ? (
                      'Current Plan'
                    ) : isEnterprise ? (
                      'Contact Sales'
                    ) : PLAN_TIERS.indexOf(tier) > PLAN_TIERS.indexOf(plan) ? (
                      <>
                        <span>Upgrade to {def.name}</span>
                        <ArrowRight className="size-3.5 ml-1" />
                      </>
                    ) : (
                      'Downgrade'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 4. Invoices & Billing History */}
      {plan !== 'starter' && invoices.length > 0 && (
        <div className="space-y-4">
          <div className="gap-2 flex items-center">
            <FileText className="size-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">
              Billing History & Receipts
            </h3>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-muted/50">
                  <TableHead className="text-xs">Invoice #</TableHead>
                  <TableHead className="text-xs">Billing Period</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-xs">Amount</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv: InvoiceItemDto) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-xs font-medium font-mono text-foreground">
                      {inv.invoiceNumber}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(inv.periodStart).toLocaleDateString()} –{' '}
                      {new Date(inv.periodEnd).toLocaleDateString()}
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

      {/* --- Upgrade Confirmation Modal --- */}
      <Dialog
        open={!!selectedPlanForUpgrade}
        onOpenChange={(open) => !open && setSelectedPlanForUpgrade(null)}
      >
        <DialogContent className="sm:max-w-md p-6">
          {selectedPlanForUpgrade && (
            <div className="space-y-5">
              <DialogHeader className="space-y-1 text-left">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-lg font-bold text-foreground">
                    Upgrade to {PLANS_CONFIG[selectedPlanForUpgrade].name}
                  </DialogTitle>
                  <PlanBadge
                    plan={selectedPlanForUpgrade}
                    size="sm"
                    variant="gradient"
                  />
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  Instantly unlock advanced capabilities and expand limits for{' '}
                  {currentWorkspaceName}.
                </DialogDescription>
              </DialogHeader>

              {/* Seats selector */}
              <div className="space-y-2 p-3.5 text-xs rounded-xl border border-border bg-surface-muted/50">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    Team Member Seats
                  </span>
                  <div className="gap-2 flex items-center">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() =>
                        setAdditionalSeats(Math.max(1, additionalSeats - 1))
                      }
                    >
                      <Minus className="size-3" />
                    </Button>
                    <span className="font-bold w-6 text-center text-foreground">
                      {additionalSeats}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => setAdditionalSeats(additionalSeats + 1)}
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  You can adjust your seat allocation anytime as your team
                  grows.
                </p>
              </div>

              {/* Cost Summary */}
              <div className="p-3.5 space-y-1.5 text-xs rounded-xl border border-primary/20 bg-primary/5">
                <div className="font-semibold flex items-center justify-between text-foreground">
                  <span>Subscription Cost</span>
                  <span>
                    $
                    {(
                      additionalSeats *
                      (isAnnual
                        ? PLANS_CONFIG[selectedPlanForUpgrade].pricing.annual
                        : PLANS_CONFIG[selectedPlanForUpgrade].pricing
                            .monthly) *
                      (isAnnual ? 12 : 1)
                    ).toLocaleString()}
                    {isAnnual ? '/year' : '/month'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Billing interval</span>
                  <span className="capitalize">
                    {isAnnual ? 'Annual (20% Savings)' : 'Monthly'}
                  </span>
                </div>
              </div>

              <DialogFooter className="pt-2 gap-2 flex flex-row items-center justify-end">
                <DialogClose asChild>
                  <Button variant="ghost" size="sm" className="text-xs">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    upgradeMutation.mutate({
                      targetPlan: selectedPlanForUpgrade,
                      billingInterval: isAnnual ? 'annual' : 'monthly',
                      seats: additionalSeats,
                    })
                  }
                  disabled={upgradeMutation.isPending}
                  className="text-xs font-semibold"
                >
                  {upgradeMutation.isPending
                    ? 'Upgrading...'
                    : 'Confirm & Upgrade'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- Downgrade Impact Modal --- */}
      <Dialog
        open={!!selectedPlanForDowngrade}
        onOpenChange={(open) => !open && setSelectedPlanForDowngrade(null)}
      >
        <DialogContent className="sm:max-w-lg p-6">
          {selectedPlanForDowngrade && (
            <div className="space-y-4">
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="text-lg font-bold gap-2 flex items-center text-foreground">
                  <Info className="size-5 text-warning" />
                  Downgrade to {PLANS_CONFIG[selectedPlanForDowngrade].name}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Please review the impact on your resources and restricted
                  features before confirming.
                </DialogDescription>
              </DialogHeader>

              {isCheckingDowngrade ? (
                <div className="py-6 text-xs flex justify-center text-muted-foreground">
                  <RefreshCw className="size-4 animate-spin mr-2" /> Auditing
                  resources...
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  {downgradeImpact?.warnings &&
                  downgradeImpact.warnings.length > 0 ? (
                    <div className="p-3.5 space-y-2 rounded-xl border border-warning/30 bg-warning/10 text-warning-text">
                      <p className="font-semibold gap-1.5 flex items-center">
                        Resource Overages:
                      </p>
                      <ul className="space-y-1.5 list-inside list-disc text-[11px]">
                        {downgradeImpact.warnings.map((w: any, idx: number) => (
                          <li key={idx}>{w.impactDescription}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="p-3 border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl border">
                      ✓ Current usage fits within{' '}
                      {PLANS_CONFIG[selectedPlanForDowngrade].name} limits.
                    </div>
                  )}

                  <div className="p-3.5 space-y-1.5 rounded-xl border border-border bg-surface-muted/50">
                    <p className="font-semibold text-foreground">
                      Safe Retention Guarantee:
                    </p>
                    <p className="leading-relaxed text-[11px] text-muted-foreground">
                      Your existing projects, members, and uploaded files will{' '}
                      <strong>not</strong> be deleted. However, creating new
                      resources beyond the lower tier limits will be restricted.
                    </p>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-2 gap-2 flex flex-row items-center justify-end">
                <DialogClose asChild>
                  <Button variant="ghost" size="sm" className="text-xs">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    downgradeMutation.mutate(selectedPlanForDowngrade)
                  }
                  disabled={downgradeMutation.isPending}
                  className="text-xs font-semibold"
                >
                  {downgradeMutation.isPending
                    ? 'Downgrading...'
                    : 'Confirm Downgrade'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- Enterprise Contact Sales Modal --- */}
      <Dialog
        open={isEnterpriseModalOpen}
        onOpenChange={setIsEnterpriseModalOpen}
      >
        <DialogContent className="sm:max-w-lg p-6">
          <div className="space-y-4">
            <DialogHeader className="space-y-1 text-left">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-lg font-bold text-foreground">
                  Enterprise — Custom LLM Inquiry
                </DialogTitle>
                <PlanBadge plan="enterprise" size="sm" variant="gradient" />
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Get a custom quote with private LLM integration, dedicated
                infrastructure, and enterprise SLA.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="gap-3 grid grid-cols-2">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Your Name *
                  </label>
                  <Input
                    value={enterpriseForm.name}
                    onChange={(e) =>
                      setEnterpriseForm({
                        ...enterpriseForm,
                        name: e.target.value,
                      })
                    }
                    placeholder="Jane Smith"
                    className="text-xs h-8"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Work Email *
                  </label>
                  <Input
                    type="email"
                    value={enterpriseForm.email}
                    onChange={(e) =>
                      setEnterpriseForm({
                        ...enterpriseForm,
                        email: e.target.value,
                      })
                    }
                    placeholder="jane@company.com"
                    className="text-xs h-8"
                  />
                </div>
              </div>

              <div className="gap-3 grid grid-cols-2">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Company Name *
                  </label>
                  <Input
                    value={enterpriseForm.companyName}
                    onChange={(e) =>
                      setEnterpriseForm({
                        ...enterpriseForm,
                        companyName: e.target.value,
                      })
                    }
                    placeholder="Acme Enterprises"
                    className="text-xs h-8"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    Team Size
                  </label>
                  <Input
                    value={enterpriseForm.teamSize}
                    onChange={(e) =>
                      setEnterpriseForm({
                        ...enterpriseForm,
                        teamSize: e.target.value,
                      })
                    }
                    placeholder="e.g. 250+ employees"
                    className="text-xs h-8"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Custom LLM & Private Model Needs (Optional)
                </label>
                <Input
                  value={enterpriseForm.customLlmRequirements}
                  onChange={(e) =>
                    setEnterpriseForm({
                      ...enterpriseForm,
                      customLlmRequirements: e.target.value,
                    })
                  }
                  placeholder="e.g. vLLM cluster, self-hosted Azure, fine-tuned models"
                  className="text-xs h-8"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Additional Notes
                </label>
                <Textarea
                  value={enterpriseForm.message}
                  onChange={(e) =>
                    setEnterpriseForm({
                      ...enterpriseForm,
                      message: e.target.value,
                    })
                  }
                  placeholder="Tell us about your security, compliance, or custom SLA requirements..."
                  className="text-xs min-h-[60px]"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2 flex flex-row items-center justify-end">
              <DialogClose asChild>
                <Button variant="ghost" size="sm" className="text-xs">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                variant="primary"
                size="sm"
                onClick={() => enterpriseMutation.mutate(enterpriseForm)}
                disabled={
                  enterpriseMutation.isPending ||
                  !enterpriseForm.name ||
                  !enterpriseForm.email ||
                  !enterpriseForm.companyName
                }
                className="text-xs font-semibold px-4"
              >
                {enterpriseMutation.isPending
                  ? 'Submitting...'
                  : 'Submit Inquiry'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
