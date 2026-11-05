// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { TooltipProvider } from '@org/ui';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRail } from './app-rail.js';

const prefs = vi.hoisted(() => ({
  items: {} as Record<string, { visible?: boolean }>,
}));

vi.mock('./navigation/sidebar-store.js', () => ({
  useSidebarStore: (select: (state: typeof prefs) => unknown) => select(prefs),
}));

vi.mock('./split-view/use-split-view-action.js', () => ({
  useSplitViewAction: () => (path: string, name: string) => ({
    id: 'split-view',
    label: `Open ${name} at ${path}`,
    run: () => undefined,
  }),
}));

function renderRail(path: string, inboxUnread = 0) {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRail workspaceSlug="acme" inboxUnread={inboxUnread} />
      </MemoryRouter>
    </TooltipProvider>,
  );
}

describe('AppRail', () => {
  beforeEach(() => {
    prefs.items = {};
  });

  it('lists the app destinations with Settings last', () => {
    renderRail('/w/acme');

    const links = within(screen.getByRole('navigation', { name: 'App' }))
      .getAllByRole('link')
      .map((link) => [
        link.getAttribute('aria-label'),
        link.getAttribute('href'),
      ]);

    expect(links).toEqual([
      ['Home', '/w/acme'],
      ['Inbox', '/w/acme/inbox'],
      ['Marketplace', '/w/acme/marketplace'],
      [
        'AI Agent Studio (opens in a new tab)',
        'http://localhost:4202/w/acme/ai',
      ],
      ['Settings', '/w/acme/settings'],
    ]);
  });

  it.each([
    ['/w/acme', 'Home'],
    ['/w/acme/home', 'Home'],
    ['/w/acme/inbox', 'Inbox'],
    ['/w/acme/marketplace/apps/github', 'Marketplace'],
  ])('marks only the current destination on %s', (path, label) => {
    renderRail(path);

    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');

    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(label);
  });

  it('opens the Studio in a new tab, since it is a separate app', () => {
    renderRail('/w/acme');

    expect(
      screen.getByRole('link', { name: /AI Agent Studio/ }),
    ).toHaveAttribute('target', '_blank');
  });

  it('announces unread Inbox items', () => {
    renderRail('/w/acme', 3);

    expect(
      screen.getByRole('link', { name: 'Inbox, 3 unread' }),
    ).toBeInTheDocument();
  });

  it('respects items hidden in the sidebar customizer', () => {
    prefs.items = { marketplace: { visible: false } };
    renderRail('/w/acme');

    expect(
      screen.queryByRole('link', { name: 'Marketplace' }),
    ).not.toBeInTheDocument();
  });
});
