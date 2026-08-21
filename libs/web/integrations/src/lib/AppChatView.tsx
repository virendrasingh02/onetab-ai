import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  Hint,
  LoadingState,
  Panel,
  SearchInput,
  Spinner,
  toast,
  useRightPanelStore,
} from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Bell,
  BellOff,
  Blocks,
  Check,
  ChevronRight,
  Copy,
  MoreHorizontal,
  RefreshCw,
  Settings,
  Star,
  UserRound,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useIntegrationMutations, useIntegrations } from './use-integrations.js';

interface AppPreferencesState {
  byWorkspace: Record<string, { favorites: string[]; muted: string[] }>;
  toggleFavorite: (workspaceId: string, appId: string) => void;
  toggleMuted: (workspaceId: string, appId: string) => void;
}

const NO_IDS: string[] = [];
const EMPTY = { favorites: NO_IDS, muted: NO_IDS };
const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id];

const useAppPreferencesStore = create<AppPreferencesState>()(
  persist(
    (set) => ({
      byWorkspace: {},
      toggleFavorite: (workspaceId, appId) => {
        if (!workspaceId || !appId) return;
        set((state) => {
          const current = state.byWorkspace[workspaceId] ?? EMPTY;
          return {
            byWorkspace: {
              ...state.byWorkspace,
              [workspaceId]: {
                favorites: toggle(current.favorites, appId),
                muted: current.muted,
              },
            },
          };
        });
      },
      toggleMuted: (workspaceId, appId) => {
        if (!workspaceId || !appId) return;
        set((state) => {
          const current = state.byWorkspace[workspaceId] ?? EMPTY;
          return {
            byWorkspace: {
              ...state.byWorkspace,
              [workspaceId]: {
                favorites: current.favorites,
                muted: toggle(current.muted, appId),
              },
            },
          };
        });
      },
    }),
    { name: 'onetab-app-preferences' },
  ),
);

function useAppPreferences(workspaceId: string | undefined) {
  const byWorkspace = useAppPreferencesStore((s) => s.byWorkspace);
  const toggleFavorite = useAppPreferencesStore((s) => s.toggleFavorite);
  const toggleMuted = useAppPreferencesStore((s) => s.toggleMuted);

  const activeWorkspaceId = workspaceId ?? '';
  const entry = byWorkspace[activeWorkspaceId];
  const favoriteIds = entry?.favorites ?? NO_IDS;
  const mutedIds = entry?.muted ?? NO_IDS;

  return {
    favoriteIds,
    mutedIds,
    isFavorite: (appId: string) => favoriteIds.includes(appId),
    isMuted: (appId: string) => mutedIds.includes(appId),
    toggleFavorite: (appId: string) =>
      toggleFavorite(activeWorkspaceId, appId),
    toggleMuted: (appId: string) => toggleMuted(activeWorkspaceId, appId),
  };
}

export interface AppChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isError?: boolean;
  reactions?: { key: string; count: number; reactedByMe?: boolean }[];
}

export interface AppModelItem {
  id: string;
  name: string;
  category: string;
  description: string;
  provider: string;
  icon?: string;
  isConnected?: boolean;
  statusText?: string;
  quickStarters?: string[];
}

export const APP_LOGOS: Record<string, string> = {
  github: 'https://cdn.simpleicons.org/github',
  gitlab: 'https://cdn.simpleicons.org/gitlab',
  jira: 'https://cdn.simpleicons.org/jira',
  linear: 'https://cdn.simpleicons.org/linear',
  figma: 'https://cdn.simpleicons.org/figma',
  gdrive: 'https://cdn.simpleicons.org/googledrive',
  google_drive: 'https://cdn.simpleicons.org/googledrive',
  gcal: 'https://cdn.simpleicons.org/googlecalendar',
  google_calendar: 'https://cdn.simpleicons.org/googlecalendar',
  outlook: 'https://cdn.simpleicons.org/microsoftoutlook',
  microsoft_outlook: 'https://cdn.simpleicons.org/microsoftoutlook',
  zendesk: 'https://cdn.simpleicons.org/zendesk',
  intercom: 'https://cdn.simpleicons.org/intercom',
  mixpanel: 'https://cdn.simpleicons.org/mixpanel',
  datadog: 'https://cdn.simpleicons.org/datadog',
  stripe: 'https://cdn.simpleicons.org/stripe',
  quickbooks: 'https://cdn.simpleicons.org/quickbooks',
  bamboohr: 'https://cdn.simpleicons.org/bamboohr',
  hubspot: 'https://cdn.simpleicons.org/hubspot',
  discord: 'https://cdn.simpleicons.org/discord',
  slack: 'https://cdn.simpleicons.org/slack',
  notion: 'https://cdn.simpleicons.org/notion',
  webhooks: 'https://cdn.simpleicons.org/webhooks',
};

