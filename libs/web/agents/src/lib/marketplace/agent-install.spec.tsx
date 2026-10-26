import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MarketplaceInstallation, MarketplaceListing } from '@org/types';
import type { ComponentProps, ReactNode } from 'react';

const api = vi.hoisted(() => ({
  preview: vi.fn(),
  install: vi.fn(),
  requestApproval: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  setEnabled: vi.fn(),
  uninstall: vi.fn(),
  health: vi.fn(),
  approvals: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@org/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  agentInstallApi: api,
  memberApi: { list: vi.fn(async () => []) },
}));

import { AgentInstallDialog } from './AgentInstallDialog';
import { AgentInstallsSection } from './AgentInstallsSection';

beforeAll(() => {
  // Radix measures with these; jsdom has neither.
  const noop = () => undefined;
  globalThis.ResizeObserver ??= class {
    observe = noop;
    unobserve = noop;
    disconnect = noop;
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= noop;
  Element.prototype.hasPointerCapture ??= () => false;
});

const listing = {
  id: 'l1', kind: 'AGENT', slug: 'helper', name: 'Helper', tagline: 'Helps', version: '1.0.0',
  iconUrl: null, publisher: { name: 'Acme', slug: 'acme', isVerified: true },
} as unknown as MarketplaceListing;

const workspace = { id: 'ws1', name: 'Acme HQ', slug: 'acme' };

const basePreview = {
  listing: { ...listing, visibility: 'PUBLIC' },
  installable: true, ownAgent: false, listingStatus: 'PUBLISHED', issues: [],
  permissions: [
    { id: 'data:workspace', kind: 'data', label: 'Read workspace context', description: 'Uses what you can see.', sensitive: false },
    { id: 'tool:delete_task', kind: 'tool', label: 'Tool: delete_task', description: 'Can change data.', sensitive: true },
  ],
  configFields: [{ key: 'apiKey', label: 'API key', type: 'secret', required: true }],
  dependencies: null, compatibility: { minPlatformVersion: '1.0.0', platforms: ['Web'] },
  requiresAdminApproval: false, canInstall: true, forcedScope: null, reason: null, installation: null, newPermissions: [],
};

const installed = (over: Partial<MarketplaceInstallation> = {}): MarketplaceInstallation =>
  ({
    id: 'i1', listingId: 'l1', workspaceId: 'ws1', version: '1.0.0', status: 'ACTIVE', settings: {}, grantedScopes: [],
    installedAt: new Date().toISOString(), listing, scope: 'WORKSPACE', agentId: 'agent1', latestVersion: '1.0.0', updateAvailable: false,
    ...over,
  }) as MarketplaceInstallation;

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const apiError = (data: object) => Object.assign(new Error('x'), { response: { data } });

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.preview.mockResolvedValue(basePreview);
});

