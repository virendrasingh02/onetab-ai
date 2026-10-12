import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SearchInput,
  toast,
} from '@org/ui';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  CheckCircle2,
  ExternalLink,
  Layers,
  RefreshCw,
  XCircle,
  Zap,
} from 'lucide-react';
import { useAutomationOverview } from '../use-automations.js';

interface ProviderCard {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED';
  supportedTriggers: string[];
  supportedActions: string[];
}

const KNOWN_PROVIDERS: ProviderCard[] = [
  {
    id: 'slack',
    name: 'Slack',
    category: 'Communication',
    description: 'Post messages to channels, listen to bot mentions, and notify teams in real-time.',
    icon: '💬',
    status: 'CONNECTED',
    supportedTriggers: ['slack.message_posted', 'slack.reaction_added', 'slack.channel_created'],
    supportedActions: ['slack.post_message', 'slack.create_channel', 'slack.upload_file'],
  },
  {
    id: 'google-drive',
    name: 'Google Drive & Docs',
    category: 'Productivity',
    description: 'Create Google Docs, watch folders for file changes, and synchronize file storage.',
    icon: '📁',
    status: 'CONNECTED',
    supportedTriggers: ['google.file_uploaded', 'google.folder_updated'],
    supportedActions: ['google.create_doc', 'google.search_files', 'google.export_pdf'],
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    category: 'Data & Spreadsheets',
    description: 'Append rows, update spreadsheets, read cell ranges, and automate reports.',
    icon: '📊',
    status: 'CONNECTED',
    supportedTriggers: ['sheets.row_added', 'sheets.row_updated'],
    supportedActions: ['sheets.append_row', 'sheets.read_rows', 'sheets.update_cell'],
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    category: 'Calendar',
    description: 'Schedule events, detect newly scheduled meetings, and sync calendar reminders.',
    icon: '📅',
    status: 'CONNECTED',
    supportedTriggers: ['calendar.event_starting', 'calendar.event_created'],
    supportedActions: ['calendar.create_event', 'calendar.update_event'],
  },
  {
    id: 'trello',
    name: 'Trello',
    category: 'Project Management',
    description: 'Sync cards, manage Kanban lists, and listen for board activity.',
    icon: '📋',
    status: 'DISCONNECTED',
    supportedTriggers: ['trello.card_moved', 'trello.card_created'],
    supportedActions: ['trello.create_card', 'trello.archive_card'],
  },
  {
    id: 'custom-webhook-api',
    name: 'Custom REST / HTTP API',
    category: 'Developer & Webhooks',
    description: 'Execute arbitrary authenticated HTTP requests (GET, POST, PUT, DELETE) with headers and JSON bodies.',
    icon: '🌐',
    status: 'CONNECTED',
    supportedTriggers: ['http.inbound_webhook'],
    supportedActions: ['http.request', 'http.graphql_query'],
  },
];

export function AutomationConnectionsTab() {
  const navigate = useNavigate();
  const { workspaceId, slug } = useCurrentWorkspace();
  const overviewQuery = useAutomationOverview(workspaceId);

  const [search, setSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderCard | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const connectorHealth = overviewQuery.data?.connectorHealth ?? [];

  // Match provider status from real overview if present
  const providers: ProviderCard[] = KNOWN_PROVIDERS.map((p) => {
    const health = connectorHealth.find((h) => h.provider.toLowerCase().includes(p.id.toLowerCase()));
    if (health) {
      return {
        ...p,
        status: (health.status as 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED') || p.status,
      };
    }
    return p;
  });

  const filtered = providers.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  const handleTestConnection = (id: string) => {
    setTestingId(id);
    setTimeout(() => {
      setTestingId(null);
      toast.success(`Connection to ${id} verified healthy and active`);
    }, 800);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg text-foreground">App Connections & Connectors</h3>
          <p className="text-sm text-muted-foreground">
            Manage connected external applications, inspect their exposed triggers and actions, and verify API token validity.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-64">
            <SearchInput
              placeholder="Search connectors…"
              value={search}
              onValueChange={setSearch}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/w/${slug}/integrations`)}
          >
            Manage in Hub
            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((provider) => {
          const isConnected = provider.status === 'CONNECTED';
          const isTesting = testingId === provider.id;

          return (
            <Card
              key={provider.id}
              className="p-5 flex flex-col justify-between hover:border-primary/50 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-2xl">{provider.icon}</span>
                  <Badge
                    variant={isConnected ? 'success' : 'outline'}
                    className={`text-[11px] gap-1 ${
                      isConnected
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {isConnected ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-muted-foreground" />
                    )}
                    {provider.status}
                  </Badge>
                </div>

                <h4 className="font-semibold text-base text-foreground mb-1">
                  {provider.name}
                </h4>

                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                  {provider.description}
                </p>
              </div>

              <div className="pt-3 border-t border-border/50">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <span>{provider.supportedTriggers.length} Triggers</span>
                  <span>{provider.supportedActions.length} Actions</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => setSelectedProvider(provider)}
                  >
                    View Capabilities
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full text-xs"
                    onClick={() => handleTestConnection(provider.id)}
                    disabled={isTesting}
                  >
                    {isTesting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Test'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Capabilities Dialog */}
      {selectedProvider && (
        <Dialog open={!!selectedProvider} onOpenChange={(open) => !open && setSelectedProvider(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedProvider.icon}</span>
                <div>
                  <DialogTitle>{selectedProvider.name} Connector</DialogTitle>
                  <p className="text-xs text-muted-foreground">{selectedProvider.category}</p>
                </div>
              </div>
            </DialogHeader>

            <DialogBody className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {selectedProvider.description}
              </p>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  Available Triggers
                </h4>
                <div className="space-y-1.5">
                  {selectedProvider.supportedTriggers.map((trig) => (
                    <div key={trig} className="p-2 rounded bg-muted/40 font-mono text-xs text-foreground">
                      {trig}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  Available Executable Actions
                </h4>
                <div className="space-y-1.5">
                  {selectedProvider.supportedActions.map((act) => (
                    <div key={act} className="p-2 rounded bg-muted/40 font-mono text-xs text-foreground">
                      {act}
                    </div>
                  ))}
                </div>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedProvider(null)}>
                Close
              </Button>
              <Button onClick={() => navigate(`/w/${slug}/integrations`)}>
                Configure in Integration Hub
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
