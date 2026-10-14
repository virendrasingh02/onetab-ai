import { ApiError } from '@org/api-client';
import { ThemeProvider } from '@org/design-system';
import {
  ConfirmRoot,
  ErrorBoundary,
  NativeTitleTooltips,
  Toaster,
  TooltipProvider,
  toast,
} from '@org/ui';
import { activeBillingUrl } from './plan/billing-link.js';
import { readPlanLimit } from './plan/plan-limit.js';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

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
            // Plan/credit refusals get an explanation and a way forward, not "Action failed".
            const limit = readPlanLimit(error);
            if (limit) {
              const href = activeBillingUrl({ topUp: limit.kind === 'credits' });
              toast.warning(
                limit.kind === 'credits' ? 'Out of AI credits' : limit.kind === 'trial' ? 'Free trial ended' : 'Plan limit reached',
                {
                  description: limit.message,
                  duration: 10_000,
                  ...(href
                    ? {
                        action: {
                          label: limit.kind === 'credits' ? 'Top up' : 'Upgrade',
                          onClick: () => window.location.assign(href),
                        },
                      }
                    : {}),
                },
              );
              return;
            }
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
            <ConfirmRoot />
            <NativeTitleTooltips />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
