import { ApiError } from '@org/api-client';
import { ThemeProvider } from '@org/design-system';
import { ErrorBoundary, TooltipProvider } from '@org/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * Console-wide providers.
 *
 * A trimmed version of the web app's: no Redux store, no Matrix client — the
 * console reads platform data and renders it. The QueryClient is created
 * inside state rather than at module scope so each mount (and every test) gets
 * an isolated cache instead of sharing one.
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
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
