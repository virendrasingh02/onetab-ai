import type { AICoworkerDetail, ComposerContext } from '@org/types';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ErrorState,
  Hint,
  ScrollArea,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentUser } from '@org/auth';
import { useAgents } from '@org/web-agents';
import {
  ChatPanel,
  ConversationTabsShell,
  useDirectRoom,
  useMatrix,
} from '@org/web-chat';
import { useIntegrations } from '@org/web-integrations';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Activity,
  ArrowLeft,
  Bot,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Layers,
  MessageSquare,
  MoreHorizontal,
  PanelRight,
  PanelRightClose,
  Plug,
  Plus,
  Send,
  Sparkles,
  Star,
  Trash2,
  Unlink,
  UserCheck,
  UserRound,
} from 'lucide-react';
import { type FC, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CoworkerAvatar } from './CoworkerAvatar.js';
import { CoworkerCreateDialog } from './CoworkerCreateDialog.js';
import {
  CoworkerProfileDetails,
  CoworkerProfilePanel,
} from './CoworkerProfilePanel.js';
import { CoworkerStatusDot } from './CoworkerStatusDot.js';
import {
  useCoworker,
  useCoworkerFavorites,
  useCoworkerLogs,
  useCoworkerMutations,
} from './use-coworkers.js';

export interface CoworkerChatViewProps {
  coworkerId?: string;
}

