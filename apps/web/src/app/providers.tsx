import {
  agentsApi,
  ApiError,
  coworkersApi,
  http,
  gifsApi,
  integrationsApi,
  marketplaceApi,
  memberApi,
  resolveMediaUrl,
  stickersApi,
  queryKeys,
  workspaceApi,
} from '@org/api-client';
import { useCurrentUser } from '@org/auth';
import { store, useNotificationDisplayPreferences } from '@org/common';
import { ThemeProvider } from '@org/design-system';
import { MediaPreviewProvider } from '@org/media-preview';
import {
  AvatarColorProvider,
  AvatarPresenceProvider,
  ConfirmRoot,
  ErrorBoundary,
  GifSourceProvider,
  StickerSourceProvider,
  Toaster,
  NativeTitleTooltips,
  TooltipProvider,
  toast,
  type AvatarColorResolver,
  type GifSource,
  type StickerSource,
  type WorkspaceColorResolver,
  WorkspaceColorProvider,
} from '@org/ui';
import { RealtimeProvider, useUserPresenceMap } from '@org/realtime';
import {
  AuthenticatedMediaBridge,
  useMatrixPresenceResolver,
  useMirrorPresenceToMatrix,
  CallOverlayBridge,
  LinkPreviewBridge,
  MatrixProvider,
} from '@org/web-chat';
import {
  AgentAvatarProvider,
  AppConnectProvider,
  AppEntityProvider,
  type AppConnector,
  type AiEntityResolver,
  type AppEntityResolver,
  MemberProfileProvider,
  type MemberProfileResolver,
} from '@org/chat-ui';
import {
  getAppDisplayName,
  getAppLogoUrl,
  splitAppConnectionName,
  toPlatformUserId,
} from '@org/types';
import { SyncProvider } from '@org/sync';
import { syncServerTime } from '@org/utils';
import { DesktopChrome, DesktopProvider } from '@org/web-desktop';
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useI18nStore } from '@org/i18n';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useActiveWorkspaceId } from './use-active-workspace-id';
import { usePreferencesSync } from './preferences-sync';
import { useWorkspaceAppearanceSync } from './workspace-appearance-sync';

// Every API response carries the server's `Date`, so the server-aligned clock
// that message times are measured against stays fresh without a dedicated call.
http.interceptors.response.use((response) => {
  const serverDate = Date.parse(String(response.headers?.['date'] ?? ''));
  if (!Number.isNaN(serverDate)) syncServerTime(serverDate);
  return response;
});

function AppToaster() {
  const { notifications } = useNotificationDisplayPreferences();
  return (
    <Toaster
      position={notifications.position}
      size={notifications.size}
      duration={notifications.dismissDuration}
    />
  );
}

/**
 * Applies the active workspace's stored appearance and mirrors the user's
 * changes back to *that workspace* (`/workspaces/:id/settings/appearance/me`).
 * Rendered inside `<ThemeProvider>` so it can read and apply appearance state.
 */
function ThemeSync() {
  const user = useCurrentUser();
  useWorkspaceAppearanceSync(!!user);
  return null;
}

/**
 * Scopes the `ThemeProvider` to the active workspace, so appearance is stored
 * per workspace (namespaced localStorage keys) and switching workspace swaps
 * the whole look. The id is seeded from localStorage by `useWorkspaceStore`,
 * so it is available on the very first render.
 */
function WorkspaceThemeScope({ children }: { children: ReactNode }) {
  const activeWorkspaceId = useActiveWorkspaceId();
  return (
    <ThemeProvider defaultTheme="light" scopeKey={activeWorkspaceId}>
      {children}
    </ThemeProvider>
  );
}

/**
 * Keeps the Redux `preferences` slice (chat behavior + notification
 * display/sound settings) in sync with the server. See `usePreferencesSync`.
 */
function PreferencesSync() {
  const user = useCurrentUser();
  usePreferencesSync(!!user);
  return null;
}

/**
 * Synchronizes the signed-in user's preferredLanguage with the client-side
 * i18n store, automatically setting document lang and dir (RTL/LTR).
 */
