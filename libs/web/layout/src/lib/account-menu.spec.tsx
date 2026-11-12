// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@org/ui';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '@org/types';
import {
  AccountMenu,
  formatPauseExpiry,
  nextMondayAt9,
  tomorrowAt9,
} from './account-menu.js';

vi.mock('@org/auth', () => ({
  useAccounts: () => ({ accounts: [{ id: 'u1' }], activeAccountId: 'u1' }),
  useAuthStore: (select: (s: { setUser: () => void }) => unknown) =>
    select({ setUser: vi.fn() }),
  useLogout: () => ({ mutate: vi.fn() }),
  useRemoveAccount: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@org/api-client', () => ({
  userApi: { updateStatus: vi.fn(), clearStatus: vi.fn() },
}));

vi.mock('@org/realtime', () => ({
  usePresence: () => ({
    status: 'online',
    setManualAway: vi.fn(),
  }),
}));

vi.mock('@org/web-desktop', () => ({
  isDesktop: false,
  NO_DRAG: {},
  openDesktopApp: vi.fn(),
  openExternal: vi.fn(),
  useAppDownload: () => ({
    environment: { isMobile: false, os: 'windows' },
    primaryOption: {
      storeOrFormat: 'Windows installer',
      url: 'https://example.com',
    },
    trackDownload: vi.fn(),
  }),
}));

const mockUser: CurrentUser = {
  id: 'u1',
  email: 'virendra@example.com',
  name: 'Virendra Singh',
  displayName: 'Virendra Singh',
  avatarUrl: null,
  avatarColor: null,
  role: 'MEMBER' as any,
  presence: 'ONLINE',
  statusText: null,
  statusEmoji: null,
  statusExpiresAt: null,
  customStatus: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  username: 'virendrasingh',
};

describe('AccountMenu', () => {
  it('renders trigger button with aria-label and user avatar', () => {
    render(
      <TooltipProvider>
        <MemoryRouter>
          <AccountMenu
            user={mockUser}
            workspaceSlug="acme"
            workspaceName="Acme Corp"
          />
        </MemoryRouter>
      </TooltipProvider>,
    );

    const trigger = screen.getByRole('button', { name: 'Account menu' });
    expect(trigger).toBeInTheDocument();
  });
});

describe('pause helpers', () => {
  // Wed 2026-11-11 15:00 local
  const now = new Date(2026, 10, 11, 15, 0, 0);

  it('tomorrowAt9 lands on the next day at 09:00', () => {
    const d = tomorrowAt9(now);
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([12, 9, 0]);
  });

  it('nextMondayAt9 is the coming Monday, never today', () => {
    const d = nextMondayAt9(now);
    expect([d.getDay(), d.getDate(), d.getHours()]).toEqual([1, 16, 9]);
    const monday = new Date(2026, 10, 16, 8, 0, 0);
    expect(nextMondayAt9(monday).getDate()).toBe(23);
  });

  it('formatPauseExpiry ignores past values and names the day', () => {
    expect(formatPauseExpiry(null, now)).toBeNull();
    expect(formatPauseExpiry(new Date(2026, 10, 11, 14), now)).toBeNull();
    expect(formatPauseExpiry(new Date(2026, 10, 11, 16), now)).toMatch(
      /^Until \d/,
    );
    expect(formatPauseExpiry(tomorrowAt9(now), now)).toMatch(
      /^Until tomorrow at /,
    );
  });
});