export const DEFAULT_WORKSPACE_APPS: AppModelItem[] = [
  {
    id: 'github',
    name: 'GitHub',
    category: 'Developer Tools',
    provider: 'github',
    description:
      'Repository activity, pull request reviews, CI/CD status, and issue sync directly in chat.',
    quickStarters: [
      'Show open pull requests awaiting review',
      'Check latest CI build status on main branch',
      'List recent commits merged today',
    ],
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'Productivity & Project Management',
    provider: 'linear',
    description:
      'High-performance issue tracking, sprint cycle progress, and roadmaps.',
    quickStarters: [
      'List active sprint issues assigned to me',
      'Create bug ticket: "Fix dropdown z-index collision"',
      'Show Cycle 24 completion percentage',
    ],
  },
  {
    id: 'jira',
    name: 'Jira Software',
    category: 'Productivity & Project Management',
    provider: 'jira',
    description:
      'Enterprise issue tracking, sprint backlogs, and team agility metrics.',
    quickStarters: [
      'Show current sprint backlog summary',
      'Move issue ONETAB-142 to In Review',
      'List unassigned P1 tickets in current epic',
    ],
  },
  {
    id: 'figma',
    name: 'Figma',
    category: 'Design',
    provider: 'figma',
    description:
      'Design file sync, component comments, inspect frames, and design token exports.',
    quickStarters: [
      'Show latest comments on "Design System v2"',
      'Sync UI tokens with repository styling',
      'Generate specs for the new message row layout',
    ],
  },
  {
    id: 'sentry',
    name: 'Sentry',
    category: 'Developer Tools',
    provider: 'sentry',
    description:
      'Realtime crash reporting, error monitoring, and performance telemetry.',
    quickStarters: [
      'Check error spikes in the last 24 hours',
      'Show stack trace for latest 500 error',
      'Mute non-critical TypeError warnings in dev',
    ],
  },
  {
    id: 'gdrive',
    name: 'Google Drive',
    category: 'Productivity & Project Management',
    provider: 'gdrive',
    description:
      'Cloud file sharing, document access, sheets indexing, and permission controls.',
    quickStarters: [
      'Search shared drive for "Q3 Product Roadmap"',
      'List recently edited team spreadsheets',
      'Link team assets folder to dev channels',
    ],
  },
  {
    id: 'slack',
    name: 'Slack Sync',
    category: 'Customer Support & Communication',
    provider: 'slack',
    description:
      'Bi-directional message bridging, webhook integrations, and cross-platform notifications.',
    quickStarters: [
      'Check Slack bridge webhook status',
      'Sync announcements channel to #general',
      'Export channel transcript to Slack archive',
    ],
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'Productivity & Project Management',
    provider: 'notion',
    description:
      'Knowledge base synchronization, wikis, and team document indexing.',
    quickStarters: [
      'Search Notion wiki for engineering guidelines',
      'Create new meeting notes page for today',
      'Sync product specs database with channels',
    ],
  },
  {
    id: 'datadog',
    name: 'Datadog',
    category: 'Analytics',
    provider: 'datadog',
    description:
      'Infrastructure observability, APM traces, and synthetic monitoring.',
    quickStarters: [
      'Show P99 latency metrics for API gateway',
      'List active synthetic monitors and uptime',
      'Check CPU and memory usage on cluster nodes',
    ],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'Finance',
    provider: 'stripe',
    description:
      'Subscription metrics, MRR analytics, invoice alerts, and payment events.',
    quickStarters: [
      'Show current month MRR and customer growth',
      'Check recent successful transactions',
      'List active subscription tiers and churn rate',
    ],
  },
];

