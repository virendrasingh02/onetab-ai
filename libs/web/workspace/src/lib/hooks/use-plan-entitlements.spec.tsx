import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePlanEntitlements } from './use-plan-entitlements.js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { billingApi } from '@org/api-client';

vi.mock('../use-workspaces.js', () => ({
  useCurrentWorkspace: () => ({
    workspaceId: 'ws_test_123',
    workspace: { id: 'ws_test_123', name: 'Test Workspace' },
    isOwner: true,
  }),
}));

vi.mock('@org/api-client', () => ({
  billingApi: {
    summary: vi.fn(),
  },
  queryKeys: {
    billing: {
      summary: (id: string) => ['billing', id, 'summary'],
    },
  },
}));

describe('usePlanEntitlements', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('defaults to Starter plan before query loads', () => {
    (billingApi.summary as any).mockReturnValue(
      new Promise(() => {
        /* never resolves — simulates a pending query */
      }),
    );

    const { result } = renderHook(() => usePlanEntitlements('ws_test_123'), {
      wrapper,
    });

    expect(result.current.plan).toBe('starter');
    expect(result.current.hasFeature('core_workspace')).toBe(true);
    expect(result.current.hasFeature('advanced_views')).toBe(false);
    expect(result.current.getLimit('max_members')).toBe(5);
  });

  it('updates plan and entitlements once query succeeds with Pro tier', async () => {
    (billingApi.summary as any).mockResolvedValue({
      workspaceId: 'ws_test_123',
      workspaceName: 'Test Workspace',
      plan: 'pro',
      planConfig: { id: 'pro', name: 'Pro' },
      subscription: {
        id: 'sub_1',
        workspaceId: 'ws_test_123',
        planTier: 'pro',
        billingInterval: 'monthly',
        status: 'ACTIVE',
        seatsTotal: 25,
        seatsUsed: 8,
      },
      usage: {
        members: {
          key: 'max_members',
          label: 'Team Members',
          used: 8,
          limit: 25,
          percentage: 32,
          isNearLimit: false,
          isLimitReached: false,
        },
      },
      entitlements: {
        core_workspace: true,
        advanced_views: true,
        agent_builder: true,
        custom_llm: false,
      },
      canManageBilling: true,
    });

    const { result } = renderHook(() => usePlanEntitlements('ws_test_123'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.plan).toBe('pro');
    expect(result.current.hasFeature('advanced_views')).toBe(true);
    expect(result.current.hasFeature('custom_llm')).toBe(false);
    expect(result.current.canManageBilling).toBe(true);
  });
});
