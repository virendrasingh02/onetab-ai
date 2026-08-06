import type { MarketplaceListing } from '@org/types';
import { ArrowRight, Workflow, Zap } from 'lucide-react';
import { Storefront } from './storefront-view.js';

/** The trigger and the first few steps — enough to judge fit without opening it. */
function WorkflowOutline({ listing }: { listing: MarketplaceListing }) {
  const payload = listing.payload as
    { trigger?: { type?: string }; steps?: { type?: string }[] } | undefined;
  if (!payload?.trigger && !payload?.steps?.length) return null;

  const steps = payload.steps ?? [];

  return (
    <div className="p-2.5 rounded-lg border border-border bg-background">
      {payload.trigger?.type ? (
        <div className="gap-1.5 mb-1.5 flex items-center text-[11px] text-warning">
          <Zap className="w-3 h-3" />
          <span className="font-medium">on {payload.trigger.type}</span>
        </div>
      ) : null}
      <div className="gap-1 flex flex-wrap items-center text-[10px] text-muted-foreground">
        {steps.slice(0, 3).map((step, index) => (
          <span
            key={`${step.type}-${index}`}
            className="gap-1 flex items-center"
          >
            <span className="px-1.5 py-0.5 rounded bg-surface-raised">
              {step.type}
            </span>
            {index < Math.min(steps.length, 3) - 1 ? (
              <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
            ) : null}
          </span>
        ))}
        {steps.length > 3 ? (
          <span className="text-muted-foreground">
            +{steps.length - 3} more
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function WorkflowTemplatesView() {
  return (
    <Storefront
      kind="WORKFLOW"
      title="Workflow Templates"
      description="Prebuilt automations you can install and run without opening the builder"
      icon={<Workflow />}
      listingIcon={() => <Workflow className="w-5 h-5" />}
      renderPreview={(listing) => <WorkflowOutline listing={listing} />}
      includePayload
      emptyMessage="No workflow templates match these filters."
    />
  );
}
