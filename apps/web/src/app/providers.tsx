import { ApiError } from '@org/api-client';
import { store, useNotificationDisplayPreferences } from '@org/common';
import { ThemeProvider } from '@org/design-system';
import { MediaPreviewProvider } from '@org/media-preview';
import { ErrorBoundary, Toaster, TooltipProvider, toast } from '@org/ui';
import { MatrixProvider } from '@org/web-chat';
import { DesktopChrome, DesktopProvider } from '@org/web-desktop';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Provider } from 'react-redux';

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
            {/*
              Inside ThemeProvider (it pushes the resolved theme to native
              chrome) and inside the router (deep links resolve to routes), but
              outside the feature tree so any screen can reach the shell.
            */}
            <DesktopProvider>
              <MatrixProvider>
                <TooltipProvider>
                  <MediaPreviewProvider>
                    <DesktopChrome>{children}</DesktopChrome>
                  </MediaPreviewProvider>
                  <AppToaster />
                </TooltipProvider>
              </MatrixProvider>
            </DesktopProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  );
}
