import type { Accent } from '@org/design-system';
import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SearchInput,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  BarChart3,
  Check,
  ChevronDown,
  DollarSign,
  ExternalLink,
  FolderKanban,
  Headphones,
  Layout,
  Palette,
  Share2,
  Sparkles,
  Users,
  Webhook,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
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

const CATEGORY_META: Record<AppCategory, { icon: LucideIcon; accent: Accent }> =
  {
    Analytics: { icon: BarChart3, accent: 'blue' },
    'Customer Support & Communication': { icon: Headphones, accent: 'violet' },
    Design: { icon: Palette, accent: 'pink' },
    'Developer Tools': { icon: Share2, accent: 'amber' },
    'Productivity & Project Management': {
      icon: FolderKanban,
      accent: 'green',
    },
    'HR & Team Culture': { icon: Users, accent: 'cyan' },
    'Sales & Marketing': { icon: Layout, accent: 'rose' },
    Finance: { icon: DollarSign, accent: 'green' },
    'Internal Apps': { icon: Webhook, accent: 'teal' },
    Other: { icon: Webhook, accent: 'violet' },
  };

const APP_LOGOS: Record<string, string> = {
  github: 'https://cdn.simpleicons.org/github',
  gitlab: 'https://cdn.simpleicons.org/gitlab',
  jira: 'https://cdn.simpleicons.org/jira',
  linear: 'https://cdn.simpleicons.org/linear',
  figma: 'https://cdn.simpleicons.org/figma',
  gdrive: 'https://cdn.simpleicons.org/googledrive',
  google_drive: 'https://cdn.simpleicons.org/googledrive',
  gcal: 'https://cdn.simpleicons.org/googlecalendar',
  google_calendar: 'https://cdn.simpleicons.org/googlecalendar',
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
  webhooks: 'https://cdn.simpleicons.org/webhooks',
};

