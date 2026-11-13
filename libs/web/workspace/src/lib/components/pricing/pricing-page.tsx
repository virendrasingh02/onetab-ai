import { useEffect, useState } from 'react';
import { Badge, Button, Card, Switch, toast } from '@org/ui';
import { analyticsApi } from '@org/api-client';
import { PLAN_TIERS, PLANS_CONFIG, type PlanTier } from '@org/types';
import { CheckCircle2, HelpCircle, ShieldCheck, Sparkles } from 'lucide-react';
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
  const {
    plan: currentPlan,
    canManageBilling,
    paymentsEnabled,
  } = usePlanEntitlements(workspaceId);

  const [isAnnual, setIsAnnual] = useState(true);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] =
    useState<PlanTier | null>(null);
  const [selectedPlanForDowngrade, setSelectedPlanForDowngrade] =
    useState<PlanTier | null>(null);
  const [isEnterpriseModalOpen, setIsEnterpriseModalOpen] = useState(false);

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
        // Analytics is best-effort; a failed ping must never block the toggle.
        .catch(() => undefined);
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
        // Analytics is best-effort; a failed ping must never block plan selection.
        .catch(() => undefined);
    }

    if (tier === 'enterprise') {
      setIsEnterpriseModalOpen(true);
      return;
    }

    if (!workspaceId) {
      // Guest or unauthenticated user: redirect to register with selected plan
      navigate(
        `/register?plan=${tier}&interval=${isAnnual ? 'annual' : 'monthly'}`,
      );
      return;
    }

    if (tier === currentPlan) {
      toast.info(
        `Your workspace is already on the ${PLANS_CONFIG[tier].name} plan.`,
      );
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

  const faqs = [
    {
      q: 'What is a Micro Agent?',
      a: 'A Micro Agent is a focused, autonomous intelligence unit deployed within your workspace to handle specialized tasks—such as code reviews, database migrations, document summarization, or workflow automation.',
    },
    {
      q: 'How do shared AI credits work?',
      a: 'Each plan includes a pool of shared AI credits that is drawn down across model requests, embeddings, and tool executions. Paid plans refresh their included credits every billing period, and you can top up at any time.',
    },
    {
      q: 'Is there a free trial?',
      a: 'Eligible paid plans offer a one-time free trial. A payment method is required to start it and you are charged automatically when it ends unless you cancel first from Billing settings.',
    },
    {
      q: 'How do coupon codes work?',
      a: 'Enter a coupon code at checkout. The discount is calculated and verified on our servers for the plan and billing interval you choose, and you see the exact total before you pay.',
    },
    {
      q: 'Can I change my plan or cancel at any time?',
      a: 'Upgrades start immediately. Downgrades and cancellations take effect at the end of your current billing period, so you keep what you paid for, and your data is always preserved.',
    },
  ];

  return (
    <div
      className={`space-y-12 ${embedded ? 'py-2' : 'max-w-7xl px-4 sm:px-6 lg:px-8 py-10 mx-auto'}`}
    >
      {/* 1. Header Section */}
      <div className="space-y-4 max-w-3xl mx-auto text-center">
        <div className="gap-2 px-3 py-1 text-xs font-semibold inline-flex items-center rounded-full border border-brand/20 bg-brand/5 text-brand-text">
          <Sparkles className="size-3.5" />
          Predictable, Transparent AI Pricing
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
          Scale AI Micro-Agents With Zero Guesswork
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Dedicated compute limits, transparent shared AI credits, and
          autonomous micro-agents tailored for modern development teams.
        </p>

        {/* Monthly / Annual Billing Toggle Switch */}
        <div className="pt-3 gap-3 flex items-center justify-center">
          <span
            className={`text-xs font-semibold transition-colors ${
              !isAnnual ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            Monthly Billing
          </span>
          <Switch checked={isAnnual} onCheckedChange={handleToggleBilling} />
          <span
            className={`text-xs font-semibold gap-1.5 flex items-center transition-colors ${
              isAnnual ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            Annual Billing
            <Badge
              variant="primary"
              className="px-2 py-0 font-bold border-success/20 bg-success/15 text-2xs text-success-text"
            >
              SAVE 20%
            </Badge>
          </span>
        </div>
      </div>

      {/* 3. The 4 Plan Cards Grid */}
      <div className="md:grid-cols-2 lg:grid-cols-4 gap-6 grid grid-cols-1">
        {PLAN_TIERS.map((tier) => (
          <PricingCard
            key={tier}
            tier={tier}
            isAnnual={isAnnual}
            isCurrent={currentPlan === tier}
            currentTier={currentPlan}
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
      <div className="pt-8 max-w-4xl space-y-6 mx-auto">
        <div className="space-y-1.5 text-center">
          <h3 className="text-2xl font-bold tracking-tight gap-2 flex items-center justify-center text-foreground">
            <HelpCircle className="size-5 text-primary" />
            Frequently Asked Questions
          </h3>
          <p className="text-xs text-muted-foreground">
            Everything you need to know about plans, limits, and billing.
          </p>
        </div>

        <div className="md:grid-cols-2 gap-4 grid grid-cols-1">
          {faqs.map((faq, idx) => (
            <Card
              key={idx}
              className="p-4 space-y-1.5 border-border bg-card/60"
            >
              <h4 className="text-xs font-bold gap-2 flex items-start text-foreground">
                <CheckCircle2 className="size-3.5 mt-0.5 shrink-0 text-primary" />
                {faq.q}
              </h4>
              <p className="text-xs pl-5.5 leading-relaxed text-muted-foreground">
                {faq.a}
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* 6. Enterprise Bottom Banner */}
      <div className="p-8 space-y-3 max-w-4xl mx-auto rounded-2xl border border-border bg-gradient-to-b from-surface-muted/60 to-surface-muted/20 text-center">
        <ShieldCheck className="size-8 mx-auto text-primary" />
        <h4 className="text-lg font-bold text-foreground">
          Need Custom On-Premises or Private Cloud LLMs?
        </h4>
        <p className="text-xs max-w-xl mx-auto text-muted-foreground">
          Our Enterprise plan supports connecting your self-hosted Ollama, vLLM
          cluster, Azure OpenAI tenant, or custom VPC with custom data retention
          and dedicated SLAs.
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
    </div>
  );
}
