import type { MarketplaceListing } from '@org/types';
import { Blocks } from 'lucide-react';
import { Storefront } from './storefront-view.js';

/** Framework plus the component's public props — its whole contract. */
function ComponentSpec({ listing }: { listing: MarketplaceListing }) {
  const payload = listing.payload as
    { framework?: string; props?: string[] } | undefined;
  if (!payload?.framework && !payload?.props?.length) return null;

  return (
    <div className="p-2.5 rounded-lg border border-border bg-background">
      {payload.framework ? (
        <div className="font-semibold tracking-wide mb-1.5 text-[10px] text-accent-violet uppercase">
          {payload.framework}
        </div>
      ) : null}
      {payload.props?.length ? (
        <div className="gap-1 flex flex-wrap">
          {payload.props.map((prop) => (
            <code
              key={prop}
              className="px-1.5 py-0.5 rounded bg-surface-raised text-[10px] text-muted-foreground"
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
      icon={<Blocks />}
      listingIcon={() => <Blocks className="w-5 h-5" />}
      renderPreview={(listing) => <ComponentSpec listing={listing} />}
      includePayload
      emptyMessage="No components match these filters."
    />
  );
}
