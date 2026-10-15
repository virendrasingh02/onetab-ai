import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@org/database';
import type { OAuthAppInput, OAuthAppStatus } from '@org/types';
import { IntegrationEncryptionService } from './integration-encryption.service.js';
import { IntegrationLoggerService } from './integration-logger.service.js';
import { OAUTH_APP_DEFINITIONS, type OAuthAppDefinition } from './oauth-app-definitions.js';
import { runWithOAuthOverrides } from './oauth-app-context.js';
import type { ProviderAdapter } from './provider-adapter.interface.js';

/**
 * Lets a workspace bring its own OAuth app for a provider. The platform's env
 * credentials stay the fallback; a workspace's enabled app wins for every
 * connection made in (or refreshed for) that workspace — in the main app and
 * the AI Agent Studio alike, since both go through the same connector API.
 */
@Injectable()
export class OAuthAppCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: IntegrationEncryptionService,
    private readonly config: ConfigService,
    private readonly audit: IntegrationLoggerService,
  ) {}

  private definition(appKey: string): OAuthAppDefinition {
    const def = OAUTH_APP_DEFINITIONS.find((d) => d.appKey === appKey.toUpperCase());
    if (!def) throw new NotFoundException(`There is no OAuth app called '${appKey}'.`);
    return def;
  }

  /** Env-style overrides (`GITHUB_CLIENT_ID` → …) for a workspace's enabled apps. */
  async load(workspaceId?: string | null): Promise<ReadonlyMap<string, string>> {
    const overrides = new Map<string, string>();
    if (!workspaceId) return overrides;
    const rows = await this.prisma.workspaceOAuthApp.findMany({ where: { workspaceId, enabled: true } });
    for (const row of rows) {
      const def = OAUTH_APP_DEFINITIONS.find((d) => d.appKey === row.appKey);
      if (!def) continue;
      try {
        const secret = this.encryption.decrypt(row.encryptedClientSecret);
        overrides.set(def.clientIdEnv, row.clientId);
        overrides.set(def.clientSecretEnv, secret);
      } catch {
        // An undecryptable secret (rotated ENCRYPTION_KEY) falls back to the server's credentials.
      }
    }
    return overrides;
  }

  /**
   * An adapter whose every call sees `overrides` — so token refreshes, actions
   * and disconnects use the same OAuth app the connection was made with.
   * Synchronous methods stay synchronous.
   */
  bind<T extends ProviderAdapter>(adapter: T, overrides: ReadonlyMap<string, string>): T {
    if (overrides.size === 0) return adapter;
    return new Proxy(adapter, {
      get: (target, prop) => {
        const value = Reflect.get(target, prop, target);
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => runWithOAuthOverrides(overrides, () => value.apply(target, args));
      },
    });
  }

  /** Runs `fn` with a workspace's OAuth apps in scope (loading them first). */
  async runFor<T>(workspaceId: string | null | undefined, fn: () => Promise<T>): Promise<T> {
    return runWithOAuthOverrides(await this.load(workspaceId), fn);
  }

  private serverHas(def: OAuthAppDefinition): boolean {
    const teams = def.appKey === 'MICROSOFT_TEAMS';
    const id = this.config.get<string>(def.clientIdEnv) || (teams ? this.config.get<string>('AZURE_CLIENT_ID') : '');
    const secret =
      this.config.get<string>(def.clientSecretEnv) || (teams ? this.config.get<string>('AZURE_CLIENT_SECRET') : '');
    return Boolean(id && secret);
  }

  private apiBase(): string {
    return (this.config.get<string>('API_URL') || 'http://localhost:3000').replace(/\/+$/, '');
  }

  async list(workspaceId: string): Promise<OAuthAppStatus[]> {
    const rows = await this.prisma.workspaceOAuthApp.findMany({ where: { workspaceId } });
    return OAUTH_APP_DEFINITIONS.map((def) => this.toStatus(def, rows.find((r) => r.appKey === def.appKey)));
  }

  private toStatus(
    def: OAuthAppDefinition,
    row?: { clientId: string; enabled: boolean; updatedAt: Date } | null,
  ): OAuthAppStatus {
    const serverFallback = this.serverHas(def);
    const source = row?.enabled ? 'workspace' : serverFallback ? 'server' : 'none';
    return {
      appKey: def.appKey,
      label: def.label,
      providers: def.providers.map((p) => p.id),
      providerNames: def.providers.map((p) => p.name),
      source,
      configured: source !== 'none',
      clientId: row?.clientId ?? null,
      secretSet: Boolean(row),
      enabled: row?.enabled ?? false,
      serverFallback,
      callbackUrls: def.providers.map((p) => ({
        provider: p.name,
        url:
          this.config.get<string>(`${p.id}_REDIRECT_URI`) ||
          `${this.apiBase()}/api/v1/integrations/${p.callbackPath}/callback`,
      })),
      setupUrl: def.setupUrl,
      setupHint: def.setupHint,
      clientIdPlaceholder: def.clientIdPlaceholder,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }

  async upsert(workspaceId: string, userId: string, appKey: string, input: OAuthAppInput): Promise<OAuthAppStatus> {
    const def = this.definition(appKey);
    const clientId = (input.clientId ?? '').trim();
    const clientSecret = input.clientSecret?.trim();
    if (clientId.length < 3 || clientId.length > 300 || /\s/.test(clientId)) {
      throw new BadRequestException('Enter the client ID exactly as the provider shows it (no spaces).');
    }
    if (clientSecret !== undefined && (clientSecret.length < 1 || clientSecret.length > 2000)) {
      throw new BadRequestException('The client secret looks empty or too long.');
    }
    const key = { workspaceId_appKey: { workspaceId, appKey: def.appKey } };
    const existing = await this.prisma.workspaceOAuthApp.findUnique({ where: key });
    if (!existing && !clientSecret) throw new BadRequestException('Enter the client secret to save this app.');

    const row = await this.prisma.workspaceOAuthApp.upsert({
      where: key,
      create: {
        workspaceId,
        appKey: def.appKey,
        clientId,
        encryptedClientSecret: this.encryption.encrypt(clientSecret as string),
        enabled: input.enabled ?? true,
        createdById: userId,
      },
      update: {
        clientId,
        ...(clientSecret ? { encryptedClientSecret: this.encryption.encrypt(clientSecret) } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
    });
    await this.audit.logAudit({
      workspaceId,
      userId,
      action: existing ? 'OAUTH_APP_UPDATED' : 'OAUTH_APP_CREATED',
      status: 'SUCCESS',
      details: { appKey: def.appKey, secretChanged: Boolean(clientSecret) },
    });
    return this.toStatus(def, row);
  }

  async remove(workspaceId: string, userId: string, appKey: string): Promise<OAuthAppStatus> {
    const def = this.definition(appKey);
    await this.prisma.workspaceOAuthApp.deleteMany({ where: { workspaceId, appKey: def.appKey } });
    await this.audit.logAudit({
      workspaceId,
      userId,
      action: 'OAUTH_APP_REMOVED',
      status: 'SUCCESS',
      details: { appKey: def.appKey },
    });
    return this.toStatus(def, null);
  }
}
