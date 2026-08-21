import { ApiError } from '@org/api-client';
import { ThemeProvider } from '@org/design-system';
import { ErrorBoundary, Toaster, TooltipProvider, toast } from '@org/ui';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
