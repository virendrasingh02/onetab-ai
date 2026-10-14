import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '@org/database';
import {
  actionPermission,
  customConnectorProviderKey,
  isCustomConnectorProvider,
  slugifyActionId,
  validateCustomConnector,
  type AppActionResult,
  type CustomConnectorAction,
  type CustomConnectorDefinition,
  type CustomConnectorInput,
  type IntegrationCustomApiConfig,
} from '@org/types';
import { randomUUID } from 'node:crypto';
import { IntegrationEncryptionService } from '../core/integration-encryption.service.js';
import { IntegrationLoggerService } from '../core/integration-logger.service.js';
import { IntegrationPermissionService } from '../core/integration-permission.service.js';
import type { ResolvedCredential } from '../core/provider-adapter.interface.js';
import { customApiConfigFromMetadata, customApiMetadataWithEncryptedSecrets } from '../providers/custom-api.provider.js';
import { CUSTOM_CONNECTOR_KEY, CustomConnectorProvider } from '../providers/custom-connector.provider.js';
import { ConnectorRegistryService } from './connector-registry.service.js';

const MASK = '••••';
const MAX_ACTIONS = 40;

/**
 * Connectors a workspace defines itself. One is one connection row
 * (`ExternalIntegration`) whose provider key is unique to it and whose
 * metadata carries the definition — so it connects, tests, narrows per agent,
 * shows usage and runs as a tool or workflow step exactly like a built-in app.
 * Secrets are encrypted beside the definition; the definition never holds one.
 */
