import type { Accent } from '@org/design-system';
import { toggleRegistryItem, useConnectedApps } from '@org/hooks';
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
  const [connected, saveConnected] = useConnectedApps();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'All' | AppCategory>('All');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const toggleConnection = (card: IntegrationCard) =>
    saveConnected(
      toggleRegistryItem(connected, {
        id: card.id,
        name: card.name,
        icon: 'Plug',
        detail: card.category,
      }),
    );

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
              {connected.length} of {integrationsList.length} connected
            </Badge>
            <Button variant="outline" size="sm" leadingIcon={<ExternalLink />}>
              Open in Marketplace
            </Button>
          </div>
        }
      />

      {/* Top Search Bar */}
      <div className="mb-4 relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#949ba4]" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by app name or category..."
          className="pl-10 bg-[#1e1f22] border-[#3f4147] text-[#dbdee1] placeholder:text-[#80848e] focus-visible:ring-[#5865f2]"
        />
      </div>

      {/* Featured AI Banner Card */}
      {!bannerDismissed ? (
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-[#3f4147] bg-[#1e1f22] p-5 shadow-lg">
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="absolute top-3 right-3 rounded-full p-1 text-[#949ba4] hover:bg-[#35373c] hover:text-white transition-colors"
          >
            <X className="size-4" />
          </button>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2 text-xs font-bold text-[#5865f2] uppercase tracking-wider">
                <Sparkles className="size-4 text-[#f59e0b]" />
                <span>AI-Powered Integrations</span>
              </div>
              <h3 className="text-lg font-extrabold text-white tracking-tight">
                One-click access to AI tools in OneTab
              </h3>
              <p className="text-xs text-[#949ba4] leading-relaxed">
                A new app messaging experience makes having conversations with AI-powered agents and assistants a snap. Install apps with an assistant or agent, and put them to work today.
              </p>
              <div className="pt-1">
                <Button size="sm" className="bg-[#057a55] hover:bg-[#046c4e] text-white font-semibold rounded-lg px-4 py-1.5 shadow-sm">
                  Browse agents
                </Button>
              </div>
            </div>

            {/* Thumbnail Badge Grid */}
            <div className="flex items-center gap-2 rounded-2xl border border-[#3f4147] bg-[#2b2d31] p-3 shadow-inner">
              {['🤖', '⚡', '📊', '💬', '📂'].map((icon, idx) => (
                <div
                  key={idx}
                  className="flex size-10 items-center justify-center rounded-xl bg-[#1e1f22] text-lg shadow-sm border border-[#3f4147]"
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
              className="flex items-center gap-2 rounded-xl border border-[#3f4147] bg-[#1e1f22] px-3.5 py-1.5 text-xs font-semibold text-[#dbdee1] transition-colors hover:bg-[#2b2d31] hover:text-white shadow-sm"
            >
              <span>
                {selectedFilter === 'All' ? 'All app types' : selectedFilter}
              </span>
              <ChevronDown className="size-3.5 text-[#949ba4]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="bottom"
            sideOffset={4}
            className="w-72 max-h-80 overflow-y-auto scrollbar-subtle border-[#3f4147] bg-[#1e1f22] p-1.5 text-[#dbdee1] shadow-2xl"
          >
            <DropdownMenuItem
              onSelect={() => setSelectedFilter('All')}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold hover:bg-[#35373c] cursor-pointer"
            >
              <span>All app types</span>
              {selectedFilter === 'All' ? (
                <Check className="size-4 text-[#00a8fc]" />
              ) : null}
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={() => setSelectedFilter('Internal Apps')}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold hover:bg-[#35373c] cursor-pointer"
            >
              <span>Internal Apps</span>
              {selectedFilter === 'Internal Apps' ? (
                <Check className="size-4 text-[#00a8fc]" />
              ) : null}
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1.5 bg-[#3f4147]" />

            <DropdownMenuLabel className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
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
                className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium hover:bg-[#35373c] cursor-pointer"
              >
                <span>{category}</span>
                {selectedFilter === category ? (
                  <Check className="size-4 text-[#00a8fc]" />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <p className="text-xs font-bold text-[#949ba4] tracking-wide">
          {filteredCards.length} {filteredCards.length === 1 ? 'app' : 'apps'} in workspace
        </p>
      </div>

      {/* App Cards Grid */}
      {filteredCards.length > 0 ? (
        <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
          {filteredCards.map((card) => {
            const meta = CATEGORY_META[card.category] || CATEGORY_META['Other'];
            const Icon = meta.icon;
            const isConnected = connected.some((entry) => entry.id === card.id);

            return (
              <li key={card.id}>
                <Card className="p-5 h-full flex flex-col justify-between border-[#3f4147] bg-[#1e1f22] transition-all hover:border-[#5865f2] hover:shadow-md">
                  <div>
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className={cn(
                            'size-10 flex shrink-0 items-center justify-center rounded-xl border border-[#3f4147] bg-[#2b2d31] text-white shadow-xs',
                          )}
                        >
                          <Icon className="size-5 text-[#5865f2]" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="text-sm font-extrabold truncate text-white">
                            {card.name}
                          </h2>
                          <p className="text-[11px] text-[#949ba4] truncate font-medium">
                            {card.category}
                          </p>
                        </div>
                      </div>

                      {card.isInternal ? (
                        <Badge variant="neutral" className="bg-[#5865f2]/20 text-[#5865f2] border-[#5865f2]/40 text-[10px]">
                          Internal
                        </Badge>
                      ) : null}
                    </div>

                    <p className="mb-4 text-xs leading-relaxed text-[#b5bac1] line-clamp-3">
                      {card.description}
                    </p>
                  </div>

                  <Button
                    variant={isConnected ? 'outline' : 'primary'}
                    size="sm"
                    className={cn(
                      'w-full font-semibold rounded-lg transition-colors',
                      isConnected
                        ? 'border-[#3f4147] bg-[#2b2d31] text-white hover:bg-[#35373c]'
                        : 'bg-[#5865f2] text-white hover:bg-[#4752c4]',
                    )}
                    onClick={() => toggleConnection(card)}
                    leadingIcon={
                      isConnected ? (
                        <Check className="text-[#22c55e] size-4" />
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
        <div className="py-12 text-center border border-dashed border-[#3f4147] rounded-2xl bg-[#1e1f22]">
          <p className="text-sm font-bold text-white">No apps found</p>
          <p className="text-xs text-[#949ba4] mt-1">
            Try adjusting your search query or selecting a different app category.
          </p>
        </div>
      )}
    </Page>
  );
}
