/**
 * The one place an AI agent is built and managed — `/w/:slug/ai/agents/:id`.
 *
 * It merges what used to be three builders: the in-app Agent Builder canvas,
 * the standalone Agent Studio's test/versions/publish screens, and AI
 * Studio's agent tab. The canvas is the configuration; saving sends the graph
 * and the API derives everything the runtime reads from it
 * (`deriveAgentFromGraph`), so what you see is what runs.
 */

import type { AIAgent, AgentTestRunResult } from '@org/types';
import { convertLegacyAgentGraph, isAgentBuilderGraph } from '@org/types';
import {
  Badge,
  Button,
  Card,
  confirm,
  ErrorState,
  Field,
  Hint,
  Input,
  LoadingState,
  ResponsiveTabsList,
  Switch,
  Tabs,
  TabsContent,
  TabsTrigger,
  Textarea,
  toast,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { useCanManageAIResource, useCreationPolicies, useCurrentWorkspace } from '@org/web-workspace';
import { ReactFlowProvider } from '@xyflow/react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  Clock,
  GitBranch,
  MessageSquare,
  Play,
  RotateCcw,
  Save,
  Settings2,
  Share2,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AgentBuilderOptionsProvider, useAgentGraph, type AgentGraph } from '../agent-graph/index.js';
import { AgentBuilderWorkbench } from './AgentBuilderWorkbench.js';
import { AgentTestPanel } from './AgentTestPanel.js';
import { AIEntityRunsList } from './AIEntityRunsList.js';
import {
  errorText,
  useAgentDetail,
  useAgentEditorMutations,
  useAgentVersions,
} from './use-agent-editor.js';

type EditorTab = 'build' | 'runs' | 'versions' | 'settings';

function aiPath(slug: string | undefined, ...rest: string[]) {
  return [`/w/${slug ?? ''}/ai`, ...rest].join('/');
}

export interface AgentEditorViewProps {
  /** Omit for a new agent. */
  agentId?: string;
}

