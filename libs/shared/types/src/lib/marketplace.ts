/**
 * Phase 12 — Marketplace contracts shared by the API client and the web views.
 *
 * All seven storefronts are the same listing shape with a different `kind`, so
 * one set of types covers plugins, themes, agents, workflows, components,
 * integrations and community templates.
 */

export const MARKETPLACE_KINDS = [
  'PLUGIN',
  'THEME',
  'AGENT',
  'WORKFLOW',
  'COMPONENT',
  'INTEGRATION',
  'TEMPLATE',
] as const;

export type MarketplaceKind = (typeof MARKETPLACE_KINDS)[number];

export type MarketplaceListingStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'DEPRECATED';

export type MarketplacePricingModel = 'FREE' | 'FREEMIUM' | 'PAID';

export type MarketplaceSort = 'popular' | 'rating' | 'newest' | 'name';

export interface MarketplacePublisher {
  name: string;
  slug: string;
  isVerified: boolean;
}

export interface MarketplaceListing {
  id: string;
  kind: MarketplaceKind;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  version: string;
  iconUrl: string | null;
  previewUrl: string | null;
  tags: string[];
  pricingModel: MarketplacePricingModel;
  priceCents: number;
  status: MarketplaceListingStatus;
  isOfficial: boolean;
  isFeatured: boolean;
  installCount: number;
  /** Mean of all reviews, rounded to one decimal. Zero when unrated. */
  rating: number;
  ratingCount: number;
  publisher: MarketplacePublisher | null;
  /** Only present when the request named a workspace. */
  installed?: boolean;
  /** Only present when the browse call passed `includePayload`. */
  payload?: Record<string, unknown>;
}

export interface MarketplaceReview {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: string;
}

export interface MarketplaceListingDetail extends MarketplaceListing {
  description: string;
  manifest: Record<string, unknown>;
  payload: Record<string, unknown>;
  reviews: MarketplaceReview[];
  createdAt: string;
  updatedAt: string;
}

export interface MarketplacePage {
  items: MarketplaceListing[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface MarketplaceStorefrontStat {
  kind: MarketplaceKind;
  listingCount: number;
  installCount: number;
  /** How many of this kind the current workspace has installed. */
  installedHere: number;
}

export interface MarketplaceInstallation {
  id: string;
  listingId: string;
  workspaceId: string;
  version: string;
  status: 'ACTIVE' | 'DISABLED' | 'UNINSTALLED';
  settings: Record<string, unknown>;
  grantedScopes: string[];
  installedAt: string;
  listing: MarketplaceListing;
}

export interface MarketplaceBrowseParams {
  kind?: MarketplaceKind;
  category?: string;
  search?: string;
  pricing?: MarketplacePricingModel;
  featured?: boolean;
  sort?: MarketplaceSort;
  page?: number;
  pageSize?: number;
  /** Ask for each listing's payload — needed to preview it in the grid. */
  includePayload?: boolean;
}

export interface MarketplaceCategoryCount {
  category: string;
  count: number;
}

export interface MarketplaceStorefronts {
  kinds: readonly MarketplaceKind[];
  categories: Record<MarketplaceKind, readonly string[]>;
}

// --- Plugin SDK ------------------------------------------------------------

export type PluginRuntime = 'SANDBOXED_JS' | 'WEBHOOK' | 'IFRAME';

export interface PluginManifest {
  name: string;
  slug: string;
  version: string;
  sdkVersion?: string;
  runtime?: PluginRuntime;
  entryPoint?: string;
  webhookUrl?: string;
  scopes?: string[];
  surfaces?: string[];
  description?: string;
}

export interface PluginSDKDescriptor {
  sdkVersion: string;
  runtimes: readonly PluginRuntime[];
  scopes: readonly string[];
  /** Scopes that need an explicit admin grant at install time. */
  privilegedScopes: readonly string[];
  surfaces: readonly string[];
  manifestExample: PluginManifest;
}

export interface PluginManifestValidation {
  valid: boolean;
  errors: string[];
  normalised: PluginManifest;
  requiresConsent: string[];
}

/** Returned once, at registration — the plaintext key is never stored. */
export interface PluginCredentials {
  registrationId: string;
  listingSlug: string;
  apiKey: string;
  apiKeyPrefix: string;
  sdkVersion: string;
  scopes: string[];
}

export interface PluginRegistrationView {
  id: string;
  listingId: string;
  runtime: PluginRuntime;
  sdkVersion: string;
  entryPoint: string | null;
  webhookUrl: string | null;
  apiKeyPrefix: string | null;
  scopes: string[];
  surfaces: string[];
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
}
