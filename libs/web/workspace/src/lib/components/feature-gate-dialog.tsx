import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PlanBadge,
} from '@org/ui';
import { PLANS_CONFIG, type PlanTier } from '@org/types';

import { ArrowRight, CheckCircle2, Lock, Sparkles, Zap } from 'lucide-react';

export interface FeatureGateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  requiredPlan: PlanTier;
  featureName: string;
  featureDescription?: string;
  onUpgradeClick?: (targetPlan: PlanTier) => void;
}

export function FeatureGateDialog({
  isOpen,
  onClose,
  requiredPlan,
  featureName,
  featureDescription,
  onUpgradeClick,
}: FeatureGateDialogProps) {
  const planDef = PLANS_CONFIG[requiredPlan] || PLANS_CONFIG.pro;

  const handleUpgrade = () => {
    onClose();
    if (onUpgradeClick) {
      onUpgradeClick(requiredPlan);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-6 overflow-hidden">
        <div className="relative space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/25">
              <Lock className="size-5" />
            </div>
            <PlanBadge plan={requiredPlan} size="sm" variant="gradient" />
          </div>

          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-lg font-bold text-foreground">
              Unlock {featureName}
            </DialogTitle>
            <DialogDescription className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              {featureDescription ||
                `${featureName} is available on the ${planDef.name} plan and above. Upgrade your workspace to unlock this capability and supercharge your team.`}
            </DialogDescription>
          </DialogHeader>

          {/* Highlights */}
          <div className="rounded-xl border border-border bg-surface-muted/50 p-3.5 space-y-2 text-xs">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" />
              Included in {planDef.name}:
            </div>
            <ul className="space-y-1.5 text-muted-foreground">
              {planDef.highlightedFeatures.slice(0, 3).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter className="pt-2 flex flex-row items-center justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="text-xs">
                Maybe Later
              </Button>
            </DialogClose>
            <Button
              variant="primary"
              size="sm"
              onClick={handleUpgrade}
              className="text-xs font-semibold shadow-xs"
            >
              <Zap className="size-3.5 mr-1 fill-current" />
              {requiredPlan === 'enterprise' ? 'Contact Sales' : `Upgrade to ${planDef.name}`}
              <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
