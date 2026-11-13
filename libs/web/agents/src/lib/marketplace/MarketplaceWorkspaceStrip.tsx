import React, { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AIAgentDetail, AutomationWorkflowDetail } from '@org/types';
import { AiEntityAvatar, Button, Card, Skeleton } from '@org/ui';
import { studioWorkspacePath } from '@org/platform';
import { cn, formatRelative } from '@org/utils';
import {
  Bot,
  ExternalLink,
  LayoutGrid,
  Sparkles,
  UserRound,
  Workflow,
} from 'lucide-react';
import { MARKETPLACE_GRID_CLASS, SectionTabs } from './marketplace-ui';
import {
  ItemCard,
  ItemList,
  ItemRow,
  LayoutToggle,
  StatusDot,
  type MarketplaceLayout,
} from './marketplace-items';
import type { WorkspaceCoworker } from './use-workspace-catalog';

type ItemKind = 'agent' | 'coworker' | 'automation';
type KindFilter = 'all' | ItemKind;

/** Items per "Show more" page. */
const PAGE_SIZE = 24;

const KIND_LABEL: Record<ItemKind, string> = {
  agent: 'AI agent',
  coworker: 'Coworker',
  automation: 'Automation',
};

/** One thing this workspace added — an agent, a coworker or an automation. */
interface WorkspaceItem {
  key: string;
  id: string;
  kind: ItemKind;
  name: string;
  subtitle: string;
  description: string;
  avatarUrl: string | null;
  isActive: boolean;
  addedAt?: string;
}

function humanize(value: string): string {
  const text = value.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return text ? text[0].toUpperCase() + text.slice(1) : '';
}

function toTime(value?: string): number {
  const time = value ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? 0 : time;
}

interface MarketplaceWorkspaceStripProps {
  agents: AIAgentDetail[];
  coworkers: WorkspaceCoworker[];
  automations: AutomationWorkflowDetail[];
  isLoading: boolean;
  workspaceSlug: string;
  searchQuery: string;
  /** Opens the AI Agent Studio (optionally at a path inside its workspace area). */
  onOpenStudio: (path?: string) => void;
  layout: MarketplaceLayout;
  onLayoutChange: (next: MarketplaceLayout) => void;
}

function ItemTile({ item, size }: { item: WorkspaceItem; size: 'md' | 'lg' }) {
  if (item.kind === 'automation') {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised text-accent-amber',
          size === 'lg' ? 'size-10' : 'size-9',
        )}
        aria-hidden
      >
        <Workflow className="size-5" />
      </div>
    );
  }
  return (
    <AiEntityAvatar
      name={item.name}
      kind={item.kind}
      avatarUrl={item.avatarUrl}
      size={size}
    />
  );
}

function WorkspaceItemView({
  item,
  layout,
  onOpen,
  onStudio,
}: {
  item: WorkspaceItem;
  layout: MarketplaceLayout;
  onOpen: () => void;
  onStudio?: () => void;
}) {
  const isList = layout === 'list';
  const slots = {
    icon: <ItemTile item={item} size={isList ? 'md' : 'lg'} />,
    name: item.name,
    subtitle: item.subtitle
      ? `${KIND_LABEL[item.kind]} · ${item.subtitle}`
      : KIND_LABEL[item.kind],
    corner: <StatusDot active={item.isActive} />,
    description: item.description,
    meta: item.addedAt ? (
      <time
        dateTime={item.addedAt}
        className="truncate"
        title={new Date(item.addedAt).toLocaleString()}
      >
        Added {formatRelative(item.addedAt)}
      </time>
    ) : null,
    actions: onStudio ? (
      <Button
        variant="ghost"
        size="xs"
        onClick={onStudio}
        aria-label={`Open ${item.name} in AI Agent Studio`}
        title="Open in AI Agent Studio"
      >
        <ExternalLink aria-hidden />
        Studio
      </Button>
    ) : undefined,
    onOpen,
  };
  return isList ? <ItemRow {...slots} /> : <ItemCard {...slots} />;
}

/**
 * The "Yours" tab: every agent, coworker and automation added to this
 * workspace, newest first, so something built in the Studio shows up here as
 * soon as it exists. Each list refreshes on its own (realtime for
 * coworkers, window focus for agents and automations).
 */
export const MarketplaceWorkspaceStrip: React.FC<
  MarketplaceWorkspaceStripProps
