import { Injectable, Logger } from '@nestjs/common';
import { IntegrationsService } from '@org/api-integrations';
import { PrismaService } from '@org/database';
import { appLabel, connectorToolName, type AppActionDefinition, type AgentConnectionStatus } from '@org/types';

/** Link states the owner fixes by signing in again, not by connecting anew. */
const RECONNECT_STATUSES = new Set(['EXPIRED', 'REVOKED', 'ERROR', 'FAILED', 'NEEDS_REAUTH']);

export interface IntegrationToolSchema {
  /** `<provider>_<actionId>`, namespaced so it can sit in the same OpenAI
   *  `tools` array as the built-in MCP tools without colliding. */
  name: string;
  /** Upper-case provider key — lets an agent's tool list narrow one app's actions. */
  provider: string;
  integrationId: string;
  actionId: string;
  definition: AppActionDefinition;
  schema: Record<string, unknown>;
}

/**
 * Turns the integrations an Agent/Coworker has connected (`CoworkerApp`
 * rows — shared by both entity types despite the model name) into
 * OpenAI-style tool schemas the same tool-calling loop
 * (`AIRuntimeService`) can offer the model alongside `MCPToolRegistryService`'s
 * built-in tools.
 *
 * Deliberately not folded into `MCPToolRegistryService`'s static tool map:
 * that map is a process-wide singleton, but which integration actions exist
 * varies per workspace and per entity, so schemas are built fresh per turn
 * instead of registered once.
 */
@Injectable()
export class IntegrationToolBridgeService {
  private readonly logger = new Logger(IntegrationToolBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
  ) {}

  /**
   * Returns one schema per action exposed by every `CONNECTED` integration
   * linked to `entityId`. Requires a real `actingUserId` — an integration
   * action always runs with a person's permissions
   * (`IntegrationPermissionService.assertIntegrationAccess`), never an
   * agent's own identity, so an entity with no creator on record simply gets
   * no integration tools rather than a confusing runtime failure per call.
   */
  async getToolsForEntity(
    workspaceId: string,
    entityId: string,
    actingUserId: string | null,
    /**
     * Apps a canvas agent names on its card (`SLACK`). Each resolves to this
     * workspace's connection or the acting user's own — the same rule the
     * engine uses for `PROVIDER.action` steps — never another member's.
     */
    providers: readonly string[] = [],
    /**
     * The person talking to the agent. Their own connected accounts are used,
     * not the creator's: a published agent must never act in the creator's
     * Gmail for whoever happens to ask. Scheduled runs have no requester and
     * keep using the creator's.
     */
    requesterId?: string | null,
  ): Promise<IntegrationToolSchema[]> {
    const actor = requesterId ?? actingUserId;
    if (!actor) return [];

    const links = await this.prisma.coworkerApp.findMany({
      where: { coworkerId: entityId },
      include: {
        integration: { select: { id: true, provider: true, status: true, scopeType: true, userId: true } },
      },
    });
    // A personal connection belongs to the person who made it; another member
    // resolves the same app to their own connection (below) or goes without.
    const connected = links.filter(
      (link) =>
        link.integration.status === 'CONNECTED' &&
        !(link.integration.scopeType === 'USER' && link.integration.userId !== actor),
    );
    const linked = new Set(connected.map((link) => link.integration.provider.toUpperCase()));
    const personal = links
      .filter((link) => link.integration.scopeType === 'USER' && link.integration.userId !== actor)
      .map((link) => link.integration.provider);
    const wanted = [...new Set([...providers, ...personal].map((p) => p.toUpperCase()))].filter((p) => !linked.has(p));
    if (wanted.length > 0) {
      const rows = await this.prisma.externalIntegration.findMany({
        where: {
          provider: { in: wanted },
          status: 'CONNECTED',
          OR: [
            { workspaceId, scopeType: { not: 'USER' } },
            { scopeType: 'USER', userId: actor },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, provider: true, status: true },
      });
      for (const provider of wanted) {
        const row = rows.find((r) => r.provider.toUpperCase() === provider);
        if (row) connected.push({ integration: row } as (typeof connected)[number]);
      }
    }
    if (connected.length === 0) return [];

    const results: IntegrationToolSchema[] = [];
    for (const link of connected) {
      try {
        const actions = (await this.integrations.getActions(
          link.integration.id,
          actor,
          workspaceId,
        )) as AppActionDefinition[];

        for (const definition of actions) {
          const name = connectorToolName(link.integration.provider, definition.id);
          results.push({
            name,
            provider: link.integration.provider.toUpperCase(),
            integrationId: link.integration.id,
            actionId: definition.id,
            definition,
            schema: this.toSchema(name, definition),
          });
        }
      } catch (error) {
        this.logger.warn(
          `Failed to load actions for integration ${link.integration.id} (entity ${entityId}): ${String(error)}`,
        );
      }
    }
    return results;
  }

  /**
   * Which apps the agent needs and whether `userId` has them connected —
   * a workspace-shared connection counts for everyone, a personal one only
   * for its owner. Drives the "connect your accounts" prompt in the app.
   */
  async getConnectionStatus(
    workspaceId: string,
    entityId: string,
    userId: string,
    providers: readonly string[] = [],
  ): Promise<AgentConnectionStatus[]> {
    const links = await this.prisma.coworkerApp.findMany({
      where: { coworkerId: entityId },
      include: { integration: { select: { provider: true } } },
    });
    const required = [...new Set([...links.map((l) => l.integration.provider), ...providers].map((p) => p.toUpperCase()))];
    if (required.length === 0) return [];

    // Not just `CONNECTED` rows: an expired or failing link means "reconnect",
    // not "connect", so the person isn't sent to set up an app they already have.
    const rows = await this.prisma.externalIntegration.findMany({
      where: {
        provider: { in: required },
        status: { not: 'DISCONNECTED' },
        OR: [{ workspaceId, scopeType: { not: 'USER' } }, { scopeType: 'USER', userId }],
      },
      select: { provider: true, scopeType: true, status: true },
    });
    return required.map((provider) => {
      const mine = rows.filter((r) => r.provider.toUpperCase() === provider);
      const row = mine.find((r) => r.status === 'CONNECTED');
      return {
        provider,
        label: appLabel(provider),
        connected: !!row,
        shared: !!row && row.scopeType !== 'USER',
        ...(!row && mine.some((r) => RECONNECT_STATUSES.has(r.status.toUpperCase()))
          ? { needsReconnect: true }
          : {}),
      };
    });
  }

  private toSchema(name: string, def: AppActionDefinition): Record<string, unknown> {
    return {
      type: 'function',
      function: {
        name,
        description: def.description ? `${def.label} — ${def.description}` : def.label,
        parameters: def.inputSchema ?? { type: 'object', properties: {} },
      },
    };
  }
}
