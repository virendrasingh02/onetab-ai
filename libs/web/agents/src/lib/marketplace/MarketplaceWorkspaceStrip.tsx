import React, { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AIAgentDetail, AutomationWorkflowDetail } from '@org/types';
import { AiEntityAvatar, Button, Card, Skeleton } from '@org/ui';
import { studioWorkspacePath } from '@org/platform';
import { cn, formatRelative } from '@org/utils';
import {
  ArrowRight,
  Bot,
  ExternalLink,
  LayoutGrid,
  Sparkles,
  UserRound,
  Workflow,
} from 'lucide-react';
import { MARKETPLACE_GRID_CLASS, SectionTabs } from './marketplace-ui';
import type { WorkspaceCoworker } from './use-workspace-catalog';

type ItemKind = 'agent' | 'coworker' | 'automation';
type KindFilter = 'all' | ItemKind;

/** How many of the newest items Discover shows before "View all". */
const MAX_ITEMS = 8;

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
  /** Goes to the full list for one kind (agents tab, coworkers tab, Automation Center). */
  onViewAll: (kind: ItemKind) => void;
}

function ItemTile({ item }: { item: WorkspaceItem }) {
  if (item.kind === 'automation') {
    return (
      <div
        className="size-10 flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised text-accent-amber"
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
      size="lg"
    />
  );
}

function WorkspaceItemCard({
  item,
  onOpen,
  onStudio,
}: {
  item: WorkspaceItem;
  onOpen: () => void;
  onStudio?: () => void;
}) {
  const descId = useId();
  const status = item.isActive ? 'Active' : 'Paused';

  return (
    // The name is the card's one link-like control; it stretches over the
    // card so the whole surface is clickable without nesting buttons.
    <Card className="group gap-0 p-4 relative h-full transition-colors hover:border-border-strong hover:bg-surface-raised/40">
      <div className="gap-3 flex items-start">
        <ItemTile item={item} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            <button
              type="button"
              onClick={onOpen}
              aria-describedby={descId}
              className="after:inset-0 block max-w-full truncate text-left outline-none after:absolute after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-ring/50"
              title={item.name}
            >
              {item.name}
            </button>
          </h3>
          <p className="mt-0.5 gap-1.5 text-xs min-w-0 flex items-center text-muted-foreground">
            <span className="shrink-0">{KIND_LABEL[item.kind]}</span>
            <span aria-hidden>·</span>
            <span
              className={cn(
                'gap-1 inline-flex shrink-0 items-center',
                item.isActive ? 'text-success-text' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  item.isActive ? 'bg-success' : 'bg-muted-foreground/60',
                )}
                aria-hidden
              />
              {status}
            </span>
          </p>
        </div>
      </div>

      <p
        id={descId}
        className="mt-3 min-h-10 text-xs leading-relaxed line-clamp-2 text-muted-foreground"
      >
        {item.subtitle ? `${item.subtitle} — ` : ''}
        {item.description}
      </p>

      <div className="min-h-3 flex-1" aria-hidden />
      <div className="gap-2 pt-3 flex items-center justify-between border-t border-border/60">
        {item.addedAt ? (
          <time
            dateTime={item.addedAt}
            className="text-xs truncate text-muted-foreground"
            title={new Date(item.addedAt).toLocaleString()}
          >
            Added {formatRelative(item.addedAt)}
          </time>
        ) : (
          <span />
        )}
        {onStudio && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onStudio}
            className="relative z-10"
            aria-label={`Open ${item.name} in AI Agent Studio`}
          >
            <ExternalLink aria-hidden />
            Studio
          </Button>
        )}
      </div>
    </Card>
  );
}

/**
 * "Your workspace" on Discover: every agent, coworker and automation added to
 * this workspace, newest first, so something built in the Studio shows up here
 * as soon as it exists. Each list refreshes on its own (realtime for
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
  onViewAll,
}) => {
  const navigate = useNavigate();
  const headingId = useId();
  const [filter, setFilter] = useState<KindFilter>('all');

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

  const visible = (
    filter === 'all' ? matching : matching.filter((i) => i.kind === filter)
  ).slice(0, MAX_ITEMS);
  const total = counts[filter];

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

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="gap-2 flex flex-wrap items-end justify-between">
        <div>
          <h2 id={headingId} className="text-sm font-semibold text-foreground">
            Your workspace
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Agents, coworkers and automations added here, newest first.
          </p>
        </div>
        {filter !== 'all' && total > MAX_ITEMS ? (
          <Button variant="ghost" size="sm" onClick={() => onViewAll(filter)}>
            View all {total}
            <ArrowRight aria-hidden />
          </Button>
        ) : null}
      </div>

      <SectionTabs
        aria-label="Filter your workspace by type"
        value={filter}
        onValueChange={setFilter}
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

      {isLoading && items.length === 0 ? (
        <div
          className={MARKETPLACE_GRID_CLASS}
          aria-busy="true"
          aria-label="Loading your workspace"
        >
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p
          className="py-6 text-sm text-center text-muted-foreground"
          role="status"
        >
          {searchQuery
            ? `Nothing in your workspace matches “${searchQuery}”.`
            : `No ${filter === 'all' ? 'items' : `${KIND_LABEL[filter as ItemKind].toLowerCase()}s`} yet.`}
        </p>
      ) : (
        <ul className={MARKETPLACE_GRID_CLASS} aria-labelledby={headingId}>
          {visible.map((item) => (
            <li key={item.key} className="min-w-0">
              <WorkspaceItemCard
                item={item}
                onOpen={() => openItem(item)}
                onStudio={
                  item.kind === 'automation'
                    ? undefined
                    : () =>
                        onOpenStudio(
                          studioWorkspacePath(workspaceSlug, 'agents', item.id),
                        )
                }
              />
            </li>
          ))}
        </ul>
      )}

      {filter === 'all' && matching.length > MAX_ITEMS && (
        <p className="text-xs text-muted-foreground" role="note">
          Showing the {MAX_ITEMS} newest of {matching.length}. Pick a type above
          to see more.
        </p>
      )}
    </section>
  );
};
