import {
  AGENT_TEMPLATES,
  AGENT_TEMPLATE_CATEGORIES,
  type AgentTemplateCategory,
  type AgentTemplateDefinition,
  type AIEntity,
  type StudioAgentSummary,
} from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  ResponsiveTabsList,
  SearchInput,
  Tabs,
  TabsTrigger,
  toast,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { aiWorkspacePath, studioAgentPath } from '@org/web-ai';
import { AIEntityAvatar, useAgents } from '@org/web-agents';
import { CoworkerCreateDialog, useCoworkers } from '@org/web-coworkers';
import { useCanManageAIResource, useCreationPolicies, useCurrentWorkspace, useWorkspacePermission } from '@org/web-workspace';
import { Bot, LayoutTemplate, Plus, Sparkles, UserCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { buildAgentActions } from './agent-actions.js';
import { AgentCard } from './AgentCard.js';
import { templateIcon } from './studio-meta.js';
import { useAgentFavorites, useStudioAgents, useStudioMutations } from './use-studio.js';

type View = 'all' | 'mine' | 'shared' | 'favorites' | 'scheduled' | 'active' | 'paused' | 'drafts' | 'failing' | 'archived' | 'templates';
type TypeFilter = 'all' | 'planned' | 'workflow' | 'assistant' | 'coworker';

const VIEWS: ReadonlyArray<{ id: View; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'Mine' },
  { id: 'shared', label: 'Shared' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'active', label: 'On' },
  { id: 'paused', label: 'Paused' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'failing', label: 'Failing' },
  { id: 'archived', label: 'Archived' },
  { id: 'templates', label: 'Templates' },
];

const TYPES = [
  { value: 'all', label: 'Every kind' },
  { value: 'planned', label: 'Studio agents' },
  { value: 'workflow', label: 'Canvas workflows' },
  { value: 'assistant', label: 'Assistant agents' },
  { value: 'coworker', label: 'Coworkers' },
] as const;

/**
 * Every agent in the workspace in one library — Studio agents, canvas
 * workflows, chat assistants and coworkers — with views for what is yours,
 * what is on, what is failing, favorites and templates.
 */
