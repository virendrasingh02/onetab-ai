import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  PLUGIN_RUNTIMES,
  PLUGIN_SCOPES,
  PLUGIN_SURFACES,
  PRIVILEGED_SCOPES,
  SDK_VERSION,
  isPluginScope,
  isPluginSurface,
  type PluginRuntime,
  type PluginScope,
} from './marketplace.constants.js';
import { MarketplaceService } from './marketplace.service.js';
import type {
  IssuedPluginCredentials,
  PluginManifest,
} from './marketplace.types.js';

const KEY_PREFIX = 'otp_live_';

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function majorOf(version: string): number {
  return Number.parseInt(version.split('.')[0] ?? '', 10);
}

/**
 * Phase 12 — Plugin SDK.
 *
 * Owns the contract third-party plugins are held to: manifest validation, the
 * scope vocabulary, credential issuance, and the permission check the runtime
 * calls before handing a plugin any workspace data.
 */
@Injectable()
export class PluginSDKService {
  private readonly logger = new Logger(PluginSDKService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketplace: MarketplaceService,
  ) {}

  /** Everything an SDK consumer needs to write a valid manifest. */
  getSDKDescriptor() {
    return {
      sdkVersion: SDK_VERSION,
      runtimes: PLUGIN_RUNTIMES,
      scopes: PLUGIN_SCOPES,
      privilegedScopes: PRIVILEGED_SCOPES,
      surfaces: PLUGIN_SURFACES,
      manifestExample: {
        name: 'Standup Summarizer',
        slug: 'standup-summarizer',
        version: '1.0.0',
        sdkVersion: SDK_VERSION,
        runtime: 'SANDBOXED_JS',
        entryPoint: 'dist/plugin.js',
        scopes: ['read:channels', 'read:messages', 'ai:invoke'],
        surfaces: ['channel.toolbar', 'command.palette'],
      } satisfies PluginManifest,
    };
  }

  /**
   * Validates a manifest without registering it, so an author's build step can
   * fail on a bad manifest instead of at publish time. Returns the normalised
   * manifest plus the subset of scopes that will need an admin's explicit grant.
   */
  validateManifest(manifest: PluginManifest) {
    const errors: string[] = [];

    if (!manifest?.name?.trim()) errors.push('`name` is required.');
    if (!manifest?.slug?.trim()) errors.push('`slug` is required.');
    if (!manifest?.version?.trim()) errors.push('`version` is required.');

    const declaredSdk = manifest.sdkVersion ?? SDK_VERSION;
    const declaredMajor = majorOf(declaredSdk);
    if (!Number.isFinite(declaredMajor)) {
      errors.push(`\`sdkVersion\` '${declaredSdk}' is not a valid version.`);
    } else if (declaredMajor > majorOf(SDK_VERSION)) {
      // Refuse rather than best-effort: a manifest written against a newer
      // major may rely on guarantees this host does not make.
      errors.push(
        `\`sdkVersion\` ${declaredSdk} is newer than the host SDK (${SDK_VERSION}).`,
      );
    }

    const runtime = (manifest.runtime ?? 'SANDBOXED_JS') as PluginRuntime;
    if (!(PLUGIN_RUNTIMES as readonly string[]).includes(runtime)) {
      errors.push(
        `Unknown runtime '${runtime}'. Expected one of: ${PLUGIN_RUNTIMES.join(', ')}.`,
      );
    }
    if (runtime === 'SANDBOXED_JS' && !manifest.entryPoint?.trim()) {
      errors.push('`entryPoint` is required for the SANDBOXED_JS runtime.');
    }
    if (runtime === 'WEBHOOK' && !manifest.webhookUrl?.trim()) {
      errors.push('`webhookUrl` is required for the WEBHOOK runtime.');
    }
    if (manifest.webhookUrl && !/^https:\/\//i.test(manifest.webhookUrl)) {
      errors.push('`webhookUrl` must be an https URL.');
    }

    const scopes = manifest.scopes ?? [];
    const unknownScopes = scopes.filter((scope) => !isPluginScope(scope));
    if (unknownScopes.length > 0) {
      errors.push(`Unknown scopes: ${unknownScopes.join(', ')}.`);
    }

    const surfaces = manifest.surfaces ?? [];
    const unknownSurfaces = surfaces.filter((surface) => !isPluginSurface(surface));
    if (unknownSurfaces.length > 0) {
      errors.push(`Unknown surfaces: ${unknownSurfaces.join(', ')}.`);
    }

    const validScopes = scopes.filter(isPluginScope);

    return {
      valid: errors.length === 0,
      errors,
      normalised: {
        ...manifest,
        sdkVersion: declaredSdk,
        runtime,
        scopes: validScopes,
        surfaces: surfaces.filter(isPluginSurface),
      },
      requiresConsent: validScopes.filter((scope) =>
        PRIVILEGED_SCOPES.includes(scope),
      ),
    };
  }