describe('AgentInstallDialog', () => {
  const open = (props: Partial<ComponentProps<typeof AgentInstallDialog>> = {}) =>
    render(wrap(<AgentInstallDialog open onClose={vi.fn()} listing={listing} workspace={workspace} {...props} />));

  it('shows a loading skeleton, then the requested permissions with sensitive ones flagged', async () => {
    open();
    expect(screen.getByRole('status', { name: /loading agent details/i })).toBeInTheDocument();
    expect(await screen.findByText('Read workspace context')).toBeInTheDocument();
    expect(screen.getByText('Tool: delete_task')).toBeInTheDocument();
    expect(screen.getByText('Needs approval')).toBeInTheDocument();
  });

  it('blocks install until required settings are filled and sensitive permissions approved', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('button', { name: /continue/i }));
    const install = screen.getByRole('button', { name: /install agent/i });
    expect(install).toBeDisabled();

    await user.type(screen.getByLabelText(/api key/i), 'sk-secret');
    expect(install).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /approve sensitive permissions/i }));
    expect(install).toBeEnabled();
  });

  it('reports success only after the server confirms, listing the health checks', async () => {
    const user = userEvent.setup();
    let resolve!: (v: unknown) => void;
    api.install.mockReturnValue(new Promise((r) => (resolve = r)));
    const onOpenChat = vi.fn();
    open({ onOpenChat });

    await user.click(await screen.findByRole('button', { name: /continue/i }));
    await user.type(screen.getByLabelText(/api key/i), 'sk-secret');
    await user.click(screen.getByRole('checkbox', { name: /approve sensitive permissions/i }));
    await user.click(screen.getByRole('button', { name: /install agent/i }));

    // In flight: progress, and no success claim yet.
    expect(await screen.findByText(/installing helper/i)).toBeInTheDocument();
    expect(screen.queryByText(/installed and ready/i)).not.toBeInTheDocument();
    expect(api.install).toHaveBeenCalledWith('ws1', 'helper', {
      scope: 'WORKSPACE', settings: { apiKey: 'sk-secret' }, approvedPermissions: ['tool:delete_task'],
    });

    resolve({
      alreadyInstalled: false,
      installation: installed({ health: { ok: true, checkedAt: '', checks: [{ name: 'Agent exists', ok: true }] } }),
    });
    expect(await screen.findByText(/installed and ready/i)).toBeInTheDocument();
    expect(screen.getByText('Agent exists')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /open in chat/i }));
    expect(onOpenChat).toHaveBeenCalledWith('agent1');
  });

  it('shows an actionable error and cleanup note when the install fails, and allows a retry', async () => {
    const user = userEvent.setup();
    api.install.mockRejectedValueOnce(apiError({ code: 'HEALTH_CHECK_FAILED', message: 'Health check failed: Credential \'API key\'', retryable: true }));
    open();
    await user.click(await screen.findByRole('button', { name: /continue/i }));
    await user.type(screen.getByLabelText(/api key/i), 'bad');
    await user.click(screen.getByRole('checkbox', { name: /approve sensitive permissions/i }));
    await user.click(screen.getByRole('button', { name: /install agent/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed its health check/i);
    expect(screen.getByText(/nothing was left half-installed/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByRole('button', { name: /install agent/i })).toBeInTheDocument();
  });

  it('returns to the form with the field error when the server rejects a setting', async () => {
    const user = userEvent.setup();
    api.install.mockRejectedValueOnce(apiError({ code: 'INVALID_CONFIG', message: 'Some settings need attention.', fields: { apiKey: 'API key is required.' } }));
    open();
    await user.click(await screen.findByRole('button', { name: /continue/i }));
    await user.type(screen.getByLabelText(/api key/i), 'x');
    await user.click(screen.getByRole('checkbox', { name: /approve sensitive permissions/i }));
    await user.click(screen.getByRole('button', { name: /install agent/i }));
    expect(await screen.findByText('API key is required.')).toBeInTheDocument();
  });

  it('offers an admin request instead of an install when the caller cannot install', async () => {
    const user = userEvent.setup();
    api.preview.mockResolvedValue({ ...basePreview, canInstall: false, requiresAdminApproval: true, reason: 'This agent asks for sensitive access, so an admin has to approve it.' });
    api.requestApproval.mockResolvedValue(installed({ status: 'PENDING_APPROVAL' }));
    open();
    expect(await screen.findByText(/an admin has to approve it/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue to request/i }));
    expect(screen.queryByRole('button', { name: /install agent/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /request admin approval/i }));
    expect(await screen.findByText(/request sent/i)).toBeInTheDocument();
    expect(api.install).not.toHaveBeenCalled();
  });

  it('blocks continuing when the package is invalid and says why', async () => {
    api.preview.mockResolvedValue({ ...basePreview, installable: false, issues: [{ code: 'INCOMPATIBLE', message: 'Needs platform 9.0.0 or newer' }] });
    open();
    expect(await screen.findByText(/needs platform 9\.0\.0 or newer/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('shows a recoverable error when the preview cannot be loaded', async () => {
    api.preview.mockRejectedValueOnce(apiError({ code: 'X', message: 'Network down' }));
    open();
    expect(await screen.findByText(/could not load this agent/i)).toBeInTheDocument();
    expect(screen.getByText(/network down/i)).toBeInTheDocument();
  });
});

describe('AgentInstallsSection', () => {
  const show = () =>
    render(
      wrap(
        <AgentInstallsSection
          workspace={{ id: 'ws1', slug: 'acme' }}
          currentUserId="u1"
          canManage
          onOpenChat={vi.fn()}
          onRetry={vi.fn()}
          onBrowse={vi.fn()}
        />,
      ),
    );

  it('renders an empty state with a way to browse', async () => {
    api.list.mockResolvedValue([]);
    show();
    expect(await screen.findByText(/no installed agents/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse agents/i })).toBeInTheDocument();
  });

  it('shows status, update availability and failure details per install', async () => {
    api.list.mockResolvedValue([
      installed({ updateAvailable: true, latestVersion: '2.0.0' }),
      installed({ id: 'i2', status: 'FAILED', lastError: 'Health check failed: Agent exists', listing: { ...listing, slug: 'broken', name: 'Broken' } as MarketplaceListing }),
    ]);
    show();
    expect(await screen.findByText('Helper')).toBeInTheDocument();
    expect(screen.getByText(/update available: v1\.0\.0 → v2\.0\.0/i)).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText(/health check failed: agent exists/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry install/i })).toBeInTheDocument();
  });

  it('disables an agent through the server and refreshes from its answer', async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([installed()]);
    api.setEnabled.mockResolvedValue(installed({ status: 'DISABLED' }));
    show();
    await user.click(await screen.findByRole('switch', { name: /disable helper/i }));
    await waitFor(() => expect(api.setEnabled).toHaveBeenCalledWith('ws1', 'helper', false));
  });

  it('renders installs that were never health-checked (empty health object from older rows)', async () => {
    api.list.mockResolvedValue([installed({ health: {} as never })]);
    show();
    expect(await screen.findByText('Helper')).toBeInTheDocument();
    expect(screen.queryByText(/health check failing/i)).not.toBeInTheDocument();
  });

  it('surfaces a load failure with a retry', async () => {
    api.list.mockRejectedValueOnce(apiError({ code: 'X', message: 'Boom' }));
    show();
    expect(await screen.findByText(/could not load installed agents/i)).toBeInTheDocument();
  });
});