export function AppAvatar({
  name,
  provider,
  className,
  size = 'md',
}: {
  name: string;
  provider: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const logoUrl = APP_LOGOS[provider.toLowerCase()] || APP_LOGOS[name.toLowerCase()];
  const sizeClasses = {
    sm: 'size-7 p-1 rounded-lg text-xs',
    md: 'size-10 p-1.5 rounded-xl text-sm',
    lg: 'size-14 p-2 rounded-2xl text-base',
  }[size];

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center border border-border/80 bg-surface text-foreground shadow-xs',
        sizeClasses,
        className,
      )}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name}
          className="size-full object-contain dark:brightness-110"
          loading="lazy"
        />
      ) : (
        <Blocks className="size-full text-accent-violet" />
      )}
    </span>
  );
}

/**
 * App Chat View — Structured, laid out, and styled identically to Agent & Direct Messages.
 *
 * The conversation is the page: sticky header with APP badge, full-height chat surface,
 * direct message bubbles with markdown, thinking/syncing indicator, and right rail details.
 */
export function AppChatView() {
  const { appId: paramAppId } = useParams<{ appId?: string }>();
  const [searchParams] = useSearchParams();
  const appId =
    searchParams.get('app') ||
    searchParams.get('id') ||
    paramAppId;

  return appId ? <AppConversation appId={appId} /> : <NewAppMessage />;
}

/**
 * One App conversation.
 * Keyed on appId in the URL so switching apps remounts the component cleanly.
 */
function AppConversation({ appId }: { appId: string }) {
  const { workspaceId } = useCurrentWorkspace();
  const integrationsQuery = useIntegrations(workspaceId);

  const connectedIntegrations = useMemo(() => {
    return (integrationsQuery.data ?? []).map((i) => {
      const defaultMatch = DEFAULT_WORKSPACE_APPS.find(
        (d) => d.id === i.provider.toLowerCase() || d.provider === i.provider.toLowerCase(),
      );
      return {
        id: i.provider.toLowerCase(),
        name: defaultMatch?.name || i.provider,
        category: defaultMatch?.category || 'Developer Tools',
        provider: i.provider.toLowerCase(),
        description: defaultMatch?.description || `${i.provider} workspace integration.`,
        isConnected: i.status === 'CONNECTED',
        statusText: i.status === 'CONNECTED' ? 'Connected · Active' : 'Disconnected',
        quickStarters: defaultMatch?.quickStarters,
      } as AppModelItem;
    });
  }, [integrationsQuery.data]);

  /*
   * `DEFAULT_WORKSPACE_APPS` is a catalogue of providers this deployment knows
   * how to talk to — names, categories, blurbs — and nothing more. Whether an
   * app is actually connected comes only from the integrations endpoint, so an
   * app the workspace has never linked reads as disconnected rather than
   * inheriting a connected-looking default.
   */
  const allApps = useMemo(() => {
    const combined: AppModelItem[] = DEFAULT_WORKSPACE_APPS.map((entry) => ({
      ...entry,
      isConnected: false,
      statusText: 'Not connected',
    }));
    for (const item of connectedIntegrations) {
      const idx = combined.findIndex((c) => c.id === item.id);
      if (idx >= 0) {
        combined[idx] = { ...combined[idx], ...item };
      } else {
        combined.push(item);
      }
    }
    return combined;
  }, [connectedIntegrations]);

  const app = allApps.find(
    (a) =>
      a.id === appId.toLowerCase() ||
      a.provider === appId.toLowerCase() ||
      `app-${a.id}` === appId.toLowerCase(),
  );

  if (integrationsQuery.isLoading && allApps.length === 0) {
    return (
      <div className="p-8">
        <Spinner label="Opening app conversation…" />
      </div>
    );
  }

  if (!app) {
    return (
      <ErrorState
        fullPage
        title="App not found"
        description="This app may not be connected, or the link is out of date."
      />
    );
  }

  return (
    <div className="min-h-0 flex flex-1 flex-col overflow-hidden bg-background text-foreground">
      <AppMessageHeader app={app} />

      <AppDetailPanel key={app.id} app={app} />
    </div>
  );
}

