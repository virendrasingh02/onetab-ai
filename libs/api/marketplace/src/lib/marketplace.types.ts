import type {
  ListingKind,
  ListingStatus,
  PluginRuntime,
  PricingModel,
} from './marketplace.constants.js';

/** Listing shape returned to clients — no publisher secrets, no raw payload. */
export interface ListingSummary {
  id: string;
  kind: ListingKind;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  version: string;
  iconUrl: string | null;
  previewUrl: string | null;
  tags: string[];
  pricingModel: PricingModel;
  priceCents: number;
  status: ListingStatus;
  isOfficial: boolean;
  isFeatured: boolean;
  installCount: number;
  rating: number;
  ratingCount: number;
  publisher: { name: string; slug: string; isVerified: boolean } | null;
  /** Present only on workspace-scoped browse calls. */
  installed?: boolean;
  /**
   * Present only when the caller asked for it. Storefronts that preview the
   * payload in the grid — theme swatches, component prop lists — need it on
   * every card, and one bulk read beats one detail request per card.
   */
  payload?: Record<string, unknown>;
}

export interface ListingDetail extends ListingSummary {
  description: string;
  manifest: Record<string, unknown>;
  payload: Record<string, unknown>;
  reviews: ReviewView[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewView {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: Date;
}

export interface InstallationView {
  id: string;
  listingId: string;
  workspaceId: string;
  version: string;
  status: string;
  settings: Record<string, unknown>;
  grantedScopes: string[];
  installedAt: Date;
  listing: ListingSummary;
}

export interface BrowseQuery {
  kind?: string;
  category?: string;
  search?: string;
  pricing?: string;
  featured?: string | boolean;
  sort?: 'popular' | 'rating' | 'newest' | 'name';
  page?: string | number;
  pageSize?: string | number;
  /** Include each listing's payload — see `ListingSummary.payload`. */
  includePayload?: string | boolean;
}

export interface PublishListingInput {
  kind: string;
  slug: string;
  name: string;
  tagline?: string;
  description?: string;
  category: string;
  version?: string;
  iconUrl?: string;
  previewUrl?: string;
  tags?: string[];
  manifest?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  pricingModel?: string;
  priceCents?: number;
  publisherSlug?: string;
  publisherName?: string;
}

export interface InstallInput {
  workspaceId: string;
  listingSlug: string;
  grantedScopes?: string[];
  settings?: Record<string, unknown>;
  installedById?: string;
}

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

/** Returned once, at registration. The plaintext key is never stored. */
export interface IssuedPluginCredentials {
  registrationId: string;
  listingSlug: string;
  apiKey: string;
  apiKeyPrefix: string;
  sdkVersion: string;
  scopes: string[];
}
