import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Hint,
  SearchInput,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Activity,
  Check,
  ChevronDown,
  Code2,
  ExternalLink,
  Inbox,
  RefreshCw,
  Share2,
  Webhook,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import type { ExternalIntegration } from '@org/types';
import { CustomApiModal } from './CustomApiModal.js';
import { GmailInboxModal } from './GmailInboxModal.js';
import { IntegrationLogsView } from './IntegrationLogsView.js';
import {
  useIntegrationMutations,
  useIntegrations,
} from './use-integrations.js';
import { useWorkspaceId } from './use-workspace-id.js';

export interface IntegrationCard {
  id: string;
  name: string;
  category: AppCategory;
  description: string;
  isInternal?: boolean;
}

export type AppCategory =
  | 'Analytics'
  | 'Customer Support & Communication'
  | 'Design'
  | 'Developer Tools'
  | 'Productivity & Project Management'
  | 'HR & Team Culture'
  | 'Sales & Marketing'
  | 'Finance'
  | 'Internal Apps'
  | 'Other';

/**
 * Custom High-Quality SVG Icons for key services matching reference design
 */
function IntegrationAppIcon({ id }: { id: string; name: string }) {
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
        <div className="size-5 rounded-md bg-[#635BFF] flex items-center justify-center text-white font-bold text-xs tracking-tighter">
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
        <div className="size-5 rounded-full bg-[#2D8CFF] flex items-center justify-center text-white font-bold text-xs">
          <span className="font-sans font-black text-white text-[11px] leading-none">Z</span>
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

    case 'spotify':
      return (
        <svg className="size-5 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#1ED760"
            d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
          />
        </svg>
      );

    default:
      return <Webhook className="size-5 text-zinc-300" />;
  }
}

/**
 * Catalogue ordered according to the reference image:
 * 1. Slack 2. Stripe 3. Supabase 4. Make 5. Zoom 6. Loom 7. Discord 8. Gemini AI 9. Spotify
 * followed by other integrations.
 */
const integrationsList: IntegrationCard[] = [
  {
    id: 'slack',
    name: 'Slack',
    category: 'Customer Support & Communication',
    description: 'Releases, on-call alerts, and approvals in your channels.',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'Finance',
    description: 'Charges, retries, and payouts across connected tools.',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    category: 'Developer Tools',
    description: 'DB and auth events for live dashboards.',
  },
  {
    id: 'make',
    name: 'Make',
    category: 'Developer Tools',
    description: 'Automation runs: successes and failures in one place.',
  },
  {
    id: 'zoom',
    name: 'Zoom',
    category: 'Productivity & Project Management',
    description: 'Recordings, attendance, and follow-ups synced.',
  },
  {
    id: 'loom',
    name: 'Loom',
    category: 'Productivity & Project Management',
    description: 'Async walkthroughs and feedback in one queue.',
  },
  {
    id: 'discord',
    name: 'Discord',
    category: 'Customer Support & Communication',
    description: 'Community signals and mod flags to internal channels.',
  },
  {
    id: 'gemini',
    name: 'Gemini AI',
    category: 'Developer Tools',
    description: 'AI for documents and content workflows.',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    category: 'Other',
    description: 'Playlists and listening data for workspace apps.',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'Productivity & Project Management',
    description:
      'Read, send, and search Gmail threads directly from your workspace.',
  },
  {
    id: 'github',
    name: 'GitHub',
    category: 'Developer Tools',
    description:
      'PR code reviews, issue sync, and commit webhooks directly in channels.',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    category: 'Developer Tools',
    description:
      'Merge request checks and CI/CD pipeline deployment notifications.',
  },
  {
    id: 'jira',
    name: 'Jira Software',
    category: 'Productivity & Project Management',
    description: 'Two-way task, backlog, and sprint status synchronization.',
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'Productivity & Project Management',
    description: 'Fast, modern issue tracking and workspace project linking.',
  },
  {
    id: 'figma',
    name: 'Figma',
    category: 'Design',
    description:
      'Design file embeds, live cursor feedback, and canvas updates.',
  },
  {
    id: 'gdrive',
    name: 'Google Drive',
    category: 'Productivity & Project Management',
    description:
      'Embed files, preview docs, and search attachments across rooms.',
  },
  {
    id: 'gcal',
    name: 'Google Calendar',
    category: 'Productivity & Project Management',
    description:
      'Auto-schedule meetings, sync availability, and event reminders.',
  },
  {
    id: 'outlook',
    name: 'Microsoft Outlook',
    category: 'Productivity & Project Management',
    description:
      'Sync Outlook calendar invitations, availability, and meeting join links.',
  },
  {
    id: 'custom_api',
    name: 'Custom External API',
    category: 'Developer Tools',
    description:
      'Connect any REST API with custom headers, bearer tokens, or API keys.',
  },
  {
    id: 'onetab_internal',
    name: 'OneTab Native Bridge',
    category: 'Internal Apps',
    description:
      'Internal workspace events, activity streams, and channel notifications.',
    isInternal: true,
  },
  {
    id: 'zendesk',
    name: 'Zendesk',
    category: 'Customer Support & Communication',
    description:
      'Customer support ticket routing, triage, and reply notifications.',
  },
  {
    id: 'intercom',
    name: 'Intercom',
    category: 'Customer Support & Communication',
    description: 'Live lead chat alerts and customer conversation management.',
  },
  {
    id: 'mixpanel',
    name: 'Mixpanel',
    category: 'Analytics',
    description:
      'Product analytics, event tracking reports, and metrics summaries.',
  },
  {
    id: 'datadog',
    name: 'Datadog',
    category: 'Analytics',
    description:
      'Real-time infrastructure monitoring, alerts, and incident tracking.',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    category: 'Finance',
    description: 'Accounting receipts, expense tracking, and payroll reports.',
  },
  {
    id: 'bamboohr',
    name: 'BambooHR',
    category: 'HR & Team Culture',
    description:
      'Team birthday reminders, PTO approvals, and onboarding workflows.',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'Sales & Marketing',
    description:
      'CRM deal stage tracking, contact leads, and sales pipeline alerts.',
  },
  {
    id: 'webhooks',
    name: 'Custom Webhooks Hub',
    category: 'Internal Apps',
    description:
      'Incoming and outgoing custom REST webhooks for internal tools.',
    isInternal: true,
  },
];