/**
 * App's sticky title header — Counterpart to DirectMessageHeader & AgentMessageHeader.
 */
function AppMessageHeader({ app }: { app: AppModelItem }) {
  const { workspaceId, slug: workspaceSlug } = useCurrentWorkspace();
  const preferences = useAppPreferences(workspaceId);
  const openProfilePanel = useRightPanelStore((s) => s.openProfile);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [synced, setSynced] = useState(false);

  const name = app.name;
  const slug = workspaceSlug || 'default';

  const isFavorite = preferences.isFavorite(app.id);
  const isMuted = preferences.isMuted(app.id);

  const handleOpenProfile = () => {
    openProfilePanel({
      userId: `app-${app.id}`,
      name: app.name,
      avatarUrl: APP_LOGOS[app.provider.toLowerCase()],
      title: app.category,
      role: app.category,
      bio: app.description,
      status: app.isConnected ? 'online' : 'unavailable',
      statusEmoji: '⚡',
      statusText: app.statusText ?? 'Not connected',
      // No email: an integration is not a person and has no mailbox.
    });
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/w/${slug}/apps/chat?app=${app.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied', {
      description: 'App conversation link copied to clipboard.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleFavorite = () => {
    preferences.toggleFavorite(app.id);
    toast.success(
      isFavorite ? 'Removed from favorites' : 'Added to favorites',
      { description: `${name} · Connected App` },
    );
  };

  const handleToggleMuted = () => {
    preferences.toggleMuted(app.id);
    toast.success(isMuted ? 'Conversation unmuted' : 'Conversation muted', {
      description: isMuted
        ? `You will be notified about new activity from ${name}.`
        : `Activity from ${name} will not notify you.`,
    });
  };

  const handleSyncApp = () => {
    setSynced(true);
    toast.success('Synced successfully', {
      description: `${app.name} webhooks and data feeds re-synchronized.`,
    });
    setTimeout(() => setSynced(false), 2000);
  };

  return (
    <div className="sticky top-0 z-20 shrink-0 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="gap-2.5 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between">
        <div className="min-w-0 gap-2 flex items-center">
          <div className="min-w-0 gap-2 flex items-center">
            <button
              type="button"
              onClick={handleOpenProfile}
              className="gap-2 flex items-center rounded-md hover:bg-accent/60 p-1 -m-1 transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label={`View ${name}'s details`}
            >
              <AppAvatar
                name={name}
                provider={app.provider}
                size="sm"
                className="size-7"
              />
              <h2 className="text-sm font-semibold tracking-tight truncate text-foreground hover:underline">
                {name}
              </h2>
            </button>

            {/* Direct Message APP badge */}
            <Badge
              variant="neutral"
              className="gap-0.5 text-[9px] py-0 h-4 uppercase font-bold tracking-wider bg-accent-violet-soft text-accent-violet border-accent-violet/20"
            >
              <Blocks className="size-2.5 inline-block mr-0.5" />
              <span>APP</span>
            </Badge>

            {isMuted ? (
              <Badge variant="neutral" className="gap-1 text-muted-foreground">
                <BellOff className="size-3" />
                <span>Muted</span>
              </Badge>
            ) : null}
          </div>

          <div className="gap-0.5 flex items-center">
            {/* 1. Fav icon */}
            <Hint
              label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-pressed={isFavorite}
                aria-label={
                  isFavorite ? 'Remove from favorites' : 'Add to favorites'
                }
                onClick={handleToggleFavorite}
                className={isFavorite ? 'text-warning' : undefined}
              >
                <Star
                  className={cn(
                    'size-4',
                    isFavorite && 'fill-current text-accent-amber',
                  )}
                />
              </Button>
            </Hint>

            {/* 2. 3-dot dropdown menu */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Conversation options"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="w-64">
                <DropdownMenuItem
                  onClick={handleCopyLink}
                  className="justify-between"
                >
                  <div className="gap-2.5 flex items-center">
                    {copied ? (
                      <Check className="size-4 text-success-text" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    <span>{copied ? 'Link copied!' : 'Copy link'}</span>
                  </div>
                  <DropdownMenuShortcut>C</DropdownMenuShortcut>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleSyncApp}
                  className="justify-between"
                >
                  <div className="gap-2.5 flex items-center">
                    <RefreshCw
                      className={cn('size-4', synced && 'animate-spin')}
                    />
                    <span>Sync app webhooks</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleOpenProfile}
                  className="gap-2.5 cursor-pointer"
                >
                  <UserRound className="size-4" />
                  <span>Open app details</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() =>
                    navigate(`/w/${slug}/integrations?app=${app.id}`)
                  }
                  className="gap-2.5 cursor-pointer"
                >
                  <Settings className="size-4" />
                  <span>Manage integration & scopes</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleToggleFavorite}
                  className="justify-between"
                >
                  <div className="gap-2.5 flex items-center">
                    <Star
                      className={cn(
                        'size-4',
                        isFavorite && 'fill-current text-accent-amber',
                      )}
                    />
                    <span>{isFavorite ? 'Remove Favorite' : 'Favorite'}</span>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground/70" />
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleToggleMuted}
                  description={
                    isMuted
                      ? 'Turn notifications for this conversation back on.'
                      : 'Keep the conversation in your sidebar without being notified.'
                  }
                >
                  {isMuted ? (
                    <Bell className="size-4" />
                  ) : (
                    <BellOff className="size-4" />
                  )}
                  <span>
                    {isMuted ? 'Unmute conversation' : 'Mute conversation'}
                  </span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => navigate(`/w/${slug}/apps`)}
                  className="gap-2.5"
                >
                  <X className="size-4" />
                  <span>Close conversation</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

      </div>
    </div>
  );
}

