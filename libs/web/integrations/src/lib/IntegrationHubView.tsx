import {
  Button,
  confirm,
  ConnectionCard,
  ConnectionList,
  Dialog,
  DialogContent,
  DialogBody,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  SearchInput,
  toast,
  toConnectionState,
  type ConnectionState,
  PageBar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Activity,
  ChevronDown,
  Inbox,
  Info,
  KeyRound,
  RefreshCw,
  Share2,
  Webhook,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  OAuthAppsDialog,
  oauthAppFor,
  useOAuthApps,
} from './OAuthAppsDialog.js';
import {
  CONNECTOR_CATEGORIES,
  isCustomConnectorProvider,
  isPolicyRoleAllowed,
  normalizeConnectorCategory,
  PolicySubjectRole,
  type ConnectorCategory,
  type ExternalIntegration,
  type IntegrationCapabilities,
} from '@org/types';
import { useCurrentWorkspace, useWorkspacePolicies } from '@org/web-workspace';
import { ConnectCredentialsDialog } from './ConnectCredentialsDialog.js';
import { CustomApiModal } from './CustomApiModal.js';
import { GmailInboxModal } from './GmailInboxModal.js';
import { GoogleCalendarModal } from './GoogleCalendarModal.js';
import { GoogleDocsModal } from './GoogleDocsModal.js';
import { GoogleDriveModal } from './GoogleDriveModal.js';
import { GoogleSheetsModal } from './GoogleSheetsModal.js';
import { IntegrationLogsView } from './IntegrationLogsView.js';
import { TrelloConnectModal } from './TrelloConnectModal.js';
import {
  useIntegrationMutations,
  useIntegrationProviders,
  useIntegrations,
} from './use-integrations.js';
import { useWorkspaceId } from './use-workspace-id.js';

export interface IntegrationCard {
  id: string;
  name: string;
  category: AppCategory;
  description: string;
  isInternal?: boolean;
  /**
   * Whether this deployment has a registered backend adapter for this
   * provider (`GET /integrations/providers`). An unsupported card never gets a
   * working Connect button: nothing here may look connectable when it can't
   * actually connect to anything real.
   */
  supported: boolean;
  /** The provider's registry entry; absent on a "coming soon" card. */
  capabilities?: IntegrationCapabilities;
}

/** Providers with a viewer/actions modal beyond the generic connect toggle. */
type ActiveAppModal =
  | { kind: 'gmail'; integrationId: string; email?: string }
  | { kind: 'google_calendar'; integrationId: string; email?: string }
  | { kind: 'google_drive'; integrationId: string; email?: string }
  | { kind: 'google_docs'; integrationId: string; email?: string }
  | { kind: 'google_sheets'; integrationId: string; email?: string };

/** The connector registry's categories (`@org/types` connectors). */
export type AppCategory = ConnectorCategory;

/**
 * Custom High-Quality SVG Icons for key services matching reference design
 */
