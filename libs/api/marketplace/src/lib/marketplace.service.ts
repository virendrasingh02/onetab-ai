import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
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

/** Publisher fields a listing response is allowed to carry. */
const PUBLISHER_SELECT = {
  select: { name: true, slug: true, isVerified: true },
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
  publisher?: { name: string; slug: string; isVerified: boolean } | null;
  payloadJson?: string;
}

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    const where = {
      status: 'PUBLISHED',
      ...(query.kind ? { kind: query.kind } : {}),
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
        where: { status: 'PUBLISHED' },
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
    if (!listing) throw new NotFoundException(`Listing '${slug}' not found.`);

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
    if (listing.status !== 'PUBLISHED') {
      throw new BadRequestException(
        `'${listing.slug}' is ${listing.status.toLowerCase()} and cannot be installed.`,
      );
    }

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

  async setInstallationEnabled(
    workspaceId: string,
    listingSlug: string,
    enabled: boolean,
  ) {
    const listing = await this.requireListing(listingSlug);
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
        status: { not: 'UNINSTALLED' },
      },
      select: { listingId: true },
    });
    return new Set(rows.map((row) => row.listingId));
  }

  /** Shared by every path that resolves a listing from a URL slug. */
  async requireListing(slug: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { slug },
    });
    if (!listing) throw new NotFoundException(`Listing '${slug}' not found.`);
    return listing;
  }

  private async requireInstallation(workspaceId: string, listingId: string) {
    const installation = await this.prisma.marketplaceInstallation.findUnique({
      where: { listingId_workspaceId: { listingId, workspaceId } },
    });
    if (!installation) {
      throw new NotFoundException('This listing is not installed in the workspace.');
    }
    return installation;
  }

  private toSummary(
    row: ListingRow,
    installed?: boolean,
    includePayload = false,
  ): ListingSummary {
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
    };
  }

  private toInstallation(row: {
    id: string;
    listingId: string;
    workspaceId: string;
    version: string;
    status: string;
    settingsJson: string;
    grantedScopes: string;
    installedAt: Date;
    listing: ListingRow;
  }): InstallationView {
    return {
      id: row.id,
      listingId: row.listingId,
      workspaceId: row.workspaceId,
      version: row.version,
      status: row.status,
      settings: parseJson<Record<string, unknown>>(row.settingsJson, {}),
      grantedScopes: parseJson<string[]>(row.grantedScopes, []),
      installedAt: row.installedAt,
      listing: this.toSummary(row.listing, true),
    };
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
