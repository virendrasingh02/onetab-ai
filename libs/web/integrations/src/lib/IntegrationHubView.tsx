import type { Accent } from '@org/design-system';
import { toggleRegistryItem, useConnectedApps } from '@org/hooks';
import { accentClasses, Badge, Button, Card, Page, PageHeader } from '@org/ui';
import { cn } from '@org/utils';
import {
  Calendar,
  Check,
  ExternalLink,
  FileText,
  HardDrive,
  MessageSquare,
  Share2,
  Video,
  Webhook,
  type LucideIcon,
} from 'lucide-react';

export interface IntegrationCard {
  id: string;
  name: string;
  category: Category;
  description: string;
}

type Category =
  | 'Dev Tools'
  | 'Storage'
  | 'Calendar'
  | 'Messaging'
  | 'Video'
  | 'Importer'
  | 'API';

/**
 * Icon and accent per category, resolved from one table rather than a chain of
 * inline `&&` conditionals in the markup.
 */
const CATEGORY: Record<Category, { icon: LucideIcon; accent: Accent }> = {
  'Dev Tools': { icon: Share2, accent: 'blue' },
  Storage: { icon: HardDrive, accent: 'green' },
  Calendar: { icon: Calendar, accent: 'amber' },
  Messaging: { icon: MessageSquare, accent: 'violet' },
  Video: { icon: Video, accent: 'pink' },
  Importer: { icon: FileText, accent: 'cyan' },
  API: { icon: Webhook, accent: 'rose' },
};

/**
 * The same icons by name, for the sidebar.
 *
 * The registry stores a name rather than a component because it is persisted to
 * local storage; `@org/ui`'s `IconRenderer` resolves it back. Names not in that
 * registry (`Share2`, `Webhook`) fall through to close equivalents.
 */
const CATEGORY_ICON: Record<Category, string> = {
  'Dev Tools': 'Code',
  Storage: 'HardDrive',
  Calendar: 'Calendar',
  Messaging: 'MessageSquare',
  Video: 'Video',
  Importer: 'FileText',
  API: 'Plug',
};

const integrationsList: IntegrationCard[] = [
  {
    id: 'github',
    name: 'GitHub',
    category: 'Dev Tools',
    description: 'PR code reviews, issue sync, and commit webhooks.',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    category: 'Dev Tools',
    description: 'Merge request checks and pipeline notifications.',
  },
  {
    id: 'jira',
    name: 'Jira',
    category: 'Dev Tools',
    description: 'Two-way task and sprint synchronization.',
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'Dev Tools',
    description: 'Fast issue tracking and workspace linking.',
  },
  {
    id: 'gdrive',
    name: 'Google Drive',
    category: 'Storage',
    description: 'Embed files, preview docs, and search attachments.',
  },
  {
    id: 'gcal',
    name: 'Google Calendar',
    category: 'Calendar',
    description: 'Auto-schedule meetings and event reminders.',
  },
  {
    id: 'outlook',
    name: 'Outlook / MS 365',
    category: 'Calendar',
    description: 'Sync meetings, contacts, and emails.',
  },
  {
    id: 'slack',
    name: 'Slack Import',
    category: 'Importer',
    description: 'Import full Slack workspace JSON exports.',
  },
  {
    id: 'discord',
    name: 'Discord',
    category: 'Messaging',
    description: 'Bridge channels and post automated updates.',
  },
  {
    id: 'zoom',
    name: 'Zoom',
    category: 'Video',
    description: 'Auto-generate video conference links.',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    category: 'Messaging',
    description: 'Connect MS Teams channels to Matrix.',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    category: 'Storage',
    description: 'Browse and share Dropbox file links.',
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    category: 'Storage',
    description: 'Attach Microsoft cloud documents.',
  },
  {
    id: 'notion',
    name: 'Notion Import',
    category: 'Importer',
    description: 'Convert Notion pages and databases to Docs.',
  },
  {
    id: 'webhooks',
    name: 'Webhooks Hub',
    category: 'API',
    description: 'Incoming and outgoing custom webhooks.',
  },
];

export function IntegrationHubView() {
  /*
   * Which apps are connected lives in the shared registry rather than in local
   * state: the sidebar lists the connected ones, and toggling here used to be
   * forgotten the moment you navigated away.
   */
  const [connected, saveConnected] = useConnectedApps();
  const cards = integrationsList;

  const toggleConnection = (card: IntegrationCard) =>
    saveConnected(
      toggleRegistryItem(connected, {
        id: card.id,
        name: card.name,
        icon: CATEGORY_ICON[card.category],
        detail: card.category,
      }),
    );

  return (
    <Page>
      <PageHeader
        title="Apps"
        description="Discover, install, and manage connected apps, dev tools, and workflows."
        icon={<Share2 />}
        accent="blue"
        actions={
          <Badge variant="neutral">
            {connected.length} of {cards.length} connected
          </Badge>
        }
      />

      <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
        {cards.map((card) => {
          const { icon: Icon, accent } = CATEGORY[card.category];
          const isConnected = connected.some((entry) => entry.id === card.id);

          return (
            <li key={card.id}>
              <Card className="p-5 h-full justify-between transition-colors duration-(--duration-fast) hover:border-border-strong">
                <div>
                  <div className="mb-3 gap-2.5 flex items-center">
                    <span
                      aria-hidden
                      className={cn(
                        'size-9 flex shrink-0 items-center justify-center rounded-lg',
                        accentClasses[accent].soft,
                      )}
                    >
                      <Icon className="size-4.5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold truncate text-foreground">
                        {card.name}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {card.category}
                      </p>
                    </div>
                  </div>
                  <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                    {card.description}
                  </p>
                </div>

                <Button
                  variant={isConnected ? 'outline' : 'primary'}
                  size="sm"
                  className="w-full"
                  onClick={() => toggleConnection(card)}
                  leadingIcon={
                    isConnected ? (
                      <Check className="text-success" />
                    ) : (
                      <ExternalLink />
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
    </Page>
  );
}
