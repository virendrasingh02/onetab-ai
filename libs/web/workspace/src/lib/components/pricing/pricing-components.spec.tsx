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
    plan: 'free',
    canManageBilling: true,
    subscription: { status: 'ACTIVE' },
    microAgentLimit: 3,
    microAgentsUsed: 1,
    creditBalance: 5.0,
    isTrialing: false,
    trialDaysRemaining: null,
    paymentsEnabled: true,
    billingMode: 'test',
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
  it('renders the Pro card from central config with real (undiscounted) pricing', () => {
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

    expect(screen.getByText('Pro')).toBeDefined();
    expect(screen.getByText('$30')).toBeDefined();
    expect(screen.getByText('10 Micro Agents')).toBeDefined();
    expect(screen.getByText('4 CPUs • 8 GB RAM')).toBeDefined();
    expect(screen.getByText('25K Requests')).toBeDefined();
    expect(screen.getByText('$20 AI Credits')).toBeDefined();
    // The retired public promo must never be advertised again.
    expect(screen.queryByText(/s1nu00780/i)).toBeNull();
    expect(screen.queryByText(/100% off/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /choose pro/i }));
    expect(onSelect).toHaveBeenCalledWith('pro');
  });

  it('renders Free as permanently $0 and labels lower tiers as downgrades', () => {
    const { rerender } = render(
      <PricingCard tier="free" isAnnual={true} onSelectPlan={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByText('$0')).toBeDefined();
    expect(screen.getAllByText(/Free forever/i).length).toBeGreaterThan(0);

    rerender(<PricingCard tier="free" isAnnual={true} currentTier="max" onSelectPlan={vi.fn()} />);
    expect(screen.getByRole('button', { name: /downgrade to free/i })).toBeDefined();
  });

  it('renders Enterprise as custom pricing with a sales action', () => {
    render(<PricingCard tier="enterprise" isAnnual={true} onSelectPlan={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getAllByText('Custom').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /talk to sales/i })).toBeDefined();
  });

  it('renders PlanComparisonTable with the four plans', () => {
    render(<PlanComparisonTable currentPlan="free" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Compare Plan Features & Entitlements')).toBeDefined();
    expect(screen.getAllByText('Free').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pro').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Max').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Enterprise/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('Starter')).toBeNull();
    expect(screen.queryByText('Business')).toBeNull();
  });

  it('renders PricingPage with exactly the four plans and no promo banner', () => {
    render(<PricingPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Scale AI Micro-Agents With Zero Guesswork')).toBeDefined();
    expect(screen.queryAllByText(/s1nu00780/i)).toHaveLength(0);
    expect(screen.queryByText(/Claim Offer/i)).toBeNull();
    for (const name of ['Free', 'Pro', 'Max']) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });
});