export function AgentLibrary() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { workspaceId, slug } = useCurrentWorkspace();
  const { can } = useWorkspacePermission();
  const canManageResource = useCanManageAIResource();
  const { canCreateCoworkers, isLoading: policiesLoading } = useCreationPolicies(workspaceId);
  const studio = useStudioAgents(workspaceId);
  const assistants = useAgents(workspaceId);
  const coworkers = useCoworkers(workspaceId);
  const { favorites, toggle } = useAgentFavorites(workspaceId);
  const mutations = useStudioMutations(workspaceId);
  const [query, setQuery] = useState('');
  const [coworkerOpen, setCoworkerOpen] = useState(false);
  const view = (params.get('view') as View) || 'all';
  const legacyType = params.get('type');
  const type: TypeFilter = legacyType === 'coworker' ? 'coworker' : legacyType === 'agent' ? 'assistant' : ((legacyType as TypeFilter) || 'all');

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value && value !== 'all') next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  // "New → Coworker" lands here with ?create=coworker.
  useEffect(() => {
    if (params.get('create') !== 'coworker' || policiesLoading) return;
    if (canCreateCoworkers) setCoworkerOpen(true);
    else toast.info('Only admins can create coworkers here', { description: 'Ask a workspace admin, or have them change it in Settings → Permissions & Policies.' });
    setParam('create', null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, canCreateCoworkers, policiesLoading]);

  const needle = query.trim().toLowerCase();
  const matches = (text: string | null | undefined) => !needle || (text ?? '').toLowerCase().includes(needle);

  const agents = useMemo(() => {
    const list = (studio.data ?? []).filter((a) => matches(a.name) || matches(a.description));
    return list.filter((a) => {
      if (type === 'planned' && !a.isStudioAgent) return false;
      if (type === 'workflow' && a.isStudioAgent) return false;
      if (type === 'assistant' || type === 'coworker') return false;
      switch (view) {
        case 'mine':
          return a.isMine && a.state !== 'archived';
        case 'shared':
          return !a.isMine && a.state !== 'archived';
        case 'favorites':
          return favorites.has(a.id);
        case 'scheduled':
          return a.trigger.kind === 'schedule' && a.state === 'active';
        case 'active':
          return a.state === 'active';
        case 'paused':
          return a.state === 'paused';
        case 'drafts':
          return a.state === 'draft';
        case 'failing':
          return a.recentFailures > 0;
        case 'archived':
          return a.state === 'archived';
        default:
          return a.state !== 'archived';
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.data, view, type, needle, favorites]);

  const entities = useMemo(() => {
    if (type === 'planned' || type === 'workflow') return [];
    if (!['all', 'mine', 'shared', 'favorites', 'active', 'paused'].includes(view)) return [];
    const all: AIEntity[] = [...(assistants.data ?? []), ...(coworkers.data ?? [])];
    return all.filter((e) => {
      if (type === 'assistant' && e.type !== 'agent') return false;
      if (type === 'coworker' && e.type !== 'coworker') return false;
      if (!matches(e.name) && !matches(e.role) && !matches(e.description)) return false;
      if (view === 'favorites') return favorites.has(e.id);
      if (view === 'active') return e.isActive;
      if (view === 'paused') return !e.isActive;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistants.data, coworkers.data, view, type, needle, favorites]);

  const actionsFor = (agent: StudioAgentSummary) =>
    buildAgentActions(agent, {
      canManage: canManageResource(agent.owner?.id ?? null),
      canCreate: can('create'),
      onOpen: () => navigate(studioAgentPath(slug, agent.id)),
      onRun: () =>
        mutations.run.mutateAsync({ id: agent.id }).then((started) =>
          navigate(`${studioAgentPath(slug, agent.id, 'runs')}&run=${started.runId}`),
        ),
      onTest: () =>
        mutations.run.mutateAsync({ id: agent.id, mode: 'test' }).then((started) =>
          navigate(`${studioAgentPath(slug, agent.id, 'runs')}&run=${started.runId}`),
        ),
      onSwitchOn: () => mutations.setState.mutateAsync({ id: agent.id, state: 'active' }),
      onPause: () => mutations.setState.mutateAsync({ id: agent.id, state: 'paused' }),
      onArchive: () => mutations.setState.mutateAsync({ id: agent.id, state: 'archived' }),
      onRestore: () => mutations.setState.mutateAsync({ id: agent.id, state: 'draft' }),
      onDuplicate: () => mutations.duplicate.mutateAsync(agent.id).then((copy) => navigate(studioAgentPath(slug, copy.id))),
      onOpenCanvas: () => navigate(aiWorkspacePath(slug, 'workflows', agent.id)),
      onDelete: () => mutations.remove.mutateAsync(agent.id),
    });

  const loading = studio.isLoading || (assistants.isLoading && coworkers.isLoading);
  const total = (studio.data?.length ?? 0) + (assistants.data?.length ?? 0) + (coworkers.data?.length ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onValueChange={setQuery} placeholder="Search agents" aria-label="Search agents" className="w-full sm:w-64" />
        {view !== 'templates' ? (
          <AppSelect
            className="w-full sm:w-48"
            aria-label="Kind of agent"
            value={type}
            onValueChange={(v) => setParam('type', v)}
            options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
        ) : null}
        <div className="ml-auto flex gap-2">
          {canCreateCoworkers ? (
            <Button variant="outline" leadingIcon={<UserCheck />} onClick={() => setCoworkerOpen(true)}>
              New coworker
            </Button>
          ) : null}
          {can('create') ? (
            <Button leadingIcon={<Sparkles />} onClick={() => navigate(aiWorkspacePath(slug, 'studio', 'new'))}>
              Describe an agent
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => setParam('view', v)}>
        <ResponsiveTabsList variant="underline" size="sm" aria-label="Library views" className="w-full">
          {VIEWS.map((v) => (
            <TabsTrigger key={v.id} value={v.id}>
              {v.label}
            </TabsTrigger>
          ))}
        </ResponsiveTabsList>
      </Tabs>

      {view === 'templates' ? (
        <TemplateGallery slug={slug} query={needle} />
      ) : loading ? (
        <LoadingState label="Loading agents…" />
      ) : studio.isError && assistants.isError ? (
        <ErrorState title="Couldn't load agents" onRetry={() => void studio.refetch()} />
      ) : total === 0 ? (
        <EmptyState
          icon={<Bot />}
          title="No agents yet"
          description="Describe what you want done — “prepare my daily report every evening” — and the Studio plans an agent for you. Or start from a template."
          action={
            can('create') ? (
              <Button leadingIcon={<Sparkles />} onClick={() => navigate(aiWorkspacePath(slug, 'studio', 'new'))}>
                Describe an agent
              </Button>
            ) : undefined
          }
          secondaryAction={
            <Button variant="outline" leadingIcon={<LayoutTemplate />} onClick={() => setParam('view', 'templates')}>
              Browse templates
            </Button>
          }
        />
      ) : agents.length + entities.length === 0 ? (
        <EmptyState size="sm" title="Nothing here" description={view === 'favorites' ? 'Star an agent to keep it here.' : 'Try another view or search.'} />
      ) : (
        <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
          {agents.map((agent) => (
            <li key={agent.id}>
              <AgentCard
                agent={agent}
                to={studioAgentPath(slug, agent.id)}
                favorite={favorites.has(agent.id)}
                onToggleFavorite={() => toggle(agent.id)}
                actions={actionsFor(agent)}
              />
            </li>
          ))}
          {entities.map((entity) => (
            <li key={entity.id}>
              <EntityCard entity={entity} to={aiWorkspacePath(slug, 'agents', entity.id)} />
            </li>
          ))}
        </ul>
      )}

      {workspaceId ? <CoworkerCreateDialog open={coworkerOpen} onOpenChange={setCoworkerOpen} workspaceId={workspaceId} /> : null}
    </div>
  );
}

/** Assistants and coworkers: conversational agents with their own editor. */
function EntityCard({ entity, to }: { entity: AIEntity; to: string }) {
  const working = entity.status === 'WORKING' || entity.status === 'RUNNING_TASK';
  const state = !entity.isActive ? 'Paused' : entity.type === 'coworker' ? (working ? 'Working' : entity.status === 'ERROR' ? 'Error' : 'Available') : 'Ready';
  return (
    <Link to={to} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="flex h-full flex-col gap-3 p-4 transition-colors hover:border-border-strong">
        <div className="flex items-start gap-3">
          <AIEntityAvatar
            name={entity.name}
            type={entity.type}
            avatarUrl={entity.avatarUrl}
            status={entity.type === 'coworker' ? entity.status : undefined}
            showStatusDot={entity.type === 'coworker'}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">{entity.name}</span>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{entity.type === 'coworker' ? 'AI coworker' : 'Assistant agent'}</span>
              <Badge variant={state === 'Paused' ? 'neutral' : state === 'Error' ? 'destructive' : 'success'} className="text-[10px]">
                {state}
              </Badge>
            </div>
          </div>
        </div>
        {entity.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{entity.description}</p> : <p className="text-xs text-muted-foreground">{entity.role}</p>}
        <p className="mt-auto border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
          {entity.lastActiveAt ? `Active ${formatRelative(entity.lastActiveAt)}` : 'Not used yet'} · answers in chat
        </p>
      </Card>
    </Link>
  );
}

/** Starter agents, grouped — each one a working plan made only of real tools. */
export function TemplateGallery({ slug, query = '', limitTo }: { slug: string | undefined; query?: string; limitTo?: string[] }) {
  const templates = AGENT_TEMPLATES.filter(
    (t) => (!limitTo || limitTo.includes(t.id)) && (!query || t.name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query)),
  );
  if (limitTo) {
    return (
      <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
        {templates.map((t) => (
          <li key={t.id}>
            <TemplateCard template={t} slug={slug} />
          </li>
        ))}
      </ul>
    );
  }
  const categories = (Object.keys(AGENT_TEMPLATE_CATEGORIES) as AgentTemplateCategory[]).filter((c) => templates.some((t) => t.category === c));
  if (categories.length === 0) return <EmptyState size="sm" title="No templates match" />;
  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <section key={category} aria-labelledby={`tpl-${category}`} className="space-y-3">
          <h2 id={`tpl-${category}`} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {AGENT_TEMPLATE_CATEGORIES[category]}
          </h2>
          <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
            {templates
              .filter((t) => t.category === category)
              .map((t) => (
                <li key={t.id}>
                  <TemplateCard template={t} slug={slug} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TemplateCard({ template, slug }: { template: AgentTemplateDefinition; slug: string | undefined }) {
  const Icon = templateIcon(template.icon);
  const bp = useMemo(() => template.blueprint(), [template]);
  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4">
          <Icon />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{template.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{template.description}</p>
        </div>
      </div>
      <ol className="space-y-0.5 pl-12 text-[11px] text-muted-foreground">
        {bp.steps.slice(0, 5).map((s, i) => (
          <li key={s.id}>
            {i + 1}. {s.title}
          </li>
        ))}
        {bp.steps.length > 5 ? <li>+ {bp.steps.length - 5} more</li> : null}
      </ol>
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        {template.requires?.length ? (
          <Badge variant="outline" className="text-[10px]">
            Needs {template.requires.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')}
          </Badge>
        ) : (
          <span />
        )}
        <Button asChild size="sm" variant="outline" leadingIcon={<Plus />}>
          <Link to={`${aiWorkspacePath(slug, 'studio', 'new')}?template=${template.id}`}>Use template</Link>
        </Button>
      </div>
    </Card>
  );
}
