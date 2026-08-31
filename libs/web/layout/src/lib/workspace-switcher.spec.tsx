// @vitest-environment jsdom
import type { ReactElement } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { WorkspaceRole, WorkspaceStatus, type WorkspaceSummary } from '@org/types';
import { useAccountStore } from '@org/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceMenu } from './workspace-switcher.js';

/** The switcher now reads the multi-account hooks, which need a query client. */
function renderInProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const mockWorkspaces: WorkspaceSummary[] = [
  {
    id: 'ws-1',
    name: 'Mie Team',
    slug: 'mie-team',
    email: 'virendra@mie.ai',
    description: null,
    avatarUrl: null,
    icon: null,
    iconColor: null,
    ownerId: 'user-1',
    status: WorkspaceStatus.ACTIVE,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    role: WorkspaceRole.OWNER,
    permissions: [],
    memberCount: 12,
    channelCount: 5,
  },
  {
    id: 'ws-2',
    name: 'Acme Corp',
    slug: 'acme',
    email: 'virendra@acme.com',
    description: null,
    avatarUrl: null,
    icon: null,
    iconColor: null,
    ownerId: 'user-2',
    status: WorkspaceStatus.ACTIVE,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    role: WorkspaceRole.MEMBER,
    permissions: [],
    memberCount: 85,
    channelCount: 20,
  },
  {
    id: 'ws-3',
    name: 'Personal Space',
    slug: 'personal',
    email: 'virendra@gmail.com',
    description: null,
    avatarUrl: null,
    icon: null,
    iconColor: null,
    ownerId: 'user-1',
    status: WorkspaceStatus.ACTIVE,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    role: WorkspaceRole.OWNER,
    permissions: [],
    memberCount: 1,
    channelCount: 2,
  },
];

describe('WorkspaceMenu / Switcher', () => {
  it('renders current workspace name in the header trigger', () => {
    renderInProviders(
      <WorkspaceMenu
        workspaces={mockWorkspaces}
        current={mockWorkspaces[0]}
        userEmail="virendra@gmail.com"
      />,
    );

    const trigger = screen.getByRole('button', {
      name: /Current workspace: Mie Team/i,
    });
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText('Mie Team')).toBeInTheDocument();
  });

  it('opens the switcher, lists the account and its workspaces, and filters by search', async () => {
    const user = userEvent.setup();
    renderInProviders(
      <WorkspaceMenu
        workspaces={mockWorkspaces}
        current={mockWorkspaces[0]}
        userEmail="virendra@gmail.com"
      />,
    );

    const trigger = screen.getByRole('button', {
      name: /Current workspace/i,
    });
    await user.click(trigger);

    // One account section (keyed by the signed-in identity) with every
    // workspace it can reach listed beneath it. "Mie Team" also shows in the
    // trigger, so assert on the dropdown-only rows.
    expect(screen.getByText('Accounts')).toBeInTheDocument();
    expect(screen.getByText('virendra@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Personal Space')).toBeInTheDocument();

    // Test search filter
    const searchInput = screen.getByPlaceholderText(
      /search workspaces or emails/i,
    );
    await user.type(searchInput, 'acme');

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.queryByText('Personal Space')).toBeNull();
  });

  it('renders workspace-specific invitation button and current workspace invite action', async () => {
    const user = userEvent.setup();
    renderInProviders(
      <WorkspaceMenu
        workspaces={mockWorkspaces}
        current={mockWorkspaces[0]}
        userEmail="virendra@gmail.com"
      />,
    );

    await user.click(screen.getByRole('button', { name: /Current workspace/i }));

    expect(screen.getByText('Invite to Mie Team')).toBeInTheDocument();
    expect(
      screen.getByTitle('Invite people to Acme Corp'),
    ).toBeInTheDocument();
  });

  it('supports action triggers for Add Another Account and Manage Accounts', async () => {
    const user = userEvent.setup();
    const onAddAccount = vi.fn();
    const onManageAccounts = vi.fn();

    renderInProviders(
      <WorkspaceMenu
        workspaces={mockWorkspaces}
        current={mockWorkspaces[0]}
        onAddAccount={onAddAccount}
        onManageAccounts={onManageAccounts}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Current workspace/i }));

    const addAccountItem = screen.getByText('Add account');
    await user.click(addAccountItem);
    expect(onAddAccount).toHaveBeenCalledOnce();
  });

  it('has no "Create New Workspace" or "Join" affordance in the switcher', async () => {
    const user = userEvent.setup();
    renderInProviders(
      <WorkspaceMenu
        workspaces={mockWorkspaces}
        current={mockWorkspaces[0]}
        userEmail="virendra@gmail.com"
      />,
    );

    await user.click(screen.getByRole('button', { name: /Current workspace/i }));

    expect(screen.queryByText(/create new workspace/i)).toBeNull();
    expect(screen.queryByText(/create workspace/i)).toBeNull();
    expect(screen.queryByText(/join/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/invitation/i)).toBeNull();
  });

  it('lists a background account’s workspaces under its own email and switches on click', async () => {
    const user = userEvent.setup();

    // A JWT whose `exp` is an hour out, so the switch routine skips the network
    // refresh and reaches `setActiveAccountId` synchronously.
    const freshJwt = `h.${btoa(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    )}.s`;

    useAccountStore.setState({
      activeAccountId: 'active-user',
      accounts: [
        {
          id: 'active-user',
          user: { id: 'active-user', email: 'virendra@mie.ai' } as never,
          accessToken: 't',
          refreshToken: 'r',
          addedAt: 1,
        },
        {
          id: 'other-user',
          user: {
            id: 'other-user',
            name: 'Work Account',
            displayName: 'Work Account',
            email: 'work@acme.com',
          } as never,
          accessToken: freshJwt,
          refreshToken: 'r2',
          addedAt: 2,
          workspaces: [
            {
              id: 'ws-other',
              name: 'Acme HQ',
              slug: 'acme-hq',
              email: 'work@acme.com',
              icon: null,
              iconColor: null,
              avatarUrl: null,
              memberCount: 9,
            },
          ],
        },
      ],
    });

    const switchSpy = vi
      .spyOn(useAccountStore.getState(), 'setActiveAccountId')
      .mockImplementation(() => undefined);

    renderInProviders(
      <WorkspaceMenu
        workspaces={[mockWorkspaces[0]]}
        current={mockWorkspaces[0]}
        userEmail="virendra@mie.ai"
      />,
    );

    await user.click(screen.getByRole('button', { name: /Current workspace/i }));

    // The other account's group header and its cached workspace both render.
    expect(screen.getByText('work@acme.com')).toBeInTheDocument();
    const otherWs = screen.getByText('Acme HQ');
    expect(otherWs).toBeInTheDocument();

    await user.click(otherWs);
    // The switch routine begins by making that account active.
    expect(switchSpy).toHaveBeenCalledWith('other-user');

    switchSpy.mockRestore();
  });
});

afterEach(() => {
  useAccountStore.setState({ accounts: [], activeAccountId: null });
});
