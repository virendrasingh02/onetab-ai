import React, { useState } from 'react';
import type { MarketplaceListing, MarketplaceListingDetail } from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Switch,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { EntityIcon } from './marketplace-ui';

type Step = 'review' | 'workspace' | 'permissions' | 'config' | 'confirmation';

const STEPS_ORDER: Step[] = [
  'review',
  'workspace',
  'permissions',
  'config',
  'confirmation',
];

const STEP_LABELS: Record<Step, string> = {
  review: 'Overview',
  workspace: 'Workspace isolation',
  permissions: 'Grant permissions',
  config: 'Initial configuration',
  confirmation: 'Installation complete',
};

const NOTIFY_CHANNELS = [
  { value: 'general', label: '# general' },
  { value: 'engineering', label: '# engineering' },
  { value: 'alerts', label: '# alerts-feed' },
  { value: 'product', label: '# product-updates' },
];

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

  const stepIdx = STEPS_ORDER.indexOf(currentStep);

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
      if (nextIdx < STEPS_ORDER.length) {
        setCurrentStep(STEPS_ORDER[nextIdx]);
      }
    }
  };

  const handleBack = () => {
    const prevIdx = stepIdx - 1;
    if (prevIdx >= 0) {
      setCurrentStep(STEPS_ORDER[prevIdx]);
    }
  };

  const handleModalClose = () => {
    setCurrentStep('review');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader className="border-b border-border/60 pb-4">
          <div className="gap-3 flex items-center justify-between">
            <div className="gap-3 flex items-center">
              <EntityIcon iconUrl={listing.iconUrl} kind={listing.kind} />
              <div>
                <DialogTitle>Install {listing.name}</DialogTitle>
                <DialogDescription>
                  Step {stepIdx + 1} of {STEPS_ORDER.length} ·{' '}
                  {STEP_LABELS[currentStep]}
                </DialogDescription>
              </div>
            </div>

            <div className="gap-1.5 flex items-center" aria-hidden>
              {STEPS_ORDER.map((step, idx) => (
                <div
                  key={step}
                  className={cn(
                    'h-2 rounded-full transition-all',
                    idx === stepIdx
                      ? 'w-4 bg-primary'
                      : idx < stepIdx
                        ? 'w-2 bg-primary/50'
                        : 'w-2 bg-muted-foreground/30',
                  )}
                />
              ))}
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="max-h-[60vh] overflow-y-auto py-4">
          {/* STEP 1: REVIEW */}
          {currentStep === 'review' && (
            <div className="space-y-4">
              <Card className="gap-2 p-4 bg-surface-raised/40">
                <SummaryRow label="Publisher">
                  {listing.publisherName ||
                    listing.publisher?.name ||
                    'Onetab Official'}
                </SummaryRow>
                <SummaryRow label="Version">
                  <span className="font-mono">{listing.version || '1.0.0'}</span>
                </SummaryRow>
                <SummaryRow label="Pricing">
                  <span className="font-medium text-success-text">
                    {listing.pricingModel === 'FREE'
                      ? 'Free integration'
                      : 'Subscription'}
                  </span>
                </SummaryRow>
              </Card>

              <div>
                <h4 className="mb-2 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                  What this {listing.kind === 'AGENT' ? 'agent' : 'integration'}{' '}
                  can do
                </h4>
                <div className="space-y-2">
                  {(
                    listing.capabilities || [
                      listing.tagline ||
                        (listing as { description?: string }).description ||
                        'Ready to use',
                    ]
                  ).map((cap) => (
                    <div
                      key={cap}
                      className="gap-2.5 rounded-lg border border-border/60 bg-surface-raised/30 p-2.5 text-xs flex items-start text-foreground"
                    >
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-primary-text"
                        aria-hidden
                      />
                      <span>{cap}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: WORKSPACE ISOLATION */}
          {currentStep === 'workspace' && (
            <div className="space-y-4">
              <div className="gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 flex items-start">
                <ShieldCheck
                  className="mt-0.5 size-5 shrink-0 text-primary-text"
                  aria-hidden
                />
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-foreground">
                    Strict workspace boundary enforced
                  </h4>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    This installation is strictly isolated to your target
                    workspace. It will not have access to any other workspaces
                    or corporate data outside this perimeter.
                  </p>
                </div>
              </div>

              <Field label="Target workspace">
                <div className="rounded-lg border border-border bg-surface p-3 flex items-center justify-between">
                  <div className="gap-2.5 flex items-center">
                    <div className="size-8 text-xs font-semibold flex items-center justify-center rounded-lg bg-primary/10 text-primary-text">
                      {currentWorkspace.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {currentWorkspace.name}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        /w/{currentWorkspace.slug}
                      </p>
                    </div>
                  </div>
                  <Badge variant="success">Selected</Badge>
                </div>
              </Field>
            </div>
          )}

          {/* STEP 3: PERMISSIONS */}
          {currentStep === 'permissions' && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Review and selectively grant the granular permissions requested
                by this {listing.kind === 'AGENT' ? 'agent' : 'application'}.
              </p>

              <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-surface-raised/30">
                {permissionsList.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground">
                    No special permissions requested.
                  </div>
                ) : (
                  permissionsList.map((perm) => (
                    <div
                      key={perm.scope}
                      className="gap-3 p-3.5 flex items-start justify-between"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="gap-2 flex items-center">
                          <span className="text-xs font-semibold text-foreground">
                            {perm.name}
                          </span>
                          <Badge
                            variant={
                              perm.level === 'ADMIN' ? 'destructive' : 'neutral'
                            }
                            className="uppercase"
                          >
                            {perm.level}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {perm.description}
                        </p>
                        <span className="block font-mono text-[10px] text-muted-foreground">
                          scope: {perm.scope}
                        </span>
                      </div>

                      <Switch
                        checked={selectedScopes.includes(perm.scope)}
                        onCheckedChange={() => toggleScope(perm.scope)}
                        aria-label={`Grant ${perm.name}`}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STEP 4: CONFIGURATION */}
          {currentStep === 'config' && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Configure default interactions and notification channel
                bindings.
              </p>

              <Field label="Default alert channel">
                <AppSelect
                  aria-label="Default alert channel"
                  value={notifyChannel}
                  onValueChange={setNotifyChannel}
                  options={NOTIFY_CHANNELS}
                />
              </Field>

              <ToggleRow
                title="Enable slash commands"
                description="Allow workspace members to invoke this tool using / commands"
                checked={enableSlashCommands}
                onCheckedChange={setEnableSlashCommands}
              />
              <ToggleRow
                title="Enable @ mention routing"
                description="Route messages to this agent when mentioned with @"
                checked={enableMentionRouting}
                onCheckedChange={setEnableMentionRouting}
              />
            </div>
          )}

          {/* STEP 5: CONFIRMATION */}
          {currentStep === 'confirmation' && (
            <div className="space-y-4 py-6 text-center">
              <div className="size-14 mx-auto flex items-center justify-center rounded-full border border-success/25 bg-success/10 text-success-text">
                <CheckCircle2 className="size-8" aria-hidden />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {listing.name} is installed and ready
                </h3>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                  Available immediately across all channels in{' '}
                  <span className="font-semibold text-foreground">
                    {currentWorkspace.name}
                  </span>
                  .
                </p>
              </div>

              {listing.commands && listing.commands.length > 0 && (
                <Card className="mx-auto max-w-sm gap-2 p-3.5 text-left bg-surface-raised/40">
                  <span className="block text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                    Try running in chat
                  </span>
                  {listing.commands.map((cmd) => (
                    <div
                      key={cmd.command}
                      className="gap-2 rounded-lg border border-border bg-surface p-2 font-mono text-xs font-semibold flex items-center text-primary-text"
                    >
                      <Terminal
                        className="size-3.5 text-muted-foreground"
                        aria-hidden
                      />
                      <span>
                        {cmd.command} {cmd.args || ''}
                      </span>
                    </div>
                  ))}
                </Card>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter className="border-t border-border/60 pt-4 sm:justify-between">
          {currentStep === 'confirmation' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleModalClose}
              className="w-full"
            >
              Done
            </Button>
          ) : (
            <>
              {stepIdx > 0 ? (
                <Button variant="outline" size="sm" onClick={handleBack}>
                  <ArrowLeft aria-hidden />
                  Back
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={handleModalClose}>
                  Cancel
                </Button>
              )}

              <Button
                variant="primary"
                size="sm"
                onClick={handleNext}
                loading={isSubmitting}
              >
                {currentStep === 'config' ? 'Confirm & install' : 'Continue'}
                <ArrowRight aria-hidden />
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-xs flex items-center justify-between">
      <span className="font-semibold text-foreground">{label}</span>
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="gap-3 rounded-xl border border-border/60 bg-surface-raised/40 p-3.5 flex items-center justify-between">
      <div>
        <span className="block text-xs font-semibold text-foreground">
          {title}
        </span>
        <span className="text-[11px] text-muted-foreground">{description}</span>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={title}
      />
    </div>
  );
}
