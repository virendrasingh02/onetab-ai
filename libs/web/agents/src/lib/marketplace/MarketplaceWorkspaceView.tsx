import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MarketplaceInstallation } from '@org/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  PageSection,
} from '@org/ui';
import { studioAppUrl, studioWorkspacePath } from '@org/platform';
import {
  Boxes,
  Bot,
  ExternalLink,
  Layers,
  MessageSquare,
  Settings2,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { ActiveBadge, EntityIcon, SectionTabs } from './marketplace-ui';
import type {
  WorkspaceCatalogItem,
  WorkspaceCatalogKind,
} from './use-workspace-catalog';

export type WorkspaceFilter = 'all' | WorkspaceCatalogKind;
type Filter = WorkspaceFilter;

export function isWorkspaceFilter(value: unknown): value is WorkspaceFilter {
  return (
    value === 'all' ||
    value === 'agent' ||
    value === 'coworker' ||
    value === 'app' ||
    value === 'automation'
  );
}

const FILTERS: {
  id: Filter;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'agent', label: 'Agents', icon: Bot },
  { id: 'coworker', label: 'Coworkers', icon: UserRound },
  { id: 'app', label: 'Apps', icon: Boxes },
  { id: 'automation', label: 'Automations', icon: Layers },
];

const KIND_LABEL: Record<WorkspaceCatalogKind, string> = {
  agent: 'Agent',
  coworker: 'Coworker',
  app: 'App',
  automation: 'Automation',
};

const EMPTY_COPY: Record<Filter, { title: string; description: string }> = {
  all: {
    title: 'Nothing here yet',
    description:
      'Build agents and automations in the AI Agent Studio, add coworkers, or install apps from Discover.',
  },
  agent: {
    title: 'No published agents',
    description:
      'Agents show up here once you publish them from the AI Agent Studio.',
  },
  coworker: {
    title: 'No coworkers yet',
    description:
      'Coworkers are AI teammates that work alongside your team in channels and projects.',
  },
  app: {
    title: 'No apps installed',
    description: 'Install apps and integrations from Discover.',
  },
  automation: {
    title: 'No automations yet',
    description:
      'Automations and agent workflows are built in the AI Agent Studio.',
  },
};

interface MarketplaceWorkspaceViewProps {
  items: WorkspaceCatalogItem[];
  isLoading: boolean;
  workspaceSlug: string;
  searchQuery: string;
  /** Which kind is showing; lives in the URL so sidebar links can land on one. */
  filter: WorkspaceFilter;
  onFilterChange: (filter: WorkspaceFilter) => void;
  /** Opens the coworker creation dialog (supplied by the app; coworkers live above this library). */
  onCreateCoworker?: () => void;
  /** Opens the AI Agent Studio (optionally at a path inside its workspace area). */
  onOpenStudio: (path?: string) => void;
  onConfigure: (installation: MarketplaceInstallation) => void;
  onOpenListing: (slug: string, kind: 'AGENT' | 'INTEGRATION') => void;
  onBrowse: () => void;
}

export const MarketplaceWorkspaceView: React.FC<
  MarketplaceWorkspaceViewProps
