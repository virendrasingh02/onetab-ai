export { MarketplaceModule } from './lib/marketplace.module.js';
export { MarketplaceService } from './lib/marketplace.service.js';
export { MarketplaceController } from './lib/marketplace.controller.js';
export { PluginSDKService } from './lib/plugin-sdk.service.js';
export { CatalogService } from './lib/catalog.service.js';

export {
  BUILT_IN_CATALOG,
  FEATURED_SLUGS,
  OFFICIAL_PUBLISHERS,
} from './lib/marketplace.catalog.js';

export {
  CATEGORIES_BY_KIND,
  INSTALL_STATUSES,
  LISTING_KINDS,
  LISTING_STATUSES,
  PLUGIN_RUNTIMES,
  PLUGIN_SCOPES,
  PLUGIN_SURFACES,
  PRICING_MODELS,
  PRIVILEGED_SCOPES,
  SDK_VERSION,
  isListingKind,
  isPluginScope,
  isPluginSurface,
  type InstallStatus,
  type ListingKind,
  type ListingStatus,
  type PluginRuntime,
  type PluginScope,
  type PluginSurface,
  type PricingModel,
} from './lib/marketplace.constants.js';

export type {
  BrowseQuery,
  InstallInput,
  InstallationView,
  IssuedPluginCredentials,
  ListingDetail,
  ListingSummary,
  PluginManifest,
  PublishListingInput,
  ReviewView,
} from './lib/marketplace.types.js';
