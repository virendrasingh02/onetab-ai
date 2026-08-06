import type { MarketplaceListing } from '@org/types';
import { FileStack } from 'lucide-react';
import { Storefront } from './storefront-view.js';

/**
 * Templates carry whichever outline shape fits them — document sections, a
 * project board, or phases of a playbook — so this reads all three.
 */
function TemplateOutline({ listing }: { listing: MarketplaceListing }) {
  const payload = listing.payload as
    { sections?: string[]; board?: string[]; phases?: string[] } | undefined;
  const items = payload?.sections ?? payload?.board ?? payload?.phases;
  if (!items?.length) return null;

  return (
    <div className="p-2.5 rounded-lg border border-border bg-background">
      <ol className="gap-1 flex flex-wrap">
        {items.slice(0, 6).map((item, index) => (
          <li
            key={item}
            className="px-1.5 py-0.5 rounded bg-surface-raised text-[10px] text-muted-foreground"
          >
            <span className="mr-1 text-muted-foreground">{index + 1}</span>
            {item}
          </li>
        ))}
        {items.length > 6 ? (
          <li className="self-center text-[10px] text-muted-foreground">
            +{items.length - 6} more
          </li>
        ) : null}
      </ol>
    </div>
  );
}

export function CommunityTemplatesView() {
  return (
    <Storefront
      kind="TEMPLATE"
      title="Community Templates"
      description="Docs, project boards and playbooks shared by other OneTab AI teams"
      icon={<FileStack />}
      listingIcon={() => <FileStack className="w-5 h-5" />}
      renderPreview={(listing) => <TemplateOutline listing={listing} />}
      includePayload
      emptyMessage="No community templates match these filters."
    />
  );
}
