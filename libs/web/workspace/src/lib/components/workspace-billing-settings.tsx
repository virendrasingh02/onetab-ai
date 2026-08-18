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
import {
  Bot,
  Building,
  Check,
  CheckCircle2,
  CreditCard,
  Crown,
  Database,
  Minus,
  Plus,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

export interface WorkspaceBillingSettingsProps {
  totalMembers?: number;
  workspaceName?: string;
  isOwner?: boolean;
}

export function WorkspaceBillingSettings({
  totalMembers = 1,
  workspaceName = 'Workspace',
  isOwner = true,
}: WorkspaceBillingSettingsProps) {
  const [isAnnual, setIsAnnual] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<'starter' | 'pro' | 'enterprise'>('starter');
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<
    'starter' | 'pro' | 'enterprise' | null
  >(null);
  const [additionalSeats, setAdditionalSeats] = useState(totalMembers > 5 ? totalMembers : 5);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeSuccessMessage, setUpgradeSuccessMessage] = useState<string | null>(null);

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

  const totalCalculatedCost = (additionalSeats * currentPricePerSeat) * (isAnnual ? 12 : 1);

  const handleSimulateUpgrade = () => {
    if (!selectedPlanForModal) return;
    setIsUpgrading(true);
    setTimeout(() => {
      setIsUpgrading(false);
      setCurrentPlan(selectedPlanForModal);
      const planName =
        selectedPlanForModal === 'pro'
          ? 'Pro Team'
          : selectedPlanForModal === 'enterprise'
            ? 'Enterprise'
            : 'Free Starter';
      setUpgradeSuccessMessage(
        `Successfully upgraded ${workspaceName} to the ${planName} plan with ${additionalSeats} seats!`,
      );
      setSelectedPlanForModal(null);
    }, 900);
  };

  return (
    <div className="space-y-8">
      {/* Top Banner / Feedback Alert */}
      {upgradeSuccessMessage ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
            <p className="text-sm font-medium">{upgradeSuccessMessage}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUpgradeSuccessMessage(null)}
            className="text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-300"
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      {/* Header & Plan Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span>Plans & Billing</span>
            <Badge variant="primary" className="text-xs px-2 font-semibold uppercase">
              {currentPlan === 'enterprise'
                ? 'Enterprise'
                : currentPlan === 'pro'
                  ? 'Pro Team'
                  : 'Free Tier'}
            </Badge>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your subscription tier, member seat allocations, and compute quotas.
          </p>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="inline-flex items-center gap-3 bg-surface border border-border px-3.5 py-1.5 rounded-full shadow-2xs self-start md:self-auto">
          <span
            className={`text-xs font-medium cursor-pointer transition-colors ${
              !isAnnual ? 'text-foreground font-semibold' : 'text-muted-foreground'
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
            className={`text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 ${
              isAnnual ? 'text-foreground font-semibold' : 'text-muted-foreground'
            }`}
            onClick={() => setIsAnnual(true)}
          >
            <span>Annually</span>
            <Badge
              variant="info"
              className="text-[10px] px-1.5 py-0 font-bold bg-primary/15 text-primary border-primary/20"
            >
              SAVE 20%
            </Badge>
          </span>
        </div>
      </div>

      {/* Current Workspace Resource Quotas Card */}
      <Card className="border-border/80 bg-surface/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="size-4 text-primary" />
                Workspace Quota & Usage
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time consumption for {workspaceName} in the current billing cycle
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
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Member Seats */}
          <div className="rounded-xl border border-border bg-surface-inset/40 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
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
                    ? 'bg-amber-500'
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

          {/* AI Compute */}
          <div className="rounded-xl border border-border bg-surface-inset/40 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <Bot className="size-3.5" />
                AI Agent Runs
              </span>
              <span className="font-semibold text-foreground">
                {currentPlan === 'starter' ? '120 / 500' : 'Unlimited'}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: `${currentPlan === 'starter' ? 24 : 10}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {currentPlan === 'starter'
                ? 'Standard GPT-4o mini runs included'
                : 'High-speed GPT-4o, Claude 3.5 & Gemini Pro'}
            </p>
          </div>

          {/* Storage */}
          <div className="rounded-xl border border-border bg-surface-inset/40 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <Database className="size-3.5" />
                File & Media Storage
              </span>
              <span className="font-semibold text-foreground">
                {currentPlan === 'starter' ? '1.2 GB / 5 GB' : '1.2 GB / 500 GB'}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${currentPlan === 'starter' ? 24 : 3}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {currentPlan === 'starter'
                ? '5 GB shared workspace file storage'
                : '500 GB high-speed encrypted cloud storage'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Tier Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        {/* Free Starter Card */}
        <Card
          className={`relative flex flex-col border transition-all ${
            currentPlan === 'starter'
              ? 'border-primary ring-1 ring-primary/40 bg-surface shadow-md'
              : 'border-border bg-surface/60 hover:border-border/80'
          }`}
        >
          {currentPlan === 'starter' ? (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge variant="primary" className="text-[10px] font-bold px-2.5 py-0.5 shadow-xs">
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
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">$0</span>
                <span className="text-xs text-muted-foreground">/ forever</span>
              </div>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                Free for up to 5 members
              </span>
            </div>
          </CardHeader>

          <CardContent className="flex-1 space-y-3 text-xs">
            <Separator className="my-2" />
            <div className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
              Included Features:
            </div>
            <ul className="space-y-2.5 text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="size-4 shrink-0 text-primary mt-0.5" />
                <span>Up to <strong>5 team members</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-4 shrink-0 text-primary mt-0.5" />
                <span>Standard chat channels & DMs</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-4 shrink-0 text-primary mt-0.5" />
                <span>500 AI agent runs/month</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-4 shrink-0 text-primary mt-0.5" />
                <span>5 GB shared cloud file storage</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-4 shrink-0 text-primary mt-0.5" />
                <span>Kanban tasks & basic notes</span>
              </li>
            </ul>
          </CardContent>

          <CardFooter className="pt-3">
            <Button
              variant={currentPlan === 'starter' ? 'outline' : 'secondary'}
              disabled={currentPlan === 'starter'}
              className="w-full text-xs font-semibold"
            >
              {currentPlan === 'starter' ? 'Current Plan' : 'Downgrade to Free'}
            </Button>
          </CardFooter>
        </Card>

        {/* Pro Team Card (Recommended) */}
        <Card
          className={`relative flex flex-col border transition-all ${
            currentPlan === 'pro'
              ? 'border-primary ring-2 ring-primary bg-surface shadow-lg'
              : 'border-primary/40 bg-gradient-to-b from-primary/5 via-surface to-surface hover:border-primary shadow-sm'
          }`}
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge
              variant="primary"
              className="text-[10px] font-bold px-3 py-0.5 bg-primary text-primary-foreground shadow-sm flex items-center gap-1"
            >
              <Sparkles className="size-3" />
              {currentPlan === 'pro' ? 'ACTIVE PLAN' : 'RECOMMENDED'}
            </Badge>
          </div>

          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="text-primary font-bold">Pro Team</span>
              <div className="p-2 rounded-xl bg-primary/15 text-primary">
                <Crown className="size-4" />
              </div>
            </CardTitle>
            <CardDescription className="text-xs min-h-[32px]">
              For growing teams requiring fast AI agents, unlimited seats, & integrations.
            </CardDescription>
            <div className="pt-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  ${isAnnual ? proAnnualPrice : proMonthlyPrice}
                </span>
                <span className="text-xs text-muted-foreground">/ seat / month</span>
              </div>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                {isAnnual ? 'Billed annually ($120/yr/seat)' : 'Billed monthly'}
              </span>
            </div>
          </CardHeader>

          <CardContent className="flex-1 space-y-3 text-xs">
            <Separator className="my-2" />
            <div className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
              Everything in Free, plus:
            </div>
            <ul className="space-y-2.5 text-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-primary mt-0.5" />
                <span><strong>Unlimited member seats</strong> & channels</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-primary mt-0.5" />
                <span><strong>GPT-4o, Claude 3.5 Sonnet & Gemini Pro</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-primary mt-0.5" />
                <span>Unlimited autonomous AI agents & automations</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-primary mt-0.5" />
                <span><strong>500 GB</strong> high-speed storage & media backup</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-primary mt-0.5" />
                <span>Slack & Notion seamless workspace import/sync</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-primary mt-0.5" />
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
              className="w-full text-xs font-semibold shadow-xs"
            >
              {currentPlan === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
            </Button>
          </CardFooter>
        </Card>

        {/* Enterprise Card */}
        <Card
          className={`relative flex flex-col border transition-all ${
            currentPlan === 'enterprise'
              ? 'border-primary ring-2 ring-primary bg-surface shadow-lg'
              : 'border-border bg-surface/60 hover:border-border/80'
          }`}
        >
          {currentPlan === 'enterprise' ? (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge variant="primary" className="text-[10px] font-bold px-2.5 py-0.5 shadow-xs">
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
              For large organizations with strict security, SSO, and compliance standards.
            </CardDescription>
            <div className="pt-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  ${isAnnual ? enterpriseAnnualPrice : enterpriseMonthlyPrice}
                </span>
                <span className="text-xs text-muted-foreground">/ seat / month</span>
              </div>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                {isAnnual ? 'Billed annually' : 'Billed monthly or custom invoicing'}
              </span>
            </div>
          </CardHeader>

          <CardContent className="flex-1 space-y-3 text-xs">
            <Separator className="my-2" />
            <div className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
              Everything in Pro, plus:
            </div>
            <ul className="space-y-2.5 text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="size-4 shrink-0 text-primary mt-0.5" />
                <span><strong>SAML SSO, SCIM & Okta</strong> directory sync</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-4 shrink-0 text-primary mt-0.5" />
                <span>Dedicated private AI compute infrastructure</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-4 shrink-0 text-primary mt-0.5" />
                <span>Custom retention policies & audit logs</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-4 shrink-0 text-primary mt-0.5" />
                <span>Unlimited cloud file & media storage</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-4 shrink-0 text-primary mt-0.5" />
                <span>Dedicated customer success manager & 99.99% SLA</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-4 shrink-0 text-primary mt-0.5" />
                <span>SOC2 Type II & HIPAA compliance reports</span>
              </li>
            </ul>
          </CardContent>

          <CardFooter className="pt-3">
            <Button
              variant={currentPlan === 'enterprise' ? 'outline' : 'outline'}
              onClick={() => {
                if (currentPlan !== 'enterprise') setSelectedPlanForModal('enterprise');
              }}
              disabled={currentPlan === 'enterprise'}
              className="w-full text-xs font-semibold"
            >
              {currentPlan === 'enterprise' ? 'Current Plan' : 'Upgrade to Enterprise'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Feature Comparison Matrix Table */}
      <Card className="border-border/80 bg-surface/70 overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Detailed Plan Feature Comparison
          </CardTitle>
          <CardDescription className="text-xs">
            Review detailed capabilities across all subscription tiers
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-inset/40">
                <th className="py-3 px-4 font-semibold text-foreground w-1/3">Feature</th>
                <th className="py-3 px-4 font-semibold text-foreground text-center">Free Starter</th>
                <th className="py-3 px-4 font-semibold text-primary text-center">Pro Team</th>
                <th className="py-3 px-4 font-semibold text-foreground text-center">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Member Seats</td>
                <td className="py-3 px-4 text-center text-muted-foreground">Up to 5 seats</td>
                <td className="py-3 px-4 text-center font-semibold text-foreground">Unlimited</td>
                <td className="py-3 px-4 text-center font-semibold text-foreground">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Public & Private Channels</td>
                <td className="py-3 px-4 text-center text-muted-foreground">Up to 10</td>
                <td className="py-3 px-4 text-center font-semibold text-foreground">Unlimited</td>
                <td className="py-3 px-4 text-center font-semibold text-foreground">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">AI Models & Vision</td>
                <td className="py-3 px-4 text-center text-muted-foreground">GPT-4o mini</td>
                <td className="py-3 px-4 text-center font-semibold text-foreground">
                  GPT-4o, Claude 3.5, Gemini Pro
                </td>
                <td className="py-3 px-4 text-center font-semibold text-foreground">
                  Custom & Private Models
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Autonomous Agents & Workflows</td>
                <td className="py-3 px-4 text-center text-muted-foreground">3 active agents</td>
                <td className="py-3 px-4 text-center font-semibold text-foreground">Unlimited</td>
                <td className="py-3 px-4 text-center font-semibold text-foreground">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Storage Allocation</td>
                <td className="py-3 px-4 text-center text-muted-foreground">5 GB</td>
                <td className="py-3 px-4 text-center font-semibold text-foreground">500 GB</td>
                <td className="py-3 px-4 text-center font-semibold text-foreground">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Slack & Notion Migration</td>
                <td className="py-3 px-4 text-center text-muted-foreground">Basic Export</td>
                <td className="py-3 px-4 text-center text-primary font-semibold">
                  <CheckCircle2 className="size-4 mx-auto" />
                </td>
                <td className="py-3 px-4 text-center text-primary font-semibold">
                  <CheckCircle2 className="size-4 mx-auto" />
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">SAML SSO & SCIM Directory</td>
                <td className="py-3 px-4 text-center text-muted-foreground">—</td>
                <td className="py-3 px-4 text-center text-muted-foreground">—</td>
                <td className="py-3 px-4 text-center text-primary font-semibold">
                  <CheckCircle2 className="size-4 mx-auto" />
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Support & SLA</td>
                <td className="py-3 px-4 text-center text-muted-foreground">Community</td>
                <td className="py-3 px-4 text-center font-semibold text-foreground">24/7 Priority Support</td>
                <td className="py-3 px-4 text-center font-semibold text-foreground">Dedicated CSM & 99.99% SLA</td>
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
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              Upgrade to {selectedPlanForModal === 'enterprise' ? 'Enterprise' : 'Pro Team'}
            </DialogTitle>
            <DialogDescription>
              Select your required seat allocation and confirm your subscription for {workspaceName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-3 text-xs">
            {/* Tier Summary Pill */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-sm">
                  {selectedPlanForModal === 'enterprise' ? 'Enterprise Tier' : 'Pro Team Tier'}
                </span>
                <Badge variant="primary">
                  ${currentPricePerSeat}/seat/mo
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Includes unlimited member seats, high-speed priority AI compute, 500GB storage, and full workspace integrations.
              </p>
            </div>

            {/* Seat Quantity Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between font-medium">
                <span className="text-foreground">Member Seats Required:</span>
                <span className="text-primary font-bold text-sm">{additionalSeats} Seats</span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setAdditionalSeats((prev) => Math.max(1, prev - 1))}
                  disabled={additionalSeats <= 1}
                  className="size-8"
                >
                  <Minus className="size-3.5" />
                </Button>
                <div className="flex-1 text-center font-semibold text-sm bg-surface-inset py-1.5 rounded-lg border border-border">
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
                You currently have {totalMembers} member(s) in this workspace. You can invite more anytime.
              </p>
            </div>

            {/* Billing Interval Selection */}
            <div className="rounded-xl border border-border bg-surface-inset/50 p-3 flex items-center justify-between">
              <div>
                <span className="font-medium text-foreground block">
                  {isAnnual ? 'Annual Billing (Save 20%)' : 'Monthly Billing'}
                </span>
                <span className="text-muted-foreground text-[11px]">
                  {isAnnual
                    ? `$${currentPricePerSeat} / seat / mo ($${currentPricePerSeat * 12}/yr per seat)`
                    : `$${currentPricePerSeat} / seat / mo charged monthly`}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAnnual(!isAnnual)}
                className="text-xs text-primary font-semibold"
              >
                Switch to {isAnnual ? 'Monthly' : 'Annual'}
              </Button>
            </div>

            {/* Price Summary Breakdown */}
            <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{additionalSeats} seats × ${currentPricePerSeat}/mo</span>
                <span>${additionalSeats * currentPricePerSeat}/mo</span>
              </div>
              {isAnnual ? (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Billing cycle</span>
                  <span>12 months (billed annually)</span>
                </div>
              ) : null}
              <Separator />
              <div className="flex items-center justify-between text-foreground font-bold text-sm pt-1">
                <span>Total Due Today:</span>
                <span className="text-primary text-base">${totalCalculatedCost}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="ghost" size="sm" disabled={isUpgrading}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSimulateUpgrade}
              disabled={isUpgrading}
              className="font-semibold"
            >
              {isUpgrading ? (
                <span className="flex items-center gap-2">
                  <span className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Processing Upgrade...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <CreditCard className="size-4" />
                  Confirm & Upgrade — ${totalCalculatedCost}
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