> = ({
  agents,
  coworkers,
  automations,
  isLoading,
  workspaceSlug,
  searchQuery,
  onOpenStudio,
  layout,
  onLayoutChange,
}) => {
  const navigate = useNavigate();
  const headingId = useId();
  const [filter, setFilter] = useState<KindFilter>('all');
  const [pageCount, setPageCount] = useState(1);

  const items = useMemo<WorkspaceItem[]>(() => {
    const all: WorkspaceItem[] = [
      ...agents.map((a) => ({
        key: `agent:${a.id}`,
        id: a.id,
        kind: 'agent' as const,
        name: a.name,
        // The role only prefixes a real description, never the fallback.
        subtitle: (a.description ?? '').trim() ? (a.role ?? '').trim() : '',
        description:
          (a.description ?? '').trim() ||
          (a.isMarketplace
            ? 'Installed from the Marketplace.'
            : 'Built in the AI Agent Studio.'),
        avatarUrl: a.avatarUrl ?? null,
        isActive: a.isActive,
        addedAt: a.createdAt,
      })),
      ...coworkers.map((c) => ({
        key: `coworker:${c.id}`,
        id: c.id,
        kind: 'coworker' as const,
        name: c.name,
        subtitle: c.description === 'No description yet.' ? '' : c.role,
        description: c.description,
        avatarUrl: c.avatarUrl,
        isActive: c.isActive,
        addedAt: c.createdAt ?? c.updatedAt,
      })),
      ...automations.map((w) => ({
        key: `automation:${w.id}`,
        id: w.id,
        kind: 'automation' as const,
        name: w.name,
        subtitle: '',
        description:
          (w.description ?? '').trim() ||
          `Runs on ${humanize(w.triggerType) || 'a trigger'}.`,
        avatarUrl: null,
        isActive: w.isActive,
        addedAt: w.createdAt,
      })),
    ];
    return all.sort((a, b) => toTime(b.addedAt) - toTime(a.addedAt));
  }, [agents, coworkers, automations]);

  const matching = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) =>
      [i.name, i.subtitle, i.description, KIND_LABEL[i.kind]].some((t) =>
        t.toLowerCase().includes(needle),
      ),
    );
  }, [items, searchQuery]);

  const counts = useMemo(
    () => ({
      all: matching.length,
      agent: matching.filter((i) => i.kind === 'agent').length,
      coworker: matching.filter((i) => i.kind === 'coworker').length,
      automation: matching.filter((i) => i.kind === 'automation').length,
    }),
    [matching],
  );

  const filtered =
    filter === 'all' ? matching : matching.filter((i) => i.kind === filter);
  const visible = filtered.slice(0, pageCount * PAGE_SIZE);

  const openItem = (item: WorkspaceItem) => {
    if (item.kind === 'agent')
      navigate(`/w/${workspaceSlug}/agents/${item.id}/chat`);
    else if (item.kind === 'coworker')
      navigate(`/w/${workspaceSlug}/coworkers/${item.id}`);
    else navigate(`/w/${workspaceSlug}/automations/builder/${item.id}`);
  };

  // Nothing to show yet and nothing loading: one quiet prompt to build.
  if (!isLoading && items.length === 0) {
    return (
      <section aria-labelledby={headingId}>
        <h2
          id={headingId}
          className="mb-3 text-sm font-semibold text-foreground"
        >
          Your workspace
        </h2>
        <Card className="gap-4 p-5 sm:flex-row sm:items-center flex flex-col justify-between border-dashed">
          <div className="gap-4 flex items-center">
            <div className="size-11 flex shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary-text">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Nothing added yet
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Agents, coworkers and automations you install or build show up
                here right away.
              </p>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => onOpenStudio()}>
            Open AI Agent Studio
            <ExternalLink aria-hidden />
          </Button>
        </Card>
      </section>
    );
  }

  const studioFor = (item: WorkspaceItem) =>
    item.kind === 'automation'
      ? undefined
      : () =>
          onOpenStudio(studioWorkspacePath(workspaceSlug, 'agents', item.id));

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <h2 id={headingId} className="sr-only">
        Your workspace
      </h2>

      <div className="gap-x-3 gap-y-2 flex flex-wrap items-center justify-between">
        <SectionTabs
          aria-label="Filter your workspace by type"
          value={filter}
          onValueChange={(next) => {
            setFilter(next);
            setPageCount(1);
          }}
          items={[
            {
              value: 'all' as const,
              label: 'All',
              icon: <LayoutGrid className="size-3.5" aria-hidden />,
              count: counts.all,
            },
            {
              value: 'agent' as const,
              label: 'Agents',
              icon: <Bot className="size-3.5" aria-hidden />,
              count: counts.agent,
            },
            {
              value: 'coworker' as const,
              label: 'Coworkers',
              icon: <UserRound className="size-3.5" aria-hidden />,
              count: counts.coworker,
            },
            {
              value: 'automation' as const,
              label: 'Automations',
              icon: <Workflow className="size-3.5" aria-hidden />,
              count: counts.automation,
            },
          ]}
        />
        <div className="gap-2 flex items-center">
          <Button variant="outline" size="sm" onClick={() => onOpenStudio()}>
            <Sparkles aria-hidden />
            Build new
          </Button>
          <LayoutToggle value={layout} onValueChange={onLayoutChange} />
        </div>
      </div>

      {isLoading && items.length === 0 ? (
        <div
          className={MARKETPLACE_GRID_CLASS}
          aria-busy="true"
          aria-label="Loading your workspace"
        >
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p
          className="py-10 text-sm text-center text-muted-foreground"
          role="status"
        >
          {searchQuery
            ? `Nothing in your workspace matches “${searchQuery}”.`
            : `No ${filter === 'all' ? 'items' : `${KIND_LABEL[filter as ItemKind].toLowerCase()}s`} yet.`}
        </p>
      ) : layout === 'grid' ? (
        <ul className={MARKETPLACE_GRID_CLASS} aria-labelledby={headingId}>
          {visible.map((item) => (
            <li key={item.key} className="min-w-0">
              <WorkspaceItemView
                item={item}
                layout="grid"
                onOpen={() => openItem(item)}
                onStudio={studioFor(item)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <ItemList aria-labelledby={headingId}>
          {visible.map((item) => (
            <WorkspaceItemView
              key={item.key}
              item={item}
              layout="list"
              onOpen={() => openItem(item)}
              onStudio={studioFor(item)}
            />
          ))}
        </ItemList>
      )}

      {filtered.length > visible.length && (
        <div className="gap-3 flex items-center justify-center">
          <span className="text-xs text-muted-foreground">
            Showing {visible.length} of {filtered.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPageCount((n) => n + 1)}
          >
            Show more
          </Button>
        </div>
      )}
    </section>
  );
};