> = ({
  items,
  isLoading,
  workspaceSlug,
  searchQuery,
  filter,
  onFilterChange,
  onCreateCoworker,
  onOpenStudio,
  onConfigure,
  onOpenListing,
  onBrowse,
}) => {
  const navigate = useNavigate();

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: items.length,
      agent: 0,
      coworker: 0,
      app: 0,
      automation: 0,
    };
    for (const item of items) c[item.kind] += 1;
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return items
      .filter((item) => filter === 'all' || item.kind === filter)
      .filter(
        (item) =>
          !needle ||
          item.name.toLowerCase().includes(needle) ||
          item.description.toLowerCase().includes(needle) ||
          item.subtitle.toLowerCase().includes(needle),
      );
  }, [items, filter, searchQuery]);

  const studioPath = (...segments: string[]) =>
    studioWorkspacePath(workspaceSlug, ...segments);

  /** The one "add" button for the filter on screen — what the sidebar's Add links expect to find. */
  const createAction: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    primary: boolean;
    run: () => void;
  } | null = (() => {
    switch (filter) {
      case 'agent':
        return {
          label: 'Create agent in Studio',
          icon: Sparkles,
          primary: true,
          run: () => onOpenStudio(studioPath('create')),
        };
      case 'coworker':
        return onCreateCoworker
          ? {
              label: 'New coworker',
              icon: UserRound,
              primary: true,
              run: onCreateCoworker,
            }
          : null;
      case 'app':
        return {
          label: 'Browse apps',
          icon: Boxes,
          primary: true,
          run: onBrowse,
        };
      case 'automation':
        return {
          label: 'New automation in Studio',
          icon: Layers,
          primary: true,
          run: () => onOpenStudio(studioPath('workflows')),
        };
      default:
        return {
          label: 'Manage in AI Agent Studio',
          icon: ExternalLink,
          primary: false,
          run: () => onOpenStudio(),
        };
    }
  })();

  const actionsFor = (item: WorkspaceCatalogItem) => {
    switch (item.kind) {
      case 'agent':
        return {
          primary: {
            label: 'Chat',
            icon: MessageSquare,
            run: () => navigate(`/w/${workspaceSlug}/agents/${item.id}/chat`),
          },
          secondary: item.installation
            ? {
                label: 'Configure',
                icon: Settings2,
                run: () =>
                  onConfigure(item.installation as MarketplaceInstallation),
              }
            : {
                label: 'Edit in Studio',
                icon: ExternalLink,
                run: () => onOpenStudio(studioPath('agents', item.id)),
              },
        };
      case 'coworker':
        return {
          primary: {
            label: 'Open',
            icon: MessageSquare,
            run: () => navigate(`/w/${workspaceSlug}/coworkers/${item.id}`),
          },
          secondary: {
            label: 'Edit',
            icon: Settings2,
            run: () => navigate(`/w/${workspaceSlug}/ai/agents/${item.id}`),
          },
        };
      case 'app':
        return {
          primary: item.slug
            ? {
                label: 'Details',
                icon: Boxes,
                run: () => onOpenListing(item.slug as string, 'INTEGRATION'),
              }
            : undefined,
          secondary: item.installation
            ? {
                label: 'Configure',
                icon: Settings2,
                run: () =>
                  onConfigure(item.installation as MarketplaceInstallation),
              }
            : undefined,
        };
      case 'automation':
        return {
          primary: {
            label: 'Open in Studio',
            icon: ExternalLink,
            run: () =>
              onOpenStudio(
                item.studioAgent
                  ? studioPath('studio', item.id)
                  : studioPath('workflows', item.id),
              ),
          },
          secondary: undefined,
        };
    }
  };

  return (
    <div className="space-y-4 py-3">
      <PageSection
        variant="plain"
        title="Your workspace"
        description="Every agent, coworker, app and automation in this workspace. Agents appear once published from the AI Agent Studio."
        className="mb-0"
        actions={
          createAction ? (
            <Button
              variant={createAction.primary ? 'primary' : 'outline'}
              size="sm"
              onClick={createAction.run}
            >
              <createAction.icon aria-hidden />
              {createAction.label}
            </Button>
          ) : undefined
        }
      />

      <SectionTabs
        aria-label="Filter by type"
        value={filter}
        onValueChange={onFilterChange}
        items={FILTERS.map(({ id, label, icon: Icon }) => ({
          value: id,
          label,
          icon: <Icon className="size-3.5" aria-hidden />,
          count: counts[id],
        }))}
      />

      {isLoading && items.length === 0 ? (
        <LoadingState label="Loading your workspace…" />
      ) : visible.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No matches' : EMPTY_COPY[filter].title}
          description={
            searchQuery
              ? `Nothing in your workspace matches “${searchQuery}”.`
              : EMPTY_COPY[filter].description
          }
          action={
            createAction ? (
              <Button variant="primary" size="sm" onClick={createAction.run}>
                <createAction.icon aria-hidden />
                {createAction.label}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="md:grid-cols-2 lg:grid-cols-3 gap-4 grid grid-cols-1">
          {visible.map((item) => {
            const { primary, secondary } = actionsFor(item);
            return (
              <Card key={item.key} className="p-4 justify-between">
                <div>
                  <div className="mb-3 gap-3 flex items-start justify-between">
                    <div className="min-w-0 gap-3 flex items-center">
                      <EntityIcon
                        iconUrl={item.icon}
                        kind={item.kind === 'app' ? 'INTEGRATION' : 'AGENT'}
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold truncate text-foreground">
                          {item.name}
                        </h4>
                        <p className="text-xs truncate text-muted-foreground">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>
                    <ActiveBadge active={item.status === 'active'} />
                  </div>
                  <p className="mb-3 text-xs leading-relaxed line-clamp-2 text-muted-foreground">
                    {item.description}
                  </p>
                  <Badge variant="neutral">{KIND_LABEL[item.kind]}</Badge>
                </div>

                {(primary || secondary) && (
                  <div className="mt-4 gap-2 pt-3 flex items-center justify-between border-t border-border/60">
                    {primary ? (
                      <Button variant="outline" size="xs" onClick={primary.run}>
                        <primary.icon aria-hidden />
                        {primary.label}
                      </Button>
                    ) : (
                      <span />
                    )}
                    {secondary && (
                      <Button variant="ghost" size="xs" onClick={secondary.run}>
                        <secondary.icon aria-hidden />
                        {secondary.label}
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

/** Opens a Studio path in a new tab (the Studio is a separate app). */
export function openStudioTab(path = ''): void {
  window.open(studioAppUrl(path), '_blank', 'noopener');
}
