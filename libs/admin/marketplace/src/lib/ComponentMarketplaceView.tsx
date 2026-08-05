import type { MarketplaceListing } from '@org/types';
import { Blocks } from 'lucide-react';
import { Storefront } from './storefront-view.js';

/** Framework plus the component's public props — its whole contract. */
function ComponentSpec({ listing }: { listing: MarketplaceListing }) {
  const payload = listing.payload as
    | { framework?: string; props?: string[] }
    | undefined;
  if (!payload?.framework && !payload?.props?.length) return null;

  return (
    <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-2.5">
      {payload.framework ? (
        <div className="text-[10px] font-semibold tracking-wide text-purple-400 uppercase mb-1.5">
          {payload.framework}
        </div>
      ) : null}
      {payload.props?.length ? (
        <div className="flex flex-wrap gap-1">
          {payload.props.map((prop) => (
            <code
              key={prop}
              className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-400"
            >
              {prop}
            </code>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ComponentMarketplaceView() {
  return (
    <Storefront
      kind="COMPONENT"
      title="Component Marketplace"
      description="Drop-in UI components published by the design community"
      icon={<Blocks className="w-6 h-6 text-purple-400" />}
      listingIcon={() => <Blocks className="w-5 h-5" />}
      renderPreview={(listing) => <ComponentSpec listing={listing} />}
      includePayload
      emptyMessage="No components match these filters."
    />
  );
}
