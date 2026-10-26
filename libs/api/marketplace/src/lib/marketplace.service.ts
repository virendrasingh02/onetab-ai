import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import { compareSemver, evaluateAgentPackage, parseAccess } from './agent-manifest.js';
import {
  DEFAULT_PAGE_SIZE,
  LISTING_KINDS,
  LISTING_STATUSES,
  MAX_PAGE_SIZE,
  PRICING_MODELS,
  isListingKind,
  type ListingKind,
  type ListingStatus,
} from './marketplace.constants.js';
import {
  RETIRED_SEED_SLUGS,
  SEED_LISTINGS,
  SEED_PUBLISHER,
} from './marketplace.seeds.js';
import type {
  BrowseQuery,
  InstallInput,
  InstallationView,
  ListingDetail,
  ListingSummary,
  PublishListingInput,
  ReviewView,
} from './marketplace.types.js';

/** Parses a JSON column, falling back to `fallback` rather than throwing. */
function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/** What an install copies out of a Studio-published agent. */
interface AgentBlueprint {
  name: string;
  role: string;
  description: string | null;
  avatarUrl: string | null;
  systemPrompt: string;
  systemInstructions?: string;
  provider: string;
  model: string;
  /** JSON-encoded string array, as stored on `AIAgent.tools`. */
  tools: string;
  graphJson: string | null;
  configuration?: Record<string, unknown>;
}

export interface PublishStudioAgentInput {
  visibility?: 'WORKSPACE' | 'PUBLIC';
  name?: string;
  tagline?: string;
  description?: string;
  category?: string;
  tags?: string[];
  changeNotes?: string;
}

function parseTools(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : parseJson<unknown[]>(typeof raw === 'string' ? raw : null, []);
  return list.filter((t): t is string => typeof t === 'string');
}

/**
 * The agent configuration minus anything that belongs to the publishing
 * workspace: version history/lifecycle bookkeeping and anything that smells like
 * a credential. Shared listings are readable by other workspaces.
 */
function stripWorkspaceSpecific(config: Record<string, any>): Record<string, unknown> {
  const dropped = new Set(['versions', 'status', 'publishedAt', 'currentVersion', 'marketplace']);
  const sensitive = /secret|token|password|credential|api[-_]?key|webhook|variables/i;
  return Object.fromEntries(
    Object.entries(config).filter(([key]) => !dropped.has(key) && !sensitive.test(key)),
  );
}

/** Publisher fields a listing response is allowed to carry. */
const PUBLISHER_SELECT = {
  select: { name: true, slug: true, isVerified: true, websiteUrl: true, supportEmail: true },
} as const;

/**
 * The listing columns every serializer here needs. Declared structurally rather
 * than pulled from the generated Prisma types because the same shape has to fit
 * rows loaded with and without their publisher joined.
 */
interface ListingRow {
  id: string;
  kind: string;
  slug: string;
  name: string;
  tagline: string;
  description?: string;
  category: string;
  version: string;
  iconUrl: string | null;
  previewUrl: string | null;
  tags: string;
  pricingModel: string;
  priceCents: number;
  status: string;
  isOfficial: boolean;
  isFeatured: boolean;
  installCount: number;
  ratingSum: number;
  ratingCount: number;
  publisher?: {
    name: string;
    slug: string;
    isVerified: boolean;
    websiteUrl?: string | null;
    supportEmail?: string | null;
  } | null;
  payloadJson?: string;
  manifestJson?: string;
  visibility?: string;
  ownerWorkspaceId?: string | null;
  sourceAgentId?: string | null;
}

