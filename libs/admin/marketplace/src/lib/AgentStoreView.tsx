import type { MarketplaceListing } from '@org/types';
import { Bot, Cpu } from 'lucide-react';
import { Storefront } from './storefront-view.js';

/** Model and tool list — the two things that decide whether an agent fits. */
function AgentSpec({ listing }: { listing: MarketplaceListing }) {
  const payload = listing.payload as
    | { model?: string; tools?: string[] }
    | undefined;
  if (!payload?.model && !payload?.tools?.length) return null;

  return (
    <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-2.5 space-y-1.5">
      {payload.model ? (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Cpu className="w-3 h-3 text-emerald-400" />
          <code className="text-slate-300">{payload.model}</code>
        </div>
      ) : null}
      {payload.tools?.length ? (
        <div className="flex flex-wrap gap-1">
          {payload.tools.slice(0, 4).map((tool) => (
            <span
              key={tool}
              className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-400"
            >
              {tool}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AgentStoreView() {
  return (
    <Storefront
      kind="AGENT"
      title="Agent Marketplace"
      description="Install ready-made AI agents built by the community and verified publishers"
      icon={<Bot className="w-6 h-6 text-emerald-400" />}
      listingIcon={() => <Bot className="w-5 h-5" />}
      renderPreview={(listing) => <AgentSpec listing={listing} />}
      includePayload
      emptyMessage="No agents match these filters."
    />
  );
}