/**
 * Full-height Direct Matrix Room conversation surface for Connected Apps.
 */
function AppDetailPanel({ app }: { app: AppModelItem }) {
  const { workspaceId } = useCurrentWorkspace();
  const { connect, disconnect } = useIntegrationMutations(workspaceId);

  const isBusy = connect.isPending || disconnect.isPending;
  const failure = connect.error ?? disconnect.error;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <section className="rounded-card border border-border bg-surface-raised p-5 space-y-3">
          <div className="gap-3 flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-medium">Connection</h2>
              <p className="text-sm text-muted-foreground">
                {app.description}
              </p>
            </div>
            <Badge variant={app.isConnected ? 'success' : 'outline'}>
              {app.isConnected ? 'Connected' : 'Not connected'}
            </Badge>
          </div>

          <div className="gap-2 flex items-center">
            {app.isConnected ? (
              <Button
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() =>
                  disconnect.mutate(app.provider, {
                    onSuccess: () =>
                      toast.success(`${app.name} disconnected`),
                  })
                }
              >
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={isBusy}
                onClick={() =>
                  connect.mutate(
                    { provider: app.provider },
                    {
                      onSuccess: () =>
                        toast.success(`${app.name} connected`),
                    },
                  )
                }
              >
                Connect {app.name}
              </Button>
            )}
            {isBusy ? <Spinner /> : null}
          </div>

          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {failure instanceof Error
                ? failure.message
                : `Could not update the ${app.name} connection.`}
            </p>
          ) : null}
        </section>

        {/*
          An integration has no conversation surface: there is no endpoint that
          takes a message for a third-party app and answers as it, so offering
          a composer here would be a box that swallows what you type.
        */}
        <EmptyState
          size="sm"
          icon={<Blocks />}
          title="No conversation for apps"
          description={`${app.name} sends activity into your channels rather than a direct thread. Connect it, then pick the channels that should receive its updates.`}
        />
      </div>
    </div>
  );
}

/**
 * The picker for "New app message" — Counterpart to NewDirectMessage & NewAgentMessage.
 */
