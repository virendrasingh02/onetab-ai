import type { MarketplaceListing } from '@org/types';
import { KeyRound, Plug } from 'lucide-react';
import { Storefront } from './storefront-view.js';

/**
 * Auth method and subscribed events — what an admin actually needs to know
 * before connecting an outside system to the workspace.
 */
function IntegrationSpec({ listing }: { listing: MarketplaceListing }) {
  const payload = listing.payload as
    | { authType?: string; events?: string[] }
    | undefined;
  if (!payload?.authType && !payload?.events?.length) return null;

  return (
    <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-2.5 space-y-1.5">
      {payload.authType ? (
        <div className="flex items-center gap-1.5 text-[11px] text-cyan-400">
          <KeyRound className="w-3 h-3" />
          {payload.authType}
        </div>
      ) : null}
      {payload.events?.length ? (
        <div className="flex flex-wrap gap-1">
          {payload.events.map((event) => (
            <span
              key={event}
              className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-400"
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
      icon={<Plug className="w-6 h-6 text-cyan-400" />}
      listingIcon={() => <Plug className="w-5 h-5" />}
      renderPreview={(listing) => <IntegrationSpec listing={listing} />}
      includePayload
      emptyMessage="No integrations match these filters."
    />
  );
}
