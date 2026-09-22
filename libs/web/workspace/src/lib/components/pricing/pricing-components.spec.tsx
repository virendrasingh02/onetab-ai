import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PricingCard } from './pricing-card.js';
import { PlanComparisonTable } from './plan-comparison-table.js';
import { PricingPage } from './pricing-page.js';

vi.mock('../../use-workspaces.js', () => ({
  useCurrentWorkspace: () => ({
    workspaceId: 'ws-1',
    workspace: { id: 'ws-1', name: 'Acme Test', slug: 'acme' },
  }),
}));

vi.mock('../../hooks/use-plan-entitlements.js', () => ({
  usePlanEntitlements: () => ({
    plan: 'starter',
    planConfig: {
      id: 'starter',
      name: 'Starter',
      pricing: { monthly: 15, annual: 12 },
      machineLimits: {
        microAgents: 3,
        cpu: 2,
        ramGb: 4,
        requestsPerMonth: 5000,
        aiCreditsUsd: 5,
        logRetentionDays: 7,
        agentUpgrades: false,
      },
    },
    subscription: { status: 'ACTIVE' },
    usage: {
      members: { name: 'Members', used: 2, limit: 5, unit: 'members', percentage: 40 },
      storage: { name: 'Storage', used: 100, limit: 1000, unit: 'MB', percentage: 10 },
      aiRequests: { name: 'AI Requests', used: 200, limit: 5000, unit: 'requests', percentage: 4 },
      automations: { name: 'Automations', used: 1, limit: 3, unit: 'workflows', percentage: 33 },
    },
    canManageBilling: true,
    microAgentLimit: 3,
    microAgentsUsed: 1,
    creditBalance: 5.0,
    isTrialing: false,
    trialDaysRemaining: null,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Pricing Components', () => {
  it('renders PricingCard with promo discount, machine limits and callbacks', () => {
    const onSelect = vi.fn();
    render(
      <PricingCard
        tier="pro"
        isAnnual={false}
        isCurrent={false}
        canManageBilling={true}
        onSelectPlan={onSelect}
      />,
      { wrapper: createWrapper() },
    );

    // Check title & promo display
    expect(screen.getByText('Pro')).toBeDefined();
    expect(screen.getByText('100% off with code: s1nu00780')).toBeDefined();
    expect(screen.getByText('$0')).toBeDefined();

    // Check machine specs
    expect(screen.getByText('10 Micro Agents')).toBeDefined();
    expect(screen.getByText('2 CPUs • 4 GB RAM')).toBeDefined();
    expect(screen.getByText('5K Requests')).toBeDefined();
    expect(screen.getByText('$5 AI Credits')).toBeDefined();

    // Click CTA
    const button = screen.getByRole('button', { name: /choose pro/i });
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith('pro');
  });

  it('renders PlanComparisonTable with all plan tiers', () => {
    render(<PlanComparisonTable currentPlan="starter" />, {
      wrapper: createWrapper(),
    });

    expect(
      screen.getByText('Compare Plan Features & Entitlements'),
    ).toBeDefined();
    expect(screen.getByText('Starter')).toBeDefined();
    expect(screen.getByText('Pro')).toBeDefined();
    expect(screen.getByText('Business')).toBeDefined();
    expect(screen.getAllByText(/Enterprise/i).length).toBeGreaterThan(0);
  });

  it('renders PricingPage with hero section, promo announcement, and 4 cards', () => {
    render(<PricingPage />, { wrapper: createWrapper() });

    expect(
      screen.getByText('Scale AI Micro-Agents With Zero Guesswork'),
    ).toBeDefined();
    expect(screen.getAllByText(/s1nu00780/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Starter').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pro').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Business').length).toBeGreaterThan(0);
  });
});