const integrationsList: IntegrationCard[] = [
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
    id: 'stripe',
    name: 'Stripe',
    category: 'Finance',
    description:
      'Payment alerts, subscription milestones, and invoice webhooks.',
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
    id: 'discord',
    name: 'Discord Bridge',
    category: 'Other',
    description:
      'Bridge Discord channels and post automated cross-platform updates.',
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

export function IntegrationHubView() {
  const workspaceId = useWorkspaceId();
  const integrations = useIntegrations(workspaceId);
  const { connect, disconnect } = useIntegrationMutations(workspaceId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'All' | AppCategory>(
    'All',
  );
  const [bannerDismissed, setBannerDismissed] = useState(false);

  /*
   * The catalogue below is the set of apps we can offer; the server records
   * which of them this workspace actually connected. Provider codes are stored
   * upper-case, so the card id is matched case-insensitively.
   */
  const connectedProviders = new Set(
    (integrations.data ?? [])
      .filter((integration) => integration.status === 'CONNECTED')
      .map((integration) => integration.provider.toUpperCase()),
  );

  const toggleConnection = (card: IntegrationCard) => {
    const provider = card.id.toUpperCase();
    if (connectedProviders.has(provider)) disconnect.mutate(provider);
    else connect.mutate({ provider });
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
              {/* <Badge
                variant="neutral"
                className="px-1.5 py-0 h-4.5 text-[11px]"
              >
                {connectedProviders.size} of {integrationsList.length} connected
              </Badge> */}
            </div>

            {/* <div className="h-4 mx-1 sm:block hidden w-px bg-border" /> */}
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
          {/* Featured AI Banner Card */}
          {!bannerDismissed ? (
            <div className="mb-6 p-5 relative overflow-hidden rounded-2xl border border-border bg-surface-inset shadow-lg">
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                className="top-3 right-3 p-1 absolute rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>

              <div className="md:flex-row md:items-center gap-4 flex flex-col items-start justify-between">
                <div className="space-y-2 max-w-xl">
                  <div className="gap-2 text-xs font-bold tracking-wider flex items-center text-primary-text uppercase">
                    <Sparkles className="size-4 text-warning-text" />
                    <span>AI-Powered Integrations</span>
                  </div>
                  <h3 className="text-lg font-extrabold tracking-tight text-foreground">
                    One-click access to AI tools in OneTab
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    A new app messaging experience makes having conversations
                    with AI-powered agents and assistants a snap. Install apps
                    with an assistant or agent, and put them to work today.
                  </p>
                  <div className="pt-1">
                    <Button
                      size="sm"
                      className="font-semibold px-4 py-1.5 rounded-lg bg-success text-success-foreground shadow-sm hover:bg-success/90"
                    >
                      Browse agents
                    </Button>
                  </div>
                </div>

                {/* Thumbnail Badge Grid */}
                <div className="gap-2 p-3 shadow-inner flex items-center rounded-2xl border border-border bg-surface">
                  {['🤖', '⚡', '📊', '💬', '📂'].map((icon, idx) => (
                    <div
                      key={idx}
                      className="size-10 text-lg flex items-center justify-center rounded-xl border border-border bg-surface-inset shadow-sm"
                    >
                      {icon}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

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

          {/* App Cards Grid */}
          {filteredCards.length > 0 ? (
            <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
              {filteredCards.map((card) => {
                const meta =
                  CATEGORY_META[card.category] || CATEGORY_META['Other'];
                const Icon = meta.icon;
                const isConnected = connectedProviders.has(
                  card.id.toUpperCase(),
                );
                const logoUrl = APP_LOGOS[card.id.toLowerCase()];

                return (
                  <li key={card.id}>
                    <Card className="p-5 flex h-full flex-col justify-between border-border bg-surface-inset transition-all hover:border-primary hover:shadow-md">
                      <div>
                        <div className="mb-3 gap-2 flex items-start justify-between">
                          <div className="gap-3 flex items-center">
                            <span
                              aria-hidden
                              className={cn(
                                'size-10 p-2 flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-foreground shadow-xs',
                              )}
                            >
                              {logoUrl ? (
                                <img
                                  src={logoUrl}
                                  alt={card.name}
                                  className="size-full object-contain dark:brightness-110"
                                  loading="lazy"
                                />
                              ) : (
                                <Icon className="size-5 text-primary-text" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <h2 className="text-sm font-extrabold truncate text-foreground">
                                {card.name}
                              </h2>
                              <p className="font-medium truncate text-[11px] text-muted-foreground">
                                {card.category}
                              </p>
                            </div>
                          </div>

                          {card.isInternal ? (
                            <Badge
                              variant="neutral"
                              className="border-primary/40 bg-primary/20 text-[10px] text-primary-text"
                            >
                              Internal
                            </Badge>
                          ) : null}
                        </div>

                        <p className="mb-4 text-xs leading-relaxed line-clamp-3 text-muted-foreground">
                          {card.description}
                        </p>
                      </div>

                      <Button
                        variant={isConnected ? 'outline' : 'primary'}
                        size="sm"
                        className={cn(
                          'font-semibold w-full rounded-lg transition-colors',
                          isConnected
                            ? 'border-border bg-surface text-foreground hover:bg-accent'
                            : 'bg-primary text-primary-foreground hover:bg-primary-hover',
                        )}
                        onClick={() => toggleConnection(card)}
                        leadingIcon={
                          isConnected ? (
                            <Check className="size-4 text-success-text" />
                          ) : (
                            <ExternalLink className="size-4" />
                          )
                        }
                      >
                        {isConnected ? 'Connected' : 'Connect'}
                        <span className="sr-only"> — {card.name}</span>
                      </Button>
                    </Card>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-12 rounded-2xl border border-dashed border-border bg-surface-inset text-center">
              <p className="text-sm font-bold text-foreground">No apps found</p>
              <p className="text-xs mt-1 text-muted-foreground">
                Try adjusting your search query or selecting a different app
                category.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
