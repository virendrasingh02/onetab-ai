import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IntegrationsService } from '@org/api-integrations';
import { MatrixAdminService, MatrixBotMessagingService } from '@org/api-matrix';
import { WorkToolsService } from '@org/api-work-tools';
import { PrismaService } from '@org/database';
import { PLATFORM_TOOLS, type PlatformToolInfo } from '@org/types';
import { FirecrawlService } from './firecrawl.service.js';
import { buildPlatformTools } from './platform-tools.js';

/**
 * Everything a tool handler is allowed to know about who is calling it.
 *
 * `actingUserId` is the agent's creator (resolved in `AgentsService`), not a
 * free-floating "first member of the workspace". Writes are attributed to a
 * real person so an agent cannot author a document as an arbitrary user
 * (audit B9), and reads can be narrowed to what that person may see.
 */
export interface MCPToolContext {
  workspaceId: string;
  /** Null when the agent has no creator on record — write tools then refuse. */
  actingUserId: string | null;
  /**
   * The agent's own provisioned Matrix identity, for tools that speak in chat
   * as the bot. Null until the agent has been messaged at least once — those
   * tools then refuse rather than posting as nobody.
   */
  agentMatrixUserId?: string | null;
  /** The zone "today" means for date-ranged tools; the owner's profile zone when absent. */
  timezone?: string | null;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Parameters the model may leave out; every other one is required. */
  optional?: string[];
  handler: (params: any, ctx: MCPToolContext) => Promise<unknown>;
}

/** A built-in tool as the tool picker and the Studio describe it. */
export interface MCPToolDescriptor {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  optional?: string[];
  /** Studio metadata (label, scope, progress text) — absent for tools the Studio does not describe. */
  meta?: PlatformToolInfo;
}

const MEMORY_SCOPES = ['workspace', 'user', 'agent', 'project', 'conversation', 'task'] as const;

/** A known memory scope, or undefined (unknown names are ignored, not stored in keys). */
function memoryScope(raw: unknown): string | undefined {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return (MEMORY_SCOPES as readonly string[]).includes(s) ? s : undefined;
}

/** Scoped keys are `[scope] key` / `[scope:id] key`; unprefixed keys are workspace-wide. */
function memoryScopeWhere(scope: string): Record<string, unknown> {
  const prefixed = [{ key: { startsWith: `[${scope}]` } }, { key: { startsWith: `[${scope}:` } }];
  return { OR: scope === 'workspace' ? [...prefixed, { NOT: { key: { startsWith: '[' } } }] : prefixed };
}

function clampLimit(raw: unknown, fallback: number, max: number): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : fallback;
  return Math.min(Math.max(n, 1), max);
}