const REAL_PROVIDERS = new Set(['gmail', 'custom_api', 'onetab_internal']);

export function IntegrationHubView() {
  const workspaceId = useWorkspaceId() ?? '';
  const integrations = useIntegrations(workspaceId);
  const { connect, disconnect, sync } = useIntegrationMutations(workspaceId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'All' | AppCategory>(
    'All',
  );
  const [isCustomApiModalOpen, setIsCustomApiModalOpen] = useState(false);
  const [activeGmailModal, setActiveGmailModal] = useState<{
    integrationId: string;
    email?: string;
  } | null>(null);
  const [logsCard, setLogsCard] = useState<IntegrationCard | null>(null);

  const connectedMap = new Map<string, ExternalIntegration>();
  for (const integration of integrations.data ?? []) {
    if (integration.status === 'CONNECTED') {
      connectedMap.set(integration.provider.toUpperCase(), integration);
    }
  }

  const startConnect = async (card: IntegrationCard) => {
    if (card.id === 'gmail') {
      try {
        const result = await connect.mutateAsync({
          provider: 'GMAIL',
          scopeType: 'USER',
        });
        if (result.authUrl) {
          const width = 600;
          const height = 700;
          const left = window.screen.width / 2 - width / 2;
          const top = window.screen.height / 2 - height / 2;
          window.open(
            result.authUrl,
            'Google OAuth',
            `width=${width},height=${height},left=${left},top=${top}`,
          );
        }
      } catch (err: unknown) {
        toast.error(
          err instanceof Error
            ? err.message
            : 'Failed to start Gmail connection.',
        );
      }
      return;
    }

    if (card.id === 'custom_api') {
      setIsCustomApiModalOpen(true);
      return;
    }

    connect.mutate({ provider: card.id.toUpperCase() });
  };

  const toggleConnection = (card: IntegrationCard) => {
    const connected = connectedMap.get(card.id.toUpperCase());
    if (connected) disconnect.mutate(connected.id);
    else void startConnect(card);
  };

  const filteredCards = integrationsList.filter((card) => {
    const matchesSearch =
      !searchQuery.trim() ||
      card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.category.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedFilter === 'All') return true;
    return card.category === selectedFilter;
  });

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      {/* Channel-style Header */}
      <div className="border-b border-border bg-background">
        <div className="gap-2.5 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <div className="min-w-0 gap-1.5 flex items-center">
              <Share2
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <h2 className="text-sm font-semibold tracking-tight truncate text-foreground">
                Apps
              </h2>
            </div>
          </div>

          <div className="gap-2 flex items-center">
            <SearchInput
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder="Search apps..."
              className="h-7 text-xs"
              wrapperClassName="w-36 sm:w-56"
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 p-4 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {/* Filter Dropdown & App Counter Header */}
          <div className="mb-4 flex items-center justify-between">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="gap-2 px-3.5 py-1.5 text-xs font-semibold flex items-center rounded-xl border border-border bg-surface-inset text-foreground shadow-sm transition-colors hover:bg-surface hover:text-foreground"
                >
                  <span>
                    {selectedFilter === 'All'
                      ? 'All app types'
                      : selectedFilter}
                  </span>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="bottom"
                sideOffset={4}
                className="w-72 max-h-80 scrollbar-subtle p-1.5 shadow-2xl overflow-y-auto border-border bg-surface-inset text-foreground"
              >
                <DropdownMenuItem
                  onSelect={() => setSelectedFilter('All')}
                  className="px-3 py-2 text-xs font-semibold flex cursor-pointer items-center justify-between rounded-lg hover:bg-accent"
                >
                  <span>All app types</span>
                  {selectedFilter === 'All' ? (
                    <Check className="size-4 text-info-text" />
                  ) : null}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => setSelectedFilter('Internal Apps')}
                  className="px-3 py-2 text-xs font-semibold flex cursor-pointer items-center justify-between rounded-lg hover:bg-accent"
                >
                  <span>Internal Apps</span>
                  {selectedFilter === 'Internal Apps' ? (
                    <Check className="size-4 text-info-text" />
                  ) : null}
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1.5 bg-border" />

                <DropdownMenuLabel className="px-3 py-1 font-bold tracking-wider text-[10px] text-muted-foreground uppercase">
                  Categories
                </DropdownMenuLabel>

                {(
                  [
                    'Analytics',
                    'Customer Support & Communication',
                    'Design',
                    'Developer Tools',
                    'Productivity & Project Management',
                    'HR & Team Culture',
                    'Sales & Marketing',
                    'Finance',
                    'Other',
                  ] as AppCategory[]
                ).map((category) => (
                  <DropdownMenuItem
                    key={category}
                    onSelect={() => setSelectedFilter(category)}
                    className="px-3 py-2 text-xs font-medium flex cursor-pointer items-center justify-between rounded-lg hover:bg-accent"
                  >
                    <span>{category}</span>
                    {selectedFilter === category ? (
                      <Check className="size-4 text-info-text" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <p className="text-xs font-bold tracking-wide text-muted-foreground">
              {filteredCards.length}{' '}
              {filteredCards.length === 1 ? 'app' : 'apps'} in workspace
            </p>
          </div>


        {/* 3-Columns Grid of Cards matching Reference Design */}
        {filteredCards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredCards.map((card) => {
              const connectedInfo = connectedMap.get(card.id.toUpperCase());
              const isConnected = Boolean(connectedInfo);
              const showQuickActions = isConnected && REAL_PROVIDERS.has(card.id);

              return (
                <div
                  key={card.id}
                  className="group p-5 rounded-2xl bg-[#121214] border border-zinc-800/90 hover:border-zinc-700/80 transition-all flex flex-col justify-between min-h-[175px] shadow-xs"
                >
                  {/* Top Row: App Icon & External Link / Action Menu */}
                  <div className="flex items-start justify-between">
                    <div className="size-10 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center p-2 text-white shadow-xs">
                      <IntegrationAppIcon id={card.id} name={card.name} />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {showQuickActions && connectedInfo && (
                        <>
                          {card.id === 'gmail' && (
                            <Hint label="Open inbox">
                              <button
                                type="button"
                                aria-label="Open inbox"
                                onClick={() =>
                                  setActiveGmailModal({
                                    integrationId: connectedInfo.id,
                                    email:
                                      connectedInfo.displayName ?? undefined,
                                  })
                                }
                                className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 transition-colors"
                              >
                                <Inbox className="size-3.5" />
                              </button>
                            </Hint>
                          )}

                          {card.id === 'custom_api' && (
                            <Hint label="Edit API config">
                              <button
                                type="button"
                                aria-label="Edit API config"
                                onClick={() => setIsCustomApiModalOpen(true)}
                                className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 transition-colors"
                              >
                                <Code2 className="size-3.5" />
                              </button>
                            </Hint>
                          )}

                          <Hint label="Sync now">
                            <button
                              type="button"
                              aria-label="Sync now"
                              disabled={sync.isPending}
                              onClick={() => sync.mutate(connectedInfo.id)}
                              className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 transition-colors"
                            >
                              <RefreshCw
                                className={cn(
                                  'size-3.5',
                                  sync.isPending && 'animate-spin',
                                )}
                              />
                            </button>
                          </Hint>

                          <Hint label="Activity log">
                            <button
                              type="button"
                              aria-label="Activity log"
                              onClick={() => setLogsCard(card)}
                              className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 transition-colors"
                            >
                              <Activity className="size-3.5" />
                            </button>
                          </Hint>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleConnection(card)}
                        aria-label={`Open ${card.name}`}
                        className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        <ExternalLink className="size-4" />
                      </button>
                    </div>
                  </div>

                  {/* Middle Row: Description text */}
                  <p className="my-auto py-2.5 text-xs sm:text-[13px] text-zinc-400 font-normal leading-relaxed line-clamp-2">
                    {card.description}
                  </p>

                  {/* Bottom Row: Action Button & Toggle Switch */}
                  <div className="flex items-center justify-between pt-1">
                    {isConnected ? (
                      <button
                        type="button"
                        onClick={() => toggleConnection(card)}
                        className="px-3.5 py-1.5 rounded-lg bg-[#18181b] hover:bg-zinc-800 border border-zinc-700/60 text-zinc-200 hover:text-white text-xs font-semibold transition-colors"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleConnection(card)}
                        className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <Zap className="size-3 fill-black text-black" />
                        <span>Connect</span>
                      </button>
                    )}

                    {/* Pill Switch matching reference design */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isConnected}
                      onClick={() => toggleConnection(card)}
                      aria-label={`Toggle ${card.name} connection`}
                      className={cn(
                        'w-9 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600',
                        isConnected
                          ? 'bg-zinc-700 justify-end'
                          : 'bg-zinc-800/90 border border-zinc-700/60 justify-start',
                      )}
                    >
                      <span className="size-3.5 rounded-full bg-white shadow-xs transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No integrations found"
            description="Try adjusting your search query or selecting a different category to see available apps."
          />
        )}
        </div>
      </div>

      {/* Gmail Inbox Modal */}

      {activeGmailModal ? (
        <GmailInboxModal
          workspaceId={workspaceId}
          integrationId={activeGmailModal.integrationId}
          accountEmail={activeGmailModal.email}
          isOpen={Boolean(activeGmailModal)}
          onClose={() => setActiveGmailModal(null)}
        />
      ) : null}

      {/* Custom API Modal */}
      <CustomApiModal
        workspaceId={workspaceId}
        isOpen={isCustomApiModalOpen}
        onClose={() => setIsCustomApiModalOpen(false)}
      />

      {/* Sync & Activity Log Modal */}
      <Dialog
        open={Boolean(logsCard)}
        onOpenChange={(open) => {
          if (!open) setLogsCard(null);
        }}
      >
        <DialogContent className="max-w-2xl bg-[#121214] border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">
              {logsCard
                ? `Sync & Activity — ${logsCard.name}`
                : 'Sync & Activity'}
            </DialogTitle>
          </DialogHeader>
          {logsCard
            ? (() => {
                const info = connectedMap.get(logsCard.id.toUpperCase());
                return info ? (
                  <IntegrationLogsView
                    workspaceId={workspaceId}
                    integrations={[info]}
                  />
                ) : null;
              })()
            : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

