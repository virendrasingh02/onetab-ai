import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE_PERMISSIONS, WorkspaceRole } from '@org/types';
import { describe, expect, it, vi } from 'vitest';
import { AIResourceManageGuard, CanManageAIEntity, CanManageWorkflow } from './ai-entity-access.guard.js';

/** Controller methods decorated the way the real routes are (applied by hand:
 *  the spec transform does not compile decorator syntax). */
class Routes {
  editAgent(): void {
    // route stand-in: only its metadata is read
  }
  editWorkflow(): void {
    // route stand-in: only its metadata is read
  }
}
const decorate = (decorator: MethodDecorator, key: 'editAgent' | 'editWorkflow') =>
  decorator(Routes.prototype, key, Object.getOwnPropertyDescriptor(Routes.prototype, key)!);
decorate(CanManageAIEntity('agentId'), 'editAgent');
decorate(CanManageWorkflow('workflowId'), 'editWorkflow');

function contextFor(handler: () => void, request: Record<string, unknown>) {
  return {
    getHandler: () => handler,
    getClass: () => Routes,
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

function guardWith(rows: { agent?: any; workflow?: any }) {
  const prisma = {
    aIAgent: { findFirst: vi.fn().mockResolvedValue(rows.agent ?? null) },
    automationWorkflow: { findFirst: vi.fn().mockResolvedValue(rows.workflow ?? null) },
  };
  return { guard: new AIResourceManageGuard(new Reflector(), prisma as any), prisma };
}

const request = (userId: string, role: WorkspaceRole, params: Record<string, string>) => ({
  user: { id: userId },
  workspaceId: 'ws_1',
  workspacePermissions: ROLE_PERMISSIONS[role],
  params,
});

describe('AIResourceManageGuard', () => {
  const routes = new Routes();

  it("lets an agent's creator change it", async () => {
    const { guard } = guardWith({ agent: { creatorId: 'u_member', type: 'agent' } });
    await expect(
      guard.canActivate(contextFor(routes.editAgent, request('u_member', WorkspaceRole.MEMBER, { agentId: 'a1' }))),
    ).resolves.toBe(true);
  });

  it("refuses another member — the agent acts with its creator's accounts", async () => {
    const { guard } = guardWith({ agent: { creatorId: 'u_admin', type: 'agent' } });
    await expect(
      guard.canActivate(contextFor(routes.editAgent, request('u_member', WorkspaceRole.MEMBER, { agentId: 'a1' }))),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a workspace admin change anyone’s agent', async () => {
    const { guard } = guardWith({ agent: { creatorId: 'u_other', type: 'coworker' } });
    await expect(
      guard.canActivate(contextFor(routes.editAgent, request('u_admin', WorkspaceRole.ADMIN, { agentId: 'a1' }))),
    ).resolves.toBe(true);
  });

  it('refuses a guest even for their own agent', async () => {
    const { guard } = guardWith({ agent: { creatorId: 'u_guest', type: 'agent' } });
    await expect(
      guard.canActivate(contextFor(routes.editAgent, request('u_guest', WorkspaceRole.GUEST, { agentId: 'a1' }))),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('scopes the lookup to the workspace, so another tenant’s id is not found', async () => {
    const { guard, prisma } = guardWith({ agent: null });
    await expect(
      guard.canActivate(contextFor(routes.editAgent, request('u_admin', WorkspaceRole.OWNER, { agentId: 'foreign' }))),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.aIAgent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'foreign', workspaceId: 'ws_1' } }),
    );
  });

  it('applies the same rule to workflows', async () => {
    const { guard } = guardWith({ workflow: { creatorId: 'u_admin' } });
    await expect(
      guard.canActivate(
        contextFor(routes.editWorkflow, request('u_member', WorkspaceRole.MEMBER, { workflowId: 'w1' })),
      ),
    ).rejects.toThrow(/workflow's creator/);
  });

  it('fails closed when WorkspaceRoleGuard did not run', async () => {
    const { guard } = guardWith({ agent: { creatorId: 'u_member', type: 'agent' } });
    await expect(
      guard.canActivate(contextFor(routes.editAgent, { user: { id: 'u_member' }, params: { agentId: 'a1' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
