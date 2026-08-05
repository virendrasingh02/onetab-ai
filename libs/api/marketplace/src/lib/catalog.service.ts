import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@org/database';
import {
  BUILT_IN_CATALOG,
  FEATURED_SLUGS,
  OFFICIAL_PUBLISHERS,
} from './marketplace.catalog.js';
import { MarketplaceService } from './marketplace.service.js';

/**
 * Keeps the built-in catalog in the database.
 *
 * Seeding is idempotent (upsert by slug), so it is safe to run on every boot —
 * but it only runs automatically outside production, where an operator should
 * decide when the storefront content changes. In production it is a deliberate
 * `POST /marketplace/catalog/seed`.
 */
@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly marketplace: MarketplaceService,
  ) {}

  async onModuleInit() {
    if (this.config.get('NODE_ENV') === 'production') return;
    if (this.config.get('MARKETPLACE_AUTOSEED') === 'false') return;

    try {
      const existing = await this.prisma.marketplaceListing.count();
      if (existing > 0) return;
      const result = await this.seed();
      this.logger.log(
        `Seeded the marketplace with ${result.seeded} listings across ${result.kinds} storefronts`,
      );
    } catch (error) {
      // A marketplace without its demo catalog is a degraded storefront, not a
      // reason to refuse to boot the whole API.
      this.logger.warn(
        `Marketplace catalog seeding skipped: ${(error as Error).message}`,
      );
    }
  }

  /** Publishes (or re-publishes) every built-in listing. */
  async seed() {
    for (const entry of BUILT_IN_CATALOG) {
      await this.marketplace.publish(entry);
    }

    await this.prisma.marketplaceListing.updateMany({
      where: { slug: { in: FEATURED_SLUGS } },
      data: { isFeatured: true },
    });

    const officialPublishers = await this.prisma.marketplacePublisher.findMany({
      where: { slug: { in: OFFICIAL_PUBLISHERS } },
      select: { id: true },
    });
    if (officialPublishers.length > 0) {
      await this.prisma.marketplacePublisher.updateMany({
        where: { slug: { in: OFFICIAL_PUBLISHERS } },
        data: { isVerified: true },
      });
      await this.prisma.marketplaceListing.updateMany({
        where: { publisherId: { in: officialPublishers.map((row) => row.id) } },
        data: { isOfficial: true },
      });
    }

    return {
      seeded: BUILT_IN_CATALOG.length,
      kinds: new Set(BUILT_IN_CATALOG.map((entry) => entry.kind)).size,
      featured: FEATURED_SLUGS.length,
    };
  }
}
