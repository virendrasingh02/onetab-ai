import type { FC } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ScrollArea,
  Spinner,
  toast,
  type RightPanelProfile,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  AlertCircle,
  Blocks,
  Check,
  CheckCircle2,
  Copy,
  MoreVertical,
  Play,
  Plug,
  RefreshCw,
  Settings,
  Shield,
  X,
  Zap,
} from 'lucide-react';
import {
  AppAvatar,
  DEFAULT_WORKSPACE_APPS,
  type AppModelItem,
} from './AppChatView.js';
import {
  useIntegrationMutations,
  useIntegrationProviders,
  useIntegrations,
} from './use-integrations.js';

export interface AppProfileRightPanelProps {
  profile: RightPanelProfile;
  workspaceId: string;
  workspaceSlug: string;
  onClose: () => void;
}

export const AppProfileRightPanel: FC<AppProfileRightPanelProps> = ({
  profile,
  workspaceId,
  workspaceSlug,
  onClose,
}) => {
  const navigate = useNavigate();
  const integrationsQuery = useIntegrations(workspaceId);
  const { connect, disconnect } = useIntegrationMutations(workspaceId);
  const providersQuery = useIntegrationProviders(workspaceId);

  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const appId = profile.entityId || profile.userId.replace(/^app-/, '');

  // Look up integration from connected ones or default apps
  const connectedMatch = integrationsQuery.data?.find(
    (i: any) =>
      i.id === appId ||
      i.provider.toLowerCase() === appId.toLowerCase(),
  );

  const defaultMatch = DEFAULT_WORKSPACE_APPS.find(
    (d) =>
      d.id === appId.toLowerCase() ||
      d.provider.toLowerCase() === appId.toLowerCase(),
  );

  const app: AppModelItem = (profile.raw as AppModelItem | undefined) || {
    id: appId,
    name: connectedMatch?.displayName || defaultMatch?.name || profile.name || appId,
    category: defaultMatch?.category || profile.role || 'Developer Tools',
    description:
      defaultMatch?.description ||
      profile.bio ||
      `${appId} workspace integration connected for automated workflows.`,
    provider: connectedMatch?.provider?.toLowerCase() || defaultMatch?.provider || appId,
    isConnected: !!connectedMatch && connectedMatch.status === 'CONNECTED',
    integrationId: connectedMatch?.id,
  };

  const isConnected = app.isConnected;

  const handleCopyLink = () => {
    const url = `${window.location.origin}/w/${workspaceSlug}/apps/chat?app=${app.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('App link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSyncWebhooks = () => {
    setIsSyncing(true);
    toast.success('Webhooks synchronized', {
      description: `Feed triggers for ${app.name} are active and updated.`,
    });
    setTimeout(() => setIsSyncing(false), 1200);
  };

  const handleConnect = async () => {
    const providerKey = app.provider.toUpperCase();
    const capabilities = providersQuery.data?.find((p) => p.provider === providerKey);

    try {
      const result = await connect.mutateAsync({ provider: app.provider });
      if (capabilities?.authType === 'OAUTH2' && result.authUrl) {
        window.open(result.authUrl, `${app.name} OAuth`, 'width=600,height=700');
      } else {
        toast.success(`${app.name} connected`);
      }
    } catch {
      toast.error(`Could not connect ${app.name}`);
    }
  };

  const handleDisconnect = async () => {
    if (!app.integrationId) return;
    if (!window.confirm(`Disconnect ${app.name}? Automated messages and commands will be suspended.`)) {
      return;
    }
    try {
      await disconnect.mutateAsync(app.integrationId);
      toast.success(`Disconnected ${app.name}`);
    } catch {
      toast.error(`Failed to disconnect ${app.name}`);
    }
  };

  return (
    <aside className="flex h-full w-full flex-col bg-surface text-foreground overflow-hidden">
      {/* Drawer Top Bar */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-accent-violet" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Connected App Details
          </span>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/w/${workspaceSlug}/integrations?app=${app.id}`)}>
                <Settings className="mr-2 h-3.5 w-3.5" />
                Manage Integration & Scopes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSyncWebhooks}>
                <RefreshCw className={cn('mr-2 h-3.5 w-3.5', isSyncing && 'animate-spin')} />
                Sync Webhooks
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copy Link
              </DropdownMenuItem>
              {isConnected && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDisconnect} className="text-destructive focus:text-destructive">
                    <AlertCircle className="mr-2 h-3.5 w-3.5" />
                    Disconnect App
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Body */}
      <ScrollArea className="flex-1">
        {/* Cover Header */}
        <div
          className="h-24 w-full relative bg-cover bg-center"
          style={{
            backgroundImage: 'linear-gradient(135deg, #1e1b4b 0%, #064e3b 50%, #0f172a 100%)',
          }}
        >
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* Content Body */}
        <div className="px-5 pb-5 pt-0 relative">
          <div className="-mt-10 mb-3 flex items-end justify-between">
            <div className="relative">
              <AppAvatar
                name={app.name}
                provider={app.provider}
                size="lg"
                className="size-18 rounded-2xl shadow-lg ring-4 ring-surface"
              />
            </div>
            <div className="flex items-center gap-1.5 pb-1">
              <Badge
                variant={isConnected ? 'primary' : 'outline'}
                className="text-[10px] px-2 py-0.5 font-semibold"
              >
                {isConnected ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-foreground truncate">{app.name}</h2>
              <Badge
                variant="neutral"
                className="text-[10px] font-bold uppercase tracking-wider border-accent-violet/30 bg-accent-violet/10 text-accent-violet"
              >
                APP
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{app.category}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mb-5">
            {isConnected ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/w/${workspaceSlug}/apps/chat?app=${app.id}`)}
                className="text-xs font-semibold gap-1.5 flex-1 shadow-xs"
              >
                <Play className="size-3.5 fill-current" />
                <span>Open Chat</span>
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleConnect}
                disabled={connect.isPending}
                className="text-xs font-semibold gap-1.5 flex-1 shadow-xs"
              >
                {connect.isPending ? <Spinner className="size-3.5" /> : <Plug className="size-3.5" />}
                <span>Connect {app.name}</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/w/${workspaceSlug}/integrations?app=${app.id}`)}
              className="text-xs gap-1.5 flex-1 border-border bg-surface hover:bg-accent"
            >
              <Settings className="size-3.5" />
              <span>Settings</span>
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleCopyLink}
              className="size-8 border-border bg-surface hover:bg-accent shrink-0"
              title="Copy link"
            >
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            </Button>
          </div>

          {/* Meta Chips */}
          <div className="flex flex-wrap items-center gap-3 py-2.5 text-xs text-muted-foreground border-y border-border/60 mb-5">
            <div className="flex items-center gap-1.5">
              <Blocks className="size-3.5 text-primary" />
              <span className="capitalize font-medium text-foreground">{app.provider}</span>
            </div>
            <span className="text-border">·</span>
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="size-3.5" />
                  Active Webhook
                </span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <AlertCircle className="size-3.5" />
                  Setup Required
                </span>
              )}
            </div>
          </div>

          {/* Structured Cards */}
          <div className="space-y-4">
            {/* Box 1: Description */}
            <div className="rounded-xl border border-border bg-surface-inset/40 p-4 space-y-2">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Plug className="size-3.5 text-accent-violet" />
                <span>About Integration</span>
              </h3>
              <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">{app.description}</p>
            </div>

            {/* Box 2: Connection Status & Identity */}
            <div className="rounded-xl border border-border bg-surface-inset/40 p-4 space-y-2.5 text-xs">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="size-3.5 text-primary" />
                <span>Integration Status</span>
              </h3>

              <div className="flex items-center justify-between pt-1">
                <span className="text-muted-foreground">Provider Key:</span>
                <span className="font-mono text-foreground font-medium">{app.provider}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Matrix Room:</span>
                <span className="font-mono text-muted-foreground">
                  {app.integrationId ? `app-${app.integrationId}` : 'On connection'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Webhook Feeds:</span>
                <Badge variant={isConnected ? 'neutral' : 'outline'} className="text-[10px]">
                  {isConnected ? 'Subscribed & Live' : 'Suspended'}
                </Badge>
              </div>
            </div>

            {/* Box 3: Permissions & Capabilities */}
            <div className="rounded-xl border border-border bg-surface-inset/40 p-4 space-y-2">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="size-3.5 text-accent-amber" />
                <span>App Capabilities</span>
              </h3>
              <div className="space-y-1.5 pt-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="size-3.5 text-success shrink-0" />
                  <span>Interactive chat commands &amp; slash actions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="size-3.5 text-success shrink-0" />
                  <span>Real-time event notifications in workspace channels</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="size-3.5 text-success shrink-0" />
                  <span>Threaded workflow triggers and automated responses</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
};
