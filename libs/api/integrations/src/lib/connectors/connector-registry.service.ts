import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import {
  buildConnectorManifest,
  connectorStatus,
  humanizeAuditAction,
  summarizeConnectorUsage,
  type ConnectionTestResult,
  type ConnectorActivityEntry,
  type ConnectorConnection,
  type ConnectorDetail,
  type ConnectorManifest,
  type ConnectorSummary,
  type ConnectorTriggerDefinition,
} from '@org/types';
import { IntegrationLoggerService } from '../core/integration-logger.service.js';
import { IntegrationManagerService } from '../core/integration-manager.service.js';
import { IntegrationPermissionService } from '../core/integration-permission.service.js';
import type { ProviderAdapter } from '../core/provider-adapter.interface.js';

const USAGE_WINDOW_DAYS = 30;
const ACTIVITY_LIMIT = 50;

/**
 * The connector registry: one manifest per registered provider adapter, with
 * the caller's connections and real usage merged in.
 *
 * It owns no data of its own. Capabilities come from the adapters, connections
 * from `ExternalIntegration`, and usage and history from
 * `IntegrationAuditLog` (every app action already writes one). A new adapter
 * appears here — and in every surface reading this — with no other change.
 */
@Injectable()
export class ConnectorRegistryService {
  private readonly logger = new Logger(ConnectorRegistryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly manager: IntegrationManagerService,
    private readonly permissions: IntegrationPermissionService,
    private readonly audit: IntegrationLoggerService,
  ) {}