@Injectable()
export class CustomConnectorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: IntegrationEncryptionService,
    private readonly permissions: IntegrationPermissionService,
    private readonly audit: IntegrationLoggerService,
    private readonly registry: ConnectorRegistryService,
    private readonly provider: CustomConnectorProvider,
  ) {}

  async create(workspaceId: string, userId: string, input: CustomConnectorInput, canInstall: boolean) {
    const clean = this.normalize(input);
    this.assertValid(clean);
    const scopeType = clean.scopeType === 'USER' ? 'USER' : 'WORKSPACE';
    if (scopeType === 'WORKSPACE') this.assertCanInstall(canInstall);
    const id = `cc_${randomUUID()}`;
    const provider = customConnectorProviderKey(clean.name, id.slice(3));
    const metadata = this.metadataFor(clean);
    await this.assertReachable(id, provider, metadata);

    const row = await this.prisma.externalIntegration.create({
      data: {
        id,
        workspaceId: scopeType === 'WORKSPACE' ? workspaceId : null,
        userId,
        scopeType,
        provider,
        displayName: clean.name,
        status: 'CONNECTED',
        metadata: JSON.stringify(metadata),
        configJson: JSON.stringify({ baseUrl: clean.baseUrl, authType: clean.authType }),
      },
    });
    this.registry.rememberCustom(row);
    await this.audit.logAudit({
      integrationId: id,
      workspaceId,
      userId,
      action: 'CUSTOM_CONNECTOR_CREATED',
      status: 'SUCCESS',
      details: { provider, actions: clean.actions.length },
    });
    return { provider, integrationId: id };
  }

  async update(workspaceId: string, userId: string, integrationId: string, input: CustomConnectorInput, canInstall: boolean) {
    const existing = await this.ownedRow(workspaceId, userId, integrationId, canInstall);
    const clean = this.normalize(input);
    this.assertValid(clean);
    const metadata = this.metadataFor(clean, this.parse(existing.metadata));
    await this.assertReachable(integrationId, existing.provider, metadata);

    const row = await this.prisma.externalIntegration.update({
      where: { id: integrationId },
      data: {
        displayName: clean.name,
        status: 'CONNECTED',
        metadata: JSON.stringify(metadata),
        configJson: JSON.stringify({ baseUrl: clean.baseUrl, authType: clean.authType }),
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });
    this.registry.rememberCustom(row);
    await this.audit.logAudit({
      integrationId,
      workspaceId,
      userId,
      action: 'CUSTOM_CONNECTOR_UPDATED',
      status: 'SUCCESS',
      details: { provider: row.provider, actions: clean.actions.length },
    });
    return { provider: row.provider, integrationId };
  }

  /** Deletes the connector for good — its definition lives on the row. Agents using it lose its tools. */
  async remove(workspaceId: string, userId: string, integrationId: string, canInstall: boolean) {
    const row = await this.ownedRow(workspaceId, userId, integrationId, canInstall);
    await this.prisma.externalIntegration.delete({ where: { id: integrationId } });
    this.registry.forgetCustom(row.provider);
    await this.audit.logAudit({
      integrationId: null,
      workspaceId,
      userId,
      action: 'CUSTOM_CONNECTOR_DELETED',
      status: 'SUCCESS',
      details: { provider: row.provider },
    });
    return { deleted: true as const };
  }

  /**
   * Runs one action against the real API with the builder's unsaved
   * definition, so a person can see what it returns before saving. Anything
   * that changes data needs `confirm: true`. With `integrationId`, blank
   * secrets fall back to the stored ones (editing).
   */
  async preview(
    workspaceId: string,
    userId: string,
    body: { connector: CustomConnectorInput; actionId: string; values?: Record<string, unknown>; confirm?: boolean; integrationId?: string },
    canInstall: boolean,
  ): Promise<AppActionResult> {
    // Testing sends real requests with real credentials, so it needs the same right as saving.
    if (!body.integrationId && body.connector?.scopeType !== 'USER') this.assertCanInstall(canInstall);
    const clean = this.normalize(body.connector);
    const problems = validateCustomConnector(clean);
    const action = clean.actions.find((a) => a.id === body.actionId);
    if (!action) throw new BadRequestException('Pick an action to test.');
    // Only this action has to be sound to test it; the rest may be half-built.
    const relevant = problems.filter((p) => p.includes(`“${action.label}”`) || p.startsWith('Enter the API') || p.startsWith('The base URL') || p.startsWith('Name the header') || p.startsWith('Enter the username'));
    if (relevant.length) throw new BadRequestException(relevant[0]);
    if (actionPermission(action) !== 'read' && body.confirm !== true) {
      throw new BadRequestException(`“${action.label}” changes data in the API. Confirm to run it.`);
    }
    let existingMetadata: Record<string, unknown> | undefined;
    if (body.integrationId) {
      existingMetadata = this.parse((await this.ownedRow(workspaceId, userId, body.integrationId, canInstall)).metadata);
    }
    const metadata = this.metadataFor(clean, existingMetadata);
    const credential = this.credential(body.integrationId ?? 'preview', 'CUSTOM_PREVIEW', metadata);
    return this.provider.run(credential, action, body.values ?? {});
  }

  // ---------------------------------------------------------------------------

  private async ownedRow(workspaceId: string, userId: string, integrationId: string, canInstall: boolean) {
    const row = await this.assertCustom(integrationId);
    await this.permissions.assertIntegrationAccess(integrationId, userId, workspaceId, 'manage');
    if (row.scopeType !== 'USER') this.assertCanInstall(canInstall);
    return row;
  }

  /** `whoCanInstallApps` governs workspace-wide connectors; a personal one is its owner's business. */
  private assertCanInstall(canInstall: boolean) {
    if (!canInstall) throw new ForbiddenException('You do not have permission to install apps in this workspace.');
  }

  private async assertCustom(integrationId: string) {
    const row = await this.prisma.externalIntegration.findUnique({ where: { id: integrationId } });
    if (!row || !isCustomConnectorProvider(row.provider)) throw new BadRequestException('That isn’t a custom connector.');
    return row;
  }

  private assertValid(input: CustomConnectorInput) {
    if (input.actions.length > MAX_ACTIONS) throw new BadRequestException(`A connector can have up to ${MAX_ACTIONS} actions.`);
    const errors = validateCustomConnector(input);
    if (errors.length) throw new BadRequestException(errors.join(' '));
  }

  /** Trims text, fills in missing ids from labels and drops blank rows. */
  private normalize(input: CustomConnectorInput): CustomConnectorInput {
    const actions: CustomConnectorAction[] = (input.actions ?? []).map((a) => ({
      ...a,
      id: (a.id?.trim() || slugifyActionId(a.label ?? '')).trim(),
      label: (a.label ?? '').trim(),
      description: (a.description ?? '').trim(),
      path: (a.path ?? '').trim(),
      query: Object.fromEntries(Object.entries(a.query ?? {}).filter(([k]) => k.trim()).map(([k, v]) => [k.trim(), String(v ?? '')])),
      body: a.body?.trim() ? a.body : undefined,
      params: (a.params ?? []).filter((p) => p.name?.trim()).map((p) => ({ ...p, name: p.name.trim(), required: !!p.required })),
    }));
    return {
      ...input,
      name: (input.name ?? '').trim(),
      description: (input.description ?? '').trim() || `${(input.name ?? '').trim()} — a custom connector.`,
      baseUrl: (input.baseUrl ?? '').trim().replace(/\/+$/, ''),
      category: input.category ?? 'custom',
      actions,
      triggers: (input.triggers ?? []).map((t) => ({ ...t, itemsPath: (t.itemsPath ?? '').trim(), idField: (t.idField ?? '').trim() || 'id' })),
    };
  }

  private parse(raw: string): Record<string, unknown> {
    try {
      return JSON.parse(raw || '{}') as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  /**
   * Metadata to store: the request config with secrets encrypted (kept from
   * `existing` when the person left a secret blank), plus the secret-free
   * definition the registry and the adapter read.
   */
  private metadataFor(input: CustomConnectorInput, existing?: Record<string, unknown>): Record<string, unknown> {
    const old: Partial<IntegrationCustomApiConfig> = existing
      ? customApiConfigFromMetadata(existing, (c) => this.encryption.decrypt(c))
      : {};
    const keep = (next: string | undefined, prev: string | undefined) => (next?.trim() ? next.trim() : prev);
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(input.customHeaders ?? old.customHeaders ?? {})) {
      if (!name.trim()) continue;
      headers[name.trim()] = value === MASK ? (old.customHeaders?.[name.trim()] ?? '') : value;
    }
    const authType = input.authType;
    const config: IntegrationCustomApiConfig = {
      baseUrl: input.baseUrl,
      authType,
      ...(authType === 'API_KEY_HEADER' || authType === 'API_KEY_QUERY' ? { apiKey: keep(input.apiKey, old.apiKey) } : {}),
      ...(authType === 'API_KEY_HEADER' ? { apiKeyHeader: input.apiKeyHeader?.trim() } : {}),
      ...(authType === 'API_KEY_QUERY' ? { apiKeyQueryParam: input.apiKeyQueryParam?.trim() || 'apiKey' } : {}),
      ...(authType === 'BEARER' ? { bearerToken: keep(input.bearerToken, old.bearerToken) } : {}),
      ...(authType === 'BASIC' ? { basicUsername: input.basicUsername?.trim(), basicPassword: keep(input.basicPassword, old.basicPassword) } : {}),
      ...(Object.keys(headers).length ? { customHeaders: headers } : {}),
    };
    const definition: CustomConnectorDefinition = {
      name: input.name,
      description: input.description,
      category: input.category,
      baseUrl: input.baseUrl,
      authType,
      ...(config.apiKeyHeader ? { apiKeyHeader: config.apiKeyHeader } : {}),
      ...(config.apiKeyQueryParam ? { apiKeyQueryParam: config.apiKeyQueryParam } : {}),
      ...(config.basicUsername ? { basicUsername: config.basicUsername } : {}),
      ...(Object.keys(headers).length ? { customHeaderNames: Object.keys(headers) } : {}),
      actions: input.actions,
      triggers: input.triggers,
    };
    return { ...customApiMetadataWithEncryptedSecrets(config, this.encryption), [CUSTOM_CONNECTOR_KEY]: definition };
  }

  private credential(id: string, provider: string, metadata: Record<string, unknown>): ResolvedCredential {
    return { id, provider, scopeType: 'WORKSPACE', accessToken: '', metadata, scopes: [] };
  }

  /** Saves nothing the API can't be reached for; a refused key (401) is caught here too. */
  private async assertReachable(id: string, provider: string, metadata: Record<string, unknown>) {
    let status: number;
    try {
      ({ status } = await this.provider.probe(this.credential(id, provider, metadata)));
    } catch (error) {
      throw new BadRequestException(`Couldn’t reach ${String(metadata['baseUrl'])}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (status === 401) {
      throw new BadRequestException('The API refused these credentials (HTTP 401). Check the key, token or password.');
    }
  }
}
