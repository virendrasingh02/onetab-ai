import type { MarketplaceKind } from '@org/types';
import {
  Blocks,
  Bot,
  Download,
  FileStack,
  Package,
  Palette,
  Plug,
  Puzzle,
  Sparkles,
  Store,
  Workflow,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import {
  KIND_LABEL,
  KIND_TONE,
  ListingCard,
  Panel,
  QueryState,
  RefreshButton,
  ViewHeader,
  ViewShell,
  formatCount,
} from './marketplace-ui.js';
import { useListings, useMarketplaceStats } from './use-marketplace.js';

/** Route segment and icon for each storefront, in the order they are shown. */
const STOREFRONTS: {
  kind: MarketplaceKind;
  path: string;
  icon: ComponentType<{ className?: string }>;
  blurb: string;
}[] = [
  {
    kind: 'PLUGIN',
    path: 'plugins',
    icon: Puzzle,
    blurb: 'Sandboxed extensions built on the Plugin SDK',
  },
  {
    kind: 'THEME',
    path: 'themes',
    icon: Palette,
    blurb: 'Workspace-wide colour themes',
  },
  {
    kind: 'AGENT',
    path: 'agents',
    icon: Bot,
    blurb: 'Ready-made AI agents',
  },
  {
    kind: 'WORKFLOW',
    path: 'workflows',
    icon: Workflow,
    blurb: 'Prebuilt automation templates',
  },
  {
    kind: 'COMPONENT',
    path: 'components',
    icon: Blocks,
    blurb: 'Drop-in UI components',
  },
  {
    kind: 'INTEGRATION',
    path: 'integrations',
    icon: Plug,
    blurb: 'Connectors for external tools',
  },
  {
    kind: 'TEMPLATE',
    path: 'templates',
    icon: FileStack,
    blurb: 'Docs, boards and playbooks',
  },
];

const KIND_ICON = Object.fromEntries(
  STOREFRONTS.map((entry) => [entry.kind, entry.icon]),
) as Record<MarketplaceKind, ComponentType<{ className?: string }>>;

function StorefrontTile({
  kind,
  path,
  icon: Icon,
  blurb,
  listingCount,
  installCount,
}: {
  kind: MarketplaceKind;
  path: string;
  icon: ComponentType<{ className?: string }>;
  blurb: string;
  listingCount: number;
  installCount: number;
}) {
  return (
    <Link
      to={`/marketplace/${path}`}
      className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col gap-2 transition group"
    >
      <div className="flex items-center justify-between">
        <div className={`p-2 bg-slate-800 rounded-lg ${KIND_TONE[kind]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {installCount > 0 ? (
          <span className="px-2 py-0.5 bg-emerald-950/60 border border-emerald-500/40 rounded-full text-[10px] font-semibold text-emerald-400">
            {formatCount(installCount)} installs
          </span>
        ) : null}
      </div>
      <div>
        <h3 className="font-bold text-sm text-slate-100 group-hover:text-white">
          {KIND_LABEL[kind]}s
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5">{blurb}</p>
      </div>
      <span className="text-[11px] text-slate-400 mt-auto">
        {formatCount(listingCount)} listing{listingCount === 1 ? '' : 's'}
      </span>
    </Link>
  );
}

/**
 * Catalogue landing screen for the console.
 *
 * The web app's version of this page also listed what the current workspace
 * had installed. Here the question is the platform-wide one: what is in the
 * catalogue, and what is being adopted across every workspace.
 */
export function MarketplaceHomeView() {
  const stats = useMarketplaceStats();
  const featured = useListings({ featured: true, sort: 'popular', pageSize: 6 });

  const totalListings =
    stats.data?.reduce((sum, row) => sum + row.listingCount, 0) ?? 0;
  const totalInstalls =
    stats.data?.reduce((sum, row) => sum + row.installCount, 0) ?? 0;

  return (
    <ViewShell>
      <ViewHeader
        icon={<Store className="w-6 h-6 text-blue-400" />}
        title="Marketplace"
        description={`${formatCount(totalListings)} listings across seven storefronts · ${formatCount(totalInstalls)} installs platform-wide`}
        actions={
          <RefreshButton
            onClick={() => {
              void stats.refetch();
              void featured.refetch();
            }}
            busy={stats.isFetching || featured.isFetching}
          />
        }
      />

      <QueryState isLoading={stats.isLoading} error={stats.error}>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
          {STOREFRONTS.map((entry) => {
            const row = stats.data?.find((stat) => stat.kind === entry.kind);
            return (
              <StorefrontTile
                key={entry.kind}
                {...entry}
                listingCount={row?.listingCount ?? 0}
                installCount={row?.installCount ?? 0}
              />
            );
          })}
        </div>
      </QueryState>

      <section className="mb-8">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-amber-400" /> Featured
        </h2>
        <QueryState
          isLoading={featured.isLoading}
          error={featured.error}
          isEmpty={featured.data?.items.length === 0}
          emptyMessage="Nothing is featured yet."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {featured.data?.items.map((listing) => {
              const Icon = KIND_ICON[listing.kind] ?? Package;
              return (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  icon={<Icon className="w-5 h-5" />}
                />
              );
            })}
          </div>
        </QueryState>
      </section>

      <section>
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
          <Download className="w-4 h-4 text-emerald-400" /> Adoption by
          storefront
        </h2>
        <Panel>
          <QueryState
            isLoading={stats.isLoading}
            error={stats.error}
            isEmpty={totalListings === 0}
            emptyMessage="The catalogue is empty."
          >
            <ul className="divide-y divide-slate-800">
              {stats.data?.map((row) => {
                const Icon = KIND_ICON[row.kind] ?? Package;
                return (
                  <li
                    key={row.kind}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${KIND_TONE[row.kind]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-200 truncate">
                        {KIND_LABEL[row.kind]}s
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {formatCount(row.listingCount)} listing
                        {row.listingCount === 1 ? '' : 's'} published
                      </p>
                    </div>
                    <span className="px-2 py-0.5 border text-[10px] font-semibold rounded-full bg-slate-800 border-slate-700 text-slate-300">
                      {formatCount(row.installCount)} install
                      {row.installCount === 1 ? '' : 's'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </QueryState>
        </Panel>
      </section>
    </ViewShell>
  );
}
