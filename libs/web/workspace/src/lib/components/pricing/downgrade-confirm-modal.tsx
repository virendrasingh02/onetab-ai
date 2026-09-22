import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Switch,
  toast,
} from '@org/ui';
import { billingApi, queryKeys } from '@org/api-client';
import {
  PLANS_CONFIG,
  type DowngradeImpactSummary,
  type DowngradePlanInput,
  type PlanTier,
  type WorkspaceBillingSummary,
} from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bot, Loader2 } from 'lucide-react';

export interface DowngradeConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPlan: PlanTier | null;
  workspaceId?: string;
  onSuccess?: (summary: WorkspaceBillingSummary) => void;
}

export function DowngradeConfirmModal({
  open,
  onOpenChange,
  targetPlan,
  workspaceId,
  onSuccess,
}: DowngradeConfirmModalProps) {
  const queryClient = useQueryClient();
  const [acknowledged, setAcknowledged] = useState(false);

  const plan = targetPlan ? PLANS_CONFIG[targetPlan] : null;

  const { data: impact, isLoading: isCheckingImpact } =
    useQuery<DowngradeImpactSummary>({
      queryKey: queryKeys.billing.downgradeImpact(
        workspaceId ?? '',
        targetPlan ?? '',
      ),
      queryFn: () =>
        billingApi.downgradeImpact(workspaceId as string, targetPlan as PlanTier),
      enabled: Boolean(open && workspaceId && targetPlan),
    });

  const downgradeMutation = useMutation({
    mutationFn: (input: DowngradePlanInput) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required.');
      }
      return billingApi.downgrade(workspaceId, input);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.billing.all(workspaceId as string),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all() });
      toast.success(
        `Your workspace has been downgraded to ${PLANS_CONFIG[updated.plan].name}.`,
      );
      onOpenChange(false);
      setAcknowledged(false);
      onSuccess?.(updated);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to downgrade plan.');
    },
  });

  if (!plan) return null;

  const handleConfirmDowngrade = () => {
    if (!targetPlan) return;
    downgradeMutation.mutate({
      targetPlan,
      acknowledgeOverages: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-amber-500/10 p-6 border-b border-amber-500/20">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
              <AlertTriangle className="size-4" />
              Confirm Plan Downgrade
            </div>
            <DialogTitle className="text-xl font-bold text-foreground">
              Downgrade to {plan.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Please review the resource limit reductions before proceeding.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {isCheckingImpact ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <>
              {/* Warnings List */}
              {impact?.warnings && impact.warnings.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    Important Changes to Your Workspace:
                  </p>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {impact.warnings.map((warning, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <AlertTriangle className="size-3.5 mt-0.5 text-amber-500 shrink-0" />
                        <span>{warning.impactDescription}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Disabled / Lost Features */}
              {impact?.restrictedFeatures && impact.restrictedFeatures.length > 0 && (
                <div className="space-y-2 text-xs">
                  <p className="font-semibold text-foreground">
                    Features no longer available on {plan.name}:
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 text-muted-foreground">
                    {impact.restrictedFeatures.map((feat) => (
                      <div
                        key={feat}
                        className="rounded-md border border-border/80 bg-surface-muted/30 px-2.5 py-1.5 font-mono text-[11px] truncate"
                      >
                        {feat}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Micro Agents Impact Notice */}
              <div className="rounded-xl border border-border bg-surface-muted/40 p-3.5 space-y-1 text-xs">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Bot className="size-3.5 text-primary" />
                  Micro Agent Limit
                </p>
                <p className="text-muted-foreground text-[11px]">
                  {plan.name} provides {plan.machineLimits.microAgents} Micro Agents.
                  Active agents beyond this limit will remain saved but will not execute until upgraded or pruned.
                </p>
              </div>

              {/* Overages Acknowledgment */}
              <div className="flex items-start gap-3 rounded-xl border border-border p-3.5 bg-surface-muted/20">
                <Switch
                  id="acknowledge-downgrade"
                  checked={acknowledged}
                  onCheckedChange={setAcknowledged}
                  className="mt-0.5"
                />
                <label
                  htmlFor="acknowledge-downgrade"
                  className="text-xs text-muted-foreground leading-tight cursor-pointer select-none"
                >
                  I understand that higher-tier features will be disabled immediately and overages will be locked.
                </label>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border bg-surface-muted/30 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Keep Current Plan
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={!acknowledged || downgradeMutation.isPending}
            onClick={handleConfirmDowngrade}
            className="font-semibold"
          >
            {downgradeMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 mr-2 animate-spin" />
                Downgrading...
              </>
            ) : (
              `Confirm Downgrade to ${plan.name}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
