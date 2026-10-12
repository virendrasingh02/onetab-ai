import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AutomationsService, humanizeCron } from './automations.service.js';
import { UnauthorizedException } from '@nestjs/common';

describe('AutomationsService and Cron Utilities', () => {
  describe('humanizeCron', () => {
    it('humanizes minute, hourly, and daily cron expressions', () => {
      expect(humanizeCron('* * * * *')).toBe('Every minute');
      expect(humanizeCron('*/15 * * * *')).toBe('Every 15 minutes');
      expect(humanizeCron('0 * * * *')).toBe('Every hour');
      expect(humanizeCron('0 9 * * *')).toBe('Daily at 09:00');
      expect(humanizeCron('0 9 * * 1-5')).toBe('Weekdays at 09:00');
      expect(humanizeCron('0 0 1 * *')).toBe('Monthly on the 1st at 00:00');
      expect(humanizeCron('30 14 * * 0')).toBe('Schedule (30 14 * * 0)');
    });
  });

  describe('AutomationsService methods', () => {
    let service: AutomationsService;
    let mockPrisma: any;
    let mockEngine: any;

    beforeEach(() => {
      mockPrisma = {
        automationWorkflow: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
        workflowExecution: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
        aIExecution: {
          count: vi.fn(),
        },
        externalIntegration: {
          findMany: vi.fn(),
        },
        approvalRequest: {
          count: vi.fn(),
        },
      };

      mockEngine = {
        executeWorkflow: vi.fn(),
      };

      service = new AutomationsService(mockPrisma as any, mockEngine as any);
    });

    it('calculates real overview metrics including success rate, p50/p95, and ROI', async () => {
      const now = new Date();
      mockPrisma.automationWorkflow.findMany.mockResolvedValue([
        {
          id: 'wf-1',
          name: 'Task Triage',
          isActive: true,
          triggerType: 'EVENT',
          nodesJson: '[]',
          edgesJson: '[]',
        },
        {
          id: 'wf-2',
          name: 'Morning Summary',
          isActive: false,
          triggerType: 'CRON',
          nodesJson: '[]',
          edgesJson: '[]',
        },
      ]);

      mockPrisma.workflowExecution.findMany.mockResolvedValue([
        {
          id: 'run-1',
          workflowId: 'wf-1',
          status: 'SUCCESS',
          startedAt: new Date(now.getTime() - 1000),
          finishedAt: now,
          stepResults: '[]',
          workflow: { id: 'wf-1', name: 'Task Triage', triggerType: 'EVENT' },
        },
        {
          id: 'run-2',
          workflowId: 'wf-1',
          status: 'FAILED',
          startedAt: new Date(now.getTime() - 2500),
          finishedAt: now,
          stepResults: JSON.stringify([{ stepId: 'step-1', status: 'FAILED', error: 'TIMEOUT: request timed out' }]),
          workflow: { id: 'wf-1', name: 'Task Triage', triggerType: 'EVENT' },
        },
      ]);

      mockPrisma.aIExecution.count.mockResolvedValue(0);

      mockPrisma.externalIntegration.findMany.mockResolvedValue([
        { provider: 'SLACK', status: 'CONNECTED' },
      ]);

      mockPrisma.approvalRequest.count.mockResolvedValue(1);

      const overview = await service.getAutomationOverview('ws-1');

      expect(overview.totalWorkflows).toBe(2);
      expect(overview.activeWorkflows).toBe(1);
      expect(overview.pausedWorkflows).toBe(1);
      expect(overview.successfulExecutions).toBe(1);
      expect(overview.failedExecutions).toBe(1);
      expect(overview.successRate).toBe(50);
      expect(overview.pendingApprovalsCount).toBe(1);
      expect(overview.volumeByDay.length).toBe(14);
      expect(overview.estimatedTimeSavedHours).toBeGreaterThanOrEqual(0);
      expect(overview.connectorHealth).toHaveLength(1);
      expect(overview.connectorHealth[0].provider).toBe('SLACK');
    });

    it('extracts schedules with nextRunAt timetable', async () => {
      mockPrisma.automationWorkflow.findMany.mockResolvedValue([
        {
          id: 'wf-cron',
          name: 'Daily Sync',
          triggerType: 'CRON',
          isActive: true,
          nodesJson: JSON.stringify([
            { id: 'start', type: 'TRIGGER', data: { triggerKind: 'CRON', cron: '0 9 * * 1-5', timezone: 'UTC' } },
          ]),
          executions: [{ startedAt: new Date() }],
        },
      ]);
      mockPrisma.workflowExecution.findFirst.mockResolvedValue(null);

      const schedules = await service.getSchedules('ws-1');

      expect(schedules).toHaveLength(1);
      expect(schedules[0].name).toBe('Daily Sync');
      expect(schedules[0].cron).toBe('0 9 * * 1-5');
      expect(schedules[0].humanSchedule).toBe('Weekdays at 09:00');
      expect(schedules[0].nextRunAt).toBeDefined();
    });

    it('groups errors by classified error code', async () => {
      const now = new Date();
      mockPrisma.workflowExecution.findMany.mockResolvedValue([
        {
          id: 'run-err-1',
          workflowId: 'wf-1',
          status: 'FAILED',
          startedAt: now,
          finishedAt: now,
          stepResults: JSON.stringify([
            { stepId: 's1', status: 'FAILED', error: 'TIMEOUT: connection timed out' },
          ]),
          workflow: { id: 'wf-1', name: 'Sync Flow' },
        },
        {
          id: 'run-err-2',
          workflowId: 'wf-2',
          status: 'FAILED',
          startedAt: now,
          finishedAt: now,
          stepResults: JSON.stringify([
            { stepId: 's2', status: 'FAILED', error: 'MISSING_PERMISSION: unauthorized resource' },
          ]),
          workflow: { id: 'wf-2', name: 'Doc Flow' },
        },
      ]);

      const groups = await service.getErrorMonitoring('ws-1');

      expect(groups.length).toBeGreaterThanOrEqual(2);
      const timeoutGroup = groups.find((g) => g.classification === 'TIMEOUT');
      expect(timeoutGroup).toBeDefined();
      expect(timeoutGroup?.count).toBe(1);
      expect(timeoutGroup?.affectedWorkflows[0].name).toBe('Sync Flow');
    });

    it('triggers webhooks with signature verification', async () => {
      mockPrisma.automationWorkflow.findFirst.mockResolvedValue({
        id: 'wf-hook',
        workspaceId: 'ws-1',
        isActive: true,
        nodesJson: JSON.stringify([
          { id: 'start', type: 'TRIGGER', data: { triggerKind: 'WEBHOOK', webhookSecret: 'super-secret' } },
        ]),
      });

      mockEngine.executeWorkflow.mockResolvedValue({
        runId: 'exec-123',
        status: 'SUCCESS',
      });

      // Wrong secret fails with UnauthorizedException
      await expect(
        service.triggerWebhook('ws-1', 'wf-hook', { test: true }, 'wrong-secret'),
      ).rejects.toThrow(UnauthorizedException);

      // Correct secret succeeds
      const res = await service.triggerWebhook('ws-1', 'wf-hook', { test: true }, 'super-secret');
      expect(res.executionId).toBe('exec-123');
      expect(res.status).toBe('SUCCESS');
      expect(mockEngine.executeWorkflow).toHaveBeenCalledWith(
        'wf-hook',
        expect.objectContaining({ test: true, source: 'webhook' }),
        { startedBy: 'webhook' },
      );
    });
  });
});