export const CoworkerChatView: FC<CoworkerChatViewProps> = ({
  coworkerId: propCoworkerId,
}) => {
  const navigate = useNavigate();
  const params = useParams<{ slug: string; coworkerId?: string; id?: string }>();
  const coworkerId = propCoworkerId || params.coworkerId || params.id || '';

  const { workspaceId = '', slug: workspaceSlug = '' } = useCurrentWorkspace();

  const { data: coworker, isLoading, error } = useCoworker(workspaceId, coworkerId);
  const { data: logs, isLoading: logsLoading } = useCoworkerLogs(workspaceId, coworkerId);
  const agentsQuery = useAgents(workspaceId);
  const integrationsQuery = useIntegrations(workspaceId);

  const { isFavorite: checkFavorite, toggleFavorite } = useCoworkerFavorites(workspaceId);
  const mutations = useCoworkerMutations(workspaceId);

  const [activeTab, setActiveTab] = useState<'messages' | 'profile' | 'agents-apps' | 'activity'>('messages');
  const [showProfile, setShowProfile] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Fallback state for direct execution when Matrix is not available
  const [directPrompt, setDirectPrompt] = useState('');
  const [turnHistory, setTurnHistory] = useState<
    Array<{
      id: string;
      role: 'user' | 'coworker';
      content: string;
      timestamp: Date;
    }>
  >([]);

  const isFavorite = coworker ? checkFavorite(coworker.id) : false;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Coworker conversation link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendDirect = async (promptText: string) => {
    const text = promptText.trim();
    if (!text || mutations.execute.isPending || !coworker) return;

    const userMsgId = `u-${Date.now()}`;
    setTurnHistory((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: text, timestamp: new Date() },
    ]);
    setDirectPrompt('');

    try {
      const res = await mutations.execute.mutateAsync({
        coworkerId: coworker.id,
        promptText: text,
      });

      setTurnHistory((prev) => [
        ...prev,
        {
          id: `cw-${Date.now()}`,
          role: 'coworker',
          content: res.result || 'Done.',
          timestamp: new Date(),
        },
      ]);
    } catch {
      toast.error('Coworker execution failed');
      setTurnHistory((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'coworker',
          content: 'Sorry, I encountered an error while processing your request.',
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleLinkAgent = async (agentId: string) => {
    if (!coworker) return;
    try {
      await mutations.linkAgent.mutateAsync({
        coworkerId: coworker.id,
        agentId,
      });
      toast.success('Linked sub-agent');
    } catch {
      toast.error('Failed to link sub-agent');
    }
  };

  const handleUnlinkAgent = async (agentId: string) => {
    if (!coworker) return;
    try {
      await mutations.unlinkAgent.mutateAsync({
        coworkerId: coworker.id,
        agentId,
      });
      toast.success('Unlinked sub-agent');
    } catch {
      toast.error('Failed to unlink sub-agent');
    }
  };

  const handleLinkApp = async (integrationId: string) => {
    if (!coworker) return;
    try {
      await mutations.linkApp.mutateAsync({
        coworkerId: coworker.id,
        integrationId,
      });
      toast.success('Connected integration');
    } catch {
      toast.error('Failed to connect integration');
    }
  };

  const handleUnlinkApp = async (integrationId: string) => {
    if (!coworker) return;
    try {
      await mutations.unlinkApp.mutateAsync({
        coworkerId: coworker.id,
        integrationId,
      });
      toast.success('Unlinked integration');
    } catch {
      toast.error('Failed to unlink integration');
    }
  };

  const handleDeleteCoworker = async () => {
    if (!coworker) return;
    if (
      !window.confirm(
        `Are you sure you want to delete "${coworker.name}"? This action cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await mutations.remove.mutateAsync(coworker.id);
      toast.success(`Deleted coworker ${coworker.name}`);
      navigate(`/w/${workspaceSlug}/coworkers`);
    } catch {
      toast.error('Failed to delete coworker');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !coworker) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-6 bg-background">
        <ErrorState
          title="Coworker Not Found"
          description="The AI Coworker you requested does not exist or has been removed from this workspace."
        />
        <Button
          variant="outline"
          size="sm"
          className="mt-4 gap-2"
          onClick={() => navigate(`/w/${workspaceSlug}/coworkers`)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to AI Coworkers Directory
        </Button>
      </div>
    );
  }

  const linkedAgentIds = new Set(coworker.agentLinks?.map((l) => l.agentId) ?? []);
  const availableAgentsToLink = (agentsQuery.data ?? []).filter(
    (a) => !linkedAgentIds.has(a.id),
  );

  const linkedAppIds = new Set(coworker.appLinks?.map((l) => l.integrationId) ?? []);
  const availableAppsToLink = (integrationsQuery.data ?? []).filter(
    (i) => i.status === 'CONNECTED' && !linkedAppIds.has(i.id),
  );

  const totalTokensUsed = (logs ?? []).reduce(
    (acc, log) => acc + (log.tokensUsed || 0),
    0,
  );

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Coworker Top Bar Header — Styled Identically to AI Agents & Channels */}
        <header className="flex h-14 items-center justify-between border-b border-border/80 bg-surface/60 px-4 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => navigate(`/w/${workspaceSlug}/coworkers`)}
              title="Back to Directory"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <CoworkerAvatar
              name={coworker.name}
              avatarUrl={coworker.avatarUrl}
              status={coworker.status}
              size="sm"
            />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-foreground truncate">
                  {coworker.name}
                </h2>
                <Badge
                  variant="primary"
                  className="font-mono text-[10px] hidden sm:inline-flex uppercase font-bold"
                >
                  AI COWORKER
                </Badge>
                <CoworkerStatusDot status={coworker.status} size="xs" showLabel />
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {coworker.role} · {coworker.model || 'gpt-4o'}
              </p>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-1">
            {/* 1. Favorite Star Toggle */}
            <Hint label={isFavorite ? 'Remove Favorite' : 'Favorite'}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleFavorite(coworker.id)}
              >
                <Star
                  className={cn(
                    'size-4',
                    isFavorite
                      ? 'fill-current text-amber-500'
                      : 'text-muted-foreground',
                  )}
                />
              </Button>
            </Hint>

            {/* 2. Copy Direct Link */}
            <Hint label={copied ? 'Link Copied' : 'Copy Direct Link'}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleCopyLink}
              >
                {copied ? (
                  <Check className="size-4 text-emerald-500" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </Hint>

            {/* 3. More Dropdown Menu */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleCopyLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  <span>Copy Direct Link</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                  <Brain className="mr-2 h-4 w-4" />
                  <span>Edit Settings &amp; Prompt</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate(`/w/${workspaceSlug}/coworkers`)}
                >
                  <UserRound className="mr-2 h-4 w-4" />
                  <span>View Coworkers Directory</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDeleteCoworker}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Delete Coworker</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 4. Right Drawer Summary Panel Toggle */}
            <Hint label={showProfile ? 'Hide Profile Drawer' : 'Show Profile Drawer'}>
              <Button
                variant={showProfile ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowProfile((p) => !p)}
              >
                {showProfile ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRight className="h-4 w-4" />
                )}
              </Button>
            </Hint>
          </div>
        </header>

        {/* Channels Mechanism Tab Bar */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as any)}
          className="min-h-0 flex flex-1 flex-col overflow-hidden"
        >
          <div className="px-4 sm:px-6 py-1 gap-1 flex items-center border-b border-border bg-background shrink-0">
            <TabsList className="scrollbar-none overflow-x-auto">
              <TabsTrigger value="messages" className="gap-1.5 text-xs">
                <MessageSquare className="size-3.5 inline" /> Messages
              </TabsTrigger>
              <TabsTrigger value="profile" className="gap-1.5 text-xs">
                <UserCheck className="size-3.5 inline" /> Profile
              </TabsTrigger>
              <TabsTrigger value="agents-apps" className="gap-1.5 text-xs">
                <Bot className="size-3.5 inline" /> Sub-Agents &amp; Apps
                {(coworker.agentLinks?.length ?? 0) + (coworker.appLinks?.length ?? 0) > 0 && (
                  <Badge variant="neutral" className="ml-0.5 px-1.5 py-0 text-[10px]">
                    {(coworker.agentLinks?.length ?? 0) + (coworker.appLinks?.length ?? 0)}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5 text-xs">
                <Activity className="size-3.5 inline" /> Activity &amp; Logs
                {(logs?.length ?? 0) > 0 && (
                  <Badge variant="neutral" className="ml-0.5 px-1.5 py-0 text-[10px]">
                    {logs?.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: Messages / Chat */}
          <TabsContent value="messages" className="flex-1 min-h-0 m-0 overflow-hidden outline-none">
            <CoworkerConversationContainer
              coworker={coworker}
              workspaceId={workspaceId}
              directPrompt={directPrompt}
              setDirectPrompt={setDirectPrompt}
              turnHistory={turnHistory}
              onSendDirect={handleSendDirect}
              isExecuting={mutations.execute.isPending}
            />
          </TabsContent>

          {/* TAB 2: Full User-Profile View */}
          <TabsContent value="profile" className="flex-1 min-h-0 m-0 overflow-y-auto outline-none">
            <ScrollArea className="h-full p-4 sm:p-6">
              <CoworkerProfileDetails
                coworker={coworker}
                workspaceId={workspaceId}
                onEdit={() => setEditDialogOpen(true)}
                onStartChat={() => setActiveTab('messages')}
              />
            </ScrollArea>
          </TabsContent>

          {/* TAB 3: Sub-Agents & Apps (Channel View Style) */}
          <TabsContent value="agents-apps" className="flex-1 min-h-0 m-0 overflow-y-auto outline-none">
            <ScrollArea className="h-full p-4 sm:p-6">
              <div className="max-w-5xl mx-auto space-y-6">
                {/* Header overview */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-foreground">
                      Sub-Agents &amp; Connected Apps
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Manage subordinate AI agents and external tool integrations delegated to {coworker.name}.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Add Agent dropdown */}
                    {availableAgentsToLink.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                            <Plus className="size-3.5" />
                            <span>Link Sub-Agent</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {availableAgentsToLink.map((agent) => (
                            <DropdownMenuItem
                              key={agent.id}
                              onClick={() => handleLinkAgent(agent.id)}
                              className="text-xs gap-2"
                            >
                              <Bot className="size-3.5 text-violet-500" />
                              <span className="truncate">{agent.name}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    {/* Connect App dropdown */}
                    {availableAppsToLink.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="primary" className="gap-1.5 text-xs">
                            <Plus className="size-3.5" />
                            <span>Connect App</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {availableAppsToLink.map((integration) => (
                            <DropdownMenuItem
                              key={integration.id}
                              onClick={() => handleLinkApp(integration.id)}
                              className="text-xs gap-2 capitalize"
                            >
                              <Layers className="size-3.5 text-sky-500" />
                              <span className="truncate">
                                {integration.displayName || integration.provider}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                {/* Sub-Agents Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Bot className="size-4 text-violet-500" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Delegated Sub-Agents ({coworker.agentLinks?.length ?? 0})
                    </h3>
                  </div>

                  {coworker.agentLinks?.length ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {coworker.agentLinks.map((link) => (
                        <div
                          key={link.id}
                          className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 text-xs shadow-xs"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="size-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                              <Bot className="size-5 text-violet-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-foreground truncate">{link.agent.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{link.agent.role}</p>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => handleUnlinkAgent(link.agentId)}
                            title="Unlink sub-agent"
                          >
                            <Unlink className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-8 text-center bg-surface/40 space-y-2">
                      <Bot className="size-8 text-muted-foreground/50 mx-auto" />
                      <p className="text-xs font-semibold text-foreground">No delegated sub-agents</p>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        Link specialized AI agents to allow {coworker.name} to delegate coding, research, or execution tasks.
                      </p>
                    </div>
                  )}
                </div>

                {/* Connected Apps Section */}
                <div className="space-y-3 pt-4">
                  <div className="flex items-center gap-2">
                    <Plug className="size-4 text-sky-500" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Connected App Integrations ({coworker.appLinks?.length ?? 0})
                    </h3>
                  </div>

                  {coworker.appLinks?.length ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {coworker.appLinks.map((link) => (
                        <div
                          key={link.id}
                          className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 text-xs shadow-xs"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="size-9 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                              <Layers className="size-5 text-sky-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-foreground truncate capitalize">
                                {link.integration.displayName || link.integration.provider}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                Status: {link.integration.status}
                              </p>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => handleUnlinkApp(link.integrationId)}
                            title="Unlink app"
                          >
                            <Unlink className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-8 text-center bg-surface/40 space-y-2">
                      <Plug className="size-8 text-muted-foreground/50 mx-auto" />
                      <p className="text-xs font-semibold text-foreground">No connected apps</p>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        Connect external services like GitHub, Jira, or Slack to equip {coworker.name} with actionable tools.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* TAB 4: Activity & Logs */}
          <TabsContent value="activity" className="flex-1 min-h-0 m-0 overflow-y-auto outline-none">
            <ScrollArea className="h-full p-4 sm:p-6">
              <div className="max-w-5xl mx-auto space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-border bg-surface p-4 space-y-1 shadow-xs">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Total Executions
                    </span>
                    <p className="text-2xl font-bold text-foreground">
                      {logs?.length ?? coworker._count?.executionLogs ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface p-4 space-y-1 shadow-xs">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Tokens Consumed
                    </span>
                    <p className="text-2xl font-mono font-bold text-foreground">
                      {totalTokensUsed.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface p-4 space-y-1 shadow-xs">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Teammate Status
                    </span>
                    <div className="flex items-center gap-2 pt-1">
                      <CoworkerStatusDot status={coworker.status} showLabel />
                    </div>
                  </div>
                </div>

                {/* Log Feed */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Activity className="size-4 text-primary" />
                    <span>Execution History ({logs?.length ?? 0})</span>
                  </h3>

                  {logsLoading ? (
                    <div className="text-center py-8">
                      <Spinner className="h-6 w-6 mx-auto" />
                    </div>
                  ) : logs && logs.length > 0 ? (
                    <div className="space-y-2.5">
                      {logs.map((log) => {
                        const isExpanded = expandedLogId === log.id;
                        return (
                          <div
                            key={log.id}
                            className="rounded-xl border border-border bg-surface shadow-xs text-xs overflow-hidden"
                          >
                            <button
                              type="button"
                              className="w-full flex items-center justify-between p-3.5 text-left hover:bg-muted/30 transition-colors"
                              onClick={() =>
                                setExpandedLogId(isExpanded ? null : log.id)
                              }
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <span
                                  className={cn(
                                    'h-2.5 w-2.5 rounded-full shrink-0',
                                    log.status === 'COMPLETED'
                                      ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                                      : 'bg-rose-500 ring-2 ring-rose-500/20',
                                  )}
                                />
                                <div className="truncate">
                                  <p className="font-semibold text-foreground truncate">
                                    {log.promptText || 'Task Run'}
                                  </p>
                                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                                    {new Date(log.executedAt).toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                {log.tokensUsed > 0 && (
                                  <Badge variant="neutral" className="font-mono text-[10px]">
                                    {log.tokensUsed} tokens
                                  </Badge>
                                )}
                                {isExpanded ? (
                                  <ChevronDown className="size-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="size-4 text-muted-foreground" />
                                )}
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="p-4 bg-muted/20 border-t border-border space-y-3">
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                                    Prompt Input:
                                  </span>
                                  <p className="p-2.5 rounded-lg bg-surface border border-border font-mono text-[11px] text-foreground whitespace-pre-wrap">
                                    {log.promptText}
                                  </p>
                                </div>

                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                                    Output Result:
                                  </span>
                                  <p className="p-2.5 rounded-lg bg-surface border border-border text-[11px] text-foreground leading-relaxed whitespace-pre-wrap">
                                    {log.outputResult || 'Completed without textual output.'}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-8 text-center bg-surface/40">
                      <p className="text-xs text-muted-foreground italic">
                        No executions recorded yet. Start a direct message with {coworker.name} to generate activity.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Right Drawer Profile Panel (Summary Card) */}
      {showProfile && (
        <CoworkerProfilePanel
          coworker={coworker}
          workspaceId={workspaceId}
          onClose={() => setShowProfile(false)}
          onEdit={() => setEditDialogOpen(true)}
          onStartChat={() => {
            setShowProfile(false);
            setActiveTab('messages');
          }}
        />
      )}

      {/* Edit Dialog */}
      <CoworkerCreateDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        workspaceId={workspaceId}
        coworker={coworker}
      />
    </div>
  );
};


/** Matrix + Direct Execution Shell */
function CoworkerConversationContainer({
  coworker,
  workspaceId,
  directPrompt,
  setDirectPrompt,
  turnHistory,
  onSendDirect,
  isExecuting,
}: {
  coworker: AICoworkerDetail;
  workspaceId: string;
  directPrompt: string;
  setDirectPrompt: (v: string) => void;
  turnHistory: Array<{
    id: string;
    role: 'user' | 'coworker';
    content: string;
    timestamp: Date;
  }>;
  onSendDirect: (prompt: string) => void;
  isExecuting: boolean;
}) {
  const { enabled } = useMatrix();
  const currentUser = useCurrentUser();
  const { roomId, error } = useDirectRoom(
    coworker.matrixUserId ?? `coworker-${coworker.id}`,
  );

  const quickPrompts = useMemo(
    () => [
      `Review recent updates and summarize next action items for ${coworker.role}.`,
      `What are the top active tasks right now?`,
      `Help me draft a technical proposal or documentation for this project.`,
    ],
    [coworker.role],
  );

  // If Matrix is enabled and connected, use the full real-time ChatPanel
  if (enabled && !error && (roomId || coworker.matrixRoomId)) {
    const activeRoomId = roomId || coworker.matrixRoomId || '';
    const composerContext: ComposerContext = {
      surfaceKind: 'coworker',
      workspaceId,
      roomId: activeRoomId,
      peerId: coworker.matrixUserId ?? `coworker-${coworker.id}`,
      canManage: false,
    };
    return (
      <ConversationTabsShell
        filesContext={{ type: 'AGENT', id: coworker.id }}
        roomId={activeRoomId}
        workspaceId={workspaceId}
        enabled={enabled}
        currentUserId={currentUser?.id}
      >
        <ChatPanel
          roomId={activeRoomId}
          title={coworker.name}
          subtitle={`${coworker.model || 'gpt-4o'} · ${coworker.role}`}
          showHeader={false}
          workspaceId={workspaceId}
          showMembers={false}
          showEncryptedBadge={false}
          composerContext={composerContext}
          welcome={{
            kind: 'direct',
            peer: {
              name: coworker.name,
              userId: coworker.matrixUserId ?? `coworker-${coworker.id}`,
              kind: 'coworker',
              role: `${coworker.model || 'gpt-4o'} · ${coworker.role}`,
              avatarNode: (
                <CoworkerAvatar
                  name={coworker.name}
                  avatarUrl={coworker.avatarUrl}
                  status={coworker.status}
                  size="xl"
                />
              ),
            },
          }}
        />
      </ConversationTabsShell>
    );
  }

  // Fallback Turn-based runner when Matrix room is not active
  return (
    <div className="flex h-full flex-col justify-between overflow-hidden bg-background">
      <ScrollArea className="flex-1 p-6 space-y-4">
        {/* Intro Welcome Banner */}
        <div className="mx-auto max-w-2xl text-center py-8">
          <CoworkerAvatar
            name={coworker.name}
            avatarUrl={coworker.avatarUrl}
            status={coworker.status}
            size="xl"
            className="mx-auto mb-3"
          />
          <h3 className="text-lg font-bold text-foreground">{coworker.name}</h3>
          <p className="text-xs font-semibold text-primary mt-0.5">
            {coworker.role}
          </p>
          <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
            {coworker.description ||
              'Persistent AI teammate ready to collaborate on project tasks, review deliverables, and answer questions.'}
          </p>

          {/* Quick Prompts */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted hover:text-foreground"
                onClick={() => onSendDirect(prompt)}
              >
                <Sparkles className="mr-1.5 inline-block h-3 w-3 text-amber-500" />
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Turn Messages */}
        <div className="mx-auto max-w-2xl space-y-4 pt-4">
          {turnHistory.map((turn) => (
            <div
              key={turn.id}
              className={cn(
                'flex gap-3 text-xs',
                turn.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              {turn.role === 'coworker' && (
                <CoworkerAvatar
                  name={coworker.name}
                  avatarUrl={coworker.avatarUrl}
                  size="sm"
                  showStatusDot={false}
                />
              )}
              <div
                className={cn(
                  'rounded-2xl px-4 py-3 max-w-[80%] leading-relaxed',
                  turn.role === 'user'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'bg-card border border-border text-foreground shadow-xs',
                )}
              >
                <p className="whitespace-pre-wrap">{turn.content}</p>
                <span className="mt-1 block text-[10px] opacity-70 font-mono">
                  {turn.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}

          {isExecuting && (
            <div className="flex gap-3 text-xs justify-start">
              <CoworkerAvatar
                name={coworker.name}
                avatarUrl={coworker.avatarUrl}
                size="sm"
                status="WORKING"
              />
              <div className="flex items-center gap-2 rounded-2xl bg-card border border-border px-4 py-3 text-muted-foreground shadow-xs">
                <Spinner className="h-3.5 w-3.5" />
                <span>{coworker.name} is thinking and consulting tools...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Bottom Composer */}
      <div className="border-t border-border bg-surface p-4 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSendDirect(directPrompt);
          }}
          className="mx-auto flex max-w-2xl items-center gap-2"
        >
          <input
            type="text"
            className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
            placeholder={`Message ${coworker.name}... (Press Enter to send)`}
            value={directPrompt}
            onChange={(e) => setDirectPrompt(e.target.value)}
            disabled={isExecuting}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!directPrompt.trim() || isExecuting}
            className="h-9 px-4 gap-1.5 font-medium"
          >
            {isExecuting ? <Spinner className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
            <span>Send</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
