import { describe, expect, it, vi } from 'vitest';
import { IntegrationToolBridgeService } from './integration-tool-bridge.service.js';

const action = (id: string) => ({
  id,
  label: id,
  description: '',
  inputSchema: { type: 'object', properties: {} },
  permissionLevel: 'read' as const,
  requiresConfirmation: false,
});

function setup(links: unknown[], rows: unknown[]) {
  const prisma = {
    coworkerApp: { findMany: vi.fn().mockResolvedValue(links) },
    externalIntegration: { findMany: vi.fn().mockResolvedValue(rows) },
  };
  const integrations = {
    getActions: vi.fn(async (integrationId: string) =>
      integrationId === 'int_slack' ? [action('send_message')] : [action('list_issues')],
    ),
  };
  return { prisma, integrations, bridge: new IntegrationToolBridgeService(prisma as never, integrations as never) };
}

describe('IntegrationToolBridgeService', () => {
  it('offers a linked app’s actions under canonical names with their provider', async () => {
    const { bridge } = setup([{ integration: { id: 'int_slack', provider: 'SLACK', status: 'CONNECTED' } }], []);
    const tools = await bridge.getToolsForEntity('ws', 'agent', 'u1');
    expect(tools.map((t) => [t.name, t.provider])).toEqual([['slack_send_message', 'SLACK']]);
  });

  it('resolves apps a canvas agent names from the workspace’s or the owner’s own connections', async () => {
    const { bridge, prisma } = setup([], [{ id: 'int_gh', provider: 'GITHUB', status: 'CONNECTED' }]);
    const tools = await bridge.getToolsForEntity('ws', 'agent', 'u1', ['github']);
    expect(tools.map((t) => t.name)).toEqual(['github_list_issues']);
    expect(prisma.externalIntegration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          provider: { in: ['GITHUB'] },
          status: 'CONNECTED',
          OR: [{ workspaceId: 'ws', scopeType: { not: 'USER' } }, { scopeType: 'USER', userId: 'u1' }],
        }),
      }),
    );
  });

  it('gives nothing without an acting person', async () => {
    const { bridge, prisma } = setup([{ integration: { id: 'int_slack', provider: 'SLACK', status: 'CONNECTED' } }], []);
    expect(await bridge.getToolsForEntity('ws', 'agent', null, ['SLACK'])).toEqual([]);
    expect(prisma.coworkerApp.findMany).not.toHaveBeenCalled();
  });
});
