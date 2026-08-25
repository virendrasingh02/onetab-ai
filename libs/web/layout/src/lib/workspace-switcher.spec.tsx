// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { WorkspaceRole, WorkspaceStatus, type WorkspaceSummary } from '@org/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceMenu } from './workspace-switcher.js';

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
  it('renders current workspace name and associated email stacked in the header trigger', () => {
    render(
      <MemoryRouter>
        <WorkspaceMenu
          workspaces={mockWorkspaces}
          current={mockWorkspaces[0]}
          userEmail="virendra@gmail.com"
        />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', {
      name: /Current workspace: Mie Team \(virendra@mie\.ai\)/i,
    });
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText('Mie Team')).toBeInTheDocument();
    expect(screen.getByText('virendra@mie.ai')).toBeInTheDocument();
  });

  it('opens switcher dropdown on click, displays all workspaces with their associated emails, and filters by search', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WorkspaceMenu
          workspaces={mockWorkspaces}
          current={mockWorkspaces[0]}
          userEmail="virendra@gmail.com"
        />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', {
      name: /Current workspace/i,
    });
    await user.click(trigger);

    // Dropdown content should show all 3 workspaces with their respective email addresses
    expect(screen.getByText('Workspaces & Accounts')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('virendra@acme.com')).toBeInTheDocument();
    expect(screen.getByText('Personal Space')).toBeInTheDocument();
    expect(screen.getByText('virendra@gmail.com')).toBeInTheDocument();

    // Test search filter
    const searchInput = screen.getByPlaceholderText(
      /search workspaces or emails/i,
    );
    await user.type(searchInput, 'acme');

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.queryByText('Personal Space')).toBeNull();
  });

  it('supports action triggers for Add Another Account and Manage Accounts', async () => {
    const user = userEvent.setup();
    const onAddAccount = vi.fn();
    const onManageAccounts = vi.fn();

    render(
      <MemoryRouter>
        <WorkspaceMenu
          workspaces={mockWorkspaces}
          current={mockWorkspaces[0]}
          onAddAccount={onAddAccount}
          onManageAccounts={onManageAccounts}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /Current workspace/i }));

    const addAccountItem = screen.getByText('Add another account');
    await user.click(addAccountItem);
    expect(onAddAccount).toHaveBeenCalledOnce();
  });
});
