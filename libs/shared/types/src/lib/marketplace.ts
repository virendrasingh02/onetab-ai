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

export type IntegrationEntityType = 'APP' | 'AGENT';

export type MarketplaceVisibility = 'PUBLIC' | 'WORKSPACE';

/** What AI Agent Studio sends to turn a published agent into a listing. */
export interface PublishAgentListingInput {
  visibility?: MarketplaceVisibility;
  name?: string;
  tagline?: string;
  description?: string;
  category?: string;
  tags?: string[];
  changeNotes?: string;
}

export type VerificationBadge =
  | 'VERIFIED'
  | 'OFFICIAL'
  | 'INTERNAL'
  | 'COMMUNITY'
  | 'UNVERIFIED';

export type PermissionLevel = 'READ' | 'WRITE' | 'ADMIN' | 'SENSITIVE';

export interface IntegrationPermission {
  scope: string;
  name: string;
  level: PermissionLevel;
  description: string;
}

export interface IntegrationCommand {
  command: string;
  description: string;
  args?: string;
}

export interface IntegrationSecurity {
  dataAccessed: string[];
  authentication: string;
  dataStorage: string;
  externalServices: string[];
  dataBoundaries: string;
  modelProvider?: string;
  approvalRequiredActions?: string[];
}

export interface IntegrationCompatibility {
  minVersion?: string;
  platforms: string[];
}

export interface IntegrationChangelogItem {
  version: string;
  date: string;
  notes: string;
}

export interface ApprovalRequest {
  requestedBy: string;
  requestedByName: string;
  reason: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface MarketplacePublisher {
  name: string;
  slug: string;
  isVerified: boolean;
  websiteUrl?: string | null;
  supportEmail?: string | null;
}

/** The workspace member answerable for a listing: its Studio builder, else its installer. */
export interface MarketplaceListingOwner {
  id: string;
  name: string;
  avatarUrl: string | null;
  relation: 'BUILT' | 'INSTALLED';
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
  /** First-class entity designation */
  entityType?: IntegrationEntityType;
  /** `WORKSPACE` listings are only visible to the workspace that published them. */
  visibility?: MarketplaceVisibility;
  ownerWorkspaceId?: string | null;
  /** `studio` when published from AI Agent Studio. */
  source?: 'studio';
  badge?: VerificationBadge;
  capabilities?: string[];
  permissions?: IntegrationPermission[];
  commands?: IntegrationCommand[];
  examplePrompts?: string[];
  requiresAdmin?: boolean;
  security?: IntegrationSecurity;
  compatibility?: IntegrationCompatibility;
  screenshots?: string[];
  changelog?: IntegrationChangelogItem[];
  description?: string;
  publisherName?: string;
  approvalStatus?: string;
  installationCount?: number;
  ratingAverage?: number;
  /** Creator view of a Studio listing: live installs per version, and how many lag the listed version. */
  installStats?: { byVersion: Record<string, number>; behind: number };
  /** Only present when the request named a workspace; null when nobody here owns it. */
  owner?: MarketplaceListingOwner | null;
}

export interface AgentPackageValidation {
  valid: boolean;
  version: string;
  permissions: AgentPermissionRequest[];
  configFields: AgentConfigField[];
  issues: Array<{ code: string; message: string }>;
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

export type InstallationStatus =
  | 'ACTIVE'
  | 'DISABLED'
  | 'INSTALLING'
  | 'UPDATING'
  | 'PENDING_APPROVAL'
  | 'CONFIG_REQUIRED'
  | 'SUSPENDED'
  | 'FAILED'
  | 'UNINSTALLED';

export interface MarketplaceInstallation {
  id: string;
  listingId: string;
  workspaceId: string;
  version: string;
  status: InstallationStatus;
  settings: Record<string, unknown>;
  grantedScopes: string[];
  installedAt: string;
  listing: MarketplaceListing;
  approvalRequest?: ApprovalRequest | null;
  lastActivityAt?: string | null;
  entityType?: IntegrationEntityType;
  listingSlug?: string;
  name?: string;
  kind?: MarketplaceKind;
  iconUrl?: string | null;
  enabled?: boolean;
  approvalStatus?: string;
  requestReason?: string;
  requestedBy?: string;
  requesterName?: string;
  // --- agent install lifecycle (AGENT listings) ---
  installedById?: string | null;
  scope?: AgentInstallScope;
  access?: AgentInstallAccess;
  /** The workspace agent this install provisioned — what chat opens. */
  agentId?: string | null;
  lastError?: string | null;
  lastErrorCode?: string | null;
  health?: AgentHealthResult | null;
  approvedPermissions?: string[];
  latestVersion?: string;
  updateAvailable?: boolean;
}

export type AgentInstallScope = 'WORKSPACE' | 'PERSONAL' | 'ADMIN_MANAGED';

export interface AgentInstallAccess {
  mode: 'EVERYONE' | 'RESTRICTED';
  userIds: string[];
  roles: string[];
}

export interface AgentHealthResult {
  ok: boolean;
  checkedAt: string;
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
}

export interface AgentPermissionRequest {
  id: string;
  kind: 'tool' | 'network' | 'data' | 'code' | 'connector';
  label: string;
  description: string;
  sensitive: boolean;
}

export interface AgentConfigField {
  key: string;
  label: string;
  type: 'text' | 'secret' | 'url' | 'select' | 'boolean';
  required: boolean;
  description?: string;
  options?: string[];
}

export interface AgentInstallPreview {
  listing: MarketplaceListing;
  installable: boolean;
  ownAgent: boolean;
  listingStatus: string;
  issues: Array<{ code: string; message: string }>;
  permissions: AgentPermissionRequest[];
  configFields: AgentConfigField[];
  dependencies: { connectors: string[]; externalServices: string[] } | null;
  compatibility: { minPlatformVersion: string; platforms: string[] } | null;
  /** True when the caller cannot install on their own and must ask an admin. */
  requiresAdminApproval: boolean;
  canInstall: boolean;
  forcedScope: AgentInstallScope | null;
  reason: string | null;
  installation: MarketplaceInstallation | null;
  /** Permissions an available update would add on top of what was approved. */
  newPermissions: AgentPermissionRequest[];
}

export interface AgentInstallRequest {
  scope?: AgentInstallScope;
  access?: Partial<AgentInstallAccess>;
  settings?: Record<string, unknown>;
  approvedPermissions?: string[];
  reason?: string;
}

export interface AgentInstallResult {
  installation: MarketplaceInstallation;
  alreadyInstalled: boolean;
}

export interface AgentAuditEntry {
  id: string;
  action: string;
  target: string | null;
  actor: { id: string; name: string | null; email: string } | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface MarketplaceBrowseParams {
  kind?: MarketplaceKind;
  entityType?: IntegrationEntityType;
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