function IntegrationAppIcon({ id, name }: { id: string; name: string }) {
  switch (id.toLowerCase()) {
    case 'slack':
      return (
        <svg className="size-5 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#E01E5A"
            d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"
          />
          <path
            fill="#36C5F0"
            d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"
          />
          <path
            fill="#2EB67D"
            d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"
          />
          <path
            fill="#ECB22E"
            d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
          />
        </svg>
      );

    case 'stripe':
      return (
        <div className="size-5 text-white font-bold text-xs tracking-tighter flex items-center justify-center rounded-md bg-[#635BFF]">
          <svg className="size-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
          </svg>
        </div>
      );

    case 'supabase':
      return (
        <svg className="size-5 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#3ECF8E"
            d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L.638 14.646H10v8.958a.396.396 0 0 0 .716.233l10.646-14.483a.396.396 0 0 0-.28-.646z"
          />
        </svg>
      );

    case 'make':
      return (
        <svg className="size-5 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#EA1889"
            d="M2.37 8.01a4.27 4.27 0 0 0 4.26 4.27 4.27 4.27 0 0 0 3.32-1.58l3.39 1.96a4.25 4.25 0 0 0-.08.74 4.27 4.27 0 1 0 7.02-3.26l-3.39-1.96a4.27 4.27 0 0 0-7.23-1.74L6.29 4.48A4.27 4.27 0 0 0 2.37 8.01zm4.26 2.27a2.27 2.27 0 1 1 0-4.54 2.27 2.27 0 0 1 0 4.54zm10.74 5.04a2.27 2.27 0 1 1 0-4.54 2.27 2.27 0 0 1 0 4.54z"
          />
        </svg>
      );

    case 'zoom':
      return (
        <div className="size-5 text-white font-bold text-xs flex items-center justify-center rounded-full bg-[#2D8CFF]">
          <span className="font-black text-white font-sans text-[11px] leading-none">
            Z
          </span>
        </div>
      );

    case 'loom':
      return (
        <svg className="size-5 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#625DF5"
            d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm1.745 6.096l1.24 3.712 3.712-1.24-1.24 3.712 3.713 1.24-3.713 1.24 1.24 3.713-3.712-1.24-1.24 3.712-1.24-3.712-3.713 1.24 1.24-3.713-3.712-1.24 3.712-1.24-1.24-3.712 3.713 1.24 1.24-3.712z"
          />
        </svg>
      );

    case 'discord':
      return (
        <svg className="size-5 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#5865F2"
            d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
          />
        </svg>
      );

    case 'gemini':
    case 'ai':
      return (
        <svg className="size-5 shrink-0" viewBox="0 0 24 24">
          <defs>
            <linearGradient id="ai-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff4b4b" />
              <stop offset="50%" stopColor="#7a5bd0" />
              <stop offset="100%" stopColor="#4d6dd6" />
            </linearGradient>
          </defs>
          <path
            fill="url(#ai-grad)"
            d="M12 0c.5 6 6 11.5 12 12-6 .5-11.5 6-12 12-.5-6-6-11.5-12-12 6-.5 11.5-6 12-12z"
          />
        </svg>
      );

    case 'gmail':
      return (
        <svg className="size-5 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#EA4335"
            d="M1.5 6.5 12 14 22.5 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-1V8.7l-8 5.8-8-5.8V19H2a1.5 1.5 0 0 1-1.5-1.5v-11Z"
          />
          <path
            fill="#EA4335"
            d="M1.5 6.5A1.5 1.5 0 0 1 3 5h1l8 5.8L20 5h1a1.5 1.5 0 0 1 1.5 1.5L12 14 1.5 6.5Z"
          />
        </svg>
      );

    case 'github':
      return (
        <div className="size-5 flex shrink-0 items-center justify-center rounded-full bg-[#181717]">
          <svg className="size-3.5 fill-white" viewBox="0 0 24 24">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .3.2.66.79.55A10.51 10.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
          </svg>
        </div>
      );

    case 'linear':
      return (
        <div className="size-5 flex shrink-0 items-center justify-center rounded-full bg-[#5E6AD2]">
          <span className="font-black text-white text-[11px] leading-none">
            L
          </span>
        </div>
      );

    case 'notion':
      return (
        <div className="size-5 bg-white flex shrink-0 items-center justify-center rounded-md border border-border">
          <span className="font-black text-black text-[11px] leading-none">
            N
          </span>
        </div>
      );

    case 'trello':
      return (
        <div className="size-5 shrink-0 rounded-md bg-[#0052CC] p-[3px]">
          <div className="grid size-full grid-cols-2 gap-[2px]">
            <span className="bg-white rounded-[1px]" />
            <span className="bg-white/50 rounded-[1px]" />
          </div>
        </div>
      );

    case 'spotify':
      return (
        <svg className="size-5 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#1ED760"
            d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
          />
        </svg>
      );

    case 'custom_api':
    case 'webhooks':
      return <Webhook className="size-5 text-muted-foreground" />;

    default:
      return (
        <span
          aria-hidden
          className="size-5 text-[11px] font-bold flex shrink-0 items-center justify-center rounded-md border border-border bg-surface-raised text-muted-foreground"
        >
          {name.charAt(0).toUpperCase()}
        </span>
      );
  }
}

