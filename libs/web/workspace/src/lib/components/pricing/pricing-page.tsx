import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Switch,
  toast,
} from '@org/ui';
import { analyticsApi } from '@org/api-client';
import {
  ACTIVE_PROMOTION_CODE,
  PLAN_TIERS,
  PLANS_CONFIG,
  type PlanTier,
} from '@org/types';
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  HelpCircle,
  Percent,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePlanEntitlements } from '../../hooks/use-plan-entitlements.js';
import { useCurrentWorkspace } from '../../use-workspaces.js';
import { CheckoutModal } from './checkout-modal.js';
import { DowngradeConfirmModal } from './downgrade-confirm-modal.js';
import { EnterpriseContactModal } from './enterprise-contact-modal.js';
import { PlanComparisonTable } from './plan-comparison-table.js';
import { PricingCard } from './pricing-card.js';

export interface PricingPageProps {
  embedded?: boolean;
}

export function PricingPage({ embedded = false }: PricingPageProps) {
  const navigate = useNavigate();
  const { workspaceId } = useCurrentWorkspace();
  const { plan: currentPlan, canManageBilling } = usePlanEntitlements(workspaceId);

  const [isAnnual, setIsAnnual] = useState(true);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] =
    useState<PlanTier | null>(null);
  const [selectedPlanForDowngrade, setSelectedPlanForDowngrade] =
    useState<PlanTier | null>(null);
  const [isEnterpriseModalOpen, setIsEnterpriseModalOpen] = useState(false);
  const promoCodeToApply = ACTIVE_PROMOTION_CODE;

  // Track page view
  useEffect(() => {
    if (workspaceId) {
      analyticsApi
        .trackEvent(workspaceId, 'pricing_viewed', {
          currentPlan,
          isAnnual,
        })
        .catch(() => {
          // Non-blocking telemetry
        });
    }
  }, [workspaceId]);

  const handleToggleBilling = (annual: boolean) => {
    setIsAnnual(annual);
    if (workspaceId) {
      analyticsApi
        .trackEvent(
          workspaceId,
          annual ? 'pricing_toggle_yearly' : 'pricing_toggle_monthly',
          { currentPlan },
        )
        .catch(() => {});
    }
  };

  const handlePlanSelection = (tier: PlanTier) => {
    if (workspaceId) {
      analyticsApi
        .trackEvent(workspaceId, 'pricing_plan_selected', {
          targetPlan: tier,
          currentPlan,
          isAnnual,
        })
        .catch(() => {});
    }

    if (tier === 'enterprise') {
      setIsEnterpriseModalOpen(true);
      return;
    }

    if (!workspaceId) {
      // Guest or unauthenticated user: redirect to register with selected plan
      navigate(`/register?plan=${tier}&interval=${isAnnual ? 'annual' : 'monthly'}`);
      return;
    }

    if (tier === currentPlan) {
      toast.info(`Your workspace is already on the ${PLANS_CONFIG[tier].name} plan.`);
      return;
    }

    const currentIdx = PLAN_TIERS.indexOf(currentPlan);
    const targetIdx = PLAN_TIERS.indexOf(tier);

    if (targetIdx > currentIdx) {
      setSelectedPlanForCheckout(tier);
    } else {
      setSelectedPlanForDowngrade(tier);
    }
  };

  const handleCopyPromo = () => {
    navigator.clipboard.writeText(ACTIVE_PROMOTION_CODE);
    toast.success(`Copied code "${ACTIVE_PROMOTION_CODE}" to clipboard!`);
  };

  const faqs = [
    {
      q: 'What is a Micro Agent?',
      a: 'A Micro Agent is a focused, autonomous intelligence unit deployed within your workspace to handle specialized tasks—such as code reviews, database migrations, document summarization, or workflow automation.',
    },
    {
      q: 'How do shared AI credits work?',
      a: 'Every monthly billing cycle provides a pool of shared AI credits ($5 on Starter, Pro, and Business). These credits are drawn down transparently across model requests, embeddings, and tool executions. You can also top up credits at any time.',
    },
    {
      q: 'What is the 7-day free trial policy?',
      a: 'You can trial any tier (Starter, Pro, or Business) completely free for 7 days. You will not be charged until the trial concludes, and you can cancel anytime from your Billing settings without penalty.',
    },
    {
      q: 'How do promotional discount codes work?',
      a: `Applying code "${ACTIVE_PROMOTION_CODE}" gives you a 100% discount ($0/month) across our subscription tiers. Enter the code during checkout or click "Apply Promo" to unlock immediate activation.`,
    },
    {
      q: 'Can I change my plan or cancel at any time?',
      a: 'Yes. Upgrades take effect immediately with prorated credits. Downgrades allow you to keep existing data while adapting your resource allocations. Subscriptions can be paused or cancelled anytime.',
    },
  ];

  return (
    <div className={`space-y-12 ${embedded ? 'py-2' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10'}`}>
      {/* 1. Header Section */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold">
          <Sparkles className="size-3.5" />
          Predictable, Transparent AI Pricing
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
          Scale AI Micro-Agents With Zero Guesswork
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Dedicated compute limits, transparent shared AI credits, and autonomous micro-agents tailored for modern development teams.
        </p>

        {/* Monthly / Annual Billing Toggle Switch */}
        <div className="pt-3 flex items-center justify-center gap-3">
          <span
            className={`text-xs font-semibold transition-colors ${
              !isAnnual ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            Monthly Billing
          </span>
          <Switch
            checked={isAnnual}
            onCheckedChange={handleToggleBilling}
          />
          <span
            className={`text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              isAnnual ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            Annual Billing
            <Badge
              variant="primary"
              className="px-2 py-0 text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            >
              SAVE 20%
            </Badge>
          </span>
        </div>
      </div>

      {/* 2. Promotional Announcement Banner */}
      <div className="max-w-4xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-card p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5 text-left">
            <div className="size-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 text-primary">
              <Percent className="size-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-sm">
                  Limited Time Launch Promotion: 100% OFF
                </span>
                <Badge variant="primary" className="text-[10px] font-mono font-bold">
                  {ACTIVE_PROMOTION_CODE}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Get full access to all plans for $0/mo with promotional code{' '}
                <strong className="text-foreground">{ACTIVE_PROMOTION_CODE}</strong>. Includes 7-day free trial.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyPromo}
              className="text-xs h-8.5 gap-1.5 flex-1 sm:flex-none"
            >
              <Copy className="size-3.5" />
              Copy Code
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handlePlanSelection('pro')}
              className="text-xs h-8.5 gap-1.5 font-semibold flex-1 sm:flex-none"
            >
              Claim Offer
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* 3. The 4 Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLAN_TIERS.map((tier) => (
          <PricingCard
            key={tier}
            tier={tier}
            isAnnual={isAnnual}
            isCurrent={currentPlan === tier}
            canManageBilling={canManageBilling}
            onSelectPlan={handlePlanSelection}
          />
        ))}
      </div>

      {/* 4. Complete Feature Comparison Matrix */}
      <div className="pt-6">
        <PlanComparisonTable
          currentPlan={currentPlan}
          onSelectPlan={handlePlanSelection}
        />
      </div>

      {/* 5. Frequently Asked Questions (FAQ) */}
      <div className="pt-8 max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-1.5">
          <h3 className="text-2xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
            <HelpCircle className="size-5 text-primary" />
            Frequently Asked Questions
          </h3>
          <p className="text-xs text-muted-foreground">
            Everything you need to know about micro-agent limits, compute quotas, and billing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {faqs.map((faq, idx) => (
            <Card key={idx} className="border-border bg-card/60 p-4 space-y-1.5">
              <h4 className="text-xs font-bold text-foreground flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-primary mt-0.5 shrink-0" />
                {faq.q}
              </h4>
              <p className="text-xs text-muted-foreground pl-5.5 leading-relaxed">
                {faq.a}
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* 6. Enterprise Bottom Banner */}
      <div className="rounded-2xl border border-border bg-gradient-to-b from-surface-muted/60 to-surface-muted/20 p-8 text-center space-y-3 max-w-4xl mx-auto">
        <ShieldCheck className="size-8 mx-auto text-primary" />
        <h4 className="text-lg font-bold text-foreground">
          Need Custom On-Premises or Private Cloud LLMs?
        </h4>
        <p className="text-xs text-muted-foreground max-w-xl mx-auto">
          Our Enterprise plan supports connecting your self-hosted Ollama, vLLM cluster, Azure OpenAI tenant, or custom VPC with custom data retention and dedicated SLAs.
        </p>
        <div className="pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsEnterpriseModalOpen(true)}
            className="text-xs font-semibold"
          >
            Contact Enterprise Sales
          </Button>
        </div>
      </div>

      {/* Checkout Modal */}
      <CheckoutModal
        open={Boolean(selectedPlanForCheckout)}
        onOpenChange={(open) => !open && setSelectedPlanForCheckout(null)}
        targetPlan={selectedPlanForCheckout}
        isAnnual={isAnnual}
        workspaceId={workspaceId}
        initialPromoCode={promoCodeToApply}
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
    </div>
  );
}
