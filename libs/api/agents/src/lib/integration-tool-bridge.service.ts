import { Injectable, Logger } from '@nestjs/common';
import { IntegrationsService } from '@org/api-integrations';
import { PrismaService } from '@org/database';
import { connectorToolName, type AppActionDefinition } from '@org/types';

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
  ): Promise<IntegrationToolSchema[]> {
    if (!actingUserId) return [];

    const links = await this.prisma.coworkerApp.findMany({
      where: { coworkerId: entityId },
      include: {
        integration: { select: { id: true, provider: true, status: true } },
      },
    });
    const connected = links.filter((link) => link.integration.status === 'CONNECTED');
    const linked = new Set(connected.map((link) => link.integration.provider.toUpperCase()));
    const wanted = [...new Set(providers.map((p) => p.toUpperCase()))].filter((p) => !linked.has(p));
    if (wanted.length > 0) {
      const rows = await this.prisma.externalIntegration.findMany({
        where: {
          provider: { in: wanted },
          status: 'CONNECTED',
          OR: [
            { workspaceId, scopeType: { not: 'USER' } },
            { scopeType: 'USER', userId: actingUserId },
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
          actingUserId,
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