  /** Manifests only — what every connector can do, independent of who asks. */
  manifests(): ConnectorManifest[] {
    return this.manager
      .listAdapters()
      .filter((adapter) => this.isListed(adapter))
      .map((adapter) => this.manifestFor(adapter))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  manifest(provider: string): ConnectorManifest {
    const adapter = this.findAdapter(provider);
    return this.manifestFor(adapter);
  }

  /** A trigger's definition, for the poller. */
  trigger(provider: string, triggerId: string): ConnectorTriggerDefinition | null {
    const manifest = this.manifest(provider);
    return manifest.triggers.find((t) => t.id === triggerId) ?? null;
  }

  async list(workspaceId: string, userId: string): Promise<ConnectorSummary[]> {
    const manifests = this.manifests();
    const rows = await this.visibleConnections(workspaceId, userId);
    const since = new Date(Date.now() - USAGE_WINDOW_DAYS * 86_400_000);
    const ids = rows.map((r) => r.id);
    const logs = ids.length
      ? await this.prisma.integrationAuditLog.findMany({
          where: { integrationId: { in: ids }, createdAt: { gte: since }, action: { startsWith: 'APP_ACTION_' } },
          select: { integrationId: true, action: true, status: true, durationMs: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5000,
        })
      : [];

    return manifests.map((manifest) => {
      const connections = rows.filter((r) => r.provider === manifest.provider).map((r) => this.toConnection(r, userId));
      const connIds = new Set(connections.map((c) => c.id));
      return {
        ...manifest,
        status: connectorStatus(connections, manifest.serverConfigured),
        connections,
        usage: summarizeConnectorUsage(
          logs.filter((l) => l.integrationId && connIds.has(l.integrationId)),
          manifest.capabilities,
          USAGE_WINDOW_DAYS,
        ),
      };
    });
  }

  async detail(workspaceId: string, userId: string, provider: string): Promise<ConnectorDetail> {
    const manifest = this.manifest(provider);
    const rows = (await this.visibleConnections(workspaceId, userId)).filter((r) => r.provider === manifest.provider);
    const connections = rows.map((r) => this.toConnection(r, userId));
    const ids = connections.map((c) => c.id);
    const since = new Date(Date.now() - USAGE_WINDOW_DAYS * 86_400_000);
    const [usageRows, recent] = ids.length
      ? await Promise.all([
          this.prisma.integrationAuditLog.findMany({
            where: { integrationId: { in: ids }, createdAt: { gte: since }, action: { startsWith: 'APP_ACTION_' } },
            select: { action: true, status: true, durationMs: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 5000,
          }),
          this.prisma.integrationAuditLog.findMany({
            where: { integrationId: { in: ids } },
            orderBy: { createdAt: 'desc' },
            take: ACTIVITY_LIMIT,
          }),
        ])
      : [[], []];

    const userIds = [...new Set(recent.map((r) => r.userId).filter((id): id is string => !!id))];
    const users = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : [];
    const nameOf = new Map(users.map((u) => [u.id, u.name || u.email]));
    const labelOf = new Map(manifest.capabilities.map((c) => [`APP_ACTION_${c.id.toUpperCase()}`, c.label]));

    const activity: ConnectorActivityEntry[] = recent.map((row) => {
      let error: string | null = null;
      if (row.status !== 'SUCCESS' && row.details) {
        try {
          const parsed = JSON.parse(row.details) as Record<string, unknown>;
          error = typeof parsed['error'] === 'string' ? parsed['error'] : null;
        } catch {
          error = null;
        }
      }
      return {
        id: row.id,
        at: row.createdAt.toISOString(),
        action: row.action,
        label: labelOf.get(row.action) ?? humanizeAuditAction(row.action),
        status: row.status,
        durationMs: row.durationMs,
        userId: row.userId,
        userName: row.userId ? (nameOf.get(row.userId) ?? null) : null,
        error,
      };
    });

    return {
      ...manifest,
      status: connectorStatus(connections, manifest.serverConfigured),
      connections,
      usage: summarizeConnectorUsage(usageRows, manifest.capabilities, USAGE_WINDOW_DAYS),
      activity,
    };
  }

  /**
   * Checks a connection against the app itself (its account endpoint), records
   * the outcome on the connection and in the audit log, and says whether the
   * person has to reconnect.
   */
  async testConnection(workspaceId: string, userId: string, integrationId: string): Promise<ConnectionTestResult> {
    await this.permissions.assertIntegrationAccess(integrationId, userId, workspaceId, 'view');
    const started = Date.now();
    try {
      const { adapter, credential } = await this.manager.resolveCredential(integrationId);
      const account = await adapter.getAccount(credential);
      const durationMs = Date.now() - started;
      await this.prisma.externalIntegration.update({
        where: { id: integrationId },
        data: { status: 'CONNECTED', lastErrorAt: null, lastErrorMessage: null },
      });
      await this.audit.logAudit({
        integrationId,
        workspaceId,
        userId,
        action: 'CONNECTION_TESTED',
        status: 'SUCCESS',
        durationMs,
        details: { provider: credential.provider },
      });
      return {
        success: true,
        message: `Connected as ${account.name || account.email || account.accountId}.`,
        durationMs,
        account: { email: account.email ?? null, name: account.name ?? null },
      };
    } catch (error) {
      const durationMs = Date.now() - started;
      const message = error instanceof Error ? error.message : String(error);
      const reconnect = /401|unauthori[sz]ed|invalid[_ ]grant|expired|revoked|token/i.test(message);
      await this.prisma.externalIntegration
        .update({
          where: { id: integrationId },
          data: { lastErrorAt: new Date(), lastErrorMessage: message.slice(0, 500), ...(reconnect ? { status: 'ERROR' } : {}) },
        })
        .catch((e) => this.logger.warn(`Could not record test failure on ${integrationId}: ${String(e)}`));
      await this.audit.logAudit({
        integrationId,
        workspaceId,
        userId,
        action: 'CONNECTION_TESTED',
        status: 'FAILURE',
        durationMs,
        details: { error: message },
      });
      return {
        success: false,
        message: reconnect ? `The app refused the saved sign-in (${message}). Reconnect to continue.` : message,
        durationMs,
        reconnect,
      };
    }
  }

  private manifestFor(adapter: ProviderAdapter): ConnectorManifest {
    const caps = adapter.getCapabilities();
    let configured: boolean;
    try {
      configured = adapter.isServerConfigured ? adapter.isServerConfigured() : true;
    } catch {
      configured = false;
    }
    return buildConnectorManifest(caps, adapter.getActions?.() ?? [], adapter.getTriggers?.() ?? [], {
      configured,
      ...(configured
        ? {}
        : { reason: `${caps.displayName} isn’t set up on this server yet — an admin needs to add its OAuth app credentials.` }),
    });
  }

  /** Internal plumbing adapters (no auth, nothing to do) aren't connectors. */
  private isListed(adapter: ProviderAdapter): boolean {
    const caps = adapter.getCapabilities();
    return !(caps.authType === 'NONE' && !(adapter.getActions?.().length ?? 0));
  }

  private findAdapter(provider: string): ProviderAdapter {
    const key = provider.toUpperCase();
    const adapter = this.manager.listAdapters().find((a) => a.providerId.toUpperCase() === key);
    if (!adapter || !this.isListed(adapter)) throw new NotFoundException(`There’s no '${provider}' connector.`);
    return adapter;
  }

  /** Workspace-wide connections plus the caller's own — never another member's personal one. */
  private visibleConnections(workspaceId: string, userId: string) {
    return this.prisma.externalIntegration.findMany({
      where: {
        OR: [
          { workspaceId, scopeType: 'WORKSPACE' },
          { userId, scopeType: 'USER' },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        provider: true,
        scopeType: true,
        status: true,
        displayName: true,
        userId: true,
        scopes: true,
        metadata: true,
        lastSyncAt: true,
        lastErrorAt: true,
        lastErrorMessage: true,
        createdAt: true,
      },
    });
  }

  private toConnection(
    row: Awaited<ReturnType<ConnectorRegistryService['visibleConnections']>>[number],
    userId: string,
  ): ConnectorConnection {
    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(row.metadata || '{}') as Record<string, unknown>;
    } catch {
      meta = {};
    }
    let scopes: string[];
    try {
      const parsed = JSON.parse(row.scopes || '[]') as unknown;
      scopes = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      scopes = [];
    }
    const text = (v: unknown) => (typeof v === 'string' && v ? v : null);
    return {
      id: row.id,
      provider: row.provider,
      scopeType: row.scopeType === 'USER' ? 'USER' : 'WORKSPACE',
      status: row.status,
      displayName: row.displayName,
      accountEmail: text(meta['accountEmail']) ?? text(meta['email']),
      accountName: text(meta['accountName']) ?? text(meta['name']),
      scopes,
      mine: row.scopeType === 'USER' && row.userId === userId,
      lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
      lastErrorAt: row.lastErrorAt?.toISOString() ?? null,
      lastErrorMessage: row.lastErrorMessage,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
