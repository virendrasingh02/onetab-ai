import { ApiError } from '@org/api-client';
import { store } from '@org/common';
import { ThemeProvider } from '@org/design-system';
import { ErrorBoundary, TooltipProvider } from '@org/ui';
import { MatrixProvider } from '@org/web-chat';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Provider } from 'react-redux';

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
          <ThemeProvider defaultTheme="system">
            <MatrixProvider>
              <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
            </MatrixProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  );
}
