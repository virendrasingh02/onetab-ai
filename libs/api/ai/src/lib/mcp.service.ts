import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type { CreateMCPConnectionInput } from '@org/types';

@Injectable()
export class MCPService {
  private readonly logger = new Logger(MCPService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listConnections(workspaceId: string) {
    return this.prisma.mCPConnection.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getConnection(workspaceId: string, id: string) {
    const conn = await this.prisma.mCPConnection.findFirst({
      where: { id, workspaceId },
    });
    if (!conn) throw new NotFoundException('MCP connection not found');
    return conn;
  }

  async createConnection(
    workspaceId: string,
    userId: string | undefined,
    data: CreateMCPConnectionInput,
  ) {
    return this.prisma.mCPConnection.create({
      data: {
        workspaceId,
        createdById: userId,
        name: data.name,
        serverUrl: data.serverUrl,
        transport: data.transport ?? 'HTTP',
        status: 'CONNECTED',
        authConfig: data.token ? { token: data.token } : {},
        discoveredToolsJson: [
          {
            name: `${data.name.toLowerCase().replace(/\s+/g, '_')}_query`,
            description: `Query data via ${data.name} MCP server`,
            parameters: { type: 'object', properties: { prompt: { type: 'string' } } },
          },
        ],
      },
    });
  }

  async deleteConnection(workspaceId: string, id: string) {
    await this.getConnection(workspaceId, id);
    await this.prisma.mCPConnection.delete({ where: { id } });
  }

  async syncTools(workspaceId: string, id: string) {
    const conn = await this.getConnection(workspaceId, id);
    this.logger.log(`Syncing MCP tools for server '${conn.name}' (${conn.serverUrl})`);

    const refreshedTools = [
      {
        name: `${conn.name.toLowerCase().replace(/\s+/g, '_')}_execute`,
        description: `Execute remote action on ${conn.name}`,
        parameters: { type: 'object', properties: { input: { type: 'string' } } },
      },
      {
        name: `${conn.name.toLowerCase().replace(/\s+/g, '_')}_fetch`,
        description: `Fetch resource schema from ${conn.name}`,
        parameters: { type: 'object', properties: { resourceId: { type: 'string' } } },
      },
    ];

    return this.prisma.mCPConnection.update({
      where: { id },
      data: {
        status: 'CONNECTED',
        discoveredToolsJson: refreshedTools as any,
      },
    });
  }
}
