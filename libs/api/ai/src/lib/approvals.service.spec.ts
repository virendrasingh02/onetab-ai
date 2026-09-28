import { ForbiddenException } from '@nestjs/common';
import { ROLE_PERMISSIONS, WorkspaceRole } from '@org/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalsService } from './approvals.service.js';

describe('ApprovalsService authorization', () => {
  let prisma: any;
  let events: any;
  let service: ApprovalsService;

  const pending = (overrides: Record<string, unknown> = {}) => ({
    id: 'ap_1',
    workspaceId: 'ws_1',
    requesterId: 'u_creator',
    entityType: 'agent',
    entityId: 'agent_1',
    executionId: null,
    stepId: null,
    actionType: 'create_task',
    proposedPayload: {},
    comment: null,
    state: 'PENDING',
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      approvalRequest: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      aIExecution: { findUnique: vi.fn(), update: vi.fn() },
    };
    // `update` returns the row it was asked to change, as Prisma does.
    prisma.approvalRequest.update.mockImplementation(async ({ data }: any) => ({
      ...(await prisma.approvalRequest.findFirst.mock.results.at(-1)?.value),
      ...data,
    }));
    events = { emit: vi.fn() };
    service = new ApprovalsService(prisma, events);
  });

  const actor = (userId: string, role: WorkspaceRole) => ({ userId, permissions: ROLE_PERMISSIONS[role] });

  it("refuses a member deciding someone else's request", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(pending());
    await expect(
      service.decide('ws_1', 'ap_1', actor('u_other', WorkspaceRole.MEMBER), { decision: 'APPROVED' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.approvalRequest.update).not.toHaveBeenCalled();
  });

  it('lets the requester decide and emits the agent event', async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(pending());
    await service.decide('ws_1', 'ap_1', actor('u_creator', WorkspaceRole.MEMBER), { decision: 'APPROVED' });
    expect(events.emit).toHaveBeenCalledWith('agent.approval.decided', expect.objectContaining({ decision: 'APPROVED' }));
  });

  it('lets an admin decide, and hands a workflow approval to the workflow engine', async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(
      pending({ entityType: 'WORKFLOW', entityId: 'wf_1', executionId: 'ex_1', stepId: 'approve' }),
    );
    await service.decide('ws_1', 'ap_1', actor('u_admin', WorkspaceRole.ADMIN), { decision: 'REJECTED' });
    expect(events.emit).toHaveBeenCalledWith(
      'workflow.approval.decided',
      expect.objectContaining({ workflowId: 'wf_1', executionId: 'ex_1', stepId: 'approve', decision: 'REJECTED' }),
    );
    // The engine owns a workflow run's status from here.
    expect(prisma.aIExecution.update).not.toHaveBeenCalled();
  });

  it('marks which requests the viewer may decide', async () => {
    prisma.approvalRequest.findMany.mockResolvedValue([pending(), pending({ id: 'ap_2', requesterId: 'u_x' })]);
    const rows = await service.listApprovals('ws_1', undefined, actor('u_creator', WorkspaceRole.MEMBER));
    expect(rows.map((r: any) => r.canDecide)).toEqual([true, false]);
  });
});
