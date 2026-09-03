import { ApiError, gifsApi, queryKeys } from '@org/api-client';
import { useCurrentUser } from '@org/auth';
import { store, useNotificationDisplayPreferences } from '@org/common';
import { ThemeProvider } from '@org/design-system';
import { MediaPreviewProvider } from '@org/media-preview';
import {
  AvatarPresenceProvider,
  ErrorBoundary,
  GifSourceProvider,
  Toaster,
  TooltipProvider,
  toast,
  type GifSource,
} from '@org/ui';
import { RealtimeProvider, useUserPresenceMap } from '@org/realtime';
import { MatrixProvider } from '@org/web-chat';
import { DesktopChrome, DesktopProvider } from '@org/web-desktop';
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { useThemeSync } from './use-theme-sync';

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
 * Mirrors the signed-in user's theme choices to `/users/me/theme`. Rendered
 * inside `<ThemeProvider>` so it can read and apply appearance state.
 */
function ThemeSync() {
  const user = useCurrentUser();
  useThemeSync(!!user);
  return null;
}

function RealtimeAppBridge({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  return (
    <RealtimeProvider userId={user?.id}>
      <AvatarPresenceBridge>{children}</AvatarPresenceBridge>
    </RealtimeProvider>
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
  const resolve = useCallback(
    (userId: string) => presenceMap[userId]?.status,
    [presenceMap],
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
          <ThemeProvider defaultTheme="light">
            <ThemeSync />
            {/*
              Inside ThemeProvider (it pushes the resolved theme to native
              chrome) and inside the router (deep links resolve to routes), but
              outside the feature tree so any screen can reach the shell.
            */}
            <DesktopProvider>
              <MatrixProvider>
                <RealtimeAppBridge>
                  <TooltipProvider>
                    <MediaPreviewProvider>
                      <GifSourceBridge>
                        <DesktopChrome>{children}</DesktopChrome>
                      </GifSourceBridge>
                    </MediaPreviewProvider>
                    <AppToaster />
                  </TooltipProvider>
                </RealtimeAppBridge>
              </MatrixProvider>
            </DesktopProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  );
}