/**
 * Apps people ask for that have no backend adapter yet. Shown disabled as
 * "Coming soon" so the catalogue stays honest; every connectable app comes
 * from the provider registry instead (`cardsFromProviders`). An id here that
 * the registry starts returning is dropped automatically.
 */
const COMING_SOON: IntegrationCard[] = [
  { id: 'figma', name: 'Figma', category: 'productivity', description: 'Design file embeds, comments, and canvas updates.', supported: false },
  { id: 'outlook', name: 'Microsoft Outlook', category: 'email', description: 'Sync Outlook mail, availability, and meeting join links.', supported: false },
  { id: 'microsoft_calendar', name: 'Microsoft Calendar', category: 'calendar', description: 'Events, attendees, and availability from Microsoft 365.', supported: false },
  { id: 'onedrive', name: 'Microsoft OneDrive', category: 'storage', description: 'Browse and search files stored in Microsoft OneDrive.', supported: false },
  { id: 'todoist', name: 'Todoist', category: 'project_management', description: 'Projects, tasks, and due dates synced with your workspace.', supported: false },
  { id: 'cal', name: 'Cal.com', category: 'calendar', description: 'Booking types, bookings, and availability from Cal.com.', supported: false },
  { id: 'zoom', name: 'Zoom', category: 'communication', description: 'Meetings, recordings, and participants synced.', supported: false },
  { id: 'gitlab', name: 'GitLab', category: 'developer_tools', description: 'Merge request checks and CI/CD pipeline notifications.', supported: false },
  { id: 'supabase', name: 'Supabase', category: 'database', description: 'DB and auth events for live dashboards.', supported: false },
  { id: 'make', name: 'Make', category: 'automation', description: 'Automation runs: successes and failures in one place.', supported: false },
  { id: 'loom', name: 'Loom', category: 'communication', description: 'Async walkthroughs and feedback in one queue.', supported: false },
  { id: 'discord', name: 'Discord', category: 'communication', description: 'Community signals and mod flags to internal channels.', supported: false },
  { id: 'mixpanel', name: 'Mixpanel', category: 'analytics', description: 'Product analytics, event tracking, and metrics summaries.', supported: false },
  { id: 'datadog', name: 'Datadog', category: 'analytics', description: 'Infrastructure monitoring, alerts, and incident tracking.', supported: false },
  { id: 'quickbooks', name: 'QuickBooks', category: 'finance', description: 'Accounting receipts, expense tracking, and payroll reports.', supported: false },
  { id: 'bamboohr', name: 'BambooHR', category: 'productivity', description: 'PTO approvals, onboarding workflows, and team reminders.', supported: false },
  { id: 'webhooks', name: 'Custom Webhooks Hub', category: 'internal', description: 'Incoming and outgoing custom REST webhooks for internal tools.', isInternal: true, supported: false },
];

