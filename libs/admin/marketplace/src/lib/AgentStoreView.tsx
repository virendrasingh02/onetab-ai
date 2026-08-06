import type { MarketplaceListing } from '@org/types';
import { Bot, Cpu } from 'lucide-react';
import { Storefront } from './storefront-view.js';

/** Model and tool list — the two things that decide whether an agent fits. */
function AgentSpec({ listing }: { listing: MarketplaceListing }) {
  const payload = listing.payload as
    { model?: string; tools?: string[] } | undefined;
  if (!payload?.model && !payload?.tools?.length) return null;

  return (
    <div className="p-2.5 space-y-1.5 rounded-lg border border-border bg-background">
      {payload.model ? (
        <div className="gap-1.5 flex items-center text-[11px] text-muted-foreground">
          <Cpu className="w-3 h-3 text-success" />
          <code className="text-foreground">{payload.model}</code>
        </div>
      ) : null}
      {payload.tools?.length ? (
        <div className="gap-1 flex flex-wrap">
          {payload.tools.slice(0, 4).map((tool) => (
            <span
              key={tool}
              className="px-1.5 py-0.5 rounded bg-surface-raised text-[10px] text-muted-foreground"
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
      icon={<Bot />}
      listingIcon={() => <Bot className="w-5 h-5" />}
      renderPreview={(listing) => <AgentSpec listing={listing} />}
      includePayload
      emptyMessage="No agents match these filters."
    />
  );
}
