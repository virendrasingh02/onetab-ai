/**
 * Phase 12 — Marketplace vocabulary.
 *
 * The seven storefronts are seven `kind` values over one listing table, so the
 * kind list here is the single place that decides what may be published.
 */

export const LISTING_KINDS = [
  'PLUGIN',
  'THEME',
  'AGENT',
  'WORKFLOW',
  'COMPONENT',
  'INTEGRATION',
  'TEMPLATE',
] as const;

export type ListingKind = (typeof LISTING_KINDS)[number];

export const LISTING_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'REJECTED',
  'DEPRECATED',
] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const INSTALL_STATUSES = ['ACTIVE', 'DISABLED', 'UNINSTALLED'] as const;

export type InstallStatus = (typeof INSTALL_STATUSES)[number];

export const PRICING_MODELS = ['FREE', 'FREEMIUM', 'PAID'] as const;

export type PricingModel = (typeof PRICING_MODELS)[number];

export const PLUGIN_RUNTIMES = ['SANDBOXED_JS', 'WEBHOOK', 'IFRAME'] as const;

export type PluginRuntime = (typeof PLUGIN_RUNTIMES)[number];

/** Current Plugin SDK contract. Manifests declaring a newer major are rejected. */
export const SDK_VERSION = '1.0.0';

/**
 * Every permission a plugin may request. A manifest asking for anything outside
 * this list is rejected at registration rather than at call time — an unknown
 * scope is a typo or a plugin built against a newer SDK, and silently dropping
 * it would leave the author debugging a permission that never took effect.
 */
export const PLUGIN_SCOPES = [
  'read:workspace',
  'write:workspace',
  'read:channels',
  'write:channels',
  'read:messages',
  'write:messages',
  'read:tasks',
  'write:tasks',
  'read:documents',
  'write:documents',
  'read:files',
  'write:files',
  'read:members',
  'read:analytics',
  'ui:surface',
  'net:fetch',
  'ai:invoke',
] as const;

export type PluginScope = (typeof PLUGIN_SCOPES)[number];

/** Scopes that grant mutation or egress, and so need an explicit admin grant. */
export const PRIVILEGED_SCOPES: readonly PluginScope[] = PLUGIN_SCOPES.filter(
  (scope) => scope.startsWith('write:') || scope === 'net:fetch',
);

/** UI extension points a plugin may contribute to. */
export const PLUGIN_SURFACES = [
  'channel.toolbar',
  'channel.message.action',
  'sidebar.panel',
  'command.palette',
  'settings.tab',
  'task.detail',
  'document.toolbar',
  'global.modal',
] as const;

export type PluginSurface = (typeof PLUGIN_SURFACES)[number];

/** Storefront categories, per kind. Drives the browse filters in the UI. */
export const CATEGORIES_BY_KIND: Record<ListingKind, readonly string[]> = {
  PLUGIN: ['Productivity', 'Developer', 'Communication', 'Security', 'Utilities'],
  THEME: ['Dark', 'Light', 'High Contrast', 'Seasonal', 'Brand'],
  AGENT: ['Support', 'Engineering', 'Research', 'Sales', 'Operations'],
  WORKFLOW: ['Onboarding', 'Engineering', 'Alerts', 'Reporting', 'Approvals'],
  COMPONENT: ['Layout', 'Charts', 'Forms', 'Feedback', 'Navigation'],
  INTEGRATION: ['Dev Tools', 'Storage', 'Calendar', 'Messaging', 'CRM'],
  TEMPLATE: ['Docs', 'Projects', 'Meetings', 'Playbooks', 'Onboarding'],
};

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 100;

export function isListingKind(value: string): value is ListingKind {
  return (LISTING_KINDS as readonly string[]).includes(value);
}

export function isPluginScope(value: string): value is PluginScope {
  return (PLUGIN_SCOPES as readonly string[]).includes(value);
}

export function isPluginSurface(value: string): value is PluginSurface {
  return (PLUGIN_SURFACES as readonly string[]).includes(value);
}
