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
  Input,
  Page,
  PageHeader,
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
  Search,
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

const CATEGORY_META: Record<
  AppCategory,
  { icon: LucideIcon; accent: Accent }
> = {
  Analytics: { icon: BarChart3, accent: 'blue' },
  'Customer Support & Communication': { icon: Headphones, accent: 'violet' },
  Design: { icon: Palette, accent: 'pink' },
  'Developer Tools': { icon: Share2, accent: 'amber' },
  'Productivity & Project Management': { icon: FolderKanban, accent: 'green' },
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
    description: 'PR code reviews, issue sync, and commit webhooks directly in channels.',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    category: 'Developer Tools',
    description: 'Merge request checks and CI/CD pipeline deployment notifications.',
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
    description: 'Design file embeds, live cursor feedback, and canvas updates.',
  },
  {
    id: 'gdrive',
    name: 'Google Drive',
    category: 'Productivity & Project Management',
    description: 'Embed files, preview docs, and search attachments across rooms.',
  },
  {
    id: 'gcal',
    name: 'Google Calendar',
    category: 'Productivity & Project Management',
    description: 'Auto-schedule meetings, sync availability, and event reminders.',
  },
  {
    id: 'outlook',
    name: 'Microsoft Outlook',
    category: 'Productivity & Project Management',
    description: 'Sync Outlook calendar invitations, availability, and meeting join links.',
  },
  {
    id: 'zendesk',
    name: 'Zendesk',
    category: 'Customer Support & Communication',
    description: 'Customer support ticket routing, triage, and reply notifications.',
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
    description: 'Product analytics, event tracking reports, and metrics summaries.',
  },
  {
    id: 'datadog',
    name: 'Datadog',
    category: 'Analytics',
    description: 'Real-time infrastructure monitoring, alerts, and incident tracking.',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'Finance',
    description: 'Payment alerts, subscription milestones, and invoice webhooks.',
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
    description: 'Team birthday reminders, PTO approvals, and onboarding workflows.',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'Sales & Marketing',
    description: 'CRM deal stage tracking, contact leads, and sales pipeline alerts.',
  },
  {
    id: 'discord',
    name: 'Discord Bridge',
    category: 'Other',
    description: 'Bridge Discord channels and post automated cross-platform updates.',
  },
  {
    id: 'webhooks',
    name: 'Custom Webhooks Hub',
    category: 'Internal Apps',
    description: 'Incoming and outgoing custom REST webhooks for internal tools.',
    isInternal: true,
  },
];