export function AgentEditorView({ agentId }: AgentEditorViewProps) {
  const { workspaceId, slug } = useCurrentWorkspace();
  const detail = useAgentDetail(workspaceId, agentId);
  const policies = useCreationPolicies(workspaceId);
  // Bumped when a version is restored, so the canvas re-reads the stored graph.
  const [graphEpoch, setGraphEpoch] = useState(0);

  if (agentId && detail.isLoading) return <LoadingState fullPage label="Opening agent…" />;
  if (!agentId && policies.isLoading) return <LoadingState fullPage label="Opening…" />;
  // The workspace policy (Settings → Permissions) decides who may create
  // agents; the API enforces it too. Say so rather than open a canvas that
  // could never be saved.
  if (!agentId && !policies.canCreateAgents) {
    return (
      <div className="grid flex-1 place-items-center p-6">
        <ErrorState
          title="Only admins can create agents here"
          description="This workspace limits who can create agents. Ask a workspace admin to create one, or to change the policy in Settings → Permissions & Policies."
          action={
            <Button asChild variant="outline">
              <Link to={aiPath(slug, 'agents')}>Back to agents</Link>
            </Button>
          }
        />
      </div>
    );
  }
  if (agentId && (detail.isError || !detail.data)) {
    return (
      <div className="grid flex-1 place-items-center p-6">
        <ErrorState
          title="Agent not found"
          description="It may have been deleted, or it belongs to another workspace."
          action={
            <Button asChild variant="outline">
              <Link to={aiPath(slug, 'agents')}>Back to agents</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <AgentBuilderOptionsProvider workspaceId={workspaceId}>
      <ReactFlowProvider key={`${agentId ?? 'new'}:${graphEpoch}`}>
        <AgentEditor
          workspaceId={workspaceId}
          slug={slug}
          agent={agentId ? (detail.data as AIAgent) : null}
          onRestored={() => setGraphEpoch((n) => n + 1)}
        />
      </ReactFlowProvider>
    </AgentBuilderOptionsProvider>
  );
}

function parseStoredGraph(agent: AIAgent | null): { graph: AgentGraph | null; unsupported: string[] } {
  if (!agent?.graphJson) return { graph: null, unsupported: [] };
  if (isAgentBuilderGraph(agent.graphJson)) {
    try {
      return { graph: JSON.parse(agent.graphJson) as AgentGraph, unsupported: [] };
    } catch {
      return { graph: null, unsupported: [] };
    }
  }
  // Written by the former standalone Agent Studio: convert what maps onto an
  // agent, and say plainly what does not.
  const converted = convertLegacyAgentGraph(agent.graphJson, agent);
  return converted
    ? {
        graph: converted.graph as unknown as AgentGraph,
        unsupported: converted.unsupportedSteps.map((s) => s.label),
      }
    : { graph: null, unsupported: [] };
}

function AgentEditor({
  workspaceId,
  slug,
  agent,
  onRestored,
}: {
  workspaceId: string | undefined;
  slug: string | undefined;
  agent: AIAgent | null;
  onRestored: () => void;
}) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const canManageResource = useCanManageAIResource();
  const { canCreateAgents } = useCreationPolicies(workspaceId);
  const canEdit = agent ? canManageResource(agent.creatorId) : canCreateAgents;
  const mutations = useAgentEditorMutations(workspaceId, agent?.id);
  const [tab, setTab] = useState<EditorTab>((params.get('tab') as EditorTab) || 'build');
  const [testOpen, setTestOpen] = useState(false);

  const stored = useMemo(() => parseStoredGraph(agent), [agent]);
  const graph = useAgentGraph({
    agentId: agent?.id ?? null,
    initialConfig: agent
      ? { name: agent.name, role: agent.role, model: agent.model, systemPrompt: agent.systemPrompt }
      : { name: params.get('name') ?? undefined },
    initialGraph: stored.graph,
  });

  const configuration = (agent?.configuration ?? {}) as { status?: string; currentVersion?: number };
  const isPublished = configuration.status === 'published';
  const name = graph.summary.name || agent?.name || 'New agent';

  /** Saves the canvas; resolves to the saved agent, or null if it failed. */
  const saveNow = useCallback(async (): Promise<AIAgent | null> => {
    if (graph.errorCount > 0) {
      toast.error('Fix the errors first', {
        description: 'The Issues tab in the inspector lists what is missing.',
      });
      setTab('build');
      return null;
    }
    try {
      const saved = await mutations.save.mutateAsync({
        name: graph.summary.name,
        role: graph.summary.role,
        graphJson: graph.serialize(),
      });
      graph.markSaved();
      if (!agent) {
        toast.success('Agent created', { description: 'Test it, then publish it when it behaves.' });
        navigate(aiPath(slug, 'agents', saved.id), { replace: true });
      } else {
        toast.success('Saved');
      }
      return saved;
    } catch (err) {
      graph.save(); // keep a local draft so nothing typed is lost
      toast.error('Could not save the agent', { description: errorText(err) });
      return null;
    }
  }, [agent, graph, mutations.save, navigate, slug]);

  // ⌘S / Ctrl+S saves, as the status bar promises.
  useEffect(() => {
    if (!canEdit) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveNow();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canEdit, saveNow]);

  // Closing the tab with unsaved canvas edits asks first.
  useEffect(() => {
    if (!graph.dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [graph.dirty]);

  const runTest = async (message: string): Promise<AgentTestRunResult | undefined> => {
    if (!agent || graph.dirty) {
      const saved = await saveNow();
      if (!saved || !agent) return undefined; // a new agent navigates; test again after
    }
    return mutations.testRun.mutateAsync(message);
  };

  const togglePublish = async () => {
    if (!agent) return;
    if (isPublished) {
      mutations.unpublish.mutate();
      return;
    }
    if (graph.dirty && !(await saveNow())) return;
    mutations.publish.mutate(undefined, {
      onError: (err) => toast.error('Not ready to publish', { description: errorText(err) }),
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Hint label="Back to agents">
            <Button variant="ghost" size="icon-sm" asChild aria-label="Back to agents">
              <Link to={aiPath(slug, 'agents')}>
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
          </Hint>
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-violet-soft text-accent-violet">
            <Bot className="size-4" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-foreground">{name}</h1>
            <p className="truncate text-[11px] text-muted-foreground">{graph.summary.role}</p>
          </div>
          {agent ? (
            <Badge
              variant={!agent.isActive ? 'neutral' : isPublished ? 'success' : 'outline'}
              className="shrink-0 text-[10px]"
            >
              {!agent.isActive
                ? 'Paused'
                : isPublished
                  ? `Published${configuration.currentVersion ? ` · v${configuration.currentVersion}` : ''}`
                  : 'Draft'}
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              Not saved yet
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" leadingIcon={<Play />} onClick={() => setTestOpen(true)}>
            Test
          </Button>
          {agent && canEdit ? (
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Share2 />}
              loading={mutations.publish.isPending || mutations.unpublish.isPending}
              onClick={() => void togglePublish()}
            >
              {isPublished ? 'Unpublish' : 'Publish'}
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              size="sm"
              leadingIcon={<Save />}
              loading={mutations.save.isPending}
              disabled={agent ? !graph.dirty : false}
              onClick={() => void saveNow()}
            >
              {agent ? (graph.dirty ? 'Save' : 'Saved') : 'Create agent'}
            </Button>
          ) : null}
        </div>
      </header>

      {stored.unsupported.length > 0 ? (
        <div role="status" className="flex shrink-0 items-start gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-warning-text">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            This agent was built in the old Agent Studio. Its model, instructions and tools were carried over. These
            steps are workflow logic, not agent settings, and were left out: {stored.unsupported.join(', ')}. Build them
            as a workflow that calls this agent. Nothing changes until you save.
          </span>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as EditorTab)} className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border px-3 sm:px-4">
          <ResponsiveTabsList variant="underline" aria-label="Agent editor sections">
            <TabsTrigger value="build">
              <GitBranch className="size-4" aria-hidden /> Build
            </TabsTrigger>
            <TabsTrigger value="runs" disabled={!agent}>
              <Activity className="size-4" aria-hidden /> Runs
            </TabsTrigger>
            <TabsTrigger value="versions" disabled={!agent}>
              <Clock className="size-4" aria-hidden /> Versions
            </TabsTrigger>
            <TabsTrigger value="settings" disabled={!agent}>
              <Settings2 className="size-4" aria-hidden /> Settings
            </TabsTrigger>
          </ResponsiveTabsList>
        </div>

        <TabsContent value="build" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <AgentBuilderWorkbench graph={graph} readOnly={!canEdit} />
        </TabsContent>
        {agent ? (
          <>
            <TabsContent value="runs" className="mt-0 min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <AIEntityRunsList workspaceId={workspaceId} slug={slug} entityId={agent.id} onTest={() => setTestOpen(true)} />
            </TabsContent>
            <TabsContent value="versions" className="mt-0 min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <VersionsPanel
                workspaceId={workspaceId}
                agentId={agent.id}
                canEdit={canEdit}
                dirty={graph.dirty}
                mutations={mutations}
                onRestored={onRestored}
              />
            </TabsContent>
            <TabsContent value="settings" className="mt-0 min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <SettingsPanel
                slug={slug}
                agent={agent}
                canEdit={canEdit}
                mutations={mutations}
                onDeleted={() => navigate(aiPath(slug, 'agents'), { replace: true })}
              />
            </TabsContent>
          </>
        ) : null}
      </Tabs>

      <AgentTestPanel
        open={testOpen}
        onOpenChange={setTestOpen}
        agentName={name}
        onRun={runTest}
        running={mutations.testRun.isPending || mutations.save.isPending}
        runsPath={aiPath(slug, 'runs')}
        dirty={graph.dirty || !agent}
      />
    </div>
  );
}

type Mutations = ReturnType<typeof useAgentEditorMutations>;

function VersionsPanel({
  workspaceId,
  agentId,
  canEdit,
  dirty,
  mutations,
  onRestored,
}: {
  workspaceId: string | undefined;
  agentId: string;
  canEdit: boolean;
  dirty: boolean;
  mutations: Mutations;
  onRestored: () => void;
}) {
  const versions = useAgentVersions(workspaceId, agentId);
  const [summary, setSummary] = useState('');

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {canEdit ? (
        <Card className="p-4">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              mutations.snapshot.mutate(summary.trim() || undefined, { onSuccess: () => setSummary('') });
            }}
          >
            <Field
              label="Save a version of the saved agent"
              hint={dirty ? 'Unsaved canvas changes are not included — save first.' : 'Publishing also saves a version.'}
              className="flex-1"
            >
              <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What changed?" />
            </Field>
            <Button type="submit" variant="outline" loading={mutations.snapshot.isPending}>
              Save version
            </Button>
          </form>
        </Card>
      ) : null}

      {versions.isLoading ? (
        <LoadingState label="Loading versions…" />
      ) : (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {(versions.data ?? []).map((version) => (
            <div key={version.version} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {version.versionTag ?? `v${version.version}`}
                  </span>
                  <Badge variant={version.status === 'PUBLISHED' ? 'success' : 'neutral'} className="text-[10px]">
                    {version.status === 'PUBLISHED' ? 'Published' : version.status === 'DRAFT' ? 'Current draft' : 'Saved'}
                  </Badge>
                  {version.publishedAt ? (
                    <span className="text-xs text-muted-foreground">{formatRelative(version.publishedAt)}</span>
                  ) : null}
                </div>
                {version.changeSummary ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{version.changeSummary}</p>
                ) : null}
              </div>
              {canEdit && version.status !== 'DRAFT' ? (
                <Button
                  variant="outline"
                  size="sm"
                  leadingIcon={<RotateCcw />}
                  loading={mutations.restore.isPending && mutations.restore.variables === version.version}
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Restore ${version.versionTag ?? `v${version.version}`}?`,
                      description:
                        'The agent’s current canvas, instructions and tools are replaced by that version. Save a version first if you may want the current one back.',
                      confirmLabel: 'Restore',
                    });
                    if (ok) mutations.restore.mutate(version.version, { onSuccess: onRestored });
                  }}
                >
                  Restore
                </Button>
              ) : null}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function SettingsPanel({
  slug,
  agent,
  canEdit,
  mutations,
  onDeleted,
}: {
  slug: string | undefined;
  agent: AIAgent;
  canEdit: boolean;
  mutations: Mutations;
  onDeleted: () => void;
}) {
  const [welcome, setWelcome] = useState(agent.welcomeMessage ?? '');
  const welcomeChanged = welcome !== (agent.welcomeMessage ?? '');

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Active</p>
            <p className="text-xs text-muted-foreground">
              A paused agent doesn’t answer, run on schedules or get called by workflows.
            </p>
          </div>
          <Switch
            checked={agent.isActive}
            disabled={!canEdit || mutations.setActive.isPending}
            onCheckedChange={(on) => mutations.setActive.mutate(on)}
            aria-label="Agent active"
          />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm" leadingIcon={<MessageSquare />} asChild>
            <Link to={`/w/${slug ?? ''}/agents/${agent.id}/chat`}>Chat with it</Link>
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <Field
          label="Welcome message"
          hint="Shown as the first message when someone opens a conversation with it."
        >
          <Textarea
            rows={3}
            value={welcome}
            disabled={!canEdit}
            onChange={(e) => setWelcome(e.target.value)}
            placeholder={`Hi, I’m ${agent.name}. …`}
          />
        </Field>
        {canEdit ? (
          <Button
            size="sm"
            variant="outline"
            disabled={!welcomeChanged}
            loading={mutations.updateSettings.isPending}
            onClick={() => mutations.updateSettings.mutate({ welcomeMessage: welcome })}
          >
            Save message
          </Button>
        ) : null}
      </Card>

      {canEdit ? (
        <Card className="space-y-3 border-destructive/30 p-4">
          <p className="text-sm font-semibold text-foreground">Delete agent</p>
          <p className="text-xs text-muted-foreground">
            Removes it from every channel and conversation. Its run history is kept.
          </p>
          <Button
            variant="destructive"
            size="sm"
            leadingIcon={<Trash2 />}
            loading={mutations.remove.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: `Delete ${agent.name}?`,
                description: 'This cannot be undone.',
                destructive: true,
                requireText: agent.name,
              });
              if (ok) mutations.remove.mutate(undefined, { onSuccess: onDeleted });
            }}
          >
            Delete agent
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
