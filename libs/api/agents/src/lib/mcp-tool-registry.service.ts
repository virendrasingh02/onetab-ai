import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';

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
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (params: any, ctx: MCPToolContext) => Promise<unknown>;
}

@Injectable()
export class MCPToolRegistryService {
  private readonly logger = new Logger(MCPToolRegistryService.name);
  private tools = new Map<string, MCPToolDefinition>();

  constructor(private readonly prisma: PrismaService) {
    this.registerBuiltInTools();
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
            where: { id: params.projectId, workspaceId },
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
          where: { workspaceId },
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
      description: 'Send a notification or update to a workspace channel',
      parameters: {
        channelSlug: { type: 'string' },
        messageText: { type: 'string' },
      },
      handler: async () => {
        // This used to return `{ success: true, ... }` without touching Matrix
        // or the database — a fabricated success the agent trace then recorded
        // as a real send. It fails honestly until the Matrix bot path is wired
        // up (tracked as Tier 3: real agent actions).
        throw new Error(
          'send_channel_message is not implemented yet — no message was sent.',
        );
      },
    });
  }

  getToolDefinitions(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values()).map((t) => ({ name: t.name, description: t.description }));
  }

  /**
   * The registered tools as OpenAI-style function schemas, for a provider
   * chat call's `tools` option (`ChatExecutionOptions.tools`).
   *
   * Every declared parameter is treated as required — none of the built-in
   * tools currently have an optional parameter that isn't already handled by
   * the handler defaulting it, so this stays a straightforward wrap rather
   * than needing a richer per-parameter schema on `MCPToolDefinition`.
   */
  getToolSchemas(): Array<Record<string, unknown>> {
    return Array.from(this.tools.values()).map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters,
          required: Object.keys(tool.parameters),
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
