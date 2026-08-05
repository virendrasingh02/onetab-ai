import type { MarketplaceListing } from '@org/types';
import { ArrowRight, Workflow, Zap } from 'lucide-react';
import { Storefront } from './storefront-view.js';

/** The trigger and the first few steps — enough to judge fit without opening it. */
function WorkflowOutline({ listing }: { listing: MarketplaceListing }) {
  const payload = listing.payload as
    | { trigger?: { type?: string }; steps?: { type?: string }[] }
    | undefined;
  if (!payload?.trigger && !payload?.steps?.length) return null;

  const steps = payload.steps ?? [];

  return (
    <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-2.5">
      {payload.trigger?.type ? (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-400 mb-1.5">
          <Zap className="w-3 h-3" />
          <span className="font-medium">on {payload.trigger.type}</span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
        {steps.slice(0, 3).map((step, index) => (
          <span key={`${step.type}-${index}`} className="flex items-center gap-1">
            <span className="px-1.5 py-0.5 bg-slate-800 rounded">
              {step.type}
            </span>
            {index < Math.min(steps.length, 3) - 1 ? (
              <ArrowRight className="w-2.5 h-2.5 text-slate-600" />
            ) : null}
          </span>
        ))}
        {steps.length > 3 ? (
          <span className="text-slate-600">+{steps.length - 3} more</span>
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
      icon={<Workflow className="w-6 h-6 text-amber-400" />}
      listingIcon={() => <Workflow className="w-5 h-5" />}
      renderPreview={(listing) => <WorkflowOutline listing={listing} />}
      includePayload
      emptyMessage="No workflow templates match these filters."
    />
  );
}
