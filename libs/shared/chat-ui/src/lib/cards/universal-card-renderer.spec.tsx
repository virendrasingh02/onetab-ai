import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCardRegistryStore } from './card-registry-store.js';
import { UniversalCardRenderer } from './universal-card-renderer.js';

describe('UniversalCardRenderer', () => {
  beforeEach(() => {
    useCardRegistryStore.getState().resetToDefaults();
  });

  it('renders CRM Lead card with bound data', () => {
    render(
      <UniversalCardRenderer
        cardId="crm-lead"
        data={{
          name: 'Sarah Connor',
          company: 'Cyberdyne Systems',
          dealValue: 50000,
          stage: 'Proposal',
        }}
      />,
    );

    expect(screen.getByText('Sarah Connor')).toBeDefined();
    expect(screen.getByText('Cyberdyne Systems')).toBeDefined();
    expect(screen.getByText('$50,000.00')).toBeDefined();
    expect(screen.getByText('PROPOSAL')).toBeDefined();
  });

  it('renders GitHub PR card with repository details', () => {
    render(
      <UniversalCardRenderer
        cardId="github-pr"
        data={{
          repo: 'onetab-ai/core',
          prNumber: 42,
          title: 'feat: universal custom card builder',
          author: 'virendra',
        }}
      />,
    );

    expect(screen.getByText('onetab-ai/core #42')).toBeDefined();
    expect(screen.getByText('feat: universal custom card builder')).toBeDefined();
    expect(screen.getByText('Opened by @virendra')).toBeDefined();
  });

  it('renders Approval Request card with risk indicator', () => {
    render(
      <UniversalCardRenderer
        cardId="approval-request"
        data={{
          title: 'Database Schema Migration v4',
          requester: 'Migration Agent',
          riskLevel: 'Critical',
        }}
      />,
    );

    expect(screen.getByText('Critical Risk Action')).toBeDefined();
    expect(screen.getByText('Database Schema Migration v4')).toBeDefined();
    expect(screen.getByText('Approve & Execute')).toBeDefined();
    expect(screen.getByText('Reject')).toBeDefined();
  });

  it('renders a clean fallback for unregistered cards without crashing', () => {
    render(
      <UniversalCardRenderer
        cardId="unregistered-custom-card"
        version={1}
        data={{ foo: 'bar', test: 123 }}
      />,
    );

    expect(screen.getByText(/Universal Card: unregistered-custom-card/)).toBeDefined();
    expect(screen.getByText(/Card definition unavailable in local registry/)).toBeDefined();
  });
});
