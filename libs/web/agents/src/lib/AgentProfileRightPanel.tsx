import type { FC } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AIEntityProfileEmpty,
  AIEntityProfileFact,
  AIEntityProfileFacts,
  AIEntityProfileHero,
  AIEntityProfilePanel,
  AIEntityProfileQuote,
  AIEntityProfileRunList,
  AIEntityProfileSection,
  AIModelIdentity,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Spinner,
  toast,
  type RightPanelProfile,
  confirm,
} from '@org/ui';
import {
  Activity,
  Bot,
  Brain,
  Check,
  CalendarClock,
  Clock,
  Copy,
  Cpu,
  MoreVertical,
  Play,
  Shield,
  Trash2,
  Wrench,
  Zap,
} from 'lucide-react';
import { AgentAvatar } from './AgentMarketplaceView.js';
import type { AIAgentDetail } from '@org/types';
import {
  useAgent,
  useAgentLogs,
  useAgentMutations,
  useAgents,
  useAiMemory,
  useDeleteAiMemory,
} from './use-agents.js';

export interface AgentProfileRightPanelProps {
  profile: RightPanelProfile;
  workspaceId: string;
  workspaceSlug: string;
  onClose: () => void;
}

/** `tools` is stored either as a JSON array or a comma-separated list. */
function parseTools(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((t): t is string => typeof t === 'string' && t.trim() !== '');
    }
  } catch {
    // not JSON — fall through to the comma-separated form
  }
  return raw.split(',').map((t) => t.trim()).filter(Boolean);
}

