import type { MarketplaceListing } from '@org/types';
import { KeyRound, Plug } from 'lucide-react';
import { Storefront } from './storefront-view.js';

/**
 * Auth method and subscribed events — what an admin actually needs to know
 * before connecting an outside system to the workspace.
 */
function IntegrationSpec({ listing }: { listing: MarketplaceListing }) {
  const payload = listing.payload as
    { authType?: string; events?: string[] } | undefined;
  if (!payload?.authType && !payload?.events?.length) return null;

  return (
    <div className="p-2.5 space-y-1.5 rounded-lg border border-border bg-background">
      {payload.authType ? (
        <div className="gap-1.5 flex items-center text-[11px] text-accent-cyan">
          <KeyRound className="w-3 h-3" />
          {payload.authType}
        </div>
      ) : null}
      {payload.events?.length ? (
        <div className="gap-1 flex flex-wrap">
          {payload.events.map((event) => (
            <span
              key={event}
              className="px-1.5 py-0.5 rounded bg-surface-raised text-[10px] text-muted-foreground"
            >
              {event}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function IntegrationStoreView() {
  return (
    <Storefront
      kind="INTEGRATION"
      title="Integration Store"
      description="Connect external tools — installing one provisions its workspace integration"
      icon={<Plug />}
      listingIcon={() => <Plug className="w-5 h-5" />}
      renderPreview={(listing) => <IntegrationSpec listing={listing} />}
      includePayload
      emptyMessage="No integrations match these filters."
    />
  );
}
