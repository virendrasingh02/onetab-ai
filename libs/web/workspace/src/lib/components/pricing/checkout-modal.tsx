import { useEffect, useMemo, useRef, useState } from 'react';
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
  Skeleton,
  Switch,
  toast,
} from '@org/ui';
import { billingApi, queryKeys } from '@org/api-client';
import {
  PLANS_CONFIG,
  type CheckoutPlanInput,
  type CheckoutSessionDto,
  type PlanBillingInterval,
  type PlanTier,
  type ValidatePromotionResponse,
} from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Loader2, Sparkles, Tag, X } from 'lucide-react';

export interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPlan: PlanTier | null;
  isAnnual: boolean;
  workspaceId?: string;
  initialPromoCode?: string;
  /** False when the deployment has no payment provider: only $0 (coupon) checkouts can complete. */
  paymentsEnabled?: boolean;
  onSuccess?: (session: CheckoutSessionDto) => void;
}

const money = (cents: number, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);

/** Pure presentation of a server quote; the browser never computes a payable total. */
export function CheckoutModal({
  open,
  onOpenChange,
  targetPlan,
  isAnnual,
  workspaceId,
  initialPromoCode,
  paymentsEnabled = true,
  onSuccess,
}: CheckoutModalProps) {
  const queryClient = useQueryClient();
  const [promoInput, setPromoInput] = useState(initialPromoCode ?? '');
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [startTrial, setStartTrial] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // One key per attempt: a double-click or retry cannot create two checkouts.
  const idempotencyKey = useRef<string>('');

  const plan = targetPlan ? PLANS_CONFIG[targetPlan] : null;
  const interval: PlanBillingInterval = isAnnual ? 'annual' : 'monthly';

  useEffect(() => {
    if (open) {
      setAppliedCode(null);
      setCouponError(null);
      setCheckoutError(null);
      setPromoInput(initialPromoCode ?? '');
      setStartTrial(false);
      idempotencyKey.current = crypto.randomUUID();
    }
  }, [open, targetPlan, isAnnual, initialPromoCode]);

  const quoteInput: CheckoutPlanInput | null = targetPlan
    ? {
        targetPlan,
        billingInterval: interval,
        promotionCode: appliedCode ?? undefined,
        startTrial: startTrial || undefined,
      }
    : null;

  const quoteQuery = useQuery({
    queryKey: queryKeys.billing.quote(
      workspaceId ?? '',
      targetPlan ?? '',
      interval,
      appliedCode ?? '',
      startTrial,
    ),
    queryFn: () => billingApi.quote(workspaceId as string, quoteInput as CheckoutPlanInput),
    enabled: open && !!workspaceId && !!quoteInput,
    retry: false,
  });
  const quote = quoteQuery.data;

  const applyCoupon = async () => {
    const code = promoInput.trim();
    if (!code || !workspaceId || !targetPlan) return;
    setIsApplying(true);
    setCouponError(null);
    try {
      const res: ValidatePromotionResponse = await billingApi.validatePromotion(
        workspaceId,
        code,
        targetPlan,
        interval,
      );
      if (res.valid) {
        setAppliedCode(res.code);
        idempotencyKey.current = crypto.randomUUID();
      } else {
        setAppliedCode(null);
        setCouponError(res.message ?? 'That coupon cannot be applied.');
      }
    } catch (err) {
      setAppliedCode(null);
      setCouponError(err instanceof Error ? err.message : 'Could not validate the coupon.');
    } finally {
      setIsApplying(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCode(null);
    setPromoInput('');
    setCouponError(null);
    idempotencyKey.current = crypto.randomUUID();
  };

  const checkoutMutation = useMutation({
    mutationFn: (input: CheckoutPlanInput) => {
      if (!workspaceId) throw new Error('Workspace is required.');
      return billingApi.checkout(workspaceId, { ...input, idempotencyKey: idempotencyKey.current });
    },
    onSuccess: (session) => {
      setCheckoutError(null);
      if (session.redirectUrl) {
        // Hosted payment page; the plan changes only after the provider confirms payment.
        window.location.assign(session.redirectUrl);
        return;
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.all(workspaceId as string) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all() });
      if (session.status === 'COMPLETED') {
        toast.success('Your plan is active.');
        onOpenChange(false);
        onSuccess?.(session);
      } else {
        setCheckoutError(session.failureReason ?? 'Checkout did not complete.');
      }
    },
    onError: (err: Error) => setCheckoutError(err.message || 'Checkout failed. Please try again.'),
  });

  const trialDaysAvailable = paymentsEnabled ? (plan?.trialDays ?? 0) : 0;
  const blockedNoProvider = !paymentsEnabled && !!quote && quote.totalCents > 0;
  const dueNow = quote?.dueNowCents ?? 0;
  const ctaLabel = useMemo(() => {
    if (checkoutMutation.isPending) return 'Working…';
    if (quote && quote.trialDays > 0) return `Start ${quote.trialDays}-day free trial`;
    if (quote && quote.totalCents === 0) return 'Activate plan';
    return 'Continue to payment';
  }, [checkoutMutation.isPending, quote]);

  if (!plan || !targetPlan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
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
              Subscribe to {plan.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {plan.tagline}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-xl border border-border bg-surface-muted/30 p-3.5 space-y-2 text-xs">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Micro agents</span>
              <span className="font-semibold text-foreground">{plan.machineLimits.microAgents}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Requests per month</span>
              <span className="font-semibold text-foreground">
                {plan.machineLimits.requestsPerMonth.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Included AI credits</span>
              <span className="font-semibold text-foreground">
                ${plan.machineLimits.aiCreditsUsd} / month
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="checkout-coupon" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Tag className="size-3.5 text-primary" aria-hidden />
              Coupon code
            </label>
            {appliedCode ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="size-3.5" aria-hidden />
                  <span className="font-mono">{appliedCode}</span> applied
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={removeCoupon} aria-label="Remove coupon">
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  id="checkout-coupon"
                  placeholder="Enter code"
                  value={promoInput}
                  onChange={(e) => {
                    setPromoInput(e.target.value);
                    setCouponError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void applyCoupon();
                    }
                  }}
                  aria-invalid={!!couponError}
                  className="text-xs h-9 font-mono uppercase"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isApplying || !promoInput.trim()}
                  onClick={() => void applyCoupon()}
                  className="shrink-0 text-xs h-9"
                >
                  {isApplying ? <Loader2 className="size-3.5 animate-spin" /> : 'Apply'}
                </Button>
              </div>
            )}
            {couponError && (
              <p role="alert" className="text-xs text-destructive">
                {couponError}
              </p>
            )}
          </div>

          {trialDaysAvailable > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3.5">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" aria-hidden />
                  Start with a {trialDaysAvailable}-day free trial
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Needs a payment method; charged automatically when the trial ends. First trial only.
                </p>
              </div>
              <Switch checked={startTrial} onCheckedChange={setStartTrial} aria-label="Start free trial" />
            </div>
          )}

          <Separator className="bg-border/60" />

          <div className="space-y-2 text-xs" aria-live="polite">
            {quoteQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-6 w-1/2 ml-auto" />
              </div>
            ) : quoteQuery.isError ? (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                <span>{(quoteQuery.error as Error).message}</span>
              </div>
            ) : quote ? (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    {plan.name} ({interval})
                  </span>
                  <span>{money(quote.subtotalCents, quote.currency)}</span>
                </div>
                {quote.discountCents > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Discount ({quote.promotionCode})</span>
                    <span>-{money(quote.discountCents, quote.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span>
                    {quote.taxCalculatedByProvider
                      ? 'Calculated at payment'
                      : money(quote.taxCents, quote.currency)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-border font-bold text-sm text-foreground">
                  <span>Due today</span>
                  <span className="text-lg text-primary">{money(dueNow, quote.currency)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {quote.trialDays > 0
                    ? `Then ${money(quote.totalCents, quote.currency)} after ${quote.trialDays} days, `
                    : 'Renews at '}
                  {money(quote.renewalCents, quote.currency)} per {isAnnual ? 'year' : 'month'} until cancelled.
                </p>
              </>
            ) : null}
          </div>

          {blockedNoProvider && (
            <p role="status" className="rounded-lg border border-border bg-surface-muted/40 p-3 text-xs text-muted-foreground">
              Online payments are not enabled on this deployment yet, so this plan cannot be purchased. A coupon
              that covers the full price can still be applied.
            </p>
          )}

          {checkoutError && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              <span>{checkoutError}</span>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border bg-surface-muted/30 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={checkoutMutation.isPending || !quote || quoteQuery.isError || blockedNoProvider}
            onClick={() => quoteInput && checkoutMutation.mutate(quoteInput)}
            className="font-semibold"
          >
            {checkoutMutation.isPending && <Loader2 className="size-3.5 mr-2 animate-spin" />}
            {ctaLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
