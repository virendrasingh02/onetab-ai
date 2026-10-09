import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WidgetStudioService } from './widget-studio.service.js';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('WidgetStudioService', () => {
  let service: WidgetStudioService;
  let mockPrisma: any;
  let mockEvents: any;
  let mockMcp: any;

  beforeEach(() => {
    mockPrisma = {
      widgetDefinition: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      widgetVersion: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      widgetExecution: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      widgetInstance: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    mockEvents = {
      emit: vi.fn(),
    };

    mockMcp = {
      executeTool: vi.fn(),
    };

    service = new WidgetStudioService(mockPrisma, mockEvents, mockMcp);
  });

  describe('getTemplates', () => {
    it('returns pre-built templates covering all 5 core categories', () => {
      const templates = service.getTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(8);

      const categories = new Set(templates.map((t) => t.category));
      expect(categories.has('data_viz')).toBe(true);
      expect(categories.has('interactive_input')).toBe(true);
      expect(categories.has('ai_powered')).toBe(true);
      expect(categories.has('app_connector')).toBe(true);
      expect(categories.has('productivity')).toBe(true);
    });
  });

  describe('create', () => {
    it('creates a widget definition with initial version and emits widget.created event', async () => {
      const input = {
        name: 'Live Conversion KPI',
        category: 'data_viz' as const,
        componentType: 'metric_card' as const,
        description: 'Real-time conversion metric',
        appearance: { size: 'standard' as const },
        dataSource: { type: 'static_sample' as const },
        permissions: { canView: 'workspace' as const, canEdit: 'workspace' as const, canExecute: 'workspace' as const },
      };

      mockPrisma.widgetDefinition.findFirst.mockResolvedValueOnce(null);
      const mockRecord = {
        id: 'wgt_123',
        workspaceId: 'ws_abc',
        name: input.name,
        slug: 'live-conversion-kpi',
        category: input.category,
        componentType: input.componentType,
        description: input.description,
        version: 1,
        status: 'DRAFT',
        visibility: 'WORKSPACE',
        appearance: input.appearance,
        dataSource: input.dataSource,
        permissions: input.permissions,
        tags: [],
        createdBy: 'usr_xyz',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.widgetDefinition.create.mockResolvedValueOnce(mockRecord);

      const result = await service.create('ws_abc', 'usr_xyz', input);

      expect(result.id).toBe('wgt_123');
      expect(result.version).toBe(1);
      expect(mockEvents.emit).toHaveBeenCalledWith('widget.created', expect.objectContaining({ widgetId: 'wgt_123' }));
    });
  });

  describe('get', () => {
    it('returns widget definition if found', async () => {
      mockPrisma.widgetDefinition.findFirst.mockResolvedValueOnce({
        id: 'wgt_1',
        workspaceId: 'ws_1',
        name: 'Test Widget',
        slug: 'test-widget',
        category: 'data_viz',
        componentType: 'metric_card',
        version: 1,
        status: 'PUBLISHED',
        visibility: 'WORKSPACE',
        appearance: {},
        dataSource: {},
        permissions: { canView: 'workspace' },
        tags: [],
        createdBy: 'usr_1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.get('ws_1', 'wgt_1', 'usr_1');
      expect(res.id).toBe('wgt_1');
      expect(res.name).toBe('Test Widget');
    });

    it('throws NotFoundException when widget is missing', async () => {
      mockPrisma.widgetDefinition.findFirst.mockResolvedValueOnce(null);
      await expect(service.get('ws_1', 'missing', 'usr_1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('publish & version snapshotting', () => {
    it('snapshots version and increments version counter on publish', async () => {
      const existing = {
        id: 'wgt_1',
        workspaceId: 'ws_1',
        name: 'Published KPI',
        slug: 'published-kpi',
        category: 'data_viz',
        componentType: 'metric_card',
        version: 1,
        status: 'DRAFT',
        visibility: 'WORKSPACE',
        appearance: {},
        dataSource: { type: 'static_sample' },
        permissions: { canView: 'workspace' },
        tags: ['v1'],
        createdBy: 'usr_1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.widgetDefinition.findFirst.mockResolvedValueOnce(existing);

      const updated = {
        ...existing,
        version: 2,
        status: 'PUBLISHED',
      };
      mockPrisma.widgetDefinition.update.mockResolvedValueOnce(updated);

      const res = await service.publish('ws_1', 'wgt_1', 'usr_1', 'Ready for production');

      expect(mockPrisma.widgetVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            widgetDefinitionId: 'wgt_1',
            versionNumber: 2,
          }),
        })
      );
      expect(res.version).toBe(2);
      expect(mockEvents.emit).toHaveBeenCalledWith('widget.published', expect.objectContaining({ widgetId: 'wgt_1', version: 2 }));
    });
  });

  describe('rollback', () => {
    it('restores config from snapshot and updates widget', async () => {
      const current = {
        id: 'wgt_1',
        workspaceId: 'ws_1',
        name: 'Current v2',
        slug: 'wgt-1',
        category: 'data_viz',
        componentType: 'metric_card',
        version: 2,
        status: 'PUBLISHED',
        visibility: 'WORKSPACE',
        appearance: { badAppearance: true },
        dataSource: {},
        permissions: {},
        tags: [],
        createdBy: 'usr_1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.widgetDefinition.findFirst.mockResolvedValueOnce(current);

      const targetVersion = {
        id: 'ver_1',
        widgetDefinitionId: 'wgt_1',
        versionNumber: 1,
        snapshotJson: {
          id: 'wgt_1',
          name: 'Original v1',
          category: 'data_viz',
          componentType: 'metric_card',
          appearance: { goodAppearance: true },
        },
      };
      mockPrisma.widgetVersion.findUnique.mockResolvedValueOnce(targetVersion);

      const rolledBack = {
        ...current,
        name: 'Original v1',
        version: 1,
        appearance: { goodAppearance: true },
      };
      mockPrisma.widgetDefinition.update.mockResolvedValueOnce(rolledBack);

      const res = await service.rollback('ws_1', 'wgt_1', 'usr_1', 1);

      expect(res.version).toBe(1);
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'widget.version_rollback',
        expect.objectContaining({ widgetId: 'wgt_1', targetVersion: 1 })
      );
    });
  });

  describe('execute SSRF Guard', () => {
    it('blocks private loopback and link-local IP addresses', async () => {
      const widget = {
        id: 'wgt_ssrf',
        workspaceId: 'ws_1',
        name: 'SSRF Widget',
        slug: 'ssrf-widget',
        category: 'data_viz',
        componentType: 'metric_card',
        version: 1,
        status: 'PUBLISHED',
        visibility: 'WORKSPACE',
        appearance: {},
        dataSource: {
          type: 'api_rest',
          apiUrl: 'http://127.0.0.1:8080/internal/keys',
        },
        permissions: { canExecute: 'workspace' },
        tags: [],
        createdBy: 'usr_1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.widgetDefinition.findFirst.mockResolvedValueOnce(widget);

      await expect(
        service.execute('ws_1', 'wgt_ssrf', 'usr_1', { executionType: 'DATA_FETCH' })
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks AWS/cloud metadata address (169.254.169.254)', async () => {
      const widget = {
        id: 'wgt_aws_meta',
        workspaceId: 'ws_1',
        name: 'Meta Widget',
        slug: 'meta-widget',
        category: 'data_viz',
        componentType: 'metric_card',
        version: 1,
        status: 'PUBLISHED',
        visibility: 'WORKSPACE',
        appearance: {},
        dataSource: {
          type: 'api_rest',
          apiUrl: 'http://169.254.169.254/latest/meta-data/',
        },
        permissions: { canExecute: 'workspace' },
        tags: [],
        createdBy: 'usr_1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.widgetDefinition.findFirst.mockResolvedValueOnce(widget);

      await expect(
        service.execute('ws_1', 'wgt_aws_meta', 'usr_1', { executionType: 'DATA_FETCH' })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('execute action telemetry', () => {
    it('records execution record and returns execution status', async () => {
      const widget = {
        id: 'wgt_act',
        workspaceId: 'ws_1',
        name: 'Action Widget',
        slug: 'act-widget',
        category: 'interactive_input',
        componentType: 'form_input',
        version: 1,
        status: 'PUBLISHED',
        visibility: 'WORKSPACE',
        appearance: {},
        dataSource: { type: 'static_sample' },
        sampleData: { submitted: true },
        eventConfig: {
          actions: [{ id: 'submit_action', triggerEvent: 'on_submit', targetType: 'workflow_trigger' }],
        },
        permissions: { canExecute: 'workspace' },
        tags: [],
        createdBy: 'usr_1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.widgetDefinition.findFirst.mockResolvedValueOnce(widget);
      mockPrisma.widgetDefinition.update.mockResolvedValueOnce(widget);
      mockPrisma.widgetExecution.create.mockResolvedValueOnce({
        id: 'exec_1',
        widgetId: 'wgt_act',
        status: 'SUCCESS',
        latencyMs: 45,
      });

      const res = await service.execute('ws_1', 'wgt_act', 'usr_1', {
        executionType: 'RENDER',
        inputPayload: { userEmail: 'test@example.com' },
      });

      expect(res.status).toBe('SUCCESS');
      expect(mockPrisma.widgetExecution.create).toHaveBeenCalled();
      expect(mockEvents.emit).toHaveBeenCalledWith('widget.execution.completed', expect.anything());
    });
  });
});
