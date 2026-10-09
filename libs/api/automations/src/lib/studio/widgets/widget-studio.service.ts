import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@org/database';
import { safeFetch } from '@org/api-common';
import { MCPToolRegistryService } from '@org/api-agents';
import type {
  CreateWidgetDefinitionInput,
  ExecuteWidgetInput,
  UpdateWidgetDefinitionInput,
  WidgetQueryInput,
} from '@org/validation';
import type {
  WidgetCategory,
  WidgetComponentType,
  WidgetDefinition,
  WidgetExecutionRecord,
  WidgetInstance,
  WidgetTemplateItem,
  WidgetVersion,
} from '@org/types';

const DEFAULT_TEMPLATES: WidgetTemplateItem[] = [
  // --- Category A: Data & Visualization ---
  {
    id: 'tpl_metric_kpi',
    name: 'Executive KPI Summary Card',
    category: 'data_viz',
    componentType: 'metric_card',
    description: 'Displays key performance metrics with percentage delta, status badge, and secondary indicators.',
    icon: 'TrendingUp',
    tags: ['kpi', 'metrics', 'analytics', 'executive'],
    sampleData: {
      title: 'Active Agents Throughput',
      primaryValue: '128,450',
      secondaryValue: '+14.2%',
      trend: 'up',
      timeframe: 'vs last 30 days',
      status: 'optimal',
    },
    defaultConfig: {
      appearance: {
        size: 'standard',
        colorTheme: 'primary',
        customHeader: true,
        showIcon: true,
        showBorder: true,
        roundedRadius: 'md',
      },
      dataSource: {
        type: 'static_sample',
        autoRefresh: true,
        refreshIntervalSec: 60,
      },
      schemaConfig: {
        inputFields: [],
        outputFields: [
          { id: 'primaryValue', label: 'Primary Value', type: 'string', required: true },
          { id: 'secondaryValue', label: 'Delta', type: 'string' },
        ],
        allowCustomOutputs: true,
      },
      eventConfig: {
        actions: [{ id: 'act_click', triggerEvent: 'on_click', targetType: 'navigation', targetId: '/analytics' }],
        debounceMs: 300,
        preventDuplicateSubmissions: true,
      },
    },
  },
  {
    id: 'tpl_bar_chart',
    name: 'Workflow Runs & Throughput Bar Chart',
    category: 'data_viz',
    componentType: 'bar_chart',
    description: 'Aggregates daily or hourly workflow executions with success vs failure breakdown.',
    icon: 'BarChart3',
    tags: ['charts', 'executions', 'workflows', 'bar'],
    sampleData: {
      title: 'Executions (Last 7 Days)',
      data: [
        { day: 'Mon', successful: 420, failed: 12 },
        { day: 'Tue', successful: 530, failed: 8 },
        { day: 'Wed', successful: 610, failed: 15 },
        { day: 'Thu', successful: 580, failed: 6 },
        { day: 'Fri', successful: 720, failed: 18 },
        { day: 'Sat', successful: 310, failed: 4 },
        { day: 'Sun', successful: 390, failed: 5 },
      ],
      xAxisKey: 'day',
      series: [
        { key: 'successful', label: 'Successful Runs', color: '#10b981' },
        { key: 'failed', label: 'Failed Runs', color: '#ef4444' },
      ],
    },
    defaultConfig: {
      appearance: {
        size: 'large',
        colorTheme: 'default',
        customHeader: true,
        showIcon: true,
        showBorder: true,
        roundedRadius: 'md',
      },
      dataSource: {
        type: 'platform_service',
        platformService: 'activity',
        autoRefresh: true,
        refreshIntervalSec: 120,
      },
      schemaConfig: {
        inputFields: [],
        outputFields: [{ id: 'data', label: 'Chart Series', type: 'array', required: true }],
        allowCustomOutputs: true,
      },
      eventConfig: { actions: [], debounceMs: 300, preventDuplicateSubmissions: true },
    },
  },
  {
    id: 'tpl_live_table',
    name: 'Live Tasks & Issues Data Grid',
    category: 'data_viz',
    componentType: 'table_view',
    description: 'Sortable and filterable data table displaying platform tasks, assignees, and statuses.',
    icon: 'Table',
    tags: ['table', 'tasks', 'data-grid', 'productivity'],
    sampleData: {
      title: 'Active Sprint Tasks',
      columns: [
        { id: 'identifier', label: 'Key', sortable: true },
        { id: 'title', label: 'Task Title', sortable: true },
        { id: 'status', label: 'Status', sortable: true },
        { id: 'priority', label: 'Priority', sortable: true },
      ],
      rows: [
        { id: '1', identifier: 'TASK-101', title: 'Implement AI Agent Widget Center', status: 'IN_PROGRESS', priority: 'HIGH' },
        { id: '2', identifier: 'TASK-102', title: 'Connect Slack OAuth connector', status: 'DONE', priority: 'MEDIUM' },
        { id: '3', identifier: 'TASK-103', title: 'Prisma database indexing pass', status: 'DONE', priority: 'URGENT' },
        { id: '4', identifier: 'TASK-104', title: 'Add Recharts data visualizers', status: 'IN_PROGRESS', priority: 'HIGH' },
      ],
    },
    defaultConfig: {
      appearance: {
        size: 'large',
        colorTheme: 'default',
        customHeader: true,
        showIcon: true,
        showBorder: true,
        roundedRadius: 'md',
      },
      dataSource: {
        type: 'platform_service',
        platformService: 'tasks',
        autoRefresh: true,
        refreshIntervalSec: 60,
      },
      schemaConfig: {
        inputFields: [],
        outputFields: [{ id: 'rows', label: 'Table Records', type: 'array', required: true }],
        allowCustomOutputs: true,
      },
      eventConfig: { actions: [], debounceMs: 300, preventDuplicateSubmissions: true },
    },
  },

  // --- Category B: Interactive Input ---
  {
    id: 'tpl_agent_prompt_form',
    name: 'Prompt & Parameters Input Form',
    category: 'interactive_input',
    componentType: 'dynamic_form',
    description: 'Collects structured text, model temperature, and target options to dispatch to an AI agent.',
    icon: 'SlidersHorizontal',
    tags: ['form', 'input', 'prompt', 'parameters'],
    sampleData: {
      title: 'Generate Content Dispatch',
      prompt: 'Draft an executive briefing on Q3 cloud architecture improvements.',
      domain: 'Engineering',
      creativity: 0.7,
      includeMetrics: true,
    },
    defaultConfig: {
      appearance: {
        size: 'standard',
        colorTheme: 'primary',
        customHeader: true,
        showIcon: true,
        showBorder: true,
        roundedRadius: 'md',
      },
      dataSource: { type: 'static_sample', autoRefresh: false },
      schemaConfig: {
        inputFields: [
          { id: 'prompt', label: 'User Instruction', type: 'string', required: true, placeholder: 'Enter prompt...' },
          {
            id: 'domain',
            label: 'Domain Category',
            type: 'select',
            required: true,
            options: [
              { label: 'Engineering', value: 'Engineering' },
              { label: 'Marketing', value: 'Marketing' },
              { label: 'Sales', value: 'Sales' },
            ],
          },
          { id: 'includeMetrics', label: 'Include Metric Citations', type: 'boolean', defaultValue: true },
        ],
        outputFields: [{ id: 'formPayload', label: 'Submission Payload', type: 'object' }],
        allowCustomOutputs: true,
      },
      eventConfig: {
        actions: [{ id: 'act_submit', triggerEvent: 'on_submit', targetType: 'workflow_trigger' }],
        debounceMs: 300,
        preventDuplicateSubmissions: true,
      },
    },
  },
  {
    id: 'tpl_human_approval',
    name: 'Human Review & Approval Widget',
    category: 'interactive_input',
    componentType: 'approval_form',
    description: 'Pauses workflow execution until an authorized reviewer approves, edits, or rejects the draft payload.',
    icon: 'ShieldCheck',
    tags: ['approval', 'governance', 'human-in-the-loop', 'review'],
    sampleData: {
      title: 'Action Requires Human Authorization',
      actionName: 'Post Announcement to Slack #general',
      requestedBy: 'Copilot Agent (Autonomous)',
      payloadSummary: 'Target: #general | Message: "Q3 system maintenance completed ahead of schedule."',
      decisionComment: '',
      status: 'PENDING',
    },
    defaultConfig: {
      appearance: {
        size: 'standard',
        colorTheme: 'warning',
        customHeader: true,
        showIcon: true,
        showBorder: true,
        roundedRadius: 'md',
      },
      dataSource: { type: 'workflow_output', variablePath: 'approval_step.payload' },
      schemaConfig: {
        inputFields: [
          { id: 'decisionComment', label: 'Reviewer Notes', type: 'string', placeholder: 'Optional notes...' },
        ],
        outputFields: [
          { id: 'approved', label: 'Approval Status', type: 'boolean', required: true },
          { id: 'modifiedPayload', label: 'Approved Payload', type: 'object' },
        ],
      },
      eventConfig: {
        actions: [{ id: 'act_approval', triggerEvent: 'on_approval', targetType: 'workflow_trigger' }],
        debounceMs: 300,
        preventDuplicateSubmissions: true,
      },
    },
  },

  // --- Category C: AI-Powered ---
  {
    id: 'tpl_ai_summary',
    name: 'Executive AI Briefing & Insight Summary',
    category: 'ai_powered',
    componentType: 'ai_summary',
    description: 'Generates structured AI summaries with provenance citations, latency tracking, and copy actions.',
    icon: 'Sparkles',
    tags: ['ai', 'summary', 'llm', 'insights'],
    sampleData: {
      title: 'Sprint Retrospective Synthesis',
      summary:
        'All 14 planned agent studio endpoints and React Flow canvas capabilities were completed within budget. Core latency averaged 182ms with zero token budget overruns.',
      keyPoints: [
        'Prisma database migration applied and validated with zero schema drift.',
        'SSRF protection active on all outbound REST widget calls.',
        'Visual Builder responsive across desktop, tablet, and mobile views.',
      ],
      modelUsed: 'NVIDIA Llama-3 70B',
      tokensUsed: 420,
      latencyMs: 380,
    },
    defaultConfig: {
      appearance: {
        size: 'standard',
        colorTheme: 'primary',
        customHeader: true,
        showIcon: true,
        showBorder: true,
        roundedRadius: 'md',
      },
      dataSource: { type: 'workflow_output', variablePath: 'llm_step.output' },
      schemaConfig: {
        inputFields: [],
        outputFields: [
          { id: 'summary', label: 'Generated Text', type: 'string', required: true },
          { id: 'keyPoints', label: 'Key Takeaways', type: 'array' },
        ],
      },
      eventConfig: { actions: [], debounceMs: 300, preventDuplicateSubmissions: true },
    },
  },
  {
    id: 'tpl_ai_extractor',
    name: 'Structured Entity & Data Extractor',
    category: 'ai_powered',
    componentType: 'ai_extraction',
    description: 'Extracts validated JSON entities from unstructured text, documents, or connector feeds.',
    icon: 'FileJson',
    tags: ['ai', 'extraction', 'structured-data', 'schema'],
    sampleData: {
      title: 'Customer Feedback Entity Extraction',
      entities: {
        sentiment: 'Positive',
        urgency: 'Medium',
        account: 'Acme Corp',
        featureRequested: 'Custom widget dashboard export',
        confidenceScore: 0.94,
      },
    },
    defaultConfig: {
      appearance: {
        size: 'standard',
        colorTheme: 'default',
        customHeader: true,
        showIcon: true,
        showBorder: true,
        roundedRadius: 'md',
      },
      dataSource: { type: 'workflow_output', variablePath: 'extractor_step.output' },
      schemaConfig: {
        inputFields: [],
        outputFields: [{ id: 'entities', label: 'Extracted Schema', type: 'object', required: true }],
      },
      eventConfig: { actions: [], debounceMs: 300, preventDuplicateSubmissions: true },
    },
  },

  // --- Category D: App Connector Widgets ---
  {
    id: 'tpl_connector_action',
    name: 'App Connector Action Trigger (Slack/Teams/Gmail)',
    category: 'app_connector',
    componentType: 'connector_action',
    description: 'Executes an authorized integration action with credentials managed securely server-side.',
    icon: 'Boxes',
    tags: ['connector', 'slack', 'integration', 'action'],
    sampleData: {
      title: 'Post to Slack Channel',
      provider: 'SLACK',
      actionId: 'send_message',
      channelName: '#eng-announcements',
      messageDraft: 'Agent run #4298 completed with status SUCCESS.',
      requiresConfirmation: true,
    },
    defaultConfig: {
      appearance: {
        size: 'standard',
        colorTheme: 'default',
        customHeader: true,
        showIcon: true,
        showBorder: true,
        roundedRadius: 'md',
      },
      dataSource: {
        type: 'connector_query',
        connectorProvider: 'SLACK',
        connectorActionId: 'send_message',
      },
      schemaConfig: {
        inputFields: [
          { id: 'channel', label: 'Channel ID', type: 'string', required: true },
          { id: 'message', label: 'Message Text', type: 'string', required: true },
        ],
        outputFields: [{ id: 'result', label: 'Action Result', type: 'object' }],
      },
      eventConfig: {
        actions: [{ id: 'act_post', triggerEvent: 'on_click', targetType: 'connector_action' }],
        debounceMs: 300,
        preventDuplicateSubmissions: true,
      },
    },
  },

  // --- Category E: Productivity & Platform ---
  {
    id: 'tpl_meeting_action_items',
    name: 'Meeting Summary & Decisions Widget',
    category: 'productivity',
    componentType: 'meeting_summary',
    description: 'Surfaces recent meeting decisions, action items, and attendees directly from the platform.',
    icon: 'CalendarCheck2',
    tags: ['meetings', 'notes', 'action-items', 'collaboration'],
    sampleData: {
      title: 'Weekly Agent Architecture Sync',
      date: 'Today, 10:00 AM',
      attendees: ['Sarah K.', 'David L.', 'Alex M.'],
      decisions: [
        'Approved multi-panel Visual Widget Builder layout.',
        'Standardized all widget events on widget.* domain format.',
      ],
      actionItems: [
        { assignee: 'Alex M.', task: 'Complete Prisma database schemas & unit tests', status: 'DONE' },
        { assignee: 'David L.', task: 'Review SSRF protection on HTTP widget data source', status: 'DONE' },
      ],
    },
    defaultConfig: {
      appearance: {
        size: 'standard',
        colorTheme: 'default',
        customHeader: true,
        showIcon: true,
        showBorder: true,
        roundedRadius: 'md',
      },
      dataSource: {
        type: 'platform_service',
        platformService: 'meetings',
        autoRefresh: true,
        refreshIntervalSec: 180,
      },
      schemaConfig: {
        inputFields: [],
        outputFields: [{ id: 'actionItems', label: 'Action Items', type: 'array' }],
      },
      eventConfig: { actions: [], debounceMs: 300, preventDuplicateSubmissions: true },
    },
  },
];