function LanguageSync() {
  const user = useCurrentUser();
  const syncFromUserPreference = useI18nStore((s) => s.syncFromUserPreference);

  useEffect(() => {
    if (user?.preferredLanguage) {
      syncFromUserPreference(user.preferredLanguage);
    }
  }, [user?.preferredLanguage, syncFromUserPreference]);

  // Clock/date display choice from Settings → Language & Region.
  const setDisplayFormats = useI18nStore((s) => s.setDisplayFormats);
  useEffect(() => {
    setDisplayFormats({
      timeFormat: user?.timeFormat ?? null,
      dateFormat: user?.dateFormat ?? null,
    });
  }, [user?.timeFormat, user?.dateFormat, setDisplayFormats]);

  return null;
}

function RealtimeAppBridge({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  // Scope the socket and its cache invalidations to the active workspace, so a
  // realtime event from another workspace never lands on this one's queries.
  const activeWorkspaceId = useActiveWorkspaceId();
  return (
    // `manageCache={false}` — the BackgroundSyncManager (via <SyncProvider>) owns
    // the one consolidated realtime→cache invalidation map, adaptive polling,
    // reconnect catch-up and the offline queue. RealtimeProvider stays the
    // transport + presence layer only.
    <RealtimeProvider
      userId={user?.id}
      workspaceId={activeWorkspaceId}
      manageCache={false}
    >
      <SyncProvider userId={user?.id} workspaceId={activeWorkspaceId}>
        <AvatarPresenceBridge>
          <AgentAvatarBridge workspaceId={activeWorkspaceId ?? undefined}>
            <MemberProfileBridge workspaceId={activeWorkspaceId ?? undefined}>
              <WorkspaceColorBridge enabled={!!user}>{children}</WorkspaceColorBridge>
            </MemberProfileBridge>
          </AgentAvatarBridge>
        </AvatarPresenceBridge>
      </SyncProvider>
    </RealtimeProvider>
  );
}

/**
 * Gives every message the live identity (kind + current avatar) of the AI
 * coworker/agent that sent it, by id or by display name, so a coworker is the
 * same tile in chat as in the sidebar. Shares the sidebar's cached lists.
 */
function AgentAvatarBridge({
  workspaceId,
  children,
}: {
  workspaceId: string | undefined;
  children: ReactNode;
}) {
  // Real lists from the API, on the same query keys the sidebar uses (shared cache).
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(workspaceId ?? ''),
    queryFn: () => agentsApi.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
  const { data: coworkers } = useQuery({
    queryKey: queryKeys.coworkers.list(workspaceId ?? ''),
    queryFn: () => coworkersApi.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
  const resolve = useCallback<AiEntityResolver>(
    ({ id, name }) => {
      const lower = name?.trim().toLowerCase();
      const find = <T extends { id: string; name: string; avatarUrl?: string | null }>(
        list: T[] | undefined,
      ) =>
        list?.find((e) => (id && e.id === id) || (lower && e.name.toLowerCase() === lower));
      const cw = find(coworkers);
      if (cw) return { kind: 'coworker', name: cw.name, avatarUrl: cw.avatarUrl ?? undefined };
      const ag = find(agents);
      if (ag) return { kind: 'agent', name: ag.name, avatarUrl: ag.avatarUrl ?? undefined };
      return undefined;
    },
    [agents, coworkers],
  );
  return (
    <AgentAvatarProvider value={resolve}>
      <AppEntityBridge workspaceId={workspaceId}>{children}</AppEntityBridge>
    </AgentAvatarProvider>
  );
}

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Gives every timeline row the *current* name + logo of a connected app, from
 * the API: the workspace's integrations (the same cached list the sidebar and
 * composer read, refreshed on `integration.updated`) plus marketplace logos.
 * A rename therefore reaches system events, replies and bot messages at once.
 */
function AppEntityBridge({
  workspaceId,
  children,
}: {
  workspaceId: string | undefined;
  children: ReactNode;
}) {
  const { data: integrations } = useQuery({
    queryKey: queryKeys.integrations.list(workspaceId ?? ''),
    queryFn: () => integrationsApi.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
  // Same params + key as `useAppLogos`, so the cache is shared.
  const logoParams = { kind: 'INTEGRATION', pageSize: 100 } as const;
  const { data: listings } = useQuery({
    queryKey: queryKeys.marketplace.browse(workspaceId ?? '', JSON.stringify(logoParams)),
    queryFn: () => marketplaceApi.browse(logoParams, workspaceId),
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
  });

  const resolve = useCallback<AppEntityResolver>(
    ({ id, name }) => {
      const wanted = name ? normalizeKey(name) : '';
      const row = integrations?.find(
        (i) =>
          (id && i.id === id) ||
          (!id &&
            wanted &&
            (normalizeKey(i.displayName ?? '') === wanted ||
              normalizeKey(getAppDisplayName(i)) === wanted)),
      );
      if (!row) return undefined;
      const appName = getAppDisplayName(row);
      const keys = [row.provider, appName].map(normalizeKey);
      const listingLogo = listings?.items.find((l) =>
        keys.some((k) => k === normalizeKey(l.slug) || k === normalizeKey(l.name)),
      )?.iconUrl;
      return {
        id: row.id,
        name: appName,
        provider: row.provider,
        logoUrl: listingLogo || getAppLogoUrl(row.provider, appName),
        accountLabel: splitAppConnectionName(row.displayName ?? '').accountLabel,
      };
    },
    [integrations, listings],
  );
  return (
    <AppEntityProvider value={resolve}>
      <AppConnectBridge workspaceId={workspaceId}>{children}</AppConnectBridge>
    </AppEntityProvider>
  );
}

/**
 * Lets a chat card connect one of the viewer's apps in place — "Connect
 * Gmail" under an agent reply. OAuth apps open their consent popup right from
 * the click (opened blank first so the browser doesn't block it), as the
 * viewer's *own* connection: an agent works through each person's account,
 * and a personal connection needs no install policy. Apps that ask for API
 * keys, or whose OAuth app isn't set up yet, open the Integration Hub on that
 * app instead, where those forms live.
 */
function AppConnectBridge({
  workspaceId,
  children,
}: {
  workspaceId: string | undefined;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: integrations } = useQuery({
    queryKey: queryKeys.integrations.list(workspaceId ?? ''),
    queryFn: () => integrationsApi.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
  const { data: providers } = useQuery({
    queryKey: queryKeys.integrations.providers(workspaceId ?? ''),
    queryFn: () => integrationsApi.getProviders(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
  const { data: workspaces } = useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => workspaceApi.list(),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
  const slug = workspaces?.find((w) => w.id === workspaceId)?.slug;

  // The OAuth callback page tells its opener when it's done; coming back to
  // this window covers a popup closed by hand. Either way, re-read state —
  // on focus only while a connect started here is still open.
  const connectPending = useRef(false);
  useEffect(() => {
    if (!workspaceId) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.all(workspaceId) });
    };
    const onMessage = (event: MessageEvent) => {
      if ((event.data as { type?: unknown } | null)?.type !== 'INTEGRATION_CONNECTED') return;
      connectPending.current = false;
      refresh();
    };
    const onFocus = () => {
      if (connectPending.current) refresh();
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('focus', onFocus);
    };
  }, [queryClient, workspaceId]);

  const value = useMemo<AppConnector>(() => {
    const openHub = (provider: string) => {
      // `/integrations` redirects (dropping the query), so go to the hub's tab directly.
      if (slug) navigate(`/w/${slug}/marketplace?tab=apps&connect=${encodeURIComponent(provider)}`);
    };
    return {
      isConnected: (provider) => {
        if (!integrations) return undefined;
        const key = provider.toUpperCase();
        return integrations.some(
          (i) => i.provider.toUpperCase() === key && i.status?.toUpperCase() === 'CONNECTED',
        );
      },
      connect: async (provider, label) => {
        if (!workspaceId) return;
        const key = provider.toUpperCase();
        const capabilities = providers?.find((p) => p.provider.toUpperCase() === key);
        if (!capabilities || capabilities.credentialFields?.length || capabilities.authType !== 'OAUTH2') {
          openHub(key);
          return;
        }
        const popup = window.open('', `connect-${key}`, 'width=600,height=700');
        try {
          const result = await integrationsApi.connect(workspaceId, key, { scopeType: 'USER' });
          if (result.authUrl) {
            connectPending.current = true;
            if (popup) popup.location.href = result.authUrl;
            else window.open(result.authUrl, `connect-${key}`, 'width=600,height=700');
            return;
          }
          popup?.close();
          toast.success(`${label} connected`);
          void queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all(workspaceId) });
        } catch {
          // Most often: no OAuth app is set up for it yet — the hub walks through that.
          popup?.close();
          toast.info(`Finish connecting ${label} in Integrations`);
          openHub(key);
        }
      },
    };
  }, [integrations, providers, slug, workspaceId, navigate, queryClient]);

  return <AppConnectProvider value={value}>{children}</AppConnectProvider>;
}

/**
 * Gives every profile hover card / profile rail the person's real workspace
 * role (Owner / Admin / Guest), title and time zone from `GET
 * /workspaces/:id/members`. Shares the composer's members query cache, and
 * accepts either id spelling since chat senders are Matrix ids.
 */
function MemberProfileBridge({
  workspaceId,
  children,
}: {
  workspaceId: string | undefined;
  children: ReactNode;
}) {
  const { data: members } = useQuery({
    queryKey: queryKeys.members.list(workspaceId ?? ''),
    queryFn: () => memberApi.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
  const byUserId = useMemo(
    () => new Map((members ?? []).map((m) => [m.user.id, m])),
    [members],
  );
  const resolve = useCallback<MemberProfileResolver>(
    (userId) => {
      const m = byUserId.get(toPlatformUserId(userId));
      if (!m) return undefined;
      return {
        role: m.role,
        title: m.user.jobTitle ?? m.user.title,
        bio: m.user.bio,
        timezone: m.user.timezone,
        joinedAt: m.joinedAt,
        email: m.email,
        coverUrl: resolveMediaUrl(m.user.coverUrl) ?? null,
      };
    },
    [byUserId],
  );
  // Each person's workspace avatar colour, so every `UserAvatar` (chat senders
  // included — they're Matrix ids) paints the same stored swatch.
  const resolveColor = useCallback<AvatarColorResolver>(
    (userId) => byUserId.get(toPlatformUserId(userId))?.avatarColor,
    [byUserId],
  );
  return (
    <MemberProfileProvider value={resolve}>
      <AvatarColorProvider resolve={resolveColor}>{children}</AvatarColorProvider>
    </MemberProfileProvider>
  );
}

/**
 * Gives every `WorkspaceAvatar` (rail, switcher, notifications…) the
 * workspace's stored tile colour from `GET /workspaces`, on the switcher's own
 * query key so it shares that cache and refreshes on `workspace.updated`.
 */
function WorkspaceColorBridge({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const { data: workspaces } = useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => workspaceApi.list(),
    enabled,
    staleTime: 60_000,
  });
  const byId = useMemo(
    () => new Map((workspaces ?? []).map((w) => [w.id, w.avatarColor])),
    [workspaces],
  );
  const resolve = useCallback<WorkspaceColorResolver>(
    (workspaceId) => byId.get(workspaceId),
    [byId],
  );
  return (
    <WorkspaceColorProvider resolve={resolve}>{children}</WorkspaceColorProvider>
  );
}

/**
 * Feeds the live workspace presence map (from `@org/realtime`, which loads it
 * from the API and keeps it current over the socket) to every `UserAvatar` on
 * the page. A user with no live reading falls back to whatever `presence` prop
 * the call site passed.
 */
function AvatarPresenceBridge({ children }: { children: ReactNode }) {
  const presenceMap = useUserPresenceMap();
  // Matrix `m.presence` backs up users the platform has no reading for (chat
  // participants outside this workspace's roster, bridged users…); the
  // platform reading stays authoritative whenever it exists.
  const matrixPresence = useMatrixPresenceResolver();
  useMirrorPresenceToMatrix();
  const resolve = useCallback(
    (userId: string) =>
      presenceMap[userId]?.status ?? matrixPresence(userId),
    [presenceMap, matrixPresence],
  );
  return (
    <AvatarPresenceProvider resolve={resolve}>{children}</AvatarPresenceProvider>
  );
}

/**
 * Feeds the GIF picker (in `@org/ui`, which does no data-fetching of its own) a
 * source backed by the `/gifs` proxy. Results go through the shared QueryClient
 * so reopening the picker is instant. No provider ⇒ the picker falls back to a
 * small bundled GIF set.
 */
function GifSourceBridge({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const source = useMemo<GifSource>(
    () => ({
      trending: (pos) =>
        queryClient.fetchQuery({
          queryKey: queryKeys.gifs.trending(pos),
          queryFn: () => gifsApi.trending(24, pos),
          staleTime: 5 * 60_000,
        }),
      search: (query, pos) =>
        queryClient.fetchQuery({
          queryKey: queryKeys.gifs.search(query, pos),
          queryFn: () => gifsApi.search(query, 24, pos),
          staleTime: 5 * 60_000,
        }),
      categories: () =>
        queryClient.fetchQuery({
          queryKey: queryKeys.gifs.categories(),
          queryFn: () => gifsApi.categories(),
          staleTime: 60 * 60_000,
        }),
    }),
    [queryClient],
  );
  return <GifSourceProvider value={source}>{children}</GifSourceProvider>;
}

/**
 * Feeds the Sticker picker a source backed by the `/stickers` endpoints.
 */
function StickerSourceBridge({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const source = useMemo<StickerSource>(
    () => ({
      getPacks: () =>
        queryClient.fetchQuery({
          queryKey: queryKeys.stickers.packs(),
          queryFn: () => stickersApi.packs(),
          staleTime: 60 * 60_000,
        }),
      search: (query) =>
        queryClient.fetchQuery({
          queryKey: queryKeys.stickers.search(query),
          queryFn: () => stickersApi.search(query),
          staleTime: 5 * 60_000,
        }),
    }),
    [queryClient],
  );
  return (
    <StickerSourceProvider value={source}>{children}</StickerSourceProvider>
  );
}

/**
 * Application-wide providers.
 *
 * The QueryClient is created inside state rather than at module scope so each
 * mount (and every test) gets an isolated cache instead of sharing one.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onSuccess: (_data, _variables, _context, mutation) => {
            const meta = mutation.options.meta as
              | { successMessage?: string; disableToast?: boolean }
              | undefined;
            if (meta?.successMessage && !meta.disableToast) {
              toast.success(meta.successMessage);
            }
          },
          onError: (error, _variables, _context, mutation) => {
            const meta = mutation.options.meta as
              | { errorMessage?: string; disableToast?: boolean }
              | undefined;
            if (meta?.disableToast) return;
            const message =
              meta?.errorMessage ||
              (error instanceof ApiError ? error.message : (error as Error)?.message) ||
              'Action failed. Please try again.';
            toast.error('Action failed', { description: message });
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // 4xx responses are deterministic — retrying just delays the
              // error the user needs to see.
              if (error instanceof ApiError && error.status < 500) return false;
              return failureCount < 2;
            },
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return (
    <ErrorBoundary>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <WorkspaceThemeScope>
            <ThemeSync />
            <PreferencesSync />
            <LanguageSync />
            {/*
              Inside ThemeProvider (it pushes the resolved theme to native
              chrome) and inside the router (deep links resolve to routes), but
              outside the feature tree so any screen can reach the shell.
            */}
            <DesktopProvider>
              <MatrixProvider>
                <AuthenticatedMediaBridge>
                  <CallOverlayBridge />
                  <LinkPreviewBridge />
                  <RealtimeAppBridge>
                    <TooltipProvider>
                      <MediaPreviewProvider>
                        <GifSourceBridge>
                          <StickerSourceBridge>
                            <DesktopChrome>{children}</DesktopChrome>
                          </StickerSourceBridge>
                        </GifSourceBridge>
                      </MediaPreviewProvider>
                      <AppToaster />
                      <ConfirmRoot />
                      <NativeTitleTooltips />
                    </TooltipProvider>
                  </RealtimeAppBridge>
                </AuthenticatedMediaBridge>
              </MatrixProvider>
            </DesktopProvider>
          </WorkspaceThemeScope>
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  );
}