@Injectable()
export class MarketplaceService implements OnModuleInit {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedOfficialListings();
    await this.retireOfficialListings();
  }

  /**
   * Unpublishes the official app listings that never connected anything
   * (`RETIRED_SEED_SLUGS`) and closes their installs, which were only rows.
   * Only official listings are touched, so a third-party listing that happens
   * to reuse one of these slugs is left alone. Idempotent.
   */
  async retireOfficialListings() {
    try {
      const retired = await this.prisma.marketplaceListing.findMany({
        where: {
          slug: { in: [...RETIRED_SEED_SLUGS] },
          isOfficial: true,
          kind: 'INTEGRATION',
        },
        select: { id: true, status: true },
      });
      if (retired.length === 0) return;
      const ids = retired.map((l) => l.id);
      const [listings, installs] = await this.prisma.$transaction([
        this.prisma.marketplaceListing.updateMany({
          where: { id: { in: ids }, status: { not: 'DEPRECATED' } },
          data: { status: 'DEPRECATED' },
        }),
        this.prisma.marketplaceInstallation.updateMany({
          where: { listingId: { in: ids }, status: { not: 'UNINSTALLED' } },
          data: { status: 'UNINSTALLED' },
        }),
      ]);
      if (listings.count > 0 || installs.count > 0) {
        this.logger.log(
          `Retired ${listings.count} placeholder app listing(s) and closed ${installs.count} install(s); apps connect through the integration providers now.`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed to retire placeholder marketplace listings: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** Ensures high-fidelity official Apps and Agents are available in the directory. */
  async seedOfficialListings() {
    try {
      const publisher = await this.prisma.marketplacePublisher.upsert({
        where: { slug: SEED_PUBLISHER.slug },
        create: SEED_PUBLISHER,
        update: SEED_PUBLISHER,
      });

      for (const item of SEED_LISTINGS) {
        const data = {
          kind: item.kind,
          slug: item.slug,
          name: item.name,
          tagline: item.tagline ?? '',
          description: item.description ?? '',
          category: item.category,
          version: item.version ?? '1.0.0',
          iconUrl: item.iconUrl ?? null,
          previewUrl: item.previewUrl ?? null,
          tags: JSON.stringify(item.tags ?? []),
          manifestJson: JSON.stringify(item.manifest ?? {}),
          payloadJson: JSON.stringify(item.payload ?? {}),
          pricingModel: item.pricingModel ?? 'FREE',
          priceCents: item.priceCents ?? 0,
          status: 'PUBLISHED',
          isOfficial: true,
          isFeatured: true,
          publisherId: publisher.id,
          publishedAt: new Date(),
        };

        await this.prisma.marketplaceListing.upsert({
          where: { slug: item.slug },
          create: data,
          update: {
            name: data.name,
            tagline: data.tagline,
            description: data.description,
            category: data.category,
            iconUrl: data.iconUrl,
            tags: data.tags,
            manifestJson: data.manifestJson,
          },
        });
      }
      this.logger.log(
        `Marketplace official listings verified (${SEED_LISTINGS.length} items).`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to seed official marketplace listings: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Browse & detail
  // -------------------------------------------------------------------------

  /**
   * The one query behind all seven storefronts. `workspaceId` is optional: pass
   * it and every row comes back with an `installed` flag, resolved from a
   * single extra query rather than one per listing.
   */
  async browse(query: BrowseQuery, workspaceId?: string) {
    const pageSize = Math.min(
      Math.max(Number(query.pageSize ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE,
    );
    const page = Math.max(Number(query.page ?? 1) || 1, 1);

    if (query.kind && !isListingKind(query.kind)) {
      throw new BadRequestException(
        `Unknown listing kind '${query.kind}'. Expected one of: ${LISTING_KINDS.join(', ')}.`,
      );
    }

    const search = query.search?.trim();
    const where: Record<string, unknown> = {
      status: 'PUBLISHED',
      AND: [this.visibleTo(workspaceId)],
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.entityType === 'AGENT'
        ? { kind: 'AGENT' }
        : query.entityType === 'APP'
        ? { kind: { not: 'AGENT' } }
        : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.pricing ? { pricingModel: query.pricing.toUpperCase() } : {}),
      ...(query.featured === true || query.featured === 'true'
        ? { isFeatured: true }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { tagline: { contains: search, mode: 'insensitive' as const } },
              { tags: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.marketplaceListing.findMany({
        where,
        include: { publisher: PUBLISHER_SELECT },
        orderBy: this.orderFor(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.marketplaceListing.count({ where }),
    ]);

    const installedIds = workspaceId
      ? await this.installedListingIds(
          workspaceId,
          rows.map((row) => row.id),
        )
      : new Set<string>();

    const includePayload =
      query.includePayload === true || query.includePayload === 'true';

    return {
      items: rows.map((row) =>
        this.toSummary(
          row,
          workspaceId ? installedIds.has(row.id) : undefined,
          includePayload,
        ),
      ),
      total,
      page,
      pageSize,
      pageCount: Math.max(Math.ceil(total / pageSize), 1),
    };
  }

  /** Headline counts for the marketplace landing page, one row per storefront. */
  async getStorefrontStats(workspaceId?: string) {
    const [grouped, installed] = await Promise.all([
      this.prisma.marketplaceListing.groupBy({
        by: ['kind'],
        where: { status: 'PUBLISHED', AND: [this.visibleTo(workspaceId)] },
        _count: { _all: true },
        _sum: { installCount: true },
      }),
      workspaceId
        ? this.prisma.marketplaceInstallation.findMany({
            where: { workspaceId, status: 'ACTIVE' },
            select: { listing: { select: { kind: true } } },
          })
        : Promise.resolve([]),
    ]);

    const installedByKind = new Map<string, number>();
    for (const row of installed) {
      const kind = row.listing.kind;
      installedByKind.set(kind, (installedByKind.get(kind) ?? 0) + 1);
    }

    return LISTING_KINDS.map((kind) => {
      const stats = grouped.find((row) => row.kind === kind);
      return {
        kind,
        listingCount: stats?._count._all ?? 0,
        installCount: stats?._sum.installCount ?? 0,
        installedHere: installedByKind.get(kind) ?? 0,
      };
    });
  }

  async getListing(slug: string, workspaceId?: string): Promise<ListingDetail> {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { slug },
      include: {
        publisher: PUBLISHER_SELECT,
        reviews: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!listing || !this.canSee(listing, workspaceId)) {
      throw new NotFoundException(`Listing '${slug}' not found.`);
    }

    const installed = workspaceId
      ? (await this.installedListingIds(workspaceId, [listing.id])).has(listing.id)
      : undefined;

    return {
      ...this.toSummary(listing, installed),
      description: listing.description,
      manifest: parseJson<Record<string, unknown>>(listing.manifestJson, {}),
      payload: parseJson<Record<string, unknown>>(listing.payloadJson, {}),
      reviews: listing.reviews.map(toReview),
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    };
  }

  async listCategories(kind: string) {
    if (!isListingKind(kind)) {
      throw new BadRequestException(`Unknown listing kind '${kind}'.`);
    }
    const rows = await this.prisma.marketplaceListing.groupBy({
      by: ['category'],
      where: { kind, status: 'PUBLISHED' },
      _count: { _all: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((row) => ({ category: row.category, count: row._count._all }));
  }

  // -------------------------------------------------------------------------
  // Publishing
  // -------------------------------------------------------------------------

  /**
   * Upsert by slug so re-publishing a new version of an existing listing is the
   * same call as first publication — third-party CI pipelines do not have to
   * know whether the listing already exists.
   */
  async publish(input: PublishListingInput) {
    if (!isListingKind(input.kind)) {
      throw new BadRequestException(
        `Unknown listing kind '${input.kind}'. Expected one of: ${LISTING_KINDS.join(', ')}.`,
      );
    }
    const pricingModel = (input.pricingModel ?? 'FREE').toUpperCase();
    if (!(PRICING_MODELS as readonly string[]).includes(pricingModel)) {
      throw new BadRequestException(`Unknown pricing model '${pricingModel}'.`);
    }

    const slug = toSlug(input.slug || input.name);
    if (!slug) throw new BadRequestException('A slug or name is required.');

    const publisherId = input.publisherSlug
      ? (await this.ensurePublisher(input.publisherSlug, input.publisherName)).id
      : null;

    const data = {
      kind: input.kind as ListingKind,
      name: input.name,
      tagline: input.tagline ?? '',
      description: input.description ?? '',
      category: input.category,
      version: input.version ?? '1.0.0',
      iconUrl: input.iconUrl ?? null,
      previewUrl: input.previewUrl ?? null,
      tags: JSON.stringify(input.tags ?? []),
      manifestJson: JSON.stringify(input.manifest ?? {}),
      payloadJson: JSON.stringify(input.payload ?? {}),
      pricingModel,
      priceCents: input.priceCents ?? 0,
      ...(publisherId ? { publisherId } : {}),
    };

    const listing = await this.prisma.marketplaceListing.upsert({
      where: { slug },
      create: { ...data, slug, status: 'PUBLISHED', publishedAt: new Date() },
      update: data,
      include: { publisher: PUBLISHER_SELECT },
    });

    this.logger.log(`Published ${listing.kind} listing '${listing.slug}' v${listing.version}`);
    return this.toSummary(listing);
  }

  async setStatus(slug: string, status: string) {
    const next = status.toUpperCase() as ListingStatus;
    if (!(LISTING_STATUSES as readonly string[]).includes(next)) {
      throw new BadRequestException(`Unknown listing status '${status}'.`);
    }
    await this.requireListing(slug);
    const listing = await this.prisma.marketplaceListing.update({
      where: { slug },
      data: {
        status: next,
        // First transition into PUBLISHED is what the storefront sorts "newest" by.
        ...(next === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
      },
      include: { publisher: PUBLISHER_SELECT },
    });
    return this.toSummary(listing);
  }

  async ensurePublisher(slug: string, name?: string, userId?: string) {
    const normalised = toSlug(slug);
    return this.prisma.marketplacePublisher.upsert({
      where: { slug: normalised },
      create: { slug: normalised, name: name ?? slug, userId: userId ?? null },
      update: name ? { name } : {},
    });
  }

  // -------------------------------------------------------------------------
  // Installation
  // -------------------------------------------------------------------------

  /**
   * Installs into a workspace. Re-installing something previously removed
   * reuses the row (the unique key is listing+workspace), so install history
   * and per-workspace settings survive an uninstall.
   */
  async install(input: InstallInput): Promise<InstallationView> {
    const listing = await this.requireListing(input.listingSlug);
    if (!this.canSee(listing, input.workspaceId)) {
      throw new NotFoundException(`Listing '${input.listingSlug}' not found.`);
    }
    if (listing.status !== 'PUBLISHED') {
      throw new BadRequestException(
        `'${listing.slug}' is ${listing.status.toLowerCase()} and cannot be installed.`,
      );
    }
    assertNotAgent(listing.kind);

    const existing = await this.prisma.marketplaceInstallation.findUnique({
      where: {
        listingId_workspaceId: {
          listingId: listing.id,
          workspaceId: input.workspaceId,
        },
      },
    });

    const grantedScopes = JSON.stringify(input.grantedScopes ?? []);
    const settingsJson = JSON.stringify(input.settings ?? {});

    const installation = await this.prisma.marketplaceInstallation.upsert({
      where: {
        listingId_workspaceId: {
          listingId: listing.id,
          workspaceId: input.workspaceId,
        },
      },
      create: {
        listingId: listing.id,
        workspaceId: input.workspaceId,
        installedById: input.installedById ?? null,
        version: listing.version,
        status: 'ACTIVE',
        grantedScopes,
        settingsJson,
      },
      update: {
        status: 'ACTIVE',
        version: listing.version,
        grantedScopes,
        // A re-install keeps existing settings unless new ones were supplied.
        ...(input.settings ? { settingsJson } : {}),
      },
      include: { listing: { include: { publisher: PUBLISHER_SELECT } } },
    });

    // Only a genuinely new active install counts — toggling a disabled add-on
    // back on must not inflate the storefront's install number.
    if (!existing || existing.status === 'UNINSTALLED') {
      await this.prisma.marketplaceListing.update({
        where: { id: listing.id },
        data: { installCount: { increment: 1 } },
      });
    }

    this.logger.log(
      `Installed '${listing.slug}' into workspace ${input.workspaceId}`,
    );
    return this.toInstallation(installation);
  }

  async uninstall(workspaceId: string, listingSlug: string) {
    const listing = await this.requireListing(listingSlug);
    assertNotAgent(listing.kind);
    const installation = await this.requireInstallation(workspaceId, listing.id);

    await this.prisma.marketplaceInstallation.update({
      where: { id: installation.id },
      data: { status: 'UNINSTALLED' },
    });

    if (installation.status !== 'UNINSTALLED') {
      await this.prisma.marketplaceListing.update({
        where: { id: listing.id },
        // Guard the floor: a decrement past zero would be visible in the UI.
        data: { installCount: { decrement: listing.installCount > 0 ? 1 : 0 } },
      });
    }

    return { listingSlug, workspaceId, status: 'UNINSTALLED' as const };
  }

  async requestAccess(
    workspaceId: string,
    listingSlug: string,
    userId: string,
    userName: string,
    reason: string,
  ): Promise<InstallationView> {
    const listing = await this.requireListing(listingSlug);
    assertNotAgent(listing.kind);
    const approvalRequest = {
      requestedBy: userId,
      requestedByName: userName,
      reason,
      requestedAt: new Date().toISOString(),
      status: 'PENDING',
    };

    const settingsJson = JSON.stringify({
      approvalRequest,
      lastActivityAt: new Date().toISOString(),
    });

    const installation = await this.prisma.marketplaceInstallation.upsert({
      where: {
        listingId_workspaceId: {
          listingId: listing.id,
          workspaceId,
        },
      },
      create: {
        listingId: listing.id,
        workspaceId,
        installedById: userId,
        version: listing.version,
        status: 'PENDING_APPROVAL',
        grantedScopes: '[]',
        settingsJson,
      },
      update: {
        status: 'PENDING_APPROVAL',
        settingsJson,
      },
      include: { listing: { include: { publisher: PUBLISHER_SELECT } } },
    });

    this.logger.log(
      `User ${userId} requested access for '${listing.slug}' in workspace ${workspaceId}`,
    );
    return this.toInstallation(installation);
  }

  async listApprovals(workspaceId: string): Promise<InstallationView[]> {
    const rows = await this.prisma.marketplaceInstallation.findMany({
      where: {
        workspaceId,
        status: 'PENDING_APPROVAL',
      },
      include: { listing: { include: { publisher: PUBLISHER_SELECT } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.toInstallation(row));
  }

  async resolveApproval(
    workspaceId: string,
    listingSlug: string,
    adminUserId: string,
    action: 'APPROVE' | 'REJECT',
    rejectionReason?: string,
  ): Promise<InstallationView> {
    const listing = await this.requireListing(listingSlug);
    assertNotAgent(listing.kind);
    const installation = await this.requireInstallation(workspaceId, listing.id);

    const existingSettings = parseJson<Record<string, unknown>>(
      installation.settingsJson,
      {},
    );
    const existingReq =
      (existingSettings['approvalRequest'] as Record<string, unknown>) || {};

    const updatedApproval = {
      ...existingReq,
      reviewedBy: adminUserId,
      reviewedAt: new Date().toISOString(),
      status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      ...(rejectionReason ? { rejectionReason } : {}),
    };

    const newSettings = {
      ...existingSettings,
      approvalRequest: updatedApproval,
      lastActivityAt: new Date().toISOString(),
    };

    if (action === 'APPROVE') {
      const updated = await this.prisma.marketplaceInstallation.update({
        where: { id: installation.id },
        data: {
          status: 'ACTIVE',
          settingsJson: JSON.stringify(newSettings),
        },
        include: { listing: { include: { publisher: PUBLISHER_SELECT } } },
      });

      return this.toInstallation(updated);
    } else {
      const updated = await this.prisma.marketplaceInstallation.update({
        where: { id: installation.id },
        data: {
          status: 'UNINSTALLED',
          settingsJson: JSON.stringify(newSettings),
        },
        include: { listing: { include: { publisher: PUBLISHER_SELECT } } },
      });
      return this.toInstallation(updated);
    }
  }

  async publishCustom(input: {
    kind: string;
    name: string;
    slug: string;
    tagline?: string;
    description?: string;
    category: string;
    capabilities?: string[];
    permissions?: Array<{ scope: string; name: string; level: string; description: string }>;
    commands?: Array<{ command: string; description: string; args?: string }>;
    examplePrompts?: string[];
    iconUrl?: string;
    version?: string;
  }): Promise<ListingSummary> {
    if (input.kind === 'AGENT') {
      throw new BadRequestException(
        'AI agents are published from AI Agent Studio (open the agent → Marketplace tab).',
      );
    }
    const slug = toSlug(input.slug || input.name);
    const publisher = await this.ensurePublisher('community-developer', 'Community Developer');

    // Re-publishing a custom listing is fine; taking over an official or
    // Studio-published one by reusing its slug is not.
    const taken = await this.prisma.marketplaceListing.findUnique({ where: { slug } });
    if (taken && (taken.isOfficial || taken.sourceAgentId || taken.publisherId !== publisher.id)) {
      throw new ConflictException(`The slug '${slug}' is already taken.`);
    }

    const manifest = {
      entityType: input.kind === 'AGENT' ? 'AGENT' : 'APP',
      badge: 'COMMUNITY',
      capabilities: input.capabilities ?? [],
      permissions: input.permissions ?? [],
      commands: input.commands ?? [],
      examplePrompts: input.examplePrompts ?? [],
      requiresAdmin: false,
      security: {
        dataAccessed: ['Workspace context'],
        authentication: 'Custom Integration Protocol',
        dataStorage: 'Isolated workspace context',
        externalServices: [],
        dataBoundaries: 'Workspace isolated',
      },
      compatibility: { platforms: ['Web', 'Desktop', 'Mobile'] },
    };

    const listing = await this.prisma.marketplaceListing.upsert({
      where: { slug },
      create: {
        kind: input.kind as ListingKind,
        slug,
        name: input.name,
        tagline: input.tagline ?? '',
        description: input.description ?? '',
        category: input.category,
        version: input.version ?? '1.0.0',
        iconUrl: input.iconUrl ?? null,
        previewUrl: null,
        tags: JSON.stringify([input.category.toLowerCase(), input.kind.toLowerCase()]),
        manifestJson: JSON.stringify(manifest),
        payloadJson: JSON.stringify({}),
        pricingModel: 'FREE',
        priceCents: 0,
        status: 'PUBLISHED',
        isOfficial: false,
        isFeatured: false,
        publisherId: publisher.id,
        publishedAt: new Date(),
      },
      update: {
        name: input.name,
        tagline: input.tagline ?? '',
        description: input.description ?? '',
        category: input.category,
        iconUrl: input.iconUrl ?? null,
        manifestJson: JSON.stringify(manifest),
      },
      include: { publisher: PUBLISHER_SELECT },
    });

    return this.toSummary(listing);
  }

  async setInstallationEnabled(
    workspaceId: string,
    listingSlug: string,
    enabled: boolean,
  ) {
    const listing = await this.requireListing(listingSlug);
    assertNotAgent(listing.kind);
    const installation = await this.requireInstallation(workspaceId, listing.id);

    const updated = await this.prisma.marketplaceInstallation.update({
      where: { id: installation.id },
      data: { status: enabled ? 'ACTIVE' : 'DISABLED' },
      include: { listing: { include: { publisher: PUBLISHER_SELECT } } },
    });
    return this.toInstallation(updated);
  }

  async updateInstallationSettings(
    workspaceId: string,
    listingSlug: string,
    settings: Record<string, unknown>,
  ) {
    const listing = await this.requireListing(listingSlug);
    assertNotAgent(listing.kind);
    const installation = await this.requireInstallation(workspaceId, listing.id);

    const updated = await this.prisma.marketplaceInstallation.update({
      where: { id: installation.id },
      data: { settingsJson: JSON.stringify(settings ?? {}) },
      include: { listing: { include: { publisher: PUBLISHER_SELECT } } },
    });
    return this.toInstallation(updated);
  }

  async listInstallations(workspaceId: string, kind?: string) {
    if (kind && !isListingKind(kind)) {
      throw new BadRequestException(`Unknown listing kind '${kind}'.`);
    }
    const rows = await this.prisma.marketplaceInstallation.findMany({
      where: {
        workspaceId,
        status: { not: 'UNINSTALLED' },
        ...(kind ? { listing: { kind } } : {}),
      },
      include: { listing: { include: { publisher: PUBLISHER_SELECT } } },
      orderBy: { installedAt: 'desc' },
    });
    return rows.map((row) => this.toInstallation(row));
  }

  // -------------------------------------------------------------------------
  // Reviews
  // -------------------------------------------------------------------------

  async addReview(
    listingSlug: string,
    input: {
      authorId: string;
      authorName: string;
      rating: number;
      title?: string;
      body?: string;
      workspaceId?: string;
    },
  ): Promise<ReviewView> {
    const rating = Math.round(Number(input.rating));
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('A rating must be a whole number from 1 to 5.');
    }
    const listing = await this.requireListing(listingSlug);

    // `workspaceId` arrives in the request body. Attributing a review to a
    // workspace the caller does not belong to was possible before this check
    // (audit S10); an unverified id is dropped rather than trusted.
    let attributedWorkspaceId: string | null = null;
    if (input.workspaceId) {
      const member = await this.prisma.workspaceMember.findFirst({
        where: {
          workspaceId: input.workspaceId,
          userId: input.authorId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      if (!member) {
        throw new ForbiddenException(
          'You can only attribute a review to a workspace you belong to.',
        );
      }
      attributedWorkspaceId = input.workspaceId;
    }

    const [review] = await this.prisma.$transaction([
      this.prisma.marketplaceReview.create({
        data: {
          listingId: listing.id,
          workspaceId: attributedWorkspaceId,
          authorName: input.authorName,
          rating,
          title: input.title ?? null,
          body: input.body ?? '',
        },
      }),
      // Sum + count rather than a stored mean, so this stays one atomic
      // increment instead of a read-modify-write that can lose a concurrent vote.
      this.prisma.marketplaceListing.update({
        where: { id: listing.id },
        data: { ratingSum: { increment: rating }, ratingCount: { increment: 1 } },
      }),
    ]);

    return toReview(review);
  }

  async listReviews(listingSlug: string) {
    const listing = await this.requireListing(listingSlug);
    const rows = await this.prisma.marketplaceReview.findMany({
      where: { listingId: listing.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map(toReview);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private orderFor(sort: BrowseQuery['sort']) {
    switch (sort) {
      case 'rating':
        return [{ ratingSum: 'desc' as const }, { installCount: 'desc' as const }];
      case 'newest':
        return [{ publishedAt: 'desc' as const }, { createdAt: 'desc' as const }];
      case 'name':
        return [{ name: 'asc' as const }];
      case 'popular':
      default:
        return [{ isFeatured: 'desc' as const }, { installCount: 'desc' as const }];
    }
  }

  private async installedListingIds(workspaceId: string, listingIds: string[]) {
    if (listingIds.length === 0) return new Set<string>();
    const rows = await this.prisma.marketplaceInstallation.findMany({
      where: {
        workspaceId,
        listingId: { in: listingIds },
        // A failed, pending or half-finished install is not "installed" — it must stay retryable.
        status: { in: ['ACTIVE', 'DISABLED', 'UPDATING'] },
      },
      select: { listingId: true },
    });
    return new Set(rows.map((row) => row.listingId));
  }

  // -------------------------------------------------------------------------
  // Publishing from AI Agent Studio
  // -------------------------------------------------------------------------

  /** The marketplace listing (if any) a Studio agent has been published as. */
  async getStudioListing(workspaceId: string, agentId: string) {
    const row = await this.prisma.marketplaceListing.findUnique({
      where: {
        ownerWorkspaceId_sourceAgentId: { ownerWorkspaceId: workspaceId, sourceAgentId: agentId },
      },
      include: { publisher: PUBLISHER_SELECT },
    });
    if (!row) return null;
    const live = await this.prisma.marketplaceInstallation.groupBy({
      by: ['version'],
      where: { listingId: row.id, status: { in: ['ACTIVE', 'DISABLED', 'UPDATING'] } },
      _count: { _all: true },
    });
    const byVersion = Object.fromEntries(live.map((g) => [g.version, g._count._all]));
    const behind = live
      .filter((g) => compareSemver(row.version, g.version) > 0)
      .reduce((n, g) => n + g._count._all, 0);
    return { ...this.toSummary(row), installStats: { byVersion, behind } };
  }

  /**
   * Publishes (or re-publishes) a Studio agent as a marketplace listing. The
   * listing carries a snapshot of the agent's latest *published* version, not
   * its draft, so what other workspaces install is what the author shipped.
   * Defaults to workspace-only; `PUBLIC` shares it with every workspace.
   */
  /**
   * What publishing this Studio agent would ship, and whether the platform would
   * accept it as an installable package. Writes nothing, so a creator can check
   * permissions and manifest problems before anyone installs it.
   */
  async validateStudioAgent(workspaceId: string, agentId: string, userId: string, input: PublishStudioAgentInput = {}) {
    const { evaluated, data } = await this.buildStudioPackage(workspaceId, agentId, userId, input);
    return evaluated.ok
      ? { valid: true as const, version: data.version, permissions: evaluated.permissions, configFields: evaluated.manifest.configFields, issues: [] }
      : { valid: false as const, version: data.version, permissions: [], configFields: [], issues: evaluated.issues };
  }

  private async buildStudioPackage(
    workspaceId: string,
    agentId: string,
    userId: string,
    input: PublishStudioAgentInput,
  ) {
    void userId;
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId, type: 'agent' },
    });
    if (!agent) throw new NotFoundException('Agent not found.');

    const config = (agent.configuration as Record<string, any>) ?? {};
    const versions: any[] = Array.isArray(config.versions) ? config.versions : [];
    const latest = versions[0];
    if (config.status !== 'published' || !latest) {
      throw new BadRequestException(
        'Publish this agent in Studio first — only a published version can be shared to the marketplace.',
      );
    }
    if (config.marketplace?.listingSlug) {
      throw new BadRequestException(
        'This agent was installed from the marketplace. Duplicate it before publishing your own version.',
      );
    }

    const visibility = input.visibility === 'PUBLIC' ? 'PUBLIC' : 'WORKSPACE';
    const existing = await this.prisma.marketplaceListing.findUnique({
      where: {
        ownerWorkspaceId_sourceAgentId: { ownerWorkspaceId: workspaceId, sourceAgentId: agentId },
      },
    });

    const versionNumber = Number(latest.version) || Number(config.currentVersion) || 1;
    const version = `${versionNumber}.0.0`;
    const name = (input.name ?? agent.name).trim() || agent.name;
    const tagline = (input.tagline ?? agent.description ?? '').slice(0, 160);
    const category = input.category?.trim() || agent.role || 'Productivity';
    const rawTools = latest.tools ?? agent.tools;
    const tools = parseTools(rawTools);

    const blueprint: AgentBlueprint = {
      name: agent.name,
      role: agent.role,
      description: agent.description,
      avatarUrl: agent.avatarUrl,
      systemPrompt: agent.systemPrompt,
      systemInstructions: agent.systemInstructions,
      provider: latest.provider ?? agent.provider,
      model: latest.model ?? agent.model,
      tools: typeof rawTools === 'string' ? rawTools : JSON.stringify(tools),
      graphJson: latest.graphJson ?? agent.graphJson ?? null,
      configuration: stripWorkspaceSpecific(config),
    };

    const previous = parseJson<Record<string, any>>(existing?.manifestJson, {});
    const changelog = [
      {
        version,
        date: new Date().toISOString().slice(0, 10),
        notes: input.changeNotes?.trim() || latest.changeSummary || 'Published from AI Agent Studio',
      },
      ...(Array.isArray(previous['changelog']) ? previous['changelog'] : []).filter(
        (c: any) => c?.version !== version,
      ),
    ].slice(0, 20);

    const manifest = {
      entityType: 'AGENT',
      badge: visibility === 'PUBLIC' ? 'COMMUNITY' : 'INTERNAL',
      source: 'studio',
      capabilities: tools,
      permissions: [],
      commands: [],
      examplePrompts: Array.isArray(config.examplePrompts) ? config.examplePrompts.slice(0, 6) : [],
      requiresAdmin: false,
      security: {
        dataAccessed: ['Workspace context'],
        authentication: 'Workspace membership',
        dataStorage: 'Isolated workspace context',
        externalServices: [],
        dataBoundaries: 'Workspace isolated',
        modelProvider: String(blueprint.provider),
      },
      compatibility: { platforms: ['Web', 'Desktop', 'Mobile'] },
      changelog,
    };

    const data = {
      kind: 'AGENT' as ListingKind,
      name,
      tagline,
      description: (input.description ?? agent.description ?? '').trim(),
      category,
      version,
      iconUrl: agent.avatarUrl ?? null,
      tags: JSON.stringify(input.tags ?? [category.toLowerCase(), 'studio']),
      manifestJson: JSON.stringify(manifest),
      payloadJson: JSON.stringify({ blueprint }),
      pricingModel: 'FREE',
      priceCents: 0,
      status: 'PUBLISHED',
      visibility,
    };

    const evaluated = evaluateAgentPackage(data.manifestJson, data.payloadJson);
    return { data, existing, visibility, name, evaluated };
  }

  async publishStudioAgent(
    workspaceId: string,
    agentId: string,
    userId: string,
    input: PublishStudioAgentInput = {},
  ): Promise<ListingSummary> {
    const { data, existing, visibility, name, evaluated } = await this.buildStudioPackage(workspaceId, agentId, userId, input);
    if (!evaluated.ok) {
      throw new UnprocessableEntityException({
        code: 'INVALID_PACKAGE',
        message: evaluated.issues[0]?.message ?? 'This agent cannot be packaged for install.',
        issues: evaluated.issues,
      });
    }
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    const publisher = await this.ensurePublisher(
      `ws-${workspaceId.slice(-10).toLowerCase()}`,
      workspace?.name ?? 'Workspace',
      userId,
    );

    const listingData = { ...data, publisherId: publisher.id };

    const row = existing
      ? await this.prisma.marketplaceListing.update({
          where: { id: existing.id },
          data: { ...listingData, publishedAt: new Date() },
          include: { publisher: PUBLISHER_SELECT },
        })
      : await this.prisma.marketplaceListing.create({
          data: {
            ...listingData,
            slug: await this.uniqueSlug(`${toSlug(name) || 'agent'}-${workspaceId.slice(-6).toLowerCase()}`),
            ownerWorkspaceId: workspaceId,
            sourceAgentId: agentId,
            publishedAt: new Date(),
          },
          include: { publisher: PUBLISHER_SELECT },
        });

    this.logger.log(
      `Studio agent ${agentId} published as ${visibility} listing '${row.slug}' v${row.version}`,
    );
    return this.toSummary(row);
  }

  /** Takes a Studio-published listing off the storefront (installs elsewhere keep working). */
  async unpublishStudioAgent(workspaceId: string, agentId: string) {
    const existing = await this.prisma.marketplaceListing.findUnique({
      where: {
        ownerWorkspaceId_sourceAgentId: { ownerWorkspaceId: workspaceId, sourceAgentId: agentId },
      },
    });
    if (!existing) throw new NotFoundException('This agent is not on the marketplace.');
    const row = await this.prisma.marketplaceListing.update({
      where: { id: existing.id },
      data: { status: 'DEPRECATED' },
      include: { publisher: PUBLISHER_SELECT },
    });
    return this.toSummary(row);
  }

  private async uniqueSlug(base: string) {
    let slug = base;
    for (let i = 2; await this.prisma.marketplaceListing.findUnique({ where: { slug } }); i++) {
      slug = `${base}-${i}`;
    }
    return slug;
  }

  /** Listings a workspace may see: everything public plus its own workspace-only ones. */
  private visibleTo(workspaceId?: string) {
    return workspaceId
      ? { OR: [{ visibility: 'PUBLIC' }, { ownerWorkspaceId: workspaceId }] }
      : { visibility: 'PUBLIC' };
  }

  canSee(
    listing: { visibility?: string; ownerWorkspaceId?: string | null },
    workspaceId?: string,
  ) {
    return (
      listing.visibility !== 'WORKSPACE' ||
      (!!workspaceId && listing.ownerWorkspaceId === workspaceId)
    );
  }

  /** Shared by every path that resolves a listing from a URL slug. */
  async requireListing(slug: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { slug },
    });
    if (!listing) throw new NotFoundException(`Listing '${slug}' not found.`);
    return listing;
  }

  async requireInstallation(workspaceId: string, listingId: string) {
    const installation = await this.prisma.marketplaceInstallation.findUnique({
      where: { listingId_workspaceId: { listingId, workspaceId } },
    });
    if (!installation) {
      throw new NotFoundException('This listing is not installed in the workspace.');
    }
    return installation;
  }

  toSummary(
    row: ListingRow,
    installed?: boolean,
    includePayload = false,
  ): ListingSummary {
    const manifest = parseJson<Record<string, unknown>>(row.manifestJson, {});
    const isAgent = row.kind === 'AGENT' || manifest['entityType'] === 'AGENT';

    return {
      id: row.id,
      kind: row.kind as ListingSummary['kind'],
      slug: row.slug,
      name: row.name,
      tagline: row.tagline,
      category: row.category,
      version: row.version,
      iconUrl: row.iconUrl,
      previewUrl: row.previewUrl,
      tags: parseJson<string[]>(row.tags, []),
      pricingModel: row.pricingModel as ListingSummary['pricingModel'],
      priceCents: row.priceCents,
      status: row.status as ListingStatus,
      isOfficial: row.isOfficial,
      isFeatured: row.isFeatured,
      installCount: row.installCount,
      rating:
        row.ratingCount > 0
          ? Math.round((row.ratingSum / row.ratingCount) * 10) / 10
          : 0,
      ratingCount: row.ratingCount,
      publisher: row.publisher ?? null,
      ...(installed === undefined ? {} : { installed }),
      ...(includePayload
        ? { payload: parseJson<Record<string, unknown>>(row.payloadJson, {}) }
        : {}),
      entityType: isAgent ? 'AGENT' : 'APP',
      visibility: row.visibility === 'WORKSPACE' ? 'WORKSPACE' : 'PUBLIC',
      ownerWorkspaceId: row.ownerWorkspaceId ?? null,
      source: row.sourceAgentId ? 'studio' : undefined,
      badge:
        (manifest['badge'] as string) ||
        (row.isOfficial ? 'OFFICIAL' : 'COMMUNITY'),
      capabilities: (manifest['capabilities'] as string[]) || [],
      permissions: (manifest['permissions'] as any) || [],
      commands: (manifest['commands'] as any) || [],
      examplePrompts: (manifest['examplePrompts'] as string[]) || [],
      requiresAdmin: Boolean(manifest['requiresAdmin']),
      security: (manifest['security'] as Record<string, unknown>) || undefined,
      compatibility:
        (manifest['compatibility'] as Record<string, unknown>) || undefined,
      screenshots: (manifest['screenshots'] as string[]) || [],
      changelog: (manifest['changelog'] as any) || [],
    };
  }

  toInstallation(row: {
    id: string;
    listingId: string;
    workspaceId: string;
    version: string;
    status: string;
    settingsJson: string;
    grantedScopes: string;
    installedAt: Date;
    installedById?: string | null;
    scope?: string;
    accessJson?: string;
    agentId?: string | null;
    lastError?: string | null;
    lastErrorCode?: string | null;
    healthJson?: string;
    approvedPermissions?: string;
    listing: ListingRow;
  }): InstallationView {
    const settings = parseJson<Record<string, unknown>>(row.settingsJson, {});
    const approvalRequest = settings['approvalRequest'] as
      | Record<string, unknown>
      | null;
    const lastActivityAt =
      (settings['lastActivityAt'] as string) || row.installedAt.toISOString();
    const isAgent = row.listing.kind === 'AGENT';

    return {
      id: row.id,
      listingId: row.listingId,
      workspaceId: row.workspaceId,
      version: row.version,
      status: row.status,
      settings,
      grantedScopes: parseJson<string[]>(row.grantedScopes, []),
      installedAt: row.installedAt,
      listing: this.toSummary(row.listing, true),
      approvalRequest: approvalRequest ?? null,
      lastActivityAt,
      entityType: isAgent ? 'AGENT' : 'APP',
      installedById: row.installedById ?? null,
      scope: row.scope ?? 'WORKSPACE',
      access: parseAccess(row.accessJson),
      agentId: row.agentId ?? null,
      lastError: row.lastError ?? null,
      lastErrorCode: row.lastErrorCode ?? null,
      // A column default of '{}' (never checked) must read as "no result", not an empty result.
      health: parseHealth(row.healthJson),
      approvedPermissions: parseJson<string[]>(row.approvedPermissions, []),
      latestVersion: row.listing.version,
      updateAvailable: isAgent && compareSemver(row.listing.version, row.version) > 0,
    };
  }
}

function parseHealth(raw: string | undefined): InstallationView['health'] {
  const value = parseJson<Partial<NonNullable<InstallationView['health']>>>(raw, {});
  return Array.isArray(value.checks) ? (value as NonNullable<InstallationView['health']>) : null;
}

/** Agents have a lifecycle (permissions, config, health, rollback) the generic install lacks. */
function assertNotAgent(kind: string) {
  if (kind === 'AGENT') {
    throw new BadRequestException({
      code: 'USE_AGENT_INSTALL_FLOW',
      message: 'Agents are installed through the agent install flow.',
    });
  }
}

function toReview(row: {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: Date;
}): ReviewView {
  return {
    id: row.id,
    authorName: row.authorName,
    rating: row.rating,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt,
  };
}
