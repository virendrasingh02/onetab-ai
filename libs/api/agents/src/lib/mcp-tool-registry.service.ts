import { Injectable, Logger } from '@nestjs/common';
import { MatrixAdminService, MatrixBotMessagingService } from '@org/api-matrix';
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
  /**
   * The agent's own provisioned Matrix identity, for tools that speak in chat
   * as the bot. Null until the agent has been messaged at least once — those
   * tools then refuse rather than posting as nobody.
   */
  agentMatrixUserId?: string | null;
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly matrixAdmin: MatrixAdminService,
    private readonly botMessaging: MatrixBotMessagingService,
  ) {
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