  /**
   * Registers a plugin against its listing and issues API credentials.
   *
   * The plaintext key is returned exactly once — only its SHA-256 is stored, so
   * a leaked database gives an attacker nothing that authenticates.
   */
  async register(
    listingSlug: string,
    manifest: PluginManifest,
  ): Promise<IssuedPluginCredentials> {
    const check = this.validateManifest(manifest);
    if (!check.valid) {
      throw new BadRequestException({
        message: 'The plugin manifest is invalid.',
        errors: check.errors,
      });
    }

    const listing = await this.marketplace.requireListing(listingSlug);
    if (listing.kind !== 'PLUGIN') {
      throw new BadRequestException(
        `Listing '${listingSlug}' is a ${listing.kind}, not a PLUGIN.`,
      );
    }

    const apiKey = `${KEY_PREFIX}${randomBytes(24).toString('hex')}`;
    const apiKeyPrefix = apiKey.slice(0, KEY_PREFIX.length + 8);
    const registrationData = {
      runtime: check.normalised.runtime,
      sdkVersion: check.normalised.sdkVersion,
      entryPoint: manifest.entryPoint ?? null,
      webhookUrl: manifest.webhookUrl ?? null,
      apiKeyHash: hashKey(apiKey),
      apiKeyPrefix,
      scopes: JSON.stringify(check.normalised.scopes),
      surfaces: JSON.stringify(check.normalised.surfaces),
      status: 'ACTIVE',
    };

    const registration = await this.prisma.pluginRegistration.upsert({
      where: { listingId: listing.id },
      create: { listingId: listing.id, ...registrationData },
      update: registrationData,
    });

    // Keep the listing's published manifest in step with what was registered.
    await this.prisma.marketplaceListing.update({
      where: { id: listing.id },
      data: {
        manifestJson: JSON.stringify(check.normalised),
        version: manifest.version,
      },
    });

    this.logger.log(
      `Registered plugin '${listing.slug}' (${check.normalised.runtime}) with ${check.normalised.scopes.length} scopes`,
    );

    return {
      registrationId: registration.id,
      listingSlug: listing.slug,
      apiKey,
      apiKeyPrefix,
      sdkVersion: registration.sdkVersion,
      scopes: check.normalised.scopes,
    };
  }

  async getRegistration(listingSlug: string) {
    const listing = await this.marketplace.requireListing(listingSlug);
    const registration = await this.prisma.pluginRegistration.findUnique({
      where: { listingId: listing.id },
    });
    if (!registration) {
      throw new NotFoundException(`Plugin '${listingSlug}' is not registered.`);
    }
    // The hash never leaves the server; the prefix is enough for an author to
    // recognise which key a deployment is using.
    const { apiKeyHash: _hash, ...safe } = registration;
    return {
      ...safe,
      scopes: JSON.parse(registration.scopes) as PluginScope[],
      surfaces: JSON.parse(registration.surfaces) as string[],
    };
  }

  /** Rotates credentials, e.g. after a suspected leak. */
  async rotateApiKey(listingSlug: string) {
    const listing = await this.marketplace.requireListing(listingSlug);
    const apiKey = `${KEY_PREFIX}${randomBytes(24).toString('hex')}`;
    const apiKeyPrefix = apiKey.slice(0, KEY_PREFIX.length + 8);

    await this.prisma.pluginRegistration.update({
      where: { listingId: listing.id },
      data: { apiKeyHash: hashKey(apiKey), apiKeyPrefix },
    });

    this.logger.warn(`Rotated the API key for plugin '${listingSlug}'`);
    return { listingSlug, apiKey, apiKeyPrefix };
  }

  async setStatus(listingSlug: string, status: 'ACTIVE' | 'SUSPENDED') {
    const listing = await this.marketplace.requireListing(listingSlug);
    return this.prisma.pluginRegistration.update({
      where: { listingId: listing.id },
      data: { status },
      select: { id: true, status: true, updatedAt: true },
    });
  }

  /**
   * Authenticates a plugin API key. Compared over the digests in constant time
   * so response latency cannot be used to recover a key byte by byte.
   */
  async authenticate(apiKey: string) {
    if (!apiKey?.startsWith(KEY_PREFIX)) return null;

    const prefix = apiKey.slice(0, KEY_PREFIX.length + 8);
    const candidates = await this.prisma.pluginRegistration.findMany({
      where: { apiKeyPrefix: prefix, status: 'ACTIVE' },
      include: { listing: { select: { id: true, slug: true, name: true } } },
    });

    const digest = Buffer.from(hashKey(apiKey), 'hex');
    for (const candidate of candidates) {
      if (!candidate.apiKeyHash) continue;
      const stored = Buffer.from(candidate.apiKeyHash, 'hex');
      if (
        stored.length === digest.length &&
        timingSafeEqual(stored, digest)
      ) {
        return {
          registrationId: candidate.id,
          listing: candidate.listing,
          scopes: JSON.parse(candidate.scopes) as PluginScope[],
        };
      }
    }
    return null;
  }

  /**
   * The gate the plugin runtime calls before serving a request: the plugin must
   * be installed and enabled in the workspace, and the scope must be both
   * declared in its manifest and granted by that workspace's admin.
   */
  async assertScope(
    listingSlug: string,
    workspaceId: string,
    scope: PluginScope,
  ) {
    const listing = await this.marketplace.requireListing(listingSlug);

    const [registration, installation] = await Promise.all([
      this.prisma.pluginRegistration.findUnique({
        where: { listingId: listing.id },
      }),
      this.prisma.marketplaceInstallation.findUnique({
        where: {
          listingId_workspaceId: { listingId: listing.id, workspaceId },
        },
      }),
    ]);

    if (!registration || registration.status !== 'ACTIVE') {
      throw new ForbiddenException(`Plugin '${listingSlug}' is not active.`);
    }
    if (!installation || installation.status !== 'ACTIVE') {
      throw new ForbiddenException(
        `Plugin '${listingSlug}' is not enabled in this workspace.`,
      );
    }

    const declared = JSON.parse(registration.scopes) as string[];
    if (!declared.includes(scope)) {
      throw new ForbiddenException(
        `Plugin '${listingSlug}' does not declare the '${scope}' scope.`,
      );
    }

    const granted = JSON.parse(installation.grantedScopes) as string[];
    if (!granted.includes(scope)) {
      throw new ForbiddenException(
        `The workspace has not granted '${scope}' to '${listingSlug}'.`,
      );
    }

    return { listingId: listing.id, workspaceId, scope };
  }
}
