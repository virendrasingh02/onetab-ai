import { formatBytes, formatNumber } from '@org/analytics-ui';
import { analyticsApi, queryKeys } from '@org/api-client';
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
  Separator,
  Switch,
} from '@org/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  Building,
  Check,
  CheckCircle2,
  Crown,
  Database,
  Info,
  Minus,
  Plus,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useCurrentWorkspace } from '../use-workspaces.js';

export interface WorkspaceBillingSettingsProps {
  totalMembers?: number;
  workspaceName?: string;
  isOwner?: boolean;
}

export function WorkspaceBillingSettings({
  totalMembers = 1,
  workspaceName = 'Workspace',
  isOwner: _isOwner = true,
}: WorkspaceBillingSettingsProps) {
  const [isAnnual, setIsAnnual] = useState(true);
  /*
   * No setter: there is no billing backend to read a real plan from, and
   * "Confirm & Upgrade" no longer pretends to change it (see
   * `handleRequestUpgrade` below) — so this is a fixed placeholder, not
   * state that changes at runtime. Once `workspaces/:id/billing` exists,
   * this should come from a query, not `useState`.
   */
  const [currentPlan] = useState<'starter' | 'pro' | 'enterprise'>('starter');
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<
    'starter' | 'pro' | 'enterprise' | null
  >(null);
  const [additionalSeats, setAdditionalSeats] = useState(
    totalMembers > 5 ? totalMembers : 5,
  );
  const [upgradeSuccessMessage, setUpgradeSuccessMessage] = useState<
    string | null
  >(null);

  /*
   * The two usage cards below need real numbers, not the workspace's own
   * settings-page query. Called directly against `analyticsApi` rather than
   * through `@org/web-analytics`'s hooks — that lib depends on this one for
   * `useCurrentWorkspace`, so importing it back here would be circular.
   * Mirrors `workspace-company-analytics.tsx`, which hits the same two
   * endpoints the same way from elsewhere in this lib.
   */
  const { workspaceId } = useCurrentWorkspace();
  const usageDays = 30;
  const aiUsageQuery = useQuery({
    queryKey: queryKeys.analytics.aiUsage(workspaceId ?? '', usageDays),
    queryFn: () => analyticsApi.aiUsage(workspaceId as string, usageDays),
    enabled: !!workspaceId,
  });
  const storageQuery = useQuery({
    queryKey: queryKeys.analytics.storage(workspaceId ?? '', usageDays),
    queryFn: () => analyticsApi.storage(workspaceId as string, usageDays),
    enabled: !!workspaceId,
  });

  const proMonthlyPrice = 12;
  const proAnnualPrice = 10;
  const enterpriseMonthlyPrice = 36;
  const enterpriseAnnualPrice = 28;

  const currentPricePerSeat = isAnnual
    ? selectedPlanForModal === 'enterprise'
      ? enterpriseAnnualPrice
      : proAnnualPrice
    : selectedPlanForModal === 'enterprise'
      ? enterpriseMonthlyPrice
      : proMonthlyPrice;

  const totalCalculatedCost =
    additionalSeats * currentPricePerSeat * (isAnnual ? 12 : 1);

  /*
   * There is no payment provider wired up (no Stripe/card capture, no
   * `OrganizationSubscription` write) — this used to fake a 900ms "Processing
   * Upgrade..." spinner, silently flip `currentPlan`, and report a dollar
   * amount as "Successfully upgraded" with nothing actually charged or
   * persisted. That is worse than an error: it told the workspace owner they
   * were on a paid plan when they were not. Until real billing exists, this
   * only records interest — it never changes `currentPlan` or claims a
   * charge happened.
   */
  const handleRequestUpgrade = () => {
    if (!selectedPlanForModal) return;
    const planName =
      selectedPlanForModal === 'enterprise' ? 'Enterprise' : 'Pro Team';
    setUpgradeSuccessMessage(
      `Billing isn't connected yet, so nothing was charged and the plan wasn't changed. We've noted that ${workspaceName} wants ${planName} for ${additionalSeats} seat(s) — reach out to get it set up.`,
    );
    setSelectedPlanForModal(null);
  };

  return (
    <div className="space-y-8">
      {/* Top Banner / Feedback Alert — neutral, not success-styled: nothing was actually charged or changed */}
      {upgradeSuccessMessage ? (
        <div className="p-4 flex items-center justify-between rounded-xl border border-border bg-surface-muted text-foreground">
          <div className="gap-3 flex items-center">
            <Info className="size-5 shrink-0 text-muted-foreground" />
            <p className="text-sm font-medium">{upgradeSuccessMessage}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUpgradeSuccessMessage(null)}
            className="text-xs"
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      {/* Header & Plan Summary */}
      <div className="md:flex-row md:items-center gap-4 flex flex-col justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight gap-2.5 flex items-center text-foreground">
            <span>Plans & Billing</span>
            <Badge
              variant="primary"
              className="text-xs px-2 font-semibold uppercase"
            >
              {currentPlan === 'enterprise'
                ? 'Enterprise'
                : currentPlan === 'pro'
                  ? 'Pro Team'
                  : 'Free Tier'}
            </Badge>
          </h2>
          <p className="text-sm mt-0.5 text-muted-foreground">
            Manage your subscription tier, member seat allocations, and compute
            quotas.
          </p>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="gap-3 px-3.5 py-1.5 shadow-2xs md:self-auto inline-flex items-center self-start rounded-full border border-border bg-surface">
          <span
            className={`text-xs font-medium cursor-pointer transition-colors ${
              !isAnnual
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground'
            }`}
            onClick={() => setIsAnnual(false)}
          >
            Monthly
          </span>
          <Switch
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
            aria-label="Toggle annual billing"
          />
          <span
            className={`text-xs font-medium gap-1.5 flex cursor-pointer items-center transition-colors ${
              isAnnual
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground'
            }`}
            onClick={() => setIsAnnual(true)}
          >
            <span>Annually</span>
            <Badge
              variant="info"
              className="px-1.5 py-0 font-bold border-primary/20 bg-primary/15 text-[10px] text-primary"
            >
              SAVE 20%
            </Badge>
          </span>
        </div>
      </div>

      {/* Current Workspace Resource Quotas Card */}
      <Card className="backdrop-blur-sm border-border/80 bg-surface/70">
        <CardHeader className="pb-3">
          <div className="gap-2 flex flex-wrap items-center justify-between">
            <div>
              <CardTitle className="text-base gap-2 flex items-center">
                <Database className="size-4 text-primary" />
                Workspace Quota & Usage
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time consumption for {workspaceName} in the current billing
                cycle
              </CardDescription>
            </div>
            {currentPlan === 'starter' ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setSelectedPlanForModal('pro')}
                className="h-8 text-xs font-semibold"
              >
                <Zap className="size-3.5 mr-1" />
                Upgrade Workspace
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="md:grid-cols-3 gap-4 pt-2 grid grid-cols-1">
          {/* Member Seats */}
          <div className="p-3.5 space-y-2 rounded-xl border border-border bg-surface-inset/40">
            <div className="text-xs flex items-center justify-between">
              <span className="gap-1.5 font-medium flex items-center text-muted-foreground">
                <Users className="size-3.5" />
                Active Seats
              </span>
              <span className="font-semibold text-foreground">
                {totalMembers} / {currentPlan === 'starter' ? 5 : 'Unlimited'}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
              <div
                className={`h-full rounded-full ${
                  totalMembers >= 4 && currentPlan === 'starter'
                    ? 'bg-warning'
                    : 'bg-primary'
                }`}
                style={{
                  width: `${
                    currentPlan === 'starter'
                      ? Math.min(100, (totalMembers / 5) * 100)
                      : 25
                  }%`,
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {currentPlan === 'starter'
                ? `${Math.max(0, 5 - totalMembers)} seat(s) remaining on Free tier`
                : 'Unlimited seat capacity on Pro plan'}
            </p>
          </div>

          {/* AI Compute — there is no plan quota to measure against yet (no
              billing backend), so this shows real usage rather than faking a
              used-of-limit bar against a number that doesn't exist. */}
          <div className="p-3.5 space-y-2 rounded-xl border border-border bg-surface-inset/40">
            <div className="text-xs flex items-center justify-between">
              <span className="gap-1.5 font-medium flex items-center text-muted-foreground">
                <Bot className="size-3.5" />
                AI Agent Runs
              </span>
              <span className="font-semibold text-foreground">
                {aiUsageQuery.data
                  ? `${formatNumber(aiUsageQuery.data.agentExecutions)} runs`
                  : aiUsageQuery.isLoading
                    ? '…'
                    : '—'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {aiUsageQuery.data
                ? `${formatNumber(aiUsageQuery.data.estimatedTokens)} tokens in the last ${usageDays} days`
                : 'Last 30 days'}
            </p>
          </div>

          {/* Storage */}
          <div className="p-3.5 space-y-2 rounded-xl border border-border bg-surface-inset/40">
            <div className="text-xs flex items-center justify-between">
              <span className="gap-1.5 font-medium flex items-center text-muted-foreground">
                <Database className="size-3.5" />
                File & Media Storage
              </span>
              <span className="font-semibold text-foreground">
                {storageQuery.data
                  ? `${formatBytes(storageQuery.data.totalBytes)} / ${formatBytes(storageQuery.data.quotaBytes)}`
                  : storageQuery.isLoading
                    ? '…'
                    : '—'}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full bg-success"
                style={{ width: `${storageQuery.data?.usedPct ?? 0}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {storageQuery.data
                ? `${storageQuery.data.usedPct}% of workspace quota consumed`
                : 'Shared workspace file storage'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Tier Grid */}
      <div className="md:grid-cols-3 gap-6 pt-2 grid grid-cols-1">
        {/* Free Starter Card */}
        <Card
          className={`relative flex flex-col border transition-all ${
            currentPlan === 'starter'
              ? 'border-primary bg-surface shadow-md ring-1 ring-primary/40'
              : 'border-border bg-surface/60 hover:border-border/80'
          }`}
        >
          {currentPlan === 'starter' ? (
            <div className="-top-3 absolute left-1/2 -translate-x-1/2">
              <Badge
                variant="primary"
                className="font-bold px-2.5 py-0.5 text-[10px] shadow-xs"
              >
                CURRENT PLAN
              </Badge>
            </div>
          ) : null}

          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Free Starter</span>
              <div className="p-2 rounded-xl bg-surface-inset text-muted-foreground">
                <Users className="size-4" />
              </div>
            </CardTitle>
            <CardDescription className="text-xs min-h-[32px]">
              For small squads and independent builders getting started.
            </CardDescription>
            <div className="pt-2">
              <div className="gap-1 flex items-baseline">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  $0
                </span>
                <span className="text-xs text-muted-foreground">/ forever</span>
              </div>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Free for up to 5 members
              </span>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 text-xs flex-1">
            <Separator className="my-2" />
            <div className="font-semibold tracking-wider text-[11px] text-foreground uppercase">
              Included Features:
            </div>
            <ul className="space-y-2.5 text-muted-foreground">
              <li className="gap-2 flex items-start">
                <Check className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  Up to <strong>5 team members</strong>
                </span>
              </li>
              <li className="gap-2 flex items-start">
                <Check className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>Standard chat channels & DMs</span>
              </li>
              <li className="gap-2 flex items-start">
                <Check className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>500 AI agent runs/month</span>
              </li>
              <li className="gap-2 flex items-start">
                <Check className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>5 GB shared cloud file storage</span>
              </li>
              <li className="gap-2 flex items-start">
                <Check className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>Kanban tasks & basic notes</span>
              </li>
            </ul>
          </CardContent>

          <CardFooter className="pt-3">
            <Button
              variant={currentPlan === 'starter' ? 'outline' : 'secondary'}
              disabled={currentPlan === 'starter'}
              className="text-xs font-semibold w-full"
            >
              {currentPlan === 'starter' ? 'Current Plan' : 'Downgrade to Free'}
            </Button>
          </CardFooter>
        </Card>

        {/* Pro Team Card (Recommended) */}
        <Card
          className={`relative flex flex-col border transition-all ${
            currentPlan === 'pro'
              ? 'border-primary bg-surface shadow-lg ring-2 ring-primary'
              : 'border-primary/40 bg-gradient-to-b from-primary/5 via-surface to-surface shadow-sm hover:border-primary'
          }`}
        >
          <div className="-top-3 absolute left-1/2 -translate-x-1/2">
            <Badge
              variant="primary"
              className="font-bold px-3 py-0.5 gap-1 flex items-center bg-primary text-[10px] text-primary-foreground shadow-sm"
            >
              <Sparkles className="size-3" />
              {currentPlan === 'pro' ? 'ACTIVE PLAN' : 'RECOMMENDED'}
            </Badge>
          </div>

          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="font-bold text-primary">Pro Team</span>
              <div className="p-2 rounded-xl bg-primary/15 text-primary">
                <Crown className="size-4" />
              </div>
            </CardTitle>
            <CardDescription className="text-xs min-h-[32px]">
              For growing teams requiring fast AI agents, unlimited seats, &
              integrations.
            </CardDescription>
            <div className="pt-2">
              <div className="gap-1 flex items-baseline">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  ${isAnnual ? proAnnualPrice : proMonthlyPrice}
                </span>
                <span className="text-xs text-muted-foreground">
                  / seat / month
                </span>
              </div>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {isAnnual ? 'Billed annually ($120/yr/seat)' : 'Billed monthly'}
              </span>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 text-xs flex-1">
            <Separator className="my-2" />
            <div className="font-semibold tracking-wider text-[11px] text-foreground uppercase">
              Everything in Free, plus:
            </div>
            <ul className="space-y-2.5 text-foreground">
              <li className="gap-2 flex items-start">
                <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  <strong>Unlimited member seats</strong> & channels
                </span>
              </li>
              <li className="gap-2 flex items-start">
                <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  <strong>GPT-4o, Claude 3.5 Sonnet & Gemini Pro</strong>
                </span>
              </li>
              <li className="gap-2 flex items-start">
                <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>Unlimited autonomous AI agents & automations</span>
              </li>
              <li className="gap-2 flex items-start">
                <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  <strong>500 GB</strong> high-speed storage & media backup
                </span>
              </li>
              <li className="gap-2 flex items-start">
                <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>Slack & Notion seamless workspace import/sync</span>
              </li>
              <li className="gap-2 flex items-start">
                <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>Granular channel roles & member permissions</span>
              </li>
            </ul>
          </CardContent>

          <CardFooter className="pt-3">
            <Button
              variant={currentPlan === 'pro' ? 'outline' : 'primary'}
              onClick={() => {
                if (currentPlan !== 'pro') setSelectedPlanForModal('pro');
              }}
              disabled={currentPlan === 'pro'}
              className="text-xs font-semibold w-full shadow-xs"
            >
              {currentPlan === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
            </Button>
          </CardFooter>
        </Card>

        {/* Enterprise Card */}
        <Card
          className={`relative flex flex-col border transition-all ${
            currentPlan === 'enterprise'
              ? 'border-primary bg-surface shadow-lg ring-2 ring-primary'
              : 'border-border bg-surface/60 hover:border-border/80'
          }`}
        >
          {currentPlan === 'enterprise' ? (
            <div className="-top-3 absolute left-1/2 -translate-x-1/2">
              <Badge
                variant="primary"
                className="font-bold px-2.5 py-0.5 text-[10px] shadow-xs"
              >
                ACTIVE PLAN
              </Badge>
            </div>
          ) : null}

          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Enterprise</span>
              <div className="p-2 rounded-xl bg-surface-inset text-muted-foreground">
                <Building className="size-4" />
              </div>
            </CardTitle>
            <CardDescription className="text-xs min-h-[32px]">
              For large organizations with strict security, SSO, and compliance
              standards.
            </CardDescription>
            <div className="pt-2">
              <div className="gap-1 flex items-baseline">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  ${isAnnual ? enterpriseAnnualPrice : enterpriseMonthlyPrice}
                </span>
                <span className="text-xs text-muted-foreground">
                  / seat / month
                </span>
              </div>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {isAnnual
                  ? 'Billed annually'
                  : 'Billed monthly or custom invoicing'}
              </span>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 text-xs flex-1">
            <Separator className="my-2" />
            <div className="font-semibold tracking-wider text-[11px] text-foreground uppercase">
              Everything in Pro, plus:
            </div>
            <ul className="space-y-2.5 text-muted-foreground">
              <li className="gap-2 flex items-start">
                <Check className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  <strong>SAML SSO, SCIM & Okta</strong> directory sync
                </span>
              </li>
              <li className="gap-2 flex items-start">
                <Check className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>Dedicated private AI compute infrastructure</span>
              </li>
              <li className="gap-2 flex items-start">
                <Check className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>Custom retention policies & audit logs</span>
              </li>
              <li className="gap-2 flex items-start">
                <Check className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>Unlimited cloud file & media storage</span>
              </li>
              <li className="gap-2 flex items-start">
                <Check className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>Dedicated customer success manager & 99.99% SLA</span>
              </li>
              <li className="gap-2 flex items-start">
                <Check className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>SOC2 Type II & HIPAA compliance reports</span>
              </li>
            </ul>
          </CardContent>

          <CardFooter className="pt-3">
            <Button
              variant={currentPlan === 'enterprise' ? 'outline' : 'outline'}
              onClick={() => {
                if (currentPlan !== 'enterprise')
                  setSelectedPlanForModal('enterprise');
              }}
              disabled={currentPlan === 'enterprise'}
              className="text-xs font-semibold w-full"
            >
              {currentPlan === 'enterprise'
                ? 'Current Plan'
                : 'Upgrade to Enterprise'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Feature Comparison Matrix Table */}
      <Card className="overflow-hidden border-border/80 bg-surface/70">
        <CardHeader className="pb-4 border-b border-border/60">
          <CardTitle className="text-base gap-2 flex items-center">
            <Sparkles className="size-4 text-primary" />
            Detailed Plan Feature Comparison
          </CardTitle>
          <CardDescription className="text-xs">
            Review detailed capabilities across all subscription tiers
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="text-xs w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-surface-inset/40">
                <th className="py-3 px-4 font-semibold w-1/3 text-foreground">
                  Feature
                </th>
                <th className="py-3 px-4 font-semibold text-center text-foreground">
                  Free Starter
                </th>
                <th className="py-3 px-4 font-semibold text-center text-primary">
                  Pro Team
                </th>
                <th className="py-3 px-4 font-semibold text-center text-foreground">
                  Enterprise
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">
                  Member Seats
                </td>
                <td className="py-3 px-4 text-center text-muted-foreground">
                  Up to 5 seats
                </td>
                <td className="py-3 px-4 font-semibold text-center text-foreground">
                  Unlimited
                </td>
                <td className="py-3 px-4 font-semibold text-center text-foreground">
                  Unlimited
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">
                  Public & Private Channels
                </td>
                <td className="py-3 px-4 text-center text-muted-foreground">
                  Up to 10
                </td>
                <td className="py-3 px-4 font-semibold text-center text-foreground">
                  Unlimited
                </td>
                <td className="py-3 px-4 font-semibold text-center text-foreground">
                  Unlimited
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">
                  AI Models & Vision
                </td>
                <td className="py-3 px-4 text-center text-muted-foreground">
                  GPT-4o mini
                </td>
                <td className="py-3 px-4 font-semibold text-center text-foreground">
                  GPT-4o, Claude 3.5, Gemini Pro
                </td>
                <td className="py-3 px-4 font-semibold text-center text-foreground">
                  Custom & Private Models
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">
                  Autonomous Agents & Workflows
                </td>
                <td className="py-3 px-4 text-center text-muted-foreground">
                  3 active agents
                </td>
                <td className="py-3 px-4 font-semibold text-center text-foreground">
                  Unlimited
                </td>
                <td className="py-3 px-4 font-semibold text-center text-foreground">
                  Unlimited
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">
                  Storage Allocation
                </td>
                <td className="py-3 px-4 text-center text-muted-foreground">
                  5 GB
                </td>
                <td className="py-3 px-4 font-semibold text-center text-foreground">
                  500 GB
                </td>
                <td className="py-3 px-4 font-semibold text-center text-foreground">
                  Unlimited
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">
                  Slack & Notion Migration
                </td>
                <td className="py-3 px-4 text-center text-muted-foreground">
                  Basic Export
                </td>
                <td className="py-3 px-4 font-semibold text-center text-primary">
                  <CheckCircle2 className="size-4 mx-auto" />
                </td>
                <td className="py-3 px-4 font-semibold text-center text-primary">
                  <CheckCircle2 className="size-4 mx-auto" />
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">
                  SAML SSO & SCIM Directory
                </td>
                <td className="py-3 px-4 text-center text-muted-foreground">
                  —
                </td>
                <td className="py-3 px-4 text-center text-muted-foreground">
                  —
                </td>
                <td className="py-3 px-4 font-semibold text-center text-primary">
                  <CheckCircle2 className="size-4 mx-auto" />
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">
                  Support & SLA
                </td>
                <td className="py-3 px-4 text-center text-muted-foreground">
                  Community
                </td>
                <td className="py-3 px-4 font-semibold text-center text-foreground">
                  24/7 Priority Support
                </td>
                <td className="py-3 px-4 font-semibold text-center text-foreground">
                  Dedicated CSM & 99.99% SLA
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Plan Upgrade Modal / Dialog */}
      <Dialog
        open={selectedPlanForModal !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPlanForModal(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="gap-2 flex items-center">
              <Sparkles className="size-5 text-primary" />
              Upgrade to{' '}
              {selectedPlanForModal === 'enterprise'
                ? 'Enterprise'
                : 'Pro Team'}
            </DialogTitle>
            <DialogDescription>
              Select your required seat allocation and confirm your subscription
              for {workspaceName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-3 text-xs">
            {/* Tier Summary Pill */}
            <div className="p-4 space-y-2 rounded-xl border border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-foreground">
                  {selectedPlanForModal === 'enterprise'
                    ? 'Enterprise Tier'
                    : 'Pro Team Tier'}
                </span>
                <Badge variant="primary">${currentPricePerSeat}/seat/mo</Badge>
              </div>
              <p className="text-muted-foreground">
                Includes unlimited member seats, high-speed priority AI compute,
                500GB storage, and full workspace integrations.
              </p>
            </div>

            {/* Seat Quantity Selector */}
            <div className="space-y-2">
              <div className="font-medium flex items-center justify-between">
                <span className="text-foreground">Member Seats Required:</span>
                <span className="font-bold text-sm text-primary">
                  {additionalSeats} Seats
                </span>
              </div>
              <div className="gap-3 flex items-center">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() =>
                    setAdditionalSeats((prev) => Math.max(1, prev - 1))
                  }
                  disabled={additionalSeats <= 1}
                  className="size-8"
                >
                  <Minus className="size-3.5" />
                </Button>
                <div className="font-semibold text-sm py-1.5 flex-1 rounded-lg border border-border bg-surface-inset text-center">
                  {additionalSeats} Active Team Seats
                </div>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setAdditionalSeats((prev) => prev + 1)}
                  className="size-8"
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                You currently have {totalMembers} member(s) in this workspace.
                You can invite more anytime.
              </p>
            </div>

            {/* Billing Interval Selection */}
            <div className="p-3 flex items-center justify-between rounded-xl border border-border bg-surface-inset/50">
              <div>
                <span className="font-medium block text-foreground">
                  {isAnnual ? 'Annual Billing (Save 20%)' : 'Monthly Billing'}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {isAnnual
                    ? `$${currentPricePerSeat} / seat / mo ($${currentPricePerSeat * 12}/yr per seat)`
                    : `$${currentPricePerSeat} / seat / mo charged monthly`}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAnnual(!isAnnual)}
                className="text-xs font-semibold text-primary"
              >
                Switch to {isAnnual ? 'Monthly' : 'Annual'}
              </Button>
            </div>

            {/* Price Summary Breakdown */}
            <div className="p-4 space-y-2 rounded-xl border border-border bg-surface">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>
                  {additionalSeats} seats × ${currentPricePerSeat}/mo
                </span>
                <span>${additionalSeats * currentPricePerSeat}/mo</span>
              </div>
              {isAnnual ? (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Billing cycle</span>
                  <span>12 months (billed annually)</span>
                </div>
              ) : null}
              <Separator />
              <div className="font-bold text-sm pt-1 flex items-center justify-between text-foreground">
                <span>Estimated cost:</span>
                <span className="text-base text-primary">
                  ${totalCalculatedCost}
                </span>
              </div>
              <p className="font-normal pt-1 text-[11px] text-muted-foreground">
                Billing isn't connected yet — this is a price estimate, not a
                checkout. Nothing will be charged and no payment details are
                collected here.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRequestUpgrade}
              className="font-semibold"
            >
              <span className="gap-1.5 flex items-center">
                <Sparkles className="size-4" />
                Notify Me When This Ships
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
