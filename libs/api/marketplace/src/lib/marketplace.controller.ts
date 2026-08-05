import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, type AuthenticatedUser } from '@org/api-common';
import { CatalogService } from './catalog.service.js';
import {
  CATEGORIES_BY_KIND,
  LISTING_KINDS,
  type PluginScope,
} from './marketplace.constants.js';
import { MarketplaceService } from './marketplace.service.js';
import type {
  BrowseQuery,
  PluginManifest,
  PublishListingInput,
} from './marketplace.types.js';
import { PluginSDKService } from './plugin-sdk.service.js';

/**
 * Phase 12 — Marketplace.
 *
 * Browsing is workspace-agnostic; installing is not. The workspace-scoped
 * routes carry `:workspaceId` and sit behind `WorkspaceRoleGuard`, which
 * rejects non-members before a handler runs — so nothing below re-checks
 * whether the caller may touch the workspace.
 */
@Controller({ path: 'marketplace', version: '1' })
export class MarketplaceController {
  constructor(
    private readonly marketplace: MarketplaceService,
    private readonly plugins: PluginSDKService,
    private readonly catalog: CatalogService,
  ) {}

  // --- storefronts ---------------------------------------------------------

  /** The seven storefronts and what each currently holds. */
  @Get('storefronts')
  getStorefronts() {
    return {
      kinds: LISTING_KINDS,
      categories: CATEGORIES_BY_KIND,
    };
  }

  @Get('stats')
  getStats(@Query('workspaceId') workspaceId?: string) {
    return this.marketplace.getStorefrontStats(workspaceId);
  }

  @Get('listings')
  browse(@Query() query: BrowseQuery & { workspaceId?: string }) {
    const { workspaceId, ...rest } = query;
    return this.marketplace.browse(rest, workspaceId);
  }

  @Get('listings/:slug')
  getListing(
    @Param('slug') slug: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.marketplace.getListing(slug, workspaceId);
  }

  @Get('kinds/:kind/categories')
  getCategories(@Param('kind') kind: string) {
    return this.marketplace.listCategories(kind.toUpperCase());
  }

  // --- publishing ----------------------------------------------------------

  @Post('listings')
  publish(@Body() body: PublishListingInput) {
    return this.marketplace.publish(body);
  }

  @Patch('listings/:slug/status')
  setStatus(@Param('slug') slug: string, @Body() body: { status: string }) {
    return this.marketplace.setStatus(slug, body.status);
  }

  @Post('catalog/seed')
  seedCatalog() {
    return this.catalog.seed();
  }

  // --- reviews -------------------------------------------------------------

  @Get('listings/:slug/reviews')
  listReviews(@Param('slug') slug: string) {
    return this.marketplace.listReviews(slug);
  }

  @Post('listings/:slug/reviews')
  addReview(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: { rating: number; title?: string; body?: string; workspaceId?: string },
  ) {
    return this.marketplace.addReview(slug, {
      // Taken from the session, not the payload — otherwise anyone could post a
      // review under someone else's name.
      authorName: user.name ?? user.email,
      rating: body.rating,
      title: body.title,
      body: body.body,
      workspaceId: body.workspaceId,
    });
  }

  // --- installation (workspace-scoped) -------------------------------------

  @Get('workspaces/:workspaceId/installations')
  @UseGuards(WorkspaceRoleGuard)
  listInstallations(
    @Param('workspaceId') workspaceId: string,
    @Query('kind') kind?: string,
  ) {
    return this.marketplace.listInstallations(
      workspaceId,
      kind ? kind.toUpperCase() : undefined,
    );
  }

  @Post('workspaces/:workspaceId/installations')
  @UseGuards(WorkspaceRoleGuard)
  install(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      listingSlug: string;
      grantedScopes?: string[];
      settings?: Record<string, unknown>;
    },
  ) {
    return this.marketplace.install({
      workspaceId,
      listingSlug: body.listingSlug,
      grantedScopes: body.grantedScopes,
      settings: body.settings,
      installedById: user.id,
    });
  }

  @Patch('workspaces/:workspaceId/installations/:slug')
  @UseGuards(WorkspaceRoleGuard)
  updateInstallation(
    @Param('workspaceId') workspaceId: string,
    @Param('slug') slug: string,
    @Body() body: { enabled?: boolean; settings?: Record<string, unknown> },
  ) {
    if (body.settings) {
      return this.marketplace.updateInstallationSettings(
        workspaceId,
        slug,
        body.settings,
      );
    }
    return this.marketplace.setInstallationEnabled(
      workspaceId,
      slug,
      body.enabled ?? true,
    );
  }

  @Delete('workspaces/:workspaceId/installations/:slug')
  @UseGuards(WorkspaceRoleGuard)
  uninstall(
    @Param('workspaceId') workspaceId: string,
    @Param('slug') slug: string,
  ) {
    return this.marketplace.uninstall(workspaceId, slug);
  }

  // --- plugin SDK ----------------------------------------------------------

  /** The SDK contract: runtimes, scopes, surfaces and a worked manifest. */
  @Get('sdk')
  getSDK() {
    return this.plugins.getSDKDescriptor();
  }

  @Post('sdk/validate')
  validateManifest(@Body() manifest: PluginManifest) {
    return this.plugins.validateManifest(manifest);
  }

  @Post('plugins/:slug/register')
  registerPlugin(
    @Param('slug') slug: string,
    @Body() manifest: PluginManifest,
  ) {
    return this.plugins.register(slug, manifest);
  }

  @Get('plugins/:slug/registration')
  getRegistration(@Param('slug') slug: string) {
    return this.plugins.getRegistration(slug);
  }

  @Post('plugins/:slug/rotate-key')
  rotateKey(@Param('slug') slug: string) {
    return this.plugins.rotateApiKey(slug);
  }

  @Patch('plugins/:slug/status')
  setPluginStatus(
    @Param('slug') slug: string,
    @Body() body: { status: 'ACTIVE' | 'SUSPENDED' },
  ) {
    return this.plugins.setStatus(slug, body.status);
  }

  /**
   * Lets an author confirm a scope resolves before shipping the plugin.
   *
   * The workspace is a path param, not a query one, because `WorkspaceRoleGuard`
   * resolves membership from `:workspaceId`.
   */
  @Get('workspaces/:workspaceId/plugins/:slug/scope-check')
  @UseGuards(WorkspaceRoleGuard)
  checkScope(
    @Param('workspaceId') workspaceId: string,
    @Param('slug') slug: string,
    @Query('scope') scope: string,
  ) {
    return this.plugins.assertScope(slug, workspaceId, scope as PluginScope);
  }
}