/** Connectable cards, straight from the backend's provider registry. */
export function cardsFromProviders(
  providers: IntegrationCapabilities[] | undefined,
): IntegrationCard[] {
  return (providers ?? [])
    .filter((p) => !isCustomConnectorProvider(p.provider))
    .map((p) => {
      const category = normalizeConnectorCategory(p.connectorCategory, p.category);
      return {
        id: p.provider.toLowerCase(),
        name: p.displayName,
        description: p.description,
        category,
        isInternal: category === 'internal',
        supported: true,
        capabilities: p,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

const CATEGORY_LABELS = new Map<string, string>(
  CONNECTOR_CATEGORIES.map((c) => [c.id, c.label]),
);

/** Providers with a viewer modal beyond the generic connection card. */
const APPS_WITH_MODAL = new Set([
  'gmail',
  'google_calendar',
  'google_drive',
  'google_docs',
  'google_sheets',
]);

/** Where a card sits in the hub: what the viewer can do with it right now. */
export type CatalogueSection = 'connected' | 'ready' | 'setup' | 'soon';

const SECTIONS: ReadonlyArray<{
  id: CatalogueSection;
  title: string;
  description: string;
}> = [
  {
    id: 'connected',
    title: 'Connected',
    description: 'Linked to this workspace. Agents, search and chat can use them.',
  },
  {
    id: 'ready',
    title: 'Ready to connect',
    description: 'Sign in, or paste an API key, and the app is linked.',
  },
  {
    id: 'setup',
    title: 'Needs setup',
    description:
      "These sign in with OAuth. They can be connected once their app credentials (client ID and secret) are added.",
  },
  {
    id: 'soon',
    title: 'Coming soon',
    description: 'Not available to connect yet.',
  },
];

/**
 * Which section a card belongs in. Anything linked (even expired or failing)
 * is "connected" so its Reconnect prompt stays at the top; an OAuth app
 * whose client credentials haven't been added is "setup", never a Connect
 * button that can only fail.
 */
export function catalogueSection(
  card: IntegrationCard,
  { linked, needsSetup }: { linked: boolean; needsSetup: boolean },
): CatalogueSection {
  if (!card.supported) return 'soon';
  if (linked) return 'connected';
  return needsSetup ? 'setup' : 'ready';
}

export interface IntegrationHubViewProps {
  /**
   * Rendered inside another page (the Marketplace's "Integration Hub" tab):
   * no page bar or scroll container of its own, and the host's search box
   * drives `searchQuery`.
   */
  embedded?: boolean;
  searchQuery?: string;
}

export function IntegrationHubView({
  embedded = false,
  searchQuery: externalSearchQuery,
}: IntegrationHubViewProps = {}) {
  const workspaceId = useWorkspaceId() ?? '';
  const integrations = useIntegrations(workspaceId);
  const { connect, disconnect, sync } = useIntegrationMutations(workspaceId);
  const providersQuery = useIntegrationProviders(workspaceId);
  const oauthApps = useOAuthApps(workspaceId || undefined);
  const [oauthDialog, setOauthDialog] = useState<{
    appKey: string | null;
  } | null>(null);

  // Settings → Permissions & Policies → "Who can install Marketplace apps".
  // Presentation only — `POST .../integrations/:provider/connect` re-checks
  // this server-side regardless of what the button below shows.
  const { workspace } = useCurrentWorkspace();
  const policiesQuery = useWorkspacePolicies(workspaceId);
  const canInstallApps = isPolicyRoleAllowed(
    workspace?.role,
    policiesQuery.data?.whoCanInstallApps ?? PolicySubjectRole.ADMINS,
  );

  const [localSearchQuery, setSearchQuery] = useState('');
  const searchQuery = externalSearchQuery ?? localSearchQuery;
  const [selectedFilter, setSelectedFilter] = useState<'All' | AppCategory>(
    'All',
  );
  const [showComingSoon, setShowComingSoon] = useState(false);
  const canManageCredentials = isPolicyRoleAllowed(
    workspace?.role,
    PolicySubjectRole.ADMINS,
  );
  const [credentialsCard, setCredentialsCard] = useState<IntegrationCard | null>(
    null,
  );

  /** Every connectable app from the registry, then the "coming soon" ones. */
  const catalogue = useMemo(() => {
    const live = cardsFromProviders(providersQuery.data);
    const liveIds = new Set(live.map((card) => card.id));
    return [...live, ...COMING_SOON.filter((card) => !liveIds.has(card.id))];
  }, [providersQuery.data]);
  const categories = useMemo(
    () =>
      CONNECTOR_CATEGORIES.filter((c) =>
        catalogue.some((card) => card.category === c.id),
      ),
    [catalogue],
  );
  const [isCustomApiModalOpen, setIsCustomApiModalOpen] = useState(false);
  const [isTrelloModalOpen, setIsTrelloModalOpen] = useState(false);
  const [activeAppModal, setActiveAppModal] = useState<ActiveAppModal | null>(
    null,
  );
  const [logsCard, setLogsCard] = useState<IntegrationCard | null>(null);

  /*
   * Every linked integration by provider — not only `CONNECTED` ones. An
   * expired or failing link used to drop out of this map, so its card read
   * "not connected" and offered a plain Connect with no hint anything was
   * wrong. `DISCONNECTED` rows are history, not links.
   */
  const integrationMap = new Map<string, ExternalIntegration>();
  for (const integration of integrations.data ?? []) {
    if (toConnectionState(integration.status) !== 'disconnected') {
      integrationMap.set(integration.provider.toUpperCase(), integration);
    }
  }

  /**
   * Any OAuth2 provider gets the same popup-based authorize flow — nothing
   * here is Gmail-specific. `providersQuery` reflects exactly what
   * `IntegrationManagerService` has registered on the backend, so a card the
   * server doesn't recognize (not yet built) never reaches this function:
   * the UI disables it below instead.
   */
  const startConnect = async (card: IntegrationCard) => {
    if (card.id === 'custom_api') {
      setIsCustomApiModalOpen(true);
      return;
    }

    if (card.id === 'trello') {
      setIsTrelloModalOpen(true);
      return;
    }

    const providerKey = card.id.toUpperCase();
    const capabilities = card.capabilities;

    // API-key apps (Jira, HubSpot, Stripe...) ask for their credentials first;
    // the server checks them against the app before storing them encrypted.
    if (capabilities?.credentialFields?.length) {
      setCredentialsCard(card);
      return;
    }

    if (capabilities?.authType === 'OAUTH2') {
      // No OAuth app yet (neither the platform's nor this workspace's): set one up instead of failing.
      const app = oauthAppFor(oauthApps.data, providerKey);
      if (app && !app.configured) {
        setOauthDialog({ appKey: app.appKey });
        return;
      }
      try {
        const result = await connect.mutateAsync({ provider: providerKey });
        if (result.authUrl) {
          const width = 600;
          const height = 700;
          const left = window.screen.width / 2 - width / 2;
          const top = window.screen.height / 2 - height / 2;
          window.open(
            result.authUrl,
            `${card.name} OAuth`,
            `width=${width},height=${height},left=${left},top=${top}`,
          );
        }
      } catch (err: unknown) {
        toast.error(
          err instanceof Error
            ? err.message
            : `Failed to start ${card.name} connection.`,
        );
      }
      return;
    }

    connect.mutate(
      { provider: providerKey },
      {
        onError: (err: unknown) =>
          toast.error(
            err instanceof Error
              ? err.message
              : `Failed to connect ${card.name}.`,
          ),
      },
    );
  };

  const confirmDisconnect = (
    card: IntegrationCard,
    integration: ExternalIntegration,
  ) => {
    void confirm({
      title: `Disconnect ${card.name}?`,
      description:
        'This integration is removed from your workspace and its webhooks stop firing. You can reconnect it later.',
      confirmLabel: 'Disconnect',
      destructive: true,
    }).then((ok) => {
      if (!ok) return;
      disconnect.mutate(integration.id, {
        onError: (err: unknown) =>
          toast.error(
            err instanceof Error
              ? err.message
              : `Failed to disconnect ${card.name}.`,
          ),
      });
    });
  };

  const cardState = (
    card: IntegrationCard,
    integration: ExternalIntegration | undefined,
  ): ConnectionState => {
    if (!card.supported) return 'disabled';
    const providerKey = card.id.toUpperCase();
    if (connect.isPending && connect.variables?.provider === providerKey) {
      return integration ? 'reconnecting' : 'connecting';
    }
    return toConnectionState(integration?.status);
  };

  const openAppModal = (
    card: IntegrationCard,
    integration: ExternalIntegration,
  ) => {
    const email = integration.displayName ?? undefined;
    if (card.id === 'gmail')
      setActiveAppModal({
        kind: 'gmail',
        integrationId: integration.id,
        email,
      });
    else if (card.id === 'google_calendar')
      setActiveAppModal({
        kind: 'google_calendar',
        integrationId: integration.id,
        email,
      });
    else if (card.id === 'google_drive')
      setActiveAppModal({
        kind: 'google_drive',
        integrationId: integration.id,
        email,
      });
    else if (card.id === 'google_docs')
      setActiveAppModal({
        kind: 'google_docs',
        integrationId: integration.id,
        email,
      });
    else if (card.id === 'google_sheets')
      setActiveAppModal({
        kind: 'google_sheets',
        integrationId: integration.id,
        email,
      });
  };

  const linkedCount = integrationMap.size;

  /** The OAuth app an OAuth card signs in through, when it has one. */
  const oauthAppOf = (card: IntegrationCard) =>
    card.capabilities?.authType === 'OAUTH2'
      ? oauthAppFor(oauthApps.data, card.id)
      : undefined;

  const filteredCards = catalogue.filter((card) => {
    const term = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !term ||
      card.name.toLowerCase().includes(term) ||
      card.description.toLowerCase().includes(term) ||
      (CATEGORY_LABELS.get(card.category) ?? '').toLowerCase().includes(term);

    if (!matchesSearch) return false;

    if (selectedFilter === 'All') return true;
    return card.category === selectedFilter;
  });

  const sectionCards = new Map<CatalogueSection, IntegrationCard[]>(
    SECTIONS.map((section) => [section.id, []]),
  );
  for (const card of filteredCards) {
    const app = oauthAppOf(card);
    sectionCards
      .get(
        catalogueSection(card, {
          linked: integrationMap.has(card.id.toUpperCase()),
          needsSetup: Boolean(app && !app.configured),
        }),
      )
      ?.push(card);
  }
  const setupCount = sectionCards.get('setup')?.length ?? 0;

  const renderCard = (card: IntegrationCard) => {
    const integration = integrationMap.get(card.id.toUpperCase());
    const state = cardState(card, integration);
    const isConnected = state === 'connected';
    const hasSettings = card.id === 'custom_api' || card.id === 'trello';
    const app = oauthAppOf(card);
    const needsSetup = Boolean(app && !app.configured);

    return (
      <ConnectionCard
        key={card.id}
        name={card.name}
        description={card.description}
        icon={<IntegrationAppIcon id={card.id} name={card.name} />}
        state={state}
        statusLabel={card.supported ? undefined : 'Coming soon'}
        account={integration?.displayName}
        lastSyncAt={integration?.lastSyncAt}
        errorMessage={integration?.lastErrorMessage}
        permissions={integration?.scopes}
        canConnect={canInstallApps}
        cannotConnectReason="Only admins can install apps in this workspace."
        needsSetup={needsSetup}
        onSetup={
          needsSetup && app && canManageCredentials
            ? () => setOauthDialog({ appKey: app.appKey })
            : undefined
        }
        setupHint={
          app ? `Waiting for an admin to add ${app.label} credentials.` : undefined
        }
        busy={
          (connect.isPending &&
            connect.variables?.provider === card.id.toUpperCase()) ||
          (disconnect.isPending && disconnect.variables === integration?.id)
        }
        onConnect={() => void startConnect(card)}
        onReconnect={() => void startConnect(card)}
        onDisconnect={
          integration ? () => confirmDisconnect(card, integration) : undefined
        }
        onSettings={
          hasSettings
            ? () =>
                card.id === 'trello'
                  ? setIsTrelloModalOpen(true)
                  : setIsCustomApiModalOpen(true)
            : undefined
        }
        actions={
          integration ? (
            <>
              {isConnected && APPS_WITH_MODAL.has(card.id) ? (
                <Hint label={`Open ${card.name}`}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Open ${card.name}`}
                    onClick={() => openAppModal(card, integration)}
                  >
                    <Inbox className="size-3.5" />
                  </Button>
                </Hint>
              ) : null}
              {isConnected ? (
                <Hint label="Sync now">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Sync ${card.name} now`}
                    disabled={sync.isPending}
                    onClick={() =>
                      sync.mutate(integration.id, {
                        onError: (err: unknown) =>
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : `Failed to sync ${card.name}.`,
                          ),
                      })
                    }
                  >
                    <RefreshCw
                      className={cn(
                        'size-3.5',
                        sync.isPending &&
                          sync.variables === integration.id &&
                          'animate-spin',
                      )}
                    />
                  </Button>
                </Hint>
              ) : null}
              <Hint label="Activity log">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${card.name} activity log`}
                  onClick={() => setLogsCard(card)}
                >
                  <Activity className="size-3.5" />
                </Button>
              </Hint>
            </>
          ) : null
        }
      />
    );
  };

  return (
    <div className={embedded ? undefined : 'min-h-0 flex flex-1 flex-col'}>
      {!embedded && (
        <PageBar
          icon={<Share2 />}
          title="Apps"
          actions={
            <SearchInput
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder="Search apps..."
              className="h-7 text-xs"
              wrapperClassName="w-36 sm:w-56"
            />
          }
        />
      )}

      <div className={embedded ? undefined : 'min-h-0 p-4 sm:p-6 flex-1 overflow-y-auto'}>
        <div className={embedded ? undefined : 'max-w-7xl mx-auto'}>
          {/* Category filter & count */}
          <div className="mb-4 gap-2 flex flex-wrap items-center justify-between">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  trailingIcon={
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  }
                >
                  {selectedFilter === 'All'
                    ? 'All categories'
                    : CATEGORY_LABELS.get(selectedFilter) ?? selectedFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuRadioGroup
                  value={selectedFilter}
                  onValueChange={(value) =>
                    setSelectedFilter(value as 'All' | AppCategory)
                  }
                >
                  <DropdownMenuRadioItem value="All" indicator="check">
                    All categories
                  </DropdownMenuRadioItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Categories</DropdownMenuLabel>
                  {categories.map((category) => (
                    <DropdownMenuRadioItem
                      key={category.id}
                      value={category.id}
                      indicator="check"
                    >
                      {category.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="gap-3 flex items-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                leadingIcon={<KeyRound className="size-3.5" />}
                onClick={() => setOauthDialog({ appKey: null })}
              >
                App credentials
              </Button>
              <p
                className="text-xs font-semibold text-muted-foreground"
                aria-live="polite"
              >
                {filteredCards.length}{' '}
                {filteredCards.length === 1 ? 'app' : 'apps'}
                {linkedCount > 0 ? ` · ${linkedCount} connected` : ''}
                {setupCount > 0 ? ` · ${setupCount} need setup` : ''}
              </p>
            </div>
          </div>

          {!canInstallApps ? (
            <div
              role="note"
              className="mb-5 gap-2 p-3 text-xs flex items-start rounded-lg border border-border bg-surface-raised text-muted-foreground"
            >
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>
                Only admins can connect apps in this workspace. You can browse
                what's available; ask an admin to connect the ones you need.
              </span>
            </div>
          ) : null}

          {integrations.isLoading ||
          providersQuery.isLoading ||
          integrations.error ||
          providersQuery.error ||
          filteredCards.length === 0 ? (
            <ConnectionList
              isLoading={integrations.isLoading || providersQuery.isLoading}
              error={integrations.error ?? providersQuery.error}
              onRetry={() => {
                void integrations.refetch();
                void providersQuery.refetch();
              }}
              isEmpty={filteredCards.length === 0}
              emptyTitle="No integrations found"
              emptyDescription="Try a different search or category to see available apps."
              emptyAction={
                searchQuery || selectedFilter !== 'All' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedFilter('All');
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            >
              {null}
            </ConnectionList>
          ) : (
            <div className="space-y-8">
              {SECTIONS.map((section) => {
                const cards = sectionCards.get(section.id) ?? [];
                if (cards.length === 0) return null;
                const collapsed = section.id === 'soon' && !showComingSoon;
                const headingId = `hub-section-${section.id}`;
                return (
                  <section key={section.id} aria-labelledby={headingId}>
                    <div className="mb-3 gap-3 flex flex-wrap items-end justify-between">
                      <div className="min-w-0">
                        <h3
                          id={headingId}
                          className="gap-2 text-sm font-semibold flex items-center text-foreground"
                        >
                          {section.title}
                          <span className="text-xs font-medium text-muted-foreground">
                            {cards.length}
                          </span>
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {section.description}
                        </p>
                      </div>
                      {section.id === 'setup' && canManageCredentials ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          leadingIcon={<KeyRound className="size-3.5" />}
                          onClick={() => setOauthDialog({ appKey: null })}
                        >
                          Add credentials
                        </Button>
                      ) : null}
                      {section.id === 'soon' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-expanded={!collapsed}
                          aria-controls={`${headingId}-list`}
                          trailingIcon={
                            <ChevronDown
                              className={cn(
                                'size-3.5 transition-transform',
                                !collapsed && 'rotate-180',
                              )}
                            />
                          }
                          onClick={() => setShowComingSoon((v) => !v)}
                        >
                          {collapsed ? 'Show' : 'Hide'}
                        </Button>
                      ) : null}
                    </div>
                    {collapsed ? null : (
                      <div id={`${headingId}-list`}>
                        <ConnectionList>{cards.map(renderCard)}</ConnectionList>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Gmail Inbox Modal */}

      {activeAppModal?.kind === 'gmail' ? (
        <GmailInboxModal
          workspaceId={workspaceId}
          integrationId={activeAppModal.integrationId}
          accountEmail={activeAppModal.email}
          isOpen
          onClose={() => setActiveAppModal(null)}
        />
      ) : null}
      {activeAppModal?.kind === 'google_calendar' ? (
        <GoogleCalendarModal
          workspaceId={workspaceId}
          integrationId={activeAppModal.integrationId}
          accountEmail={activeAppModal.email}
          isOpen
          onClose={() => setActiveAppModal(null)}
        />
      ) : null}
      {activeAppModal?.kind === 'google_drive' ? (
        <GoogleDriveModal
          workspaceId={workspaceId}
          integrationId={activeAppModal.integrationId}
          accountEmail={activeAppModal.email}
          isOpen
          onClose={() => setActiveAppModal(null)}
        />
      ) : null}
      {activeAppModal?.kind === 'google_docs' ? (
        <GoogleDocsModal
          workspaceId={workspaceId}
          integrationId={activeAppModal.integrationId}
          accountEmail={activeAppModal.email}
          isOpen
          onClose={() => setActiveAppModal(null)}
        />
      ) : null}
      {activeAppModal?.kind === 'google_sheets' ? (
        <GoogleSheetsModal
          workspaceId={workspaceId}
          integrationId={activeAppModal.integrationId}
          accountEmail={activeAppModal.email}
          isOpen
          onClose={() => setActiveAppModal(null)}
        />
      ) : null}

      <OAuthAppsDialog
        workspaceId={workspaceId || undefined}
        open={oauthDialog !== null}
        onOpenChange={(open) => !open && setOauthDialog(null)}
        initialAppKey={oauthDialog?.appKey}
        canEdit={isPolicyRoleAllowed(workspace?.role, PolicySubjectRole.ADMINS)}
      />

      {/* Custom API Modal */}
      <CustomApiModal
        workspaceId={workspaceId}
        isOpen={isCustomApiModalOpen}
        onClose={() => setIsCustomApiModalOpen(false)}
      />

      {/* Trello Connect Modal */}
      <TrelloConnectModal
        workspaceId={workspaceId}
        isOpen={isTrelloModalOpen}
        onClose={() => setIsTrelloModalOpen(false)}
      />

      {/* API-key apps: credentials checked server-side before they're stored */}
      <ConnectCredentialsDialog
        app={
          credentialsCard?.capabilities
            ? {
                name: credentialsCard.name,
                icon: (
                  <IntegrationAppIcon
                    id={credentialsCard.id}
                    name={credentialsCard.name}
                  />
                ),
                capabilities: credentialsCard.capabilities,
              }
            : null
        }
        onOpenChange={(open) => !open && setCredentialsCard(null)}
        onSubmit={async (config) => {
          if (!credentialsCard) return;
          await connect.mutateAsync({
            provider: credentialsCard.id.toUpperCase(),
            config,
          });
          toast.success(`${credentialsCard.name} connected.`);
        }}
      />

      {/* Sync & Activity Log Modal */}
      <Dialog
        open={Boolean(logsCard)}
        onOpenChange={(open) => {
          if (!open) setLogsCard(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {logsCard
                ? `Sync & Activity — ${logsCard.name}`
                : 'Sync & Activity'}
            </DialogTitle>
          </DialogHeader>
          {logsCard
            ? (() => {
                const info = integrationMap.get(logsCard.id.toUpperCase());
                return info ? (
                  <DialogBody>
                    <IntegrationLogsView
                      workspaceId={workspaceId}
                      integrations={[info]}
                    />
                  </DialogBody>
                ) : null;
              })()
            : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
