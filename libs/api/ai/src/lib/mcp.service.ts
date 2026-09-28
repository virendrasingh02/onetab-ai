import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertPublicHttpUrl, UnsafeUrlError } from '@org/api-common';
import { PrismaService } from '@org/database';
import type { CreateMCPConnectionInput } from '@org/types';
import { AIEncryptionService } from './ai-encryption.service.js';
import {
  callMCPTool,
  discoverMCPTools,
  mcpToolNeedsApproval,
  type MCPCallResult,
  type MCPEndpoint,
  type MCPToolDescriptor,
} from './mcp-client.js';

/** What the API returns for a connection — never the token. */
export interface MCPConnectionView {
  id: string;
  workspaceId: string;
  name: string;
  serverUrl: string;
  transport: string;
  status: string;
  isEnabled: boolean;
  hasToken: boolean;
  maskedToken: string | null;
  discoveredToolsJson: MCPToolDescriptor[];
  lastError: string | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A tool an agent may call, bound to the connection that serves it. The
 * function name is what the model sees: OpenAI-style tool names allow
 * `[a-zA-Z0-9_-]{1,64}`, so it is derived, and mapped back on call.
 */
export interface MCPToolBinding {
  functionName: string;
  connectionId: string;
  connectionName: string;
  toolName: string;
  requiresApproval: boolean;
  schema: Record<string, unknown>;
}

interface StoredAuth {
  encryptedToken?: string;
  maskedToken?: string;
  /** Rows written before tokens were encrypted. Migrated on first use. */
  token?: string;
}

type ConnectionRow = Awaited<ReturnType<PrismaService['mCPConnection']['findFirst']>> & object;

/** `mcp_<first 6 of id>_<tool>` — stable, unique per connection, within 64 chars. */
export function mcpFunctionName(connectionId: string, toolName: string): string {
  const safeTool = toolName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `mcp_${connectionId.slice(-6)}_${safeTool}`.slice(0, 64);
}

/**
 * Workspace MCP servers: a real Streamable-HTTP handshake on create and sync,
 * discovered tools stored for agents to use, the bearer token encrypted at
 * rest. This used to mark every connection CONNECTED with invented tool names
 * and store the token in plain text, without contacting the server.
 */
@Injectable()
export class MCPService {
  private readonly logger = new Logger(MCPService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: AIEncryptionService,
    private readonly config: ConfigService,
  ) {}

  private get allowPrivateNetwork(): boolean {
    return this.config.get<string>('AI_ALLOW_PRIVATE_NETWORK') === 'true';
  }

  async listConnections(workspaceId: string): Promise<MCPConnectionView[]> {
    const rows = await this.prisma.mCPConnection.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toView(row));
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
    await this.assertReachableUrl(data.serverUrl);
    const token = data.token?.trim();
    const row = await this.prisma.mCPConnection.create({
      data: {
        workspaceId,
        createdById: userId,
        name: data.name.trim(),
        serverUrl: data.serverUrl.trim(),
        transport: 'HTTP',
        status: 'DISCONNECTED',
        authConfig: token
          ? { encryptedToken: this.encryption.encrypt(token), maskedToken: this.encryption.maskApiKey(token) }
          : {},
        discoveredToolsJson: [],
      },
    });
    return this.handshake(row);
  }

  async deleteConnection(workspaceId: string, id: string) {
    await this.getConnection(workspaceId, id);
    await this.prisma.mCPConnection.delete({ where: { id } });
  }

  async syncTools(workspaceId: string, id: string) {
    const conn = await this.getConnection(workspaceId, id);
    return this.handshake(conn);
  }

