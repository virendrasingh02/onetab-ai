import type { MarketplaceListing } from '@org/types';
import { Palette } from 'lucide-react';
import { Storefront } from './storefront-view.js';

/**
 * Swatch strip built from the theme's own palette, which rides along on the
 * browse response rather than costing one detail request per card.
 *
 * Renders nothing when a theme ships no colours: a placeholder grey bar would
 * misrepresent the one thing this card exists to show.
 */
function ThemeSwatches({ listing }: { listing: MarketplaceListing }) {
  const colors = (listing.payload as { colors?: Record<string, string> })
    ?.colors;
  if (!colors) return null;

  const entries = Object.entries(colors).filter(
    ([, value]) => typeof value === 'string' && value.startsWith('#'),
  );
  if (entries.length === 0) return null;

  return (
    <div
      className="h-8 flex overflow-hidden rounded-lg border border-border"
      role="img"
      aria-label={`${listing.name} palette: ${entries
        .map(([name]) => name)
        .join(', ')}`}
    >
      {entries.map(([name, value]) => (
        <div
          key={name}
          className="flex-1"
          style={{ backgroundColor: value }}
          title={`${name}: ${value}`}
        />
      ))}
    </div>
  );
}

export function ThemeStoreView() {
  return (
    <Storefront
      kind="THEME"
      title="Theme Store"
      description="Install a workspace-wide colour theme, or bring your own brand palette"
      icon={<Palette />}
      listingIcon={() => <Palette className="w-5 h-5" />}
      renderPreview={(listing) => <ThemeSwatches listing={listing} />}
      includePayload
      emptyMessage="No themes match these filters."
    />
  );
}
