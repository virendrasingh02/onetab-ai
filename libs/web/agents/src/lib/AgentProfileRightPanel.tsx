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
import {
  Activity,
  Bot,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Cpu,
  MoreVertical,
  Play,
  Shield,
  Trash2,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { AgentAvatar } from './AgentMarketplaceView.js';
import { useAgentLogs, useAgentMutations, useAgents } from './use-agents.js';
import type { AgentModelItem } from './AgentChatView.js';

export interface AgentProfileRightPanelProps {
  profile: RightPanelProfile;
  workspaceId: string;
  workspaceSlug: string;
  onClose: () => void;
}

export const AgentProfileRightPanel: FC<AgentProfileRightPanelProps> = ({
  profile,
  workspaceId,
  workspaceSlug,
  onClose,
}) => {
  const navigate = useNavigate();
  const agentsQuery = useAgents(workspaceId);
  const mutations = useAgentMutations(workspaceId);

  const agentId = profile.entityId || profile.userId.replace(/^agent-/, '');
  const agent: AgentModelItem | undefined =
    (profile.raw as AgentModelItem | undefined) ||
    agentsQuery.data?.find((a: any) => a.id === agentId);

  const { data: logs, isLoading: logsLoading } = useAgentLogs(workspaceId, agentId);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const name = agent?.name || profile.name || 'AI Agent';
  const role = agent?.role || profile.role || 'Autonomous Assistant';
  const model = agent?.model || 'gpt-4o';
  const description = agent?.description || profile.bio || 'Autonomous workspace AI agent configured for team tasks.';
  const systemPrompt = agent?.systemPrompt || 'You are an intelligent AI agent assisting the workspace team.';
  const isActive = agent?.isActive !== false;

  const handleCopyLink = () => {
    const url = `${window.location.origin}/w/${workspaceSlug}/agents/chat?id=${agentId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Agent link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleActive = async () => {
    if (!agentId) return;
    try {
      await mutations.update.mutateAsync({
        agentId,
        input: { isActive: !isActive },
      });
      toast.success(isActive ? 'Deactivated agent' : 'Activated agent');
    } catch {
      toast.error('Failed to update agent status');
    }
  };

  const handleDelete = async () => {
    if (!agentId) return;
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await mutations.remove.mutateAsync(agentId);
      toast.success(`Deleted agent ${name}`);
      onClose();
      navigate(`/w/${workspaceSlug}/agents/marketplace`);
    } catch {
      toast.error('Failed to delete agent');
    }
  };

  const parsedTools = agent?.tools
    ? agent.tools.split(',').map((t) => t.trim()).filter(Boolean)
    : ['workspace_search', 'document_reader', 'code_interpreter'];

  return (
    <aside className="flex h-full w-full flex-col bg-surface text-foreground overflow-hidden">
      {/* Drawer Top Bar */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            AI Agent Profile
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
              <DropdownMenuItem onClick={() => navigate(`/w/${workspaceSlug}/agents/builder?agentId=${agentId}`)}>
                <Wrench className="mr-2 h-3.5 w-3.5 text-accent-violet" />
                Open Visual Builder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleActive}>
                <Zap className="mr-2 h-3.5 w-3.5" />
                {isActive ? 'Deactivate Agent' : 'Activate Agent'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copy Agent Link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete Agent
              </DropdownMenuItem>
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
            backgroundImage: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 50%, #0f172a 100%)',
          }}
        >
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* Content Body */}
        <div className="px-5 pb-5 pt-0 relative">
          <div className="-mt-10 mb-3 flex items-end justify-between">
            <div className="relative">
              <AgentAvatar
                name={name}
                avatarUrl={agent?.avatarUrl}
                size="lg"
                className="size-18 rounded-2xl shadow-lg ring-4 ring-surface"
              />
            </div>
            <div className="flex items-center gap-1.5 pb-1">
              <Badge variant={isActive ? 'primary' : 'outline'} className="text-[10px] px-2 py-0.5 font-semibold">
                {isActive ? 'Active' : 'Disabled'}
              </Badge>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-foreground truncate">{name}</h2>
              <Badge variant="primary" className="text-[10px] font-bold uppercase tracking-wider">
                AI AGENT
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{role}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mb-5">
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/w/${workspaceSlug}/agents/chat?id=${agentId}`)}
              className="text-xs font-semibold gap-1.5 flex-1 shadow-xs"
            >
              <Play className="size-3.5 fill-current" />
              <span>Direct Message</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/w/${workspaceSlug}/agents/builder?agentId=${agentId}`)}
              className="text-xs gap-1.5 flex-1 border-border bg-surface hover:bg-accent"
            >
              <Wrench className="size-3.5 text-accent-violet" />
              <span>Builder</span>
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
              <Cpu className="size-3.5 text-primary" />
              <span className="font-mono font-medium text-foreground">{model}</span>
            </div>
            <span className="text-border">·</span>
            <div className="flex items-center gap-1.5">
              <Shield className="size-3.5 text-accent-emerald" />
              <span>Autonomous</span>
            </div>
          </div>

          {/* Structured Cards */}
          <div className="space-y-4">
            {/* Box 1: About */}
            <div className="rounded-xl border border-border bg-surface-inset/40 p-4 space-y-2">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Bot className="size-3.5 text-primary" />
                <span>About Agent</span>
              </h3>
              <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">{description}</p>
            </div>

            {/* Box 2: System Prompt Preview */}
            <div className="rounded-xl border border-border bg-surface-inset/40 p-4 space-y-2">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Brain className="size-3.5 text-primary" />
                <span>System Instructions</span>
              </h3>
              <p className="text-[11px] font-mono text-muted-foreground bg-surface border border-border/70 rounded-lg p-2.5 line-clamp-4 hover:line-clamp-none transition-all cursor-pointer whitespace-pre-wrap">
                {systemPrompt}
              </p>
            </div>

            {/* Box 3: Configured Tools */}
            <div className="rounded-xl border border-border bg-surface-inset/40 p-4 space-y-2">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Wrench className="size-3.5 text-primary" />
                <span>Tool Capabilities ({parsedTools.length})</span>
              </h3>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {parsedTools.map((tool) => (
                  <Badge key={tool} variant="neutral" className="text-[10px] font-mono capitalize">
                    {tool.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Box 4: Recent Execution Activity */}
            <div className="rounded-xl border border-border bg-surface-inset/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="size-3.5 text-primary" />
                  <span>Execution Activity</span>
                </h3>
                {logs && logs.length > 0 && (
                  <Badge variant="neutral" className="text-[10px]">
                    {logs.length} runs
                  </Badge>
                )}
              </div>

              {logsLoading ? (
                <div className="p-4 text-center">
                  <Spinner className="size-4 mx-auto" />
                </div>
              ) : logs && logs.length > 0 ? (
                <div className="space-y-2">
                  {logs.slice(0, 5).map((log: any) => {
                    const isExpanded = expandedLogId === log.id;
                    return (
                      <div
                        key={log.id}
                        className="rounded-lg border border-border bg-surface p-2.5 text-xs transition-colors"
                      >
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span
                              className={`size-2 rounded-full shrink-0 ${
                                log.status === 'SUCCESS' || !log.status ? 'bg-success' : 'bg-destructive'
                              }`}
                            />
                            <p className="truncate font-medium text-foreground">{log.promptText || 'Execution run'}</p>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                          )}
                        </div>

                        {isExpanded && (
                          <div className="mt-2.5 pt-2.5 border-t border-border/60 space-y-2 font-mono text-[11px]">
                            {log.outputResult && (
                              <p className="p-2 rounded bg-surface-inset text-foreground whitespace-pre-wrap">
                                {log.outputResult}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                              <span>Tokens: {log.tokensUsed || 0}</span>
                              <span>{log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : ''}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-2">
                  No execution activity recorded yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
};