export const AgentProfileRightPanel: FC<AgentProfileRightPanelProps> = ({
  profile,
  workspaceId,
  workspaceSlug,
  onClose,
}) => {
  const navigate = useNavigate();
  const agentId = profile.entityId || profile.userId.replace(/^agent-/, '');
  const agentQuery = useAgent(workspaceId, agentId);
  const agentsQuery = useAgents(workspaceId, { includeDrafts: true });
  const mutations = useAgentMutations(workspaceId);

  // Live record first; the list cache / the opener's snapshot only fill the first paint.
  const agent: Partial<AIAgentDetail> | undefined =
    agentQuery.data ??
    agentsQuery.data?.find((a) => a.id === agentId) ??
    (profile.raw as Partial<AIAgentDetail> | undefined);

  const { data: logs, isLoading: logsLoading } = useAgentLogs(workspaceId, agentId);
  const { data: memory, isLoading: memoryLoading } = useAiMemory(workspaceId, agentId);
  const deleteMemory = useDeleteAiMemory(workspaceId);
  const [copied, setCopied] = useState(false);

  const name = agent?.name || profile.name || 'AI Agent';
  const role = agent?.role || profile.role;
  const description = agent?.description || profile.bio;
  const systemPrompt = agent?.systemPrompt || agent?.systemInstructions;
  const isActive = agent?.isActive !== false;
  const totalRuns = agent?._count?.logs ?? logs?.length ?? 0;
  const activeSchedules = agent?.schedules?.filter((s) => s.isActive).length ?? 0;
  const memoryPrefix = `[agent:${agentId}]`;
  const tools = parseTools(agent?.tools);
  const createdOn = agent?.createdAt
    ? new Date(agent.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

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
    const confirmed = await confirm({
      title: `Delete “${name}”?`,
      description: 'The agent, its schedules and its builder graph are removed. Its past runs stay in Runs. This cannot be undone.',
      confirmLabel: 'Delete agent',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await mutations.remove.mutateAsync(agentId);
      toast.success(`Deleted agent ${name}`);
      onClose();
      navigate(`/w/${workspaceSlug}/ai/agents`);
    } catch {
      toast.error('Failed to delete agent');
    }
  };

  if (agentQuery.isLoading && !agent) {
    return (
      <AIEntityProfilePanel title="AI Agent Profile" onClose={onClose}>
        <div className="flex justify-center p-10">
          <Spinner className="size-5" />
        </div>
      </AIEntityProfilePanel>
    );
  }

  if (!agent) {
    return (
      <AIEntityProfilePanel title="AI Agent Profile" onClose={onClose}>
        <div className="p-5">
          <AIEntityProfileEmpty>This agent no longer exists or you can't see it.</AIEntityProfileEmpty>
        </div>
      </AIEntityProfilePanel>
    );
  }

  const openBuilder = () => navigate(`/w/${workspaceSlug}/ai/agents/${agentId}`);

  return (
    <AIEntityProfilePanel
      title="AI Agent Profile"
      onClose={onClose}
      menu={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label="More actions">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={openBuilder}>
              <Wrench className="mr-2 size-3.5" />
              Open Visual Builder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleActive}>
              <Zap className="mr-2 size-3.5" />
              {isActive ? 'Deactivate Agent' : 'Activate Agent'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyLink}>
              <Copy className="mr-2 size-3.5" />
              Copy Agent Link
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 size-3.5" />
              Delete Agent
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <AIEntityProfileHero
        avatar={
          <AgentAvatar
            name={name}
            avatarUrl={agent?.avatarUrl}
            size="lg"
            className="size-18 rounded-2xl shadow-md ring-4 ring-surface"
          />
        }
        name={name}
        kind="AI Agent"
        isActive={isActive}
        subtitle={role}
        actions={
          <>
            <Button
              size="sm"
              onClick={() => navigate(`/w/${workspaceSlug}/agents/chat?id=${agentId}`)}
              className="flex-1 gap-1.5"
            >
              <Play className="size-3.5 fill-current" />
              Direct Message
            </Button>
            <Button variant="outline" size="sm" onClick={openBuilder} className="flex-1 gap-1.5">
              <Wrench className="size-3.5" />
              Builder
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleCopyLink}
              className="size-8 shrink-0"
              title="Copy link"
              aria-label="Copy agent link"
            >
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            </Button>
          </>
        }
      />

      <AIEntityProfileFacts>
        {createdOn && (
          <AIEntityProfileFact icon={Clock} label="Created on">
            {createdOn}
          </AIEntityProfileFact>
        )}
        <AIEntityProfileFact icon={Cpu} label="Model & Provider">
          {agent.model ? (
            <AIModelIdentity
              modelId={agent.model}
              provider={agent.provider}
              layout="stacked"
              className="items-end text-right"
            />
          ) : (
            <span className="text-muted-foreground">Workspace default</span>
          )}
        </AIEntityProfileFact>
        <AIEntityProfileFact icon={Shield} label="Knowledge Access">
          <Badge
            variant={agent.permissions?.knowledgeAccess ? 'primary' : 'neutral'}
            className="text-[10px]"
          >
            {agent.permissions?.knowledgeAccess ? 'RAG Enabled' : 'Restricted'}
          </Badge>
        </AIEntityProfileFact>
        <AIEntityProfileFact icon={Wrench} label="Tools">
          {tools.length} enabled
        </AIEntityProfileFact>
        <AIEntityProfileFact icon={CalendarClock} label="Schedules">
          {activeSchedules} active
        </AIEntityProfileFact>
      </AIEntityProfileFacts>

      {description && (
        <AIEntityProfileSection icon={Bot} title="About">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">{description}</p>
        </AIEntityProfileSection>
      )}

      {agent.personality && (
        <AIEntityProfileSection icon={Brain} title="Persona & Tone">
          <AIEntityProfileQuote>
            <span className="italic">“{agent.personality}”</span>
          </AIEntityProfileQuote>
        </AIEntityProfileSection>
      )}

      {systemPrompt && (
        <AIEntityProfileSection icon={Brain} title="System Instructions">
          <AIEntityProfileQuote mono>{systemPrompt}</AIEntityProfileQuote>
        </AIEntityProfileSection>
      )}

      <AIEntityProfileSection icon={Wrench} title="Tools" count={tools.length}>
        {tools.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tools.map((tool) => (
              <Badge key={tool} variant="neutral" className="text-[11px]">
                {tool.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        ) : (
          <AIEntityProfileEmpty>No tools configured. Add them in the Builder.</AIEntityProfileEmpty>
        )}
      </AIEntityProfileSection>

      <AIEntityProfileSection
        icon={Brain}
        title="Memory"
        count={memory?.length ? `${memory.length} facts` : undefined}
      >
        {memoryLoading ? (
          <div className="flex justify-center py-4">
            <Spinner className="size-4" />
          </div>
        ) : memory && memory.length > 0 ? (
          <div className="space-y-1.5">
            {memory.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-border bg-surface p-2.5 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {entry.key.startsWith(memoryPrefix)
                      ? entry.key.slice(memoryPrefix.length).trim()
                      : entry.key}
                  </p>
                  <p className="line-clamp-2 text-[11px] text-muted-foreground">{entry.value}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMemory.mutate(entry.key)}
                  title="Forget this"
                  aria-label={`Forget ${entry.key}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <AIEntityProfileEmpty>
            Nothing remembered yet — facts this agent saves with save_memory show up here.
          </AIEntityProfileEmpty>
        )}
      </AIEntityProfileSection>

      <AIEntityProfileSection icon={Activity} title="Recent Runs" count={`${totalRuns} runs`}>
        <AIEntityProfileRunList
          loading={logsLoading}
          emptyText="No runs recorded yet."
          runs={(logs ?? []).slice(0, 5).map((log) => ({
            id: log.id,
            failed: log.status === 'FAILED' || log.status === 'ERROR',
            title: log.promptText || 'Execution run',
            output: log.outputResult,
            tokens: log.tokensUsed,
            at: log.executedAt,
          }))}
        />
      </AIEntityProfileSection>
    </AIEntityProfilePanel>
  );
};
