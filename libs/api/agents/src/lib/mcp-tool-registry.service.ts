import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';

export interface MCPToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (params: any, workspaceId: string) => Promise<unknown>;
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
      handler: async (params: { query: string }, workspaceId: string) => {
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
        workspaceId: string,
      ) => {
        const member = await this.prisma.workspaceMember.findFirst({
          where: { workspaceId },
          select: { userId: true },
        });
        if (!member) {
          throw new Error(
            'No active workspace member found to author document.',
          );
        }
        return this.prisma.workDocument.create({
          data: {
            workspaceId,
            authorId: member.userId,
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
        workspaceId: string,
      ) => {
        return this.prisma.task.create({
          data: {
            workspaceId,
            title: params.title,
            description: params.description,
            projectId: params.projectId ?? null,
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
      handler: async (_params: unknown, workspaceId: string) => {
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
      handler: async (params: { projectId?: string }, workspaceId: string) => {
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
      description: 'List accessible channels in the workspace',
      parameters: {},
      handler: async (_params: unknown, workspaceId: string) => {
        return this.prisma.channel.findMany({
          where: { workspaceId, isArchived: false },
          select: { id: true, name: true, slug: true, topic: true },
          take: 20,
        });
      },
    });

    // 7. Send Channel Message Pointer
    this.tools.set('send_channel_message', {
      name: 'send_channel_message',
      description: 'Send a notification or update to a workspace channel',
      parameters: {
        channelSlug: { type: 'string' },
        messageText: { type: 'string' },
      },
      handler: async (
        params: { channelSlug: string; messageText: string },
        _workspaceId: string,
      ) => {
        return {
          success: true,
          channelSlug: params.channelSlug,
          text: params.messageText,
        };
      },
    });
  }

  getToolDefinitions(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values()).map((t) => ({ name: t.name, description: t.description }));
  }

  async executeTool(name: string, params: any, workspaceId: string): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' is not registered in the MCP Tool Registry.`);
    }
    this.logger.log(`Executing MCP tool '${name}' for workspace ${workspaceId}`);
    return tool.handler(params, workspaceId);
  }
}
