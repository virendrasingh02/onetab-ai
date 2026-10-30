import type { FC } from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AIEntityProfileCapabilityList,
  AIEntityProfileEmpty,
  AIEntityProfileFact,
  AIEntityProfileFacts,
  AIEntityProfileHero,
  AIEntityProfileNotice,
  AIEntityProfilePanel,
  AIEntityProfilePrompt,
  AIEntityProfileRunList,
  AIEntityProfileSection,
  AIEntityProfileToolGroups,
  type AIEntityProfileCapability,
  type AIEntityProfilePromptField,
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
  getAiEntityCover,
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
  Plug,
  Shield,
  Sparkles,
  Trash2,
  Wrench,
  Zap,
} from 'lucide-react';
import { AgentAvatar } from './AgentMarketplaceView.js';
import {
  compileStudioGraph,
  isStudioGraph,
  PROMPT_TONES,
  readPromptSettings,
  studioGraphApps,
  type AIAgentDetail,
  type InlineAgentSpec,
} from '@org/types';
import { parseEntityTools, useEntityToolProfile } from './shared/entity-tool-profile.js';
import {
  useAgent,
  useAgentConnections,
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

/**
 * The agent as its Builder canvas defines it — the main agent's composed
 * spec, its structured prompt settings and the apps the canvas acts in.
 * Null for agents without a canvas graph.
 */
function readAgentCanvas(graphJson: string | null | undefined) {
  if (!graphJson || !isStudioGraph(graphJson)) return null;
  try {
    const graph = JSON.parse(graphJson) as {
      nodes?: Array<{ id?: string; data?: { config?: Record<string, unknown> } }>;
    };
    const spec: InlineAgentSpec | undefined = compileStudioGraph(graph).agents[0];
    const node = spec ? graph.nodes?.find((n) => n?.id === spec.key) : undefined;
    return {
      spec,
      promptSettings: readPromptSettings(node?.data?.config?.['promptSettings']),
      providers: studioGraphApps(graphJson).providers,
    };
  } catch {
    return null;
  }
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
  const canvas = useMemo(() => readAgentCanvas(agent?.graphJson), [agent?.graphJson]);
  const tools = useMemo(() => {
    const own = parseEntityTools(agent?.tools);
    return own.length > 0 ? own : (canvas?.spec?.tools ?? []);
  }, [agent?.tools, canvas]);
  const { data: connections } = useAgentConnections(workspaceId, agentId);
  const toolProfile = useEntityToolProfile({
    tools,
    providers: canvas?.providers,
    connections,
  });
  const knowledgeBases = canvas?.spec?.knowledge.length ?? 0;
  const subAgents = canvas?.spec?.members ?? [];
  const rules = canvas?.spec?.rules;
  const prompt = canvas?.promptSettings;
  const tone =
    prompt && prompt.tone !== 'neutral'
      ? PROMPT_TONES.find((t) => t.value === prompt.tone)?.label
      : undefined;
  const promptFields: AIEntityProfilePromptField[] = [
    { label: 'Objective', value: prompt?.objective ?? '' },
    { label: 'Persona', value: prompt?.persona || agent?.personality || '' },
    { label: 'Tone', value: tone ?? '' },
    { label: 'Goals', value: prompt?.goals ?? [] },
    { label: 'Constraints', value: prompt?.constraints ?? [] },
    { label: 'Success criteria', value: prompt?.successCriteria ?? [] },
    { label: 'Always', value: rules?.always ?? [] },
    { label: 'Asks before', value: rules?.askBefore ?? [] },
    { label: 'Never', value: rules?.never ?? [] },
    {
      label: 'Reply format',
      value: prompt && prompt.output.format !== 'auto' ? prompt.output.format.toUpperCase() : '',
    },
  ];
  const capabilities: AIEntityProfileCapability[] = [
    ...toolProfile.capabilities,
    ...(knowledgeBases > 0 || agent?.permissions?.knowledgeAccess
      ? [
          {
            id: 'knowledge',
            label: 'Answer from workspace knowledge',
            description:
              knowledgeBases > 0
                ? `Grounds answers in ${knowledgeBases} knowledge base${knowledgeBases === 1 ? '' : 's'}`
                : 'Searches the workspace knowledge base before answering',
          },
        ]
      : []),
    ...(subAgents.length > 0
      ? [
          {
            id: 'sub-agents',
            label: 'Delegate to sub-agents',
            description: subAgents.map((m) => m.name).join(', '),
          },
        ]
      : []),
    ...(activeSchedules > 0
      ? [
          {
            id: 'schedules',
            label: 'Run on a schedule',
            description: `${activeSchedules} active schedule${activeSchedules === 1 ? '' : 's'}`,
          },
        ]
      : []),
  ];
  const missingApps = toolProfile.missing;
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
        coverClassName={getAiEntityCover(name, agent?.avatarUrl, 'agent')}
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
          <span className="flex flex-wrap items-center justify-end gap-x-1.5">
            {tools.length} enabled
            {toolProfile.blockedTools > 0 ? (
              <span className="text-warning-text">· {toolProfile.blockedTools} need setup</span>
            ) : (
              missingApps.length > 0 && (
                <span className="text-warning-text">
                  · {missingApps.length} app{missingApps.length === 1 ? '' : 's'} to connect
                </span>
              )
            )}
          </span>
        </AIEntityProfileFact>
        <AIEntityProfileFact icon={CalendarClock} label="Schedules">
          {activeSchedules} active
        </AIEntityProfileFact>
      </AIEntityProfileFacts>

      {missingApps.length > 0 && (
        <AIEntityProfileNotice
          title={`Connect ${missingApps.map((m) => m.label).join(', ')} to use every tool`}
          action={
            missingApps.length === 1 ? (
              <Button size="xs" onClick={() => toolProfile.connect(missingApps[0]!)} className="shrink-0">
                <Plug className="size-3" />
                {missingApps[0]!.reason === 'reconnect' ? 'Reconnect' : 'Connect'}
              </Button>
            ) : undefined
          }
        >
          {name} works in {missingApps.length === 1 ? 'this app' : 'these apps'} through your own
          account. Until then it can’t use{' '}
          {toolProfile.blockedTools > 0 ? `${toolProfile.blockedTools} of its tools` : 'it'}.
        </AIEntityProfileNotice>
      )}

      {description && (
        <AIEntityProfileSection icon={Bot} title="About">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">{description}</p>
        </AIEntityProfileSection>
      )}

      <AIEntityProfileSection
        icon={Sparkles}
        title="Capabilities"
        count={capabilities.length || undefined}
      >
        {capabilities.length > 0 ? (
          <AIEntityProfileCapabilityList items={capabilities} />
        ) : (
          <AIEntityProfileEmpty>
            It can only chat for now. Add tools, knowledge or apps in the Builder.
          </AIEntityProfileEmpty>
        )}
      </AIEntityProfileSection>

      <AIEntityProfileSection icon={Brain} title="Prompt">
        <AIEntityProfilePrompt instructions={systemPrompt} fields={promptFields} />
      </AIEntityProfileSection>

      <AIEntityProfileSection icon={Wrench} title="Tools" count={tools.length}>
        {toolProfile.groups.length > 0 ? (
          <AIEntityProfileToolGroups groups={toolProfile.groups} />
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