@Injectable()
export class MCPToolRegistryService {
  private readonly logger = new Logger(MCPToolRegistryService.name);
  private tools = new Map<string, MCPToolDefinition>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly matrixAdmin: MatrixAdminService,
    private readonly botMessaging: MatrixBotMessagingService,
    private readonly firecrawl: FirecrawlService,
    @Optional() private readonly integrations?: IntegrationsService,
    @Optional() private readonly events?: EventEmitter2,
    @Optional() private readonly workTools?: WorkToolsService,
  ) {
    this.registerBuiltInTools();
    this.registerPlatformTools();
  }

  /**
   * Tasks, meetings, activity, project health, docs, email and notifications
   * (`platform-tools.ts`). Registered after the originals, so the platform
   * versions of `search_docs` and `create_task` — which respect doc
   * visibility and create tasks through `WorkToolsService` (identifiers,
   * events, notifications) — replace them.
   */
  private registerPlatformTools(): void {
    const workTools = this.workTools;
    for (const tool of buildPlatformTools({
      prisma: this.prisma,
      integrations: this.integrations,
      events: this.events,
      ...(workTools
        ? {
            createTask: (workspaceId, input, actorId) =>
              workTools.createTask(workspaceId, input as never, actorId) as never,
            updateTask: (workspaceId, taskId, input, actorId) =>
              workTools.updateTask(workspaceId, taskId, input as never, actorId) as never,
            createDocument: (workspaceId, authorId, input) =>
              workTools.createDocument(workspaceId, authorId, input as never),
          }
        : {}),
    })) {
      this.tools.set(tool.name, tool);
    }
  }

  private registerBuiltInTools(): void {
    // 1. Search Documents
    this.tools.set('search_docs', {
      name: 'search_docs',
      description: 'Search workspace documents and knowledge base',
      parameters: { query: { type: 'string' } },
      handler: async (params: { query: string }, { workspaceId }) => {
        return this.prisma.workDocument.findMany({
          where: {
            workspaceId,
            deletedAt: null,
            OR: [
              { title: { contains: params.query, mode: 'insensitive' } },
              { content: { contains: params.query, mode: 'insensitive' } },
            ],
          },
          take: 5,
        });
      },
    });

    // 2. Create Document
    this.tools.set('create_doc', {
      name: 'create_doc',
      description: 'Create a new document, note or specification',
      parameters: { title: { type: 'string' }, content: { type: 'string' } },
      handler: async (
        params: { title: string; content?: string },
        { workspaceId, actingUserId },
      ) => {
        const authorId = await this.assertWorkspaceMember(
          workspaceId,
          actingUserId,
        );
        return this.prisma.workDocument.create({
          data: {
            workspaceId,
            authorId,
            title: params.title,
            content: params.content ?? '',
            kind: 'DOC',
          },
        });
      },
    });

    // 3. Create Task
    this.tools.set('create_task', {
      name: 'create_task',
      description: 'Create a new agile task on the workspace Kanban board',
      parameters: {
        title: { type: 'string' },
        description: { type: 'string' },
        projectId: { type: 'string' },
      },
      handler: async (
        params: { title: string; description?: string; projectId?: string },
        { workspaceId, actingUserId },
      ) => {
        const reporterId = await this.assertWorkspaceMember(
          workspaceId,
          actingUserId,
        );
        // A projectId the model invented could point into another workspace.
        if (params.projectId) {
          const project = await this.prisma.project.findFirst({
            where: { id: params.projectId, workspaceId, deletedAt: null },
            select: { id: true },
          });
          if (!project) {
            throw new Error(
              `Project '${params.projectId}' does not exist in this workspace.`,
            );
          }
        }
        return this.prisma.task.create({
          data: {
            workspaceId,
            title: params.title,
            description: params.description,
            projectId: params.projectId ?? null,
            reporterId,
            status: 'TODO',
            priority: 'MEDIUM',
          },
        });
      },
    });

    // 4. List Projects
    this.tools.set('list_projects', {
      name: 'list_projects',
      description: 'List active projects and roadmap initiatives in the workspace',
      parameters: {},
      handler: async (_params: unknown, { workspaceId }) => {
        return this.prisma.project.findMany({
          where: { workspaceId, deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            description: true,
          },
          take: 10,
        });
      },
    });

    // 5. List Tasks
    this.tools.set('list_tasks', {
      name: 'list_tasks',
      description: 'List tasks in the workspace or under a project',
      parameters: { projectId: { type: 'string' } },
      handler: async (params: { projectId?: string }, { workspaceId }) => {
        return this.prisma.task.findMany({
          where: {
            workspaceId,
            deletedAt: null,
            ...(params.projectId ? { projectId: params.projectId } : {}),
          },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
          },
          take: 20,
        });
      },
    });

    // 6. List Channels
    this.tools.set('list_channels', {
      name: 'list_channels',
      description: 'List public channels in the workspace',
      parameters: {},
      handler: async (_params: unknown, { workspaceId, actingUserId }) => {
        // An agent is not a channel member. It sees public channels plus any
        // private channel its acting user belongs to — never the full list
        // (audit S4).
        return this.prisma.channel.findMany({
          where: {
            workspaceId,
            isArchived: false,
            OR: [
              { visibility: 'PUBLIC' },
              ...(actingUserId
                ? [{ members: { some: { userId: actingUserId } } }]
                : []),
            ],
          },
          select: { id: true, name: true, slug: true, topic: true },
          take: 20,
        });
      },
    });

    // 7. Send Channel Message
    this.tools.set('send_channel_message', {
      name: 'send_channel_message',
      description:
        'Post a plain-text message to a workspace channel as this agent',
      parameters: {
        channelSlug: { type: 'string' },
        messageText: { type: 'string' },
      },
      handler: async (
        params: { channelSlug?: string; messageText?: string },
        { workspaceId, actingUserId, agentMatrixUserId },
      ) => {
        const slug = params.channelSlug?.trim();
        const text = params.messageText?.trim();
        if (!slug || !text) {
          throw new Error('channelSlug and messageText are both required.');
        }
        if (!agentMatrixUserId) {
          throw new Error(
            'This agent has no chat identity yet — message it directly once so it gets provisioned, then retry.',
          );
        }
        // Attributed to a real person, like every other write tool.
        await this.assertWorkspaceMember(workspaceId, actingUserId);

        // The agent may only post to a channel its acting user belongs to —
        // stricter than `list_channels`, which also surfaces public channels.
        const channel = await this.prisma.channel.findFirst({
          where: {
            workspaceId,
            slug,
            isArchived: false,
            members: { some: { userId: actingUserId as string } },
          },
          select: { id: true, name: true, matrixRoomId: true },
        });
        if (!channel) {
          throw new Error(
            `Channel '${slug}' does not exist or the agent's user is not a member of it.`,
          );
        }
        if (!channel.matrixRoomId) {
          throw new Error(
            `Channel '${slug}' is not linked to a chat room yet.`,
          );
        }

        // A bot must be a joined member to post; joining is idempotent.
        await this.matrixAdmin.joinRoomAs(
          agentMatrixUserId,
          channel.matrixRoomId,
        );
        const eventId = await this.botMessaging.sendText(
          channel.matrixRoomId,
          agentMatrixUserId,
          text,
        );

        return { delivered: true, channel: channel.name, eventId };
      },
    });

    // 8. Save Memory
    this.tools.set('save_memory', {
      name: 'save_memory',
      description:
        'Remember a useful fact for this workspace so future conversations (with any agent or coworker) can recall it — e.g. a preference, a decision, a recurring detail, or learned procedure. Overwrites any existing memory with the same key.',
      parameters: {
        key: { type: 'string', description: 'Unique identifier or subject for the fact' },
        value: { type: 'string', description: 'The fact or procedure to remember' },
        scope: { type: 'string', description: `Optional scope: ${MEMORY_SCOPES.join(', ')} (default workspace)` },
      },
      optional: ['scope'],
      handler: async (params: { key?: string; value?: string; scope?: string }, { workspaceId }) => {
        let key = params.key?.trim();
        const value = params.value?.trim();
        if (!key || !value) {
          throw new Error('key and value are both required.');
        }
        const scope = memoryScope(params.scope);
        if (scope && scope !== 'workspace' && !key.startsWith('[')) {
          key = `[${scope}] ${key}`;
        }
        await this.prisma.aIMemory.upsert({
          where: { workspaceId_key: { workspaceId, key } },
          create: { workspaceId, key, value, source: 'agent' },
          update: { value, source: 'agent' },
        });
        return { saved: true, key };
      },
    });

    // 9. List Memory
    this.tools.set('list_memory', {
      name: 'list_memory',
      description: 'List facts previously saved to workspace memory via save_memory.',
      parameters: {
        scope: { type: 'string', description: `Optional scope filter: ${MEMORY_SCOPES.join(', ')}` },
        limit: { type: 'number', description: 'Maximum number of items to return (default 50, max 100)' },
      },
      optional: ['scope', 'limit'],
      handler: async (params: { scope?: string; limit?: number } | undefined, { workspaceId }) => {
        const scope = memoryScope(params?.scope);
        return this.prisma.aIMemory.findMany({
          where: { workspaceId, ...(scope ? memoryScopeWhere(scope) : {}) },
          select: { key: true, value: true, updatedAt: true, source: true },
          orderBy: { updatedAt: 'desc' },
          take: clampLimit(params?.limit, 50, 100),
        });
      },
    });

    // 9b. Search Memory
    this.tools.set('search_memory', {
      name: 'search_memory',
      description: 'Search previously saved facts, preferences, decisions, and procedures in workspace memory by keyword.',
      parameters: {
        query: { type: 'string', description: 'The keyword or phrase to look for in keys and values' },
        scope: { type: 'string', description: `Optional scope filter: ${MEMORY_SCOPES.join(', ')}` },
        limit: { type: 'number', description: 'Maximum number of results to return (default 10, max 50)' },
      },
      optional: ['scope', 'limit'],
      handler: async (params: { query?: string; scope?: string; limit?: number }, { workspaceId }) => {
        const q = params?.query?.trim();
        if (!q) throw new Error('query is required.');
        const scope = memoryScope(params?.scope);
        return this.prisma.aIMemory.findMany({
          where: {
            workspaceId,
            AND: [
              { OR: [{ key: { contains: q, mode: 'insensitive' } }, { value: { contains: q, mode: 'insensitive' } }] },
              ...(scope ? [memoryScopeWhere(scope)] : []),
            ],
          },
          select: { key: true, value: true, updatedAt: true, source: true },
          orderBy: { updatedAt: 'desc' },
          take: clampLimit(params?.limit, 10, 50),
        });
      },
    });

    // 9c. Forget Memory
    this.tools.set('forget_memory', {
      name: 'forget_memory',
      description: 'Forget a specific fact from workspace memory by its exact key (as returned by list_memory/search_memory).',
      parameters: {
        key: { type: 'string', description: 'The exact key of the memory fact to remove' },
      },
      handler: async (params: { key?: string }, { workspaceId }) => {
        const key = params?.key?.trim();
        if (!key) throw new Error('key is required.');
        const res = await this.prisma.aIMemory.deleteMany({
          where: { workspaceId, key },
        });
        if (res.count === 0) throw new Error(`No memory is saved under '${key}'.`);
        return { forgotten: true, key };
      },
    });

    // 10. Firecrawl Search
    this.tools.set('firecrawl_search', {
      name: 'firecrawl_search',
      description: 'Search the web using Firecrawl and return markdown content with URLs and citations',
      parameters: {
        query: { type: 'string', description: 'The search query' },
        limit: { type: 'number', description: 'Maximum number of results (default 5)' },
      },
      handler: async (params: { query: string; limit?: number }, { workspaceId }) => {
        if (!params.query) throw new Error('Search query is required');
        return this.firecrawl.search(params.query, { limit: params.limit ?? 5 }, workspaceId);
      },
    });

    // 11. Firecrawl Scrape
    this.tools.set('firecrawl_scrape', {
      name: 'firecrawl_scrape',
      description: 'Scrape and clean a webpage into markdown using Firecrawl',
      parameters: {
        url: { type: 'string', description: 'Web page URL to scrape' },
      },
      handler: async (params: { url: string }, { workspaceId }) => {
        if (!params.url) throw new Error('URL is required for scrape');
        return this.firecrawl.scrape(params.url, workspaceId);
      },
    });

    // 12. Firecrawl Crawl
    this.tools.set('firecrawl_crawl', {
      name: 'firecrawl_crawl',
      description: 'Crawl an entire website or docs site up to a depth/page limit using Firecrawl',
      parameters: {
        url: { type: 'string', description: 'Root URL to crawl' },
        limit: { type: 'number', description: 'Maximum pages to crawl (default 5)' },
      },
      handler: async (params: { url: string; limit?: number }, { workspaceId }) => {
        if (!params.url) throw new Error('Root URL is required for crawl');
        return this.firecrawl.crawl(params.url, params.limit ?? 5, workspaceId);
      },
    });

    // 13. Firecrawl Extract
    this.tools.set('firecrawl_extract', {
      name: 'firecrawl_extract',
      description: 'Extract structured information and schema entities from a webpage using Firecrawl',
      parameters: {
        url: { type: 'string', description: 'Target URL to extract data from' },
        prompt: { type: 'string', description: 'Extraction objective or prompt' },
      },
      handler: async (params: { url: string; prompt: string; schema?: Record<string, unknown> }, { workspaceId }) => {
        if (!params.url) throw new Error('URL is required for extract');
        return this.firecrawl.extract(params.url, params.prompt || 'Extract key facts and entities', params.schema, workspaceId);
      },
    });
  }

  /**
   * Name, description and parameters of every built-in tool — what the
   * builder's tool picker, the tester and the Studio's tool catalog show —
   * with the Studio's label, scope and progress text where it has them.
   */
  getToolDefinitions(): MCPToolDescriptor[] {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      ...(t.optional?.length ? { optional: t.optional } : {}),
      ...(PLATFORM_TOOLS[t.name] ? { meta: PLATFORM_TOOLS[t.name] } : {}),
    }));
  }

  /**
   * The registered tools as OpenAI-style function schemas, for a provider
   * chat call's `tools` option (`ChatExecutionOptions.tools`). A parameter is
   * required unless the tool lists it in `optional`.
   */
  getToolSchemas(): Array<Record<string, unknown>> {
    return this.getToolSchemasFor();
  }

  /**
   * The same OpenAI-style function schemas as {@link getToolSchemas}, optionally
   * narrowed to a subset of tool names — the seam `CoworkerRuntimeService`
   * (`@org/api-coworkers`) uses to offer a Coworker only the tools its
   * `permissions.allowActions` grants, without this registry knowing anything
   * about Coworkers. Omitting `names` (every existing caller) keeps today's
   * "every registered tool" behaviour.
   */
  getToolSchemasFor(names?: string[]): Array<Record<string, unknown>> {
    const tools = names
      ? names.flatMap((name) => {
          const tool = this.tools.get(name);
          return tool ? [tool] : [];
        })
      : Array.from(this.tools.values());

    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters,
          required: Object.keys(tool.parameters).filter((key) => !tool.optional?.includes(key)),
        },
      },
    }));
  }

  async executeTool(
    name: string,
    params: any,
    ctx: MCPToolContext,
  ): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' is not registered in the MCP Tool Registry.`);
    }
    this.logger.log(
      `Executing MCP tool '${name}' for workspace ${ctx.workspaceId} (acting user ${ctx.actingUserId})`,
    );
    return tool.handler(params, ctx);
  }

  private async assertWorkspaceMember(
    workspaceId: string,
    userId: string | null,
  ): Promise<string> {
    if (!userId) {
      throw new Error(
        'This tool writes data and needs an acting user, but the agent has no creator on record.',
      );
    }
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!member) {
      throw new Error(
        'The acting user is not an active member of this workspace.',
      );
    }
    return userId;
  }
}