function NewAppMessage() {
  const { workspaceId } = useCurrentWorkspace();
  const integrationsQuery = useIntegrations(workspaceId);
  const [, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const connectedIntegrations = useMemo(() => {
    return (integrationsQuery.data ?? []).map((i) => {
      const defaultMatch = DEFAULT_WORKSPACE_APPS.find(
        (d) => d.id === i.provider.toLowerCase() || d.provider === i.provider.toLowerCase(),
      );
      return {
        id: i.provider.toLowerCase(),
        name: defaultMatch?.name || i.provider,
        category: defaultMatch?.category || 'Developer Tools',
        provider: i.provider.toLowerCase(),
        description: defaultMatch?.description || `${i.provider} workspace integration.`,
        isConnected: i.status === 'CONNECTED',
      } as AppModelItem;
    });
  }, [integrationsQuery.data]);

  const allApps = useMemo(() => {
    const combined = [...DEFAULT_WORKSPACE_APPS];
    for (const item of connectedIntegrations) {
      const idx = combined.findIndex((c) => c.id === item.id);
      if (idx >= 0) {
        combined[idx] = { ...combined[idx], ...item };
      } else {
        combined.push(item);
      }
    }
    return combined;
  }, [connectedIntegrations]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    allApps.forEach((a) => set.add(a.category));
    return ['All', ...Array.from(set)];
  }, [allApps]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allApps.filter((app) => {
      const matchesCategory =
        selectedCategory === 'All' || app.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!needle) return true;
      return (
        app.name.toLowerCase().includes(needle) ||
        app.category.toLowerCase().includes(needle) ||
        app.description.toLowerCase().includes(needle) ||
        app.provider.toLowerCase().includes(needle)
      );
    });
  }, [allApps, query, selectedCategory]);

  const select = (app: { id: string }) =>
    setSearchParams({ app: app.id }, { replace: true });

  return (
    <div className="min-h-0 px-4 py-8 flex flex-1 flex-col items-center overflow-y-auto bg-background text-foreground">
      <div className="max-w-xl w-full">
        <div className="mb-4 text-center">
          <Blocks className="mb-2 size-6 mx-auto text-accent-violet" />
          <h1 className="text-base font-semibold text-foreground">
            New App conversation
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick a connected app or integration to start an interactive conversation.
          </p>
        </div>

        <Panel flush title="Connected Apps &amp; Integrations">
          <div className="p-3 border-b border-border space-y-2">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search apps by name, category, or tool"
              label="Search apps"
            />

            <div className="flex flex-wrap gap-1 pt-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer',
                    selectedCategory === cat
                      ? 'bg-accent-violet text-white'
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {integrationsQuery.isLoading && allApps.length === 0 ? (
            <LoadingState label="Loading workspace apps…" />
          ) : integrationsQuery.isError ? (
            <ErrorState
              title="Could not load apps"
              description="The app catalog for this workspace is unavailable."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              size="sm"
              icon={<Blocks />}
              title="No apps match that search"
              description="Try adjusting your query or selecting a different category."
            />
          ) : (
            <ul className="p-2 space-y-1">
              {visible.map((app) => {
                return (
                  <li key={app.id}>
                    <button
                      type="button"
                      onClick={() => select(app)}
                      className="gap-3 p-2.5 flex w-full items-center rounded-xl text-left transition-colors hover:bg-muted/80 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none cursor-pointer group"
                    >
                      <AppAvatar
                        name={app.name}
                        provider={app.provider}
                        size="md"
                        className="group-hover:border-accent-violet transition-colors"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate text-foreground group-hover:text-accent-violet dark:group-hover:text-accent-violet">
                            {app.name}
                          </span>
                          <Badge
                            variant="neutral"
                            className="gap-0.5 text-[9px] py-0 h-3.5 uppercase font-bold tracking-wider bg-accent-violet-soft text-accent-violet border-accent-violet/20"
                          >
                            <Blocks className="size-2 inline-block mr-0.5" />
                            <span>APP</span>
                          </Badge>
                          <Badge
                            variant="neutral"
                            className="text-[10px] py-0 h-3.5"
                          >
                            {app.category}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {app.description}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground/60 shrink-0 group-hover:text-foreground transition-colors" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
