import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Separator,
  Switch,
  toast,
} from '@org/ui';
import { billingApi, queryKeys } from '@org/api-client';
import {
  ACTIVE_PROMOTION_CODE,
  PLANS_CONFIG,
  type CheckoutPlanInput,
  type PlanBillingInterval,
  type PlanTier,
  type ValidatePromotionResponse,
  type WorkspaceBillingSummary,
} from '@org/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Sparkles, Tag } from 'lucide-react';

export interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPlan: PlanTier | null;
  isAnnual: boolean;
  workspaceId?: string;
  initialPromoCode?: string;
  onSuccess?: (summary: WorkspaceBillingSummary) => void;
}

export function CheckoutModal({
  open,
  onOpenChange,
  targetPlan,
  isAnnual,
  workspaceId,
  initialPromoCode,
  onSuccess,
}: CheckoutModalProps) {
  const queryClient = useQueryClient();
  const [promoCodeInput, setPromoCodeInput] = useState<string>(
    initialPromoCode || ACTIVE_PROMOTION_CODE,
  );
  const [appliedPromo, setAppliedPromo] =
    useState<ValidatePromotionResponse | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [startTrial, setStartTrial] = useState(true);

  const plan = targetPlan ? PLANS_CONFIG[targetPlan] : null;

  // Auto-validate promo code on open or when targetPlan changes
  useEffect(() => {
    if (open && targetPlan && workspaceId && promoCodeInput.trim()) {
      handleValidateCode(promoCodeInput.trim());
    }
  }, [open, targetPlan, workspaceId]);

  const handleValidateCode = async (codeToValidate: string) => {
    if (!codeToValidate.trim() || !workspaceId || !targetPlan) return;
    setIsValidatingPromo(true);
    try {
      const res = await billingApi.validatePromotion(
        workspaceId,
        codeToValidate.trim(),
        targetPlan,
      );
      if (res.valid) {
        setAppliedPromo(res);
        toast.success(
          `Promo code "${res.code}" applied! ${res.discountPercent}% off.`,
        );
      } else {
        setAppliedPromo(null);
        toast.error(res.message || 'Invalid promotion code.');
      }
    } catch {
      setAppliedPromo(null);
      toast.error('Could not validate promotion code.');
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const checkoutMutation = useMutation({
    mutationFn: (input: CheckoutPlanInput) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required.');
      }
      return billingApi.checkout(workspaceId, input);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.billing.all(workspaceId as string),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all() });
      toast.success(
        `Success! Your workspace is now upgraded to ${PLANS_CONFIG[updated.plan].name}.`,
      );
      onOpenChange(false);
      onSuccess?.(updated);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to complete plan checkout.');
    },
  });

  if (!plan) return null;

  const interval: PlanBillingInterval = isAnnual ? 'annual' : 'monthly';
  const baseMonthlyPrice = isAnnual ? plan.pricing.annual : plan.pricing.monthly;
  const discountPercent = appliedPromo?.valid ? appliedPromo.discountPercent : 0;
  const discountAmount = (baseMonthlyPrice * discountPercent) / 100;
  const finalPrice = Math.max(0, baseMonthlyPrice - discountAmount);

  const handleConfirmCheckout = () => {
    if (!targetPlan) return;

    checkoutMutation.mutate({
      targetPlan,
      billingInterval: interval,
      promotionCode: appliedPromo?.valid ? appliedPromo.code : undefined,
      startTrial: plan.trialDays ? startTrial : false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b border-border">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="primary" className="text-[10px] uppercase font-bold">
                {interval} billing
              </Badge>
              {plan.isPopular && (
                <Badge variant="secondary" className="text-[10px] uppercase">
                  Most Popular
                </Badge>
              )}
            </div>
            <DialogTitle className="text-xl font-bold text-foreground">
              Confirm {plan.name} Subscription
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {plan.tagline}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          {/* Plan Specs Overview */}
          <div className="rounded-xl border border-border bg-surface-muted/30 p-3.5 space-y-2 text-xs">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Micro Agents Included</span>
              <span className="font-semibold text-foreground">
                {plan.machineLimits.microAgents} Agents
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Compute Allocation</span>
              <span className="font-semibold text-foreground">
                {plan.machineLimits.cpu} CPUs • {plan.machineLimits.ramGb} GB RAM
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Monthly Requests</span>
              <span className="font-semibold text-foreground">
                {plan.machineLimits.requestsPerMonth.toLocaleString()} Requests
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Shared AI Credits</span>
              <span className="font-semibold text-foreground">
                ${plan.machineLimits.aiCreditsUsd} / month
              </span>
            </div>
          </div>

          {/* Promotion Code Box */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Tag className="size-3.5 text-primary" />
              Promotion or Referral Code
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter promo code (e.g. s1nu00780)"
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value)}
                className="text-xs h-9 font-mono uppercase"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isValidatingPromo || !promoCodeInput.trim()}
                onClick={() => handleValidateCode(promoCodeInput)}
                className="shrink-0 text-xs h-9"
              >
                {isValidatingPromo ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  'Apply'
                )}
              </Button>
            </div>

            {appliedPromo?.valid && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                <Check className="size-3.5" />
                <span>
                  Code <strong>{appliedPromo.code}</strong> applied: {appliedPromo.discountPercent}% off!
                </span>
              </div>
            )}
          </div>

          {/* 7-Day Free Trial Option */}
          {Boolean(plan.trialDays && plan.trialDays > 0) && (
            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3.5">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" />
                  Start with a 7-day free trial
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Experience full {plan.name} features free for 7 days.
                </p>
              </div>
              <Switch checked={startTrial} onCheckedChange={setStartTrial} />
            </div>
          )}

          <Separator className="bg-border/60" />

          {/* Price Breakdown */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Base Subscription ({interval})</span>
              <span>${baseMonthlyPrice.toFixed(2)}/mo</span>
            </div>

            {appliedPromo?.valid && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                <span>Promo Discount ({appliedPromo.discountPercent}%)</span>
                <span>-${discountAmount.toFixed(2)}/mo</span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-2 border-t border-border font-bold text-sm text-foreground">
              <span>Amount Due Today</span>
              <div className="text-right">
                <span className="text-lg text-primary">
                  {startTrial ? '$0.00' : `$${finalPrice.toFixed(2)}`}
                </span>
                {startTrial && (
                  <span className="block text-[10px] text-muted-foreground font-normal">
                    (then ${finalPrice.toFixed(2)}/mo after 7 days)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-border bg-surface-muted/30 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={checkoutMutation.isPending}
            onClick={handleConfirmCheckout}
            className="font-semibold"
          >
            {checkoutMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 mr-2 animate-spin" />
                Activating...
              </>
            ) : startTrial ? (
              'Start 7-Day Free Trial'
            ) : (
              'Confirm & Subscribe'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