export function IntegrationHubView() {
  const workspaceId = useWorkspaceId();
  const integrations = useIntegrations(workspaceId);
  const { connect, disconnect } = useIntegrationMutations(workspaceId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'All' | AppCategory>('All');
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
    <Page>
      <PageHeader
        title="Apps"
        description="Discover, install, and manage connected apps, dev tools, and workflows."
        icon={<Share2 />}
        accent="blue"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="neutral">
              {connectedProviders.size} of {integrationsList.length} connected
            </Badge>
            <Button variant="outline" size="sm" leadingIcon={<ExternalLink />}>
              Open in Marketplace
            </Button>
          </div>
        }
      />

      {/* Top Search Bar */}
      <div className="mb-4 relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by app name or category..."
          className="pl-10 bg-surface-inset border-border text-foreground placeholder:text-subtle focus-visible:ring-primary"
        />
      </div>

      {/* Featured AI Banner Card */}
      {!bannerDismissed ? (
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-border bg-surface-inset p-5 shadow-lg">
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="absolute top-3 right-3 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2 text-xs font-bold text-primary-text uppercase tracking-wider">
                <Sparkles className="size-4 text-warning-text" />
                <span>AI-Powered Integrations</span>
              </div>
              <h3 className="text-lg font-extrabold text-foreground tracking-tight">
                One-click access to AI tools in OneTab
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A new app messaging experience makes having conversations with AI-powered agents and assistants a snap. Install apps with an assistant or agent, and put them to work today.
              </p>
              <div className="pt-1">
                <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground font-semibold rounded-lg px-4 py-1.5 shadow-sm">
                  Browse agents
                </Button>
              </div>
            </div>

            {/* Thumbnail Badge Grid */}
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-3 shadow-inner">
              {['🤖', '⚡', '📊', '💬', '📂'].map((icon, idx) => (
                <div
                  key={idx}
                  className="flex size-10 items-center justify-center rounded-xl bg-surface-inset text-lg shadow-sm border border-border"
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
              className="flex items-center gap-2 rounded-xl border border-border bg-surface-inset px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface hover:text-foreground shadow-sm"
            >
              <span>
                {selectedFilter === 'All' ? 'All app types' : selectedFilter}
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="bottom"
            sideOffset={4}
            className="w-72 max-h-80 overflow-y-auto scrollbar-subtle border-border bg-surface-inset p-1.5 text-foreground shadow-2xl"
          >
            <DropdownMenuItem
              onSelect={() => setSelectedFilter('All')}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold hover:bg-accent cursor-pointer"
            >
              <span>All app types</span>
              {selectedFilter === 'All' ? (
                <Check className="size-4 text-info-text" />
              ) : null}
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={() => setSelectedFilter('Internal Apps')}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold hover:bg-accent cursor-pointer"
            >
              <span>Internal Apps</span>
              {selectedFilter === 'Internal Apps' ? (
                <Check className="size-4 text-info-text" />
              ) : null}
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1.5 bg-border" />

            <DropdownMenuLabel className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
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
                className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium hover:bg-accent cursor-pointer"
              >
                <span>{category}</span>
                {selectedFilter === category ? (
                  <Check className="size-4 text-info-text" />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <p className="text-xs font-bold text-muted-foreground tracking-wide">
          {filteredCards.length} {filteredCards.length === 1 ? 'app' : 'apps'} in workspace
        </p>
      </div>

      {/* App Cards Grid */}
      {filteredCards.length > 0 ? (
        <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
          {filteredCards.map((card) => {
            const meta = CATEGORY_META[card.category] || CATEGORY_META['Other'];
            const Icon = meta.icon;
            const isConnected = connectedProviders.has(card.id.toUpperCase());
            const logoUrl = APP_LOGOS[card.id.toLowerCase()];

            return (
              <li key={card.id}>
                <Card className="p-5 h-full flex flex-col justify-between border-border bg-surface-inset transition-all hover:border-primary hover:shadow-md">
                  <div>
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className={cn(
                            'size-10 flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-foreground shadow-xs p-2',
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
                          <p className="text-[11px] text-muted-foreground truncate font-medium">
                            {card.category}
                          </p>
                        </div>
                      </div>

                      {card.isInternal ? (
                        <Badge variant="neutral" className="bg-primary/20 text-primary-text border-primary/40 text-[10px]">
                          Internal
                        </Badge>
                      ) : null}
                    </div>

                    <p className="mb-4 text-xs leading-relaxed text-muted-foreground line-clamp-3">
                      {card.description}
                    </p>
                  </div>

                  <Button
                    variant={isConnected ? 'outline' : 'primary'}
                    size="sm"
                    className={cn(
                      'w-full font-semibold rounded-lg transition-colors',
                      isConnected
                        ? 'border-border bg-surface text-foreground hover:bg-accent'
                        : 'bg-primary text-primary-foreground hover:bg-primary-hover',
                    )}
                    onClick={() => toggleConnection(card)}
                    leadingIcon={
                      isConnected ? (
                        <Check className="text-success-text size-4" />
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
        <div className="py-12 text-center border border-dashed border-border rounded-2xl bg-surface-inset">
          <p className="text-sm font-bold text-foreground">No apps found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try adjusting your search query or selecting a different app category.
          </p>
        </div>
      )}
    </Page>
  );
}
