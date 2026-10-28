import { appLabel } from './agent-blueprint.js';

/**
 * Static brand logos for connected-app providers, keyed by provider slug.
 * One map for every surface (sidebar, app chat, system-event rows, the API's
 * system-event snapshots) so an app never shows its logo in one place and a
 * letter tile in another. Marketplace `iconUrl`s still win where a caller has
 * them — this is the zero-network fallback.
 */
export const APP_LOGOS: Record<string, string> = {
  gmail: 'https://cdn.simpleicons.org/gmail',
  asana: 'https://cdn.simpleicons.org/asana',
  github: 'https://cdn.simpleicons.org/github',
  gitlab: 'https://cdn.simpleicons.org/gitlab',
  jira: 'https://cdn.simpleicons.org/jira',
  linear: 'https://cdn.simpleicons.org/linear',
  figma: 'https://cdn.simpleicons.org/figma',
  trello: 'https://cdn.simpleicons.org/trello',
  todoist: 'https://cdn.simpleicons.org/todoist',
  zoom: 'https://cdn.simpleicons.org/zoom',
  cal: 'https://cdn.simpleicons.org/cal-dot-com',
  onedrive: 'https://cdn.simpleicons.org/microsoftonedrive',
  teams: 'https://cdn.simpleicons.org/microsoftteams',
  microsoft_calendar: 'https://cdn.simpleicons.org/microsoftoutlook',
  gdrive: 'https://cdn.simpleicons.org/googledrive',
  google_drive: 'https://cdn.simpleicons.org/googledrive',
  gcal: 'https://cdn.simpleicons.org/googlecalendar',
  google_calendar: 'https://cdn.simpleicons.org/googlecalendar',
  google_docs: 'https://cdn.simpleicons.org/googledocs',
  google_sheets: 'https://cdn.simpleicons.org/googlesheets',
  outlook: 'https://cdn.simpleicons.org/microsoftoutlook',
  microsoft_outlook: 'https://cdn.simpleicons.org/microsoftoutlook',
  zendesk: 'https://cdn.simpleicons.org/zendesk',
  intercom: 'https://cdn.simpleicons.org/intercom',
  mixpanel: 'https://cdn.simpleicons.org/mixpanel',
  datadog: 'https://cdn.simpleicons.org/datadog',
  stripe: 'https://cdn.simpleicons.org/stripe',
  quickbooks: 'https://cdn.simpleicons.org/quickbooks',
  bamboohr: 'https://cdn.simpleicons.org/bamboohr',
  hubspot: 'https://cdn.simpleicons.org/hubspot',
  discord: 'https://cdn.simpleicons.org/discord',
  slack: 'https://cdn.simpleicons.org/slack',
  notion: 'https://cdn.simpleicons.org/notion',
  vercel: 'https://cdn.simpleicons.org/vercel',
  webhooks: 'https://cdn.simpleicons.org/webhooks',
};

/** The static logo for a provider slug (`asana`, `GOOGLE_DRIVE`, …) or app name. */
export function getAppLogoUrl(...keys: Array<string | null | undefined>): string | undefined {
  for (const key of keys) {
    if (!key) continue;
    const lower = key.toLowerCase();
    const logo = APP_LOGOS[lower] ?? APP_LOGOS[lower.replace(/[^a-z0-9_]/g, '')];
    if (logo) return logo;
  }
  return undefined;
}

/** Connectors name a connection `"<App> · <account label>"` (e.g.
 * `"Asana · balram"`). Splits that back into the app's own name and the
 * account label, so timelines can show "Asana" with the account as detail. */
export function splitAppConnectionName(displayName: string): {
  appName: string;
  accountLabel?: string;
} {
  const idx = displayName.indexOf(' · ');
  if (idx <= 0) return { appName: displayName };
  const accountLabel = displayName.slice(idx + 3).trim();
  return {
    appName: displayName.slice(0, idx).trim(),
    accountLabel: accountLabel || undefined,
  };
}

/**
 * The one name an app goes by everywhere — sidebar, chat headers, replies,
 * system events, mentions and its Matrix bot profile. Derived from the
 * connection's `displayName` (what a rename writes), minus the connector's
 * `· account` suffix, falling back to the provider's label.
 */
export function getAppDisplayName(integration: {
  displayName?: string | null;
  provider: string;
}): string {
  const { appName } = splitAppConnectionName(integration.displayName?.trim() ?? '');
  return appName || formatProviderName(integration.provider);
}

/** `github` → `GitHub`, `google-calendar` → `Google Calendar`. */
export function formatProviderName(provider: string): string {
  return appLabel(provider.replace(/-/g, '_'));
}
