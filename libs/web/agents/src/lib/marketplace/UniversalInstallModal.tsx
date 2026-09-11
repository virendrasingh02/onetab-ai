import React, { useState } from 'react';
import type { MarketplaceListing, MarketplaceListingDetail } from '@org/types';
import { Button, Dialog, DialogContent, Switch } from '@org/ui';
import { renderEntityIcon } from './MarketplaceCard';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { cn } from '@org/utils';

interface UniversalInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: MarketplaceListing | MarketplaceListingDetail;
  currentWorkspace: { id: string; name: string; slug: string };
  onInstall: (input: {
    listingSlug: string;
    grantedScopes: string[];
    settings: Record<string, unknown>;
  }) => Promise<void>;
}

type Step = 'review' | 'workspace' | 'permissions' | 'config' | 'confirmation';

export const UniversalInstallModal: React.FC<UniversalInstallModalProps> = ({
  isOpen,
  onClose,
  listing,
  currentWorkspace,
  onInstall,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('review');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Scopes state: initialize with all requested scopes
  const permissionsList = listing.permissions || [];
  const [selectedScopes, setSelectedScopes] = useState<string[]>(() =>
    permissionsList.map((p) => p.scope),
  );

  // Config state
  const [notifyChannel, setNotifyChannel] = useState('general');
  const [enableSlashCommands, setEnableSlashCommands] = useState(true);
  const [enableMentionRouting, setEnableMentionRouting] = useState(true);

  const stepsOrder: Step[] = [
    'review',
    'workspace',
    'permissions',
    'config',
    'confirmation',
  ];
  const stepIdx = stepsOrder.indexOf(currentStep);

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const handleNext = async () => {
    if (currentStep === 'config') {
      setIsSubmitting(true);
      try {
        await onInstall({
          listingSlug: listing.slug,
          grantedScopes: selectedScopes,
          settings: {
            notifyChannel,
            enableSlashCommands,
            enableMentionRouting,
          },
        });
        setCurrentStep('confirmation');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const nextIdx = stepIdx + 1;
      if (nextIdx < stepsOrder.length) {
        setCurrentStep(stepsOrder[nextIdx]);
      }
    }
  };

  const handleBack = () => {
    const prevIdx = stepIdx - 1;
    if (prevIdx >= 0) {
      setCurrentStep(stepsOrder[prevIdx]);
    }
  };

  const handleModalClose = () => {
    setCurrentStep('review');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-surface border-border rounded-2xl">
        {/* Header / Stepper Bar */}
        <div className="border-b border-border/80 bg-surface-raised/40 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {renderEntityIcon(listing.iconUrl ?? undefined, listing.kind, 'size-9')}
              <div>
                <h3 className="font-bold text-sm text-foreground">
                  Install {listing.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Step {stepIdx + 1} of {stepsOrder.length} •{' '}
                  {currentStep === 'review' && 'Overview'}
                  {currentStep === 'workspace' && 'Workspace Isolation'}
                  {currentStep === 'permissions' && 'Grant Permissions'}
                  {currentStep === 'config' && 'Initial Configuration'}
                  {currentStep === 'confirmation' && 'Installation Complete'}
                </p>
              </div>
            </div>

            {/* Step indicators */}
            <div className="flex items-center gap-1.5">
              {stepsOrder.map((step, idx) => (
                <div
                  key={step}
                  className={cn(
                    'size-2 rounded-full transition-all',
                    idx === stepIdx
                      ? 'bg-primary w-4'
                      : idx < stepIdx
                      ? 'bg-primary/50'
                      : 'bg-muted-foreground/30',
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Step Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* STEP 1: REVIEW */}
          {currentStep === 'review' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/80 bg-surface-raised/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Publisher</span>
                  <span className="text-xs text-muted-foreground">
                    {listing.publisherName || listing.publisher?.name || 'OneTab Official'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Version</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {listing.version || '1.0.0'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Pricing</span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    {listing.pricingModel === 'FREE' ? 'Free Integration' : 'Subscription'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  What this {listing.kind === 'AGENT' ? 'agent' : 'integration'} can do
                </h4>
                <div className="space-y-2">
                  {(listing.capabilities || [listing.tagline || (listing as any).description || 'Ready to use']).map(
                    (cap, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 text-xs text-foreground bg-surface-raised/30 p-2.5 rounded-lg border border-border/60"
                      >
                        <Check className="size-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{cap}</span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: WORKSPACE ISOLATION */}
          {currentStep === 'workspace' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
                <ShieldCheck className="size-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-foreground">
                    Strict Workspace Boundary Enforced
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This installation is strictly isolated to your target workspace. It will not have access to any other workspaces or corporate data outside this perimeter.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border/80 bg-surface-raised/40 p-4">
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Target Workspace
                </label>
                <div className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">
                      {currentWorkspace.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        {currentWorkspace.name}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        /w/{currentWorkspace.slug}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    Selected
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PERMISSIONS BREAKDOWN */}
          {currentStep === 'permissions' && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Review and selectively grant the granular permissions requested by this {listing.kind === 'AGENT' ? 'agent' : 'application'}.
              </p>

              <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-surface-raised/30 overflow-hidden">
                {permissionsList.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground">
                    No special permissions requested.
                  </div>
                ) : (
                  permissionsList.map((perm) => {
                    const isSelected = selectedScopes.includes(perm.scope);
                    const isAdmin = perm.level === 'ADMIN';

                    return (
                      <div
                        key={perm.scope}
                        className="p-3.5 flex items-start justify-between gap-3 hover:bg-surface-raised/60 transition-colors"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">
                              {perm.name}
                            </span>
                            <span
                              className={cn(
                                'text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase',
                                isAdmin
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                  : 'bg-surface border-border text-muted-foreground',
                              )}
                            >
                              {perm.level}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {perm.description}
                          </p>
                          <span className="font-mono text-[10px] text-muted-foreground/70 block">
                            scope: {perm.scope}
                          </span>
                        </div>

                        <Switch
                          checked={isSelected}
                          onCheckedChange={() => toggleScope(perm.scope)}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* STEP 4: CONFIGURATION */}
          {currentStep === 'config' && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Configure default interactions and notification channel bindings.
              </p>

              <div className="space-y-3">
                <div className="rounded-xl border border-border/80 bg-surface-raised/40 p-3.5 space-y-2">
                  <label className="text-xs font-semibold text-foreground block">
                    Default Alert Channel
                  </label>
                  <select
                    value={notifyChannel}
                    onChange={(e) => setNotifyChannel(e.target.value)}
                    className="w-full text-xs bg-surface border border-border text-foreground rounded-lg px-3 py-2"
                  >
                    <option value="general"># general</option>
                    <option value="engineering"># engineering</option>
                    <option value="alerts"># alerts-feed</option>
                    <option value="product"># product-updates</option>
                  </select>
                </div>

                <div className="rounded-xl border border-border/80 bg-surface-raised/40 p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Enable Slash Commands
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Allow workspace members to invoke this tool using `/` commands
                    </span>
                  </div>
                  <Switch
                    checked={enableSlashCommands}
                    onCheckedChange={setEnableSlashCommands}
                  />
                </div>

                <div className="rounded-xl border border-border/80 bg-surface-raised/40 p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Enable @ Mention Routing
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Route messages to this agent when mentioned with @
                    </span>
                  </div>
                  <Switch
                    checked={enableMentionRouting}
                    onCheckedChange={setEnableMentionRouting}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: CONFIRMATION & SUCCESS */}
          {currentStep === 'confirmation' && (
            <div className="text-center py-6 space-y-4">
              <div className="size-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="size-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {listing.name} is installed and ready!
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Available immediately across all channels in{' '}
                  <span className="font-semibold text-foreground">
                    {currentWorkspace.name}
                  </span>
                  .
                </p>
              </div>

              {listing.commands && listing.commands.length > 0 && (
                <div className="rounded-xl border border-border/80 bg-surface-raised/40 p-3.5 text-left max-w-sm mx-auto space-y-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Try running in chat:
                  </span>
                  {listing.commands.map((cmd) => (
                    <div
                      key={cmd.command}
                      className="font-mono text-xs bg-surface p-2 rounded-lg border border-border text-primary font-semibold flex items-center gap-2"
                    >
                      <Terminal className="size-3.5 text-muted-foreground" />
                      <span>{cmd.command} {cmd.args || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation Controls */}
        <div className="border-t border-border/80 bg-surface-raised/30 px-6 py-3.5 flex items-center justify-between">
          {currentStep === 'confirmation' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleModalClose}
              className="w-full text-xs font-semibold"
            >
              Done
            </Button>
          ) : (
            <>
              {stepIdx > 0 ? (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={handleBack}
                  className="text-xs"
                >
                  <ArrowLeft className="size-3.5 mr-1" />
                  Back
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleModalClose}
                  className="text-xs text-muted-foreground"
                >
                  Cancel
                </Button>
              )}

              <Button
                variant="primary"
                size="xs"
                onClick={handleNext}
                loading={isSubmitting}
                className="text-xs font-semibold"
              >
                {currentStep === 'config' ? 'Confirm & Install' : 'Continue'}
                <ArrowRight className="size-3.5 ml-1" />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
