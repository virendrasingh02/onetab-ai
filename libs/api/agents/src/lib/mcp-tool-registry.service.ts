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
          where: { workspaceId, title: { contains: params.query, mode: 'insensitive' } },
          take: 5,
        });
      },
    });

    // 2. Create Task
    this.tools.set('create_task', {
      name: 'create_task',
      description: 'Create a new agile task on the workspace Kanban board',
      parameters: { title: { type: 'string' }, description: { type: 'string' } },
      handler: async (params: { title: string; description?: string }, workspaceId: string) => {
        return this.prisma.task.create({
          data: { workspaceId, title: params.title, description: params.description },
        });
      },
    });

    // 3. Send Channel Message Pointer
    this.tools.set('send_channel_message', {
      name: 'send_channel_message',
      description: 'Send a notification or update to a workspace channel',
      parameters: { channelSlug: { type: 'string' }, messageText: { type: 'string' } },
      handler: async (params: { channelSlug: string; messageText: string }, _workspaceId: string) => {
        return { success: true, channelSlug: params.channelSlug, text: params.messageText };
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
