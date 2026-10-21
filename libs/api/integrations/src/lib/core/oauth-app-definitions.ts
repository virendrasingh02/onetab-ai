/**
 * The provider families whose connection needs an OAuth app (client id +
 * secret). One family can serve several connectors — a single Google app
 * covers Gmail, Calendar, Drive, Docs and Sheets.
 */
export interface OAuthAppDefinition {
  appKey: string;
  label: string;
  /** Provider ids served by this app. */
  providers: Array<{ id: string; name: string; callbackPath: string }>;
  /** Env var names the adapters read; a workspace app is injected under the same names. */
  clientIdEnv: string;
  clientSecretEnv: string;
  setupUrl: string;
  setupHint: string;
  clientIdPlaceholder: string;
}

export const OAUTH_APP_DEFINITIONS: readonly OAuthAppDefinition[] = [
  {
    appKey: 'GOOGLE',
    label: 'Google',
    providers: [
      { id: 'GMAIL', name: 'Gmail', callbackPath: 'gmail' },
      { id: 'GOOGLE_CALENDAR', name: 'Google Calendar', callbackPath: 'google_calendar' },
      { id: 'GOOGLE_DRIVE', name: 'Google Drive', callbackPath: 'google_drive' },
      { id: 'GOOGLE_DOCS', name: 'Google Docs', callbackPath: 'google_docs' },
      { id: 'GOOGLE_SHEETS', name: 'Google Sheets', callbackPath: 'google_sheets' },
    ],
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    setupUrl: 'https://console.cloud.google.com/apis/credentials',
    setupHint: 'Create an OAuth client ID (Web application) and enable the Gmail, Calendar, Drive, Docs and Sheets APIs.',
    clientIdPlaceholder: '1234567890-abc.apps.googleusercontent.com',
  },
  {
    appKey: 'GITHUB',
    label: 'GitHub',
    providers: [{ id: 'GITHUB', name: 'GitHub', callbackPath: 'github' }],
    clientIdEnv: 'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET',
    setupUrl: 'https://github.com/settings/developers',
    setupHint: 'Register an OAuth App and set its authorization callback URL.',
    clientIdPlaceholder: 'Iv1.0123456789abcdef',
  },
  {
    appKey: 'LINEAR',
    label: 'Linear',
    providers: [{ id: 'LINEAR', name: 'Linear', callbackPath: 'linear' }],
    clientIdEnv: 'LINEAR_CLIENT_ID',
    clientSecretEnv: 'LINEAR_CLIENT_SECRET',
    setupUrl: 'https://linear.app/settings/api/applications/new',
    setupHint: 'Create an OAuth application and add the callback URL.',
    clientIdPlaceholder: 'Client ID',
  },
  {
    appKey: 'NOTION',
    label: 'Notion',
    providers: [{ id: 'NOTION', name: 'Notion', callbackPath: 'notion' }],
    clientIdEnv: 'NOTION_CLIENT_ID',
    clientSecretEnv: 'NOTION_CLIENT_SECRET',
    setupUrl: 'https://www.notion.so/my-integrations',
    setupHint: 'Create a public integration and add the redirect URI.',
    clientIdPlaceholder: 'OAuth client ID',
  },
  {
    appKey: 'SLACK',
    label: 'Slack',
    providers: [{ id: 'SLACK', name: 'Slack', callbackPath: 'slack' }],
    clientIdEnv: 'SLACK_CLIENT_ID',
    clientSecretEnv: 'SLACK_CLIENT_SECRET',
    setupUrl: 'https://api.slack.com/apps',
    setupHint: 'Create an app, add the redirect URL under OAuth & Permissions, and copy the client credentials.',
    clientIdPlaceholder: '1234567890.1234567890',
  },
  {
    appKey: 'MICROSOFT_TEAMS',
    label: 'Microsoft (Teams)',
    providers: [{ id: 'MICROSOFT_TEAMS', name: 'Microsoft Teams', callbackPath: 'microsoft_teams' }],
    clientIdEnv: 'MICROSOFT_TEAMS_CLIENT_ID',
    clientSecretEnv: 'MICROSOFT_TEAMS_CLIENT_SECRET',
    setupUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    setupHint: 'Register an app, add a Web redirect URI, and create a client secret.',
    clientIdPlaceholder: 'Application (client) ID',
  },
  {
    appKey: 'QUICKBOOKS',
    label: 'QuickBooks (Intuit)',
    providers: [{ id: 'QUICKBOOKS', name: 'QuickBooks', callbackPath: 'quickbooks' }],
    clientIdEnv: 'QUICKBOOKS_CLIENT_ID',
    clientSecretEnv: 'QUICKBOOKS_CLIENT_SECRET',
    setupUrl: 'https://developer.intuit.com/app/developer/dashboard',
    setupHint: 'Create an app with the Accounting scope and add the redirect URI under Keys & credentials.',
    clientIdPlaceholder: 'Client ID',
  },
  {
    appKey: 'XERO',
    label: 'Xero',
    providers: [{ id: 'XERO', name: 'Xero', callbackPath: 'xero' }],
    clientIdEnv: 'XERO_CLIENT_ID',
    clientSecretEnv: 'XERO_CLIENT_SECRET',
    setupUrl: 'https://developer.xero.com/app/manage',
    setupHint: 'Create a Web app and add the redirect URI.',
    clientIdPlaceholder: 'Client id',
  },
  {
    appKey: 'DOCUSIGN',
    label: 'DocuSign',
    providers: [{ id: 'DOCUSIGN', name: 'DocuSign', callbackPath: 'docusign' }],
    clientIdEnv: 'DOCUSIGN_CLIENT_ID',
    clientSecretEnv: 'DOCUSIGN_CLIENT_SECRET',
    setupUrl: 'https://admindemo.docusign.com/apps-and-keys',
    setupHint: 'Add an app (integration key), enable Authorization Code Grant, add a secret key and the redirect URI.',
    clientIdPlaceholder: 'Integration key',
  },
];

export function oauthAppForProvider(providerId: string): OAuthAppDefinition | undefined {
  const key = providerId.toUpperCase();
  return OAUTH_APP_DEFINITIONS.find((d) => d.providers.some((p) => p.id === key));
}
