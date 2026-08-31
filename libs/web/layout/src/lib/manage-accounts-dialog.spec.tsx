// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { WorkspaceRole, WorkspaceStatus, type WorkspaceSummary } from '@org/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { ManageAccountsDialog } from './manage-accounts-dialog.js';

/** The dialog now pulls the multi-account switcher hooks, which need a client. */
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
];

describe('ManageAccountsDialog', () => {
  it('groups the account’s workspaces under one account email with an active badge', () => {
    renderInProviders(
      <ManageAccountsDialog
        open={true}
        onOpenChange={vi.fn()}
        workspaces={mockWorkspaces}
        currentWorkspace={mockWorkspaces[0]}
        userEmail="virendra@gmail.com"
      />,
    );

    expect(screen.getByText('Manage Workspaces & Accounts')).toBeInTheDocument();
    // Account-centric: one section under the signed-in account's email.
    expect(screen.getByText('virendra@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Mie Team')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    // The removed workspace-creation affordance is gone from this surface.
    expect(screen.queryByText(/create workspace/i)).toBeNull();
  });

  it('triggers onSwitchWorkspace when switch button is clicked', async () => {
    const user = userEvent.setup();
    const onSwitchWorkspace = vi.fn();
    const onOpenChange = vi.fn();

    renderInProviders(
      <ManageAccountsDialog
        open={true}
        onOpenChange={onOpenChange}
        workspaces={mockWorkspaces}
        currentWorkspace={mockWorkspaces[0]}
        onSwitchWorkspace={onSwitchWorkspace}
      />,
    );

    const switchBtn = screen.getByRole('button', { name: 'Switch' });
    await user.click(switchBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSwitchWorkspace).toHaveBeenCalledWith(mockWorkspaces[1]);
  });
});