@Injectable()
export class WidgetStudioService {
  private readonly logger = new Logger(WidgetStudioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly mcpRegistry: MCPToolRegistryService,
  ) {}

  /**
   * List and search widgets with comprehensive filters.
   */
  async list(workspaceId: string, userId: string, query: WidgetQueryInput): Promise<{ items: WidgetDefinition[]; total: number }> {
    const where: Record<string, unknown> = {
      workspaceId,
    };

    if (query.category) {
      where['category'] = query.category;
    }
    if (query.status) {
      where['status'] = query.status;
    } else {
      // By default exclude archived unless asked
      where['status'] = { not: 'ARCHIVED' };
    }
    if (query.visibility) {
      where['visibility'] = query.visibility;
    }
    if (query.tag) {
      where['tags'] = { has: query.tag };
    }
    if (query.search?.trim()) {
      const s = query.search.trim();
      where['OR'] = [
        { name: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { slug: { contains: s, mode: 'insensitive' } },
      ];
    }

    const orderBy: Record<string, 'asc' | 'desc'> = {};
    const sortField = query.sortBy || 'updatedAt';
    orderBy[sortField] = query.sortOrder || 'desc';

    const [rows, total] = await Promise.all([
      this.prisma.widgetDefinition.findMany({
        where,
        orderBy,
        take: query.limit || 30,
        skip: query.offset || 0,
        include: {
          creator: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.widgetDefinition.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.mapDefinition(r)),
      total,
    };
  }

  /**
   * Pre-built reusable widget templates.
   */
  getTemplates(): WidgetTemplateItem[] {
    return DEFAULT_TEMPLATES;
  }

  /**
   * Create a widget definition from visual builder or template.
   */
  async create(workspaceId: string, userId: string, input: CreateWidgetDefinitionInput): Promise<WidgetDefinition> {
    const slugBase = input.slug?.trim() || input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let slug = slugBase || `widget-${Date.now().toString(36)}`;

    // Ensure slug uniqueness within workspace
    const existing = await this.prisma.widgetDefinition.findFirst({
      where: { workspaceId, slug },
    });
    if (existing) {
      slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
    }

    const created = await this.prisma.widgetDefinition.create({
      data: {
        workspaceId,
        creatorId: userId,
        name: input.name,
        slug,
        description: input.description,
        category: input.category,
        componentType: input.componentType,
        icon: input.icon || 'LayoutDashboard',
        tags: input.tags || [],
        status: 'DRAFT',
        visibility: input.visibility || 'WORKSPACE',
        version: 1,
        appearance: (input.appearance || {}) as any,
        dataSource: (input.dataSource || {}) as any,
        schemaConfig: (input.schemaConfig || {}) as any,
        eventConfig: (input.eventConfig || {}) as any,
        permissions: (input.permissions || {}) as any,
        sampleData: (input.sampleData || {}) as any,
        isTemplate: input.isTemplate || false,
        templateCategory: input.templateCategory,
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    // Record initial version 1
    await this.prisma.widgetVersion.create({
      data: {
        widgetDefinitionId: created.id,
        versionNumber: 1,
        changeSummary: 'Initial widget creation',
        snapshotJson: this.mapDefinition(created) as any,
        isPublished: false,
        createdBy: userId,
      },
    });

    this.emitEvent('widget.created', {
      workspaceId,
      widgetId: created.id,
      userId,
      name: created.name,
    });

    return this.mapDefinition(created);
  }

  /**
   * Get single widget definition with permission check.
   */
  async get(workspaceId: string, widgetId: string, userId: string): Promise<WidgetDefinition> {
    const row = await this.prisma.widgetDefinition.findFirst({
      where: { id: widgetId, workspaceId },
      include: { creator: { select: { id: true, name: true, email: true } } },
    });
    if (!row) {
      throw new NotFoundException(`Widget ${widgetId} not found.`);
    }

    const def = this.mapDefinition(row);
    if (def.permissions.canView === 'creator_only' && row.creatorId !== userId) {
      throw new ForbiddenException('You do not have permission to view this private widget.');
    }

    return def;
  }

  /**
   * Update widget definition.
   */
  async update(
    workspaceId: string,
    widgetId: string,
    userId: string,
    input: UpdateWidgetDefinitionInput,
  ): Promise<WidgetDefinition> {
    const current = await this.get(workspaceId, widgetId, userId);

    if (current.permissions.canEdit === 'creator_only' && current.creatorId !== userId) {
      throw new ForbiddenException('Only the widget creator can modify this widget.');
    }

    const updated = await this.prisma.widgetDefinition.update({
      where: { id: widgetId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.category ? { category: input.category } : {}),
        ...(input.componentType ? { componentType: input.componentType } : {}),
        ...(input.icon ? { icon: input.icon } : {}),
        ...(input.tags ? { tags: input.tags } : {}),
        ...(input.visibility ? { visibility: input.visibility } : {}),
        ...(input.appearance ? { appearance: input.appearance as any } : {}),
        ...(input.dataSource ? { dataSource: input.dataSource as any } : {}),
        ...(input.schemaConfig ? { schemaConfig: input.schemaConfig as any } : {}),
        ...(input.eventConfig ? { eventConfig: input.eventConfig as any } : {}),
        ...(input.permissions ? { permissions: input.permissions as any } : {}),
        ...(input.sampleData ? { sampleData: input.sampleData as any } : {}),
      },
      include: { creator: { select: { id: true, name: true, email: true } } },
    });

    this.emitEvent('widget.updated', {
      workspaceId,
      widgetId,
      userId,
      changes: Object.keys(input),
    });

    return this.mapDefinition(updated);
  }

  /**
   * Duplicate an existing widget.
   */
  async duplicate(workspaceId: string, widgetId: string, userId: string): Promise<WidgetDefinition> {
    const original = await this.get(workspaceId, widgetId, userId);

    return this.create(workspaceId, userId, {
      name: `Copy of ${original.name}`,
      description: original.description,
      category: original.category,
      componentType: original.componentType,
      icon: original.icon,
      tags: [...original.tags],
      visibility: original.visibility,
      appearance: original.appearance,
      dataSource: original.dataSource,
      schemaConfig: original.schemaConfig,
      eventConfig: original.eventConfig,
      permissions: original.permissions,
      sampleData: original.sampleData,
    });
  }

  /**
   * Archive / restore widget.
   */
  async setStatus(
    workspaceId: string,
    widgetId: string,
    userId: string,
    status: 'READY' | 'DRAFT' | 'ARCHIVED',
  ): Promise<WidgetDefinition> {
    await this.get(workspaceId, widgetId, userId);

    const updated = await this.prisma.widgetDefinition.update({
      where: { id: widgetId },
      data: { status },
      include: { creator: { select: { id: true, name: true, email: true } } },
    });

    return this.mapDefinition(updated);
  }

  /**
   * Publish a widget version.
   */
  async publish(workspaceId: string, widgetId: string, userId: string, changeSummary?: string): Promise<WidgetDefinition> {
    const current = await this.get(workspaceId, widgetId, userId);

    // Validate completeness before publishing
    const validation = this.validateConfig(current);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Cannot publish widget with validation errors.',
        errors: validation.errors,
      });
    }

    const nextVersion = current.version + 1;

    // Snapshot immutable version
    await this.prisma.widgetVersion.create({
      data: {
        widgetDefinitionId: widgetId,
        versionNumber: nextVersion,
        changeSummary: changeSummary || `Published version ${nextVersion}`,
        snapshotJson: current as any,
        isPublished: true,
        createdBy: userId,
      },
    });

    const updated = await this.prisma.widgetDefinition.update({
      where: { id: widgetId },
      data: {
        status: 'PUBLISHED',
        version: nextVersion,
        publishedAt: new Date(),
      },
      include: { creator: { select: { id: true, name: true, email: true } } },
    });

    this.emitEvent('widget.published', {
      workspaceId,
      widgetId,
      userId,
      version: nextVersion,
    });

    return this.mapDefinition(updated);
  }

  /**
   * Rollback to a previous published version.
   */
  async rollback(workspaceId: string, widgetId: string, userId: string, versionNumber: number): Promise<WidgetDefinition> {
    await this.get(workspaceId, widgetId, userId);

    const versionRow = await this.prisma.widgetVersion.findUnique({
      where: {
        widgetDefinitionId_versionNumber: {
          widgetDefinitionId: widgetId,
          versionNumber,
        },
      },
    });

    if (!versionRow) {
      throw new NotFoundException(`Version ${versionNumber} not found.`);
    }

    const snapshot = versionRow.snapshotJson as unknown as WidgetDefinition;

    const restored = await this.prisma.widgetDefinition.update({
      where: { id: widgetId },
      data: {
        name: snapshot.name,
        description: snapshot.description,
        category: snapshot.category,
        componentType: snapshot.componentType,
        appearance: snapshot.appearance as any,
        dataSource: snapshot.dataSource as any,
        schemaConfig: snapshot.schemaConfig as any,
        eventConfig: snapshot.eventConfig as any,
        permissions: snapshot.permissions as any,
        sampleData: snapshot.sampleData as any,
      },
      include: { creator: { select: { id: true, name: true, email: true } } },
    });

    this.emitEvent('widget.version_rollback', {
      workspaceId,
      widgetId,
      userId,
      targetVersion: versionNumber,
    });

    return this.mapDefinition(restored);
  }

  /**
   * Validate widget configuration.
   */
  validateConfig(def: Partial<WidgetDefinition>): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!def.name?.trim()) errors.push('Widget name is required.');
    if (!def.category) errors.push('Widget category must be specified.');
    if (!def.componentType) errors.push('Widget component type must be specified.');

    const ds = def.dataSource;
    if (ds) {
      if (ds.type === 'api_rest' && !ds.apiUrl?.trim()) {
        errors.push('REST API data source requires a valid URL.');
      }
      if (ds.type === 'connector_query' && (!ds.connectorProvider || !ds.connectorActionId)) {
        errors.push('App Connector data source requires provider and action ID.');
      }
      if (ds.type === 'workflow_output' && !ds.variablePath?.trim()) {
        warnings.push('Workflow output path is unset; widget will default to last step output.');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Preview a widget with sample or resolved data.
   */
  async preview(
    workspaceId: string,
    widgetId: string,
    userId: string,
    dataOverride?: Record<string, unknown>,
  ): Promise<{ definition: WidgetDefinition; previewData: Record<string, unknown> }> {
    const def = await this.get(workspaceId, widgetId, userId);

    if (dataOverride && Object.keys(dataOverride).length > 0) {
      return { definition: def, previewData: dataOverride };
    }

    // If widget has sample data, return it
    if (def.sampleData && Object.keys(def.sampleData).length > 0) {
      return { definition: def, previewData: def.sampleData };
    }

    // Otherwise find matching template default sample data
    const tpl = DEFAULT_TEMPLATES.find((t) => t.componentType === def.componentType);
    return {
      definition: def,
      previewData: tpl?.sampleData || { title: def.name, status: 'Ready' },
    };
  }

  /**
   * Execute widget operation (Data Fetch, Action Trigger, or Tool Call).
   * Enforces SSRF guard, credential isolation, and permission checks.
   */
  async execute(
    workspaceId: string,
    widgetId: string,
    userId: string,
    input: ExecuteWidgetInput,
  ): Promise<{ status: 'SUCCESS' | 'FAILED'; output: unknown; latencyMs: number }> {
    const startTime = Date.now();
    const def = await this.get(workspaceId, widgetId, userId);

    if (def.permissions.canExecute === 'admins_only') {
      const member = await this.prisma.workspaceMember.findFirst({
        where: { workspaceId, userId },
      });
      if (!member || (member.role !== 'ADMIN' && member.role !== 'OWNER')) {
        throw new ForbiddenException('Only workspace administrators may execute this widget.');
      }
    }

    let output: unknown = null;
    let errorMessage: string | undefined;

    try {
      if (input.executionType === 'DATA_FETCH' || input.executionType === 'RENDER') {
        output = await this.fetchWidgetData(workspaceId, userId, def, input);
      } else if (input.executionType === 'ACTION' || input.executionType === 'TOOL_CALL') {
        output = await this.executeWidgetAction(workspaceId, userId, def, input);
      } else {
        output = def.sampleData || {};
      }

      const latencyMs = Date.now() - startTime;

      // Update usage count
      await this.prisma.widgetDefinition.update({
        where: { id: widgetId },
        data: { usageCount: { increment: 1 } },
      });

      // Record execution
      await this.prisma.widgetExecution.create({
        data: {
          workspaceId,
          widgetDefinitionId: widgetId,
          widgetInstanceId: input.instanceId,
          executionType: input.executionType,
          status: 'SUCCESS',
          inputPayload: input.inputPayload as any,
          outputPayload: (typeof output === 'object' && output !== null ? output : { result: output }) as any,
          latencyMs,
          initiatedBy: userId,
        },
      });

      this.emitEvent('widget.execution.completed', {
        workspaceId,
        widgetId,
        latencyMs,
        executionType: input.executionType,
      });

      return { status: 'SUCCESS', output, latencyMs };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      errorMessage = err?.message || String(err);
      this.logger.error(`Widget ${widgetId} execution failed: ${errorMessage}`);

      await this.prisma.widgetExecution.create({
        data: {
          workspaceId,
          widgetDefinitionId: widgetId,
          widgetInstanceId: input.instanceId,
          executionType: input.executionType,
          status: 'FAILED',
          inputPayload: input.inputPayload as any,
          errorMessage,
          latencyMs,
          initiatedBy: userId,
        },
      });

      this.emitEvent('widget.execution.failed', {
        workspaceId,
        widgetId,
        error: errorMessage,
      });

      throw new BadRequestException(`Widget execution failed: ${errorMessage}`);
    }
  }

  /**
   * Internal data fetch implementation with SSRF guard.
   */
  private async fetchWidgetData(
    workspaceId: string,
    userId: string,
    def: WidgetDefinition,
    input: ExecuteWidgetInput,
  ): Promise<unknown> {
    const ds = def.dataSource;

    if (ds.type === 'static_sample') {
      return def.sampleData || {};
    }

    if (ds.type === 'api_rest' && ds.apiUrl) {
      // Safe SSRF-protected fetch
      const res = await safeFetch(ds.apiUrl, {
        method: ds.apiMethod || 'GET',
        headers: ds.apiHeaders || {},
        body: ds.apiBody ? JSON.stringify(ds.apiBody) : undefined,
        maxBytes: 100_000,
      });
      if (!res.ok) {
        throw new Error(`API fetch returned HTTP ${res.status}`);
      }
      return res.json();
    }

    if (ds.type === 'platform_service') {
      switch (ds.platformService) {
        case 'tasks': {
          const tasks = await this.prisma.task.findMany({
            where: { workspaceId },
            take: 20,
            orderBy: { updatedAt: 'desc' },
            select: { id: true, identifier: true, title: true, status: true, priority: true },
          });
          return { rows: tasks };
        }
        case 'projects': {
          const projects = await this.prisma.project.findMany({
            where: { workspaceId },
            take: 10,
            orderBy: { updatedAt: 'desc' },
            select: { id: true, name: true, key: true, status: true },
          });
          return { rows: projects };
        }
        case 'meetings': {
          const meetings = await this.prisma.meeting.findMany({
            where: { workspaceId },
            take: 5,
            orderBy: { startTime: 'desc' },
            select: { id: true, title: true, startTime: true, endTime: true },
          });
          return { rows: meetings };
        }
        default:
          return def.sampleData || {};
      }
    }

    if (ds.type === 'connector_query' && ds.connectorProvider && ds.connectorActionId) {
      const toolName = `${ds.connectorProvider.toLowerCase()}_${ds.connectorActionId}`;
      return this.mcpRegistry.executeTool(
        toolName,
        { ...(ds.connectorParams || {}), ...(input.overrideParams || {}) },
        { workspaceId, actingUserId: userId },
      );
    }

    return def.sampleData || {};
  }

  /**
   * Internal action trigger execution.
   */
  private async executeWidgetAction(
    workspaceId: string,
    userId: string,
    def: WidgetDefinition,
    input: ExecuteWidgetInput,
  ): Promise<unknown> {
    const action = def.eventConfig?.actions?.find((a) => a.id === input.actionId) || def.eventConfig?.actions?.[0];
    if (!action) {
      // Default fallback: return payload received
      return { received: input.inputPayload, message: 'Action executed successfully.' };
    }

    if (action.targetType === 'connector_action') {
      const ds = def.dataSource;
      if (ds.connectorProvider && ds.connectorActionId) {
        const toolName = `${ds.connectorProvider.toLowerCase()}_${ds.connectorActionId}`;
        return this.mcpRegistry.executeTool(toolName, input.inputPayload, {
          workspaceId,
          actingUserId: userId,
        });
      }
    }

    return {
      actionId: action.id,
      targetType: action.targetType,
      payload: input.inputPayload,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * List versions of a widget.
   */
  async getVersions(workspaceId: string, widgetId: string, userId: string): Promise<WidgetVersion[]> {
    await this.get(workspaceId, widgetId, userId);

    const rows = await this.prisma.widgetVersion.findMany({
      where: { widgetDefinitionId: widgetId },
      orderBy: { versionNumber: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      widgetDefinitionId: r.widgetDefinitionId,
      versionNumber: r.versionNumber,
      changeSummary: r.changeSummary || undefined,
      snapshotJson: r.snapshotJson as any,
      isPublished: r.isPublished,
      createdAt: r.createdAt.toISOString(),
      createdBy: r.createdBy || undefined,
    }));
  }

  /**
   * List execution history for a widget.
   */
  async getExecutions(workspaceId: string, widgetId: string, userId: string): Promise<WidgetExecutionRecord[]> {
    await this.get(workspaceId, widgetId, userId);

    const rows = await this.prisma.widgetExecution.findMany({
      where: { widgetDefinitionId: widgetId, workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      widgetDefinitionId: r.widgetDefinitionId,
      widgetInstanceId: r.widgetInstanceId || undefined,
      executionType: r.executionType as any,
      status: r.status as any,
      inputPayload: r.inputPayload as any,
      outputPayload: r.outputPayload as any,
      latencyMs: r.latencyMs,
      errorMessage: r.errorMessage || undefined,
      errorJson: r.errorJson as any,
      initiatedBy: r.initiatedBy || undefined,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * Helper to emit normalized events.
   */
  private emitEvent(eventName: string, payload: Record<string, unknown>) {
    try {
      this.events.emit(eventName, {
        ...payload,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      this.logger.warn(`Failed to emit ${eventName}: ${String(e)}`);
    }
  }

  /**
   * Maps Prisma database entity to WidgetDefinition.
   */
  private mapDefinition(row: any): WidgetDefinition {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      creatorId: row.creatorId || '',
      creatorName: row.creator?.name || row.creator?.email || undefined,
      name: row.name,
      slug: row.slug,
      description: row.description || undefined,
      category: row.category as WidgetCategory,
      componentType: row.componentType as WidgetComponentType,
      icon: row.icon || 'LayoutDashboard',
      tags: row.tags || [],
      status: row.status as any,
      visibility: row.visibility as any,
      version: row.version,
      appearance: (row.appearance || {}) as any,
      dataSource: (row.dataSource || {}) as any,
      schemaConfig: (row.schemaConfig || {}) as any,
      eventConfig: (row.eventConfig || {}) as any,
      permissions: (row.permissions || {}) as any,
      sampleData: (row.sampleData || {}) as any,
      isTemplate: row.isTemplate || false,
      templateCategory: row.templateCategory || undefined,
      usageCount: row.usageCount || 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      publishedAt: row.publishedAt?.toISOString(),
    };
  }
}