  /** Every tool on this workspace's enabled, connected servers. */
  async getToolBindings(workspaceId: string): Promise<MCPToolBinding[]> {
    const rows = await this.prisma.mCPConnection.findMany({
      where: { workspaceId, isEnabled: true, status: 'CONNECTED' },
    });
    const bindings: MCPToolBinding[] = [];
    for (const row of rows) {
      for (const tool of this.tools(row)) {
        const functionName = mcpFunctionName(row.id, tool.name);
        bindings.push({
          functionName,
          connectionId: row.id,
          connectionName: row.name,
          toolName: tool.name,
          requiresApproval: mcpToolNeedsApproval(tool),
          schema: {
            type: 'function',
            function: {
              name: functionName,
              description: `[${row.name}] ${tool.description ?? tool.name}`.slice(0, 1024),
              parameters: tool.inputSchema ?? { type: 'object', properties: {} },
            },
          },
        });
      }
    }
    return bindings;
  }

  async callTool(
    workspaceId: string,
    connectionId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<MCPCallResult> {
    const conn = await this.getConnection(workspaceId, connectionId);
    if (!conn.isEnabled) throw new BadRequestException(`MCP server '${conn.name}' is disabled.`);
    if (!this.tools(conn).some((t) => t.name === toolName)) {
      throw new BadRequestException(`'${toolName}' is not a tool on MCP server '${conn.name}'.`);
    }
    return callMCPTool(await this.endpointFor(conn), toolName, args);
  }

  /* ------------------------------------------------------------ internal ---- */

  private async handshake(conn: ConnectionRow): Promise<MCPConnectionView> {
    try {
      const { tools } = await discoverMCPTools(await this.endpointFor(conn));
      const updated = await this.prisma.mCPConnection.update({
        where: { id: conn.id },
        data: {
          status: 'CONNECTED',
          discoveredToolsJson: tools as any,
          lastError: null,
          lastSyncedAt: new Date(),
        },
      });
      return this.toView(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`MCP handshake with '${conn.name}' failed: ${message}`);
      const updated = await this.prisma.mCPConnection.update({
        where: { id: conn.id },
        data: {
          status: 'ERROR',
          discoveredToolsJson: [],
          lastError: message.slice(0, 500),
          lastSyncedAt: new Date(),
        },
      });
      return this.toView(updated);
    }
  }

  private async endpointFor(conn: ConnectionRow): Promise<MCPEndpoint> {
    const auth = (conn.authConfig ?? {}) as StoredAuth;
    let token: string | undefined;
    if (auth.encryptedToken) {
      token = this.encryption.decrypt(auth.encryptedToken);
    } else if (auth.token) {
      // Encrypt a legacy plaintext token the first time it is used.
      token = auth.token;
      await this.prisma.mCPConnection.update({
        where: { id: conn.id },
        data: {
          authConfig: {
            encryptedToken: this.encryption.encrypt(token),
            maskedToken: this.encryption.maskApiKey(token),
          },
        },
      });
    }
    return { url: conn.serverUrl, token, allowPrivateNetwork: this.allowPrivateNetwork };
  }

  private async assertReachableUrl(url: string) {
    if (this.allowPrivateNetwork) return;
    try {
      await assertPublicHttpUrl(url);
    } catch (err) {
      if (err instanceof UnsafeUrlError) {
        throw new BadRequestException(
          `That server URL can't be used: ${err.message} Private MCP servers need AI_ALLOW_PRIVATE_NETWORK=true on the API.`,
        );
      }
      throw err;
    }
  }

  private tools(row: ConnectionRow): MCPToolDescriptor[] {
    return Array.isArray(row.discoveredToolsJson)
      ? (row.discoveredToolsJson as unknown as MCPToolDescriptor[])
      : [];
  }

  private toView(row: ConnectionRow): MCPConnectionView {
    const auth = (row.authConfig ?? {}) as StoredAuth;
    const hasToken = !!(auth.encryptedToken || auth.token);
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      serverUrl: row.serverUrl,
      transport: row.transport,
      status: row.status,
      isEnabled: row.isEnabled,
      hasToken,
      maskedToken: auth.maskedToken ?? (auth.token ? this.encryption.maskApiKey(auth.token) : null),
      discoveredToolsJson: this.tools(row),
      lastError: row.lastError ?? null,
      lastSyncedAt: row.lastSyncedAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
