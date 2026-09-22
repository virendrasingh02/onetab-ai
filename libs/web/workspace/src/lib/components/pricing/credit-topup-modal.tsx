import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  toast,
} from '@org/ui';
import { billingApi, queryKeys } from '@org/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Coins, Loader2 } from 'lucide-react';

export interface CreditTopupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
  currentBalance?: number;
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

export function CreditTopupModal({
  open,
  onOpenChange,
  workspaceId,
  currentBalance = 0,
}: CreditTopupModalProps) {
  const queryClient = useQueryClient();
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const [isCustom, setIsCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>('');

  const topupMutation = useMutation({
    mutationFn: (amountUsd: number) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required.');
      }
      return billingApi.topUpCredits(workspaceId, { amount: amountUsd });
    },
    onSuccess: (account) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.billing.all(workspaceId as string),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.billing.credits(workspaceId as string),
      });
      toast.success(
        `Added $${amountToCharge.toFixed(2)} AI credits! New balance: $${account.balance.toFixed(2)}.`,
      );
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to top up AI credits.');
    },
  });

  const amountToCharge = isCustom
    ? parseFloat(customAmount) || 0
    : selectedAmount;

  const handleTopup = () => {
    if (amountToCharge < 1) {
      toast.error('Minimum credit top-up is $1.00.');
      return;
    }
    topupMutation.mutate(amountToCharge);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 border-b border-border">
          <DialogHeader>
            <div className="flex items-center gap-1.5 text-primary text-xs font-bold uppercase tracking-wider mb-1">
              <Coins className="size-4" />
              AI Credits Balance
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Top Up Shared AI Credits
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Current balance:{' '}
              <strong className="text-foreground">${currentBalance.toFixed(2)}</strong>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">
              Select Top-Up Amount
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_AMOUNTS.map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  variant={
                    !isCustom && selectedAmount === amt ? 'primary' : 'outline'
                  }
                  size="sm"
                  onClick={() => {
                    setIsCustom(false);
                    setSelectedAmount(amt);
                  }}
                  className="text-xs font-semibold h-9"
                >
                  ${amt}
                </Button>
              ))}
              <Button
                type="button"
                variant={isCustom ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setIsCustom(true)}
                className="text-xs font-semibold h-9"
              >
                Custom
              </Button>
            </div>
          </div>

          {isCustom && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Custom Amount ($ USD)
              </label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="25"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          )}

          <div className="rounded-lg bg-surface-muted/40 border border-border/60 p-3 text-[11px] text-muted-foreground space-y-1">
            <p>
              • Credits never expire as long as your workspace is active.
            </p>
            <p>
              • Drawn down automatically across micro-agent model calls and tool executions.
            </p>
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
            disabled={amountToCharge < 1 || topupMutation.isPending}
            onClick={handleTopup}
          >
            {topupMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              `Add $${amountToCharge.toFixed(2)} Credits`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
