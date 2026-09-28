import type { AIEntity } from '@org/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  SearchInput,
  SegmentedControl,
  toast,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { AIEntityAvatar, useAgents } from '@org/web-agents';
import { useCreationPolicies, useCurrentWorkspace } from '@org/web-workspace';
import { Bot, Plus, UserCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CoworkerCreateDialog } from '../CoworkerCreateDialog.js';
import { useCoworkers } from '../use-coworkers.js';

type TypeFilter = 'all' | 'agent' | 'coworker';

const TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'agent', label: 'Agents' },
  { value: 'coworker', label: 'Coworkers' },
] as const;

function aiPath(slug: string | undefined, ...rest: string[]) {
  return [`/w/${slug ?? ''}/ai`, ...rest].join('/');
}

/**
 * Every AI agent and coworker in the workspace — one list, because a coworker
 * is an agent with a persistent persona, not a separate product. Opens the
 * unified editor; `?create=coworker` (from the AI Workspace "New" menu) opens
 * the coworker setup straight away.
 */
export function AIAgentsDirectory() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { workspaceId, slug } = useCurrentWorkspace();
  const {
    canCreateAgents,
    canCreateCoworkers,
    isLoading: policiesLoading,
  } = useCreationPolicies(workspaceId);
  const agents = useAgents(workspaceId);
  const coworkers = useCoworkers(workspaceId);
  const [query, setQuery] = useState('');
  const type = (params.get('type') as TypeFilter) || 'all';
  const [coworkerOpen, setCoworkerOpen] = useState(false);

  // The "New → Coworker" menu item lands here with ?create=coworker.
  // Waits for the policy: until it loads, everyone reads as "not allowed".
  useEffect(() => {
    if (params.get('create') !== 'coworker' || policiesLoading) return;
    if (canCreateCoworkers) setCoworkerOpen(true);
    else
      toast.info('Only admins can create coworkers here', {
        description: 'Ask a workspace admin, or have them change it in Settings → Permissions & Policies.',
      });
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('create');
        return next;
      },
      { replace: true },
    );
  }, [params, setParams, canCreateCoworkers, policiesLoading]);

  const entities = useMemo(() => {
    const all: AIEntity[] = [...(agents.data ?? []), ...(coworkers.data ?? [])];
    const needle = query.trim().toLowerCase();
    return all
      .filter((e) => type === 'all' || e.type === type)
      .filter(
        (e) =>
          !needle ||
          e.name.toLowerCase().includes(needle) ||
          e.role.toLowerCase().includes(needle) ||
          (e.description ?? '').toLowerCase().includes(needle),
      )
      .sort((a, b) => (b.lastActiveAt ?? b.updatedAt).localeCompare(a.lastActiveAt ?? a.updatedAt));
  }, [agents.data, coworkers.data, query, type]);

  const loading = agents.isLoading || coworkers.isLoading;
  const failed = agents.isError && coworkers.isError;
  const total = (agents.data?.length ?? 0) + (coworkers.data?.length ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search agents and coworkers"
          aria-label="Search agents and coworkers"
          className="w-full sm:w-72"
        />
        <SegmentedControl
          aria-label="Show"
          size="sm"
          options={TYPE_OPTIONS}
          value={type}
          onChange={(v) =>
            setParams(
              (prev) => {
                const next = new URLSearchParams(prev);
                if (v === 'all') next.delete('type');
                else next.set('type', v);
                return next;
              },
              { replace: true },
            )
          }
        />
        <div className="ml-auto flex gap-2">
          {canCreateCoworkers ? (
            <Button variant="outline" leadingIcon={<UserCheck />} onClick={() => setCoworkerOpen(true)}>
              New coworker
            </Button>
          ) : null}
          {canCreateAgents ? (
            <Button leadingIcon={<Plus />} onClick={() => navigate(aiPath(slug, 'agents', 'new'))}>
              New agent
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading agents…" />
      ) : failed ? (
        <ErrorState
          title="Couldn't load agents"
          onRetry={() => {
            void agents.refetch();
            void coworkers.refetch();
          }}
        />
      ) : total === 0 ? (
        <EmptyState
          icon={<Bot />}
          title="No agents yet"
          description="An agent is a model with instructions, tools and knowledge. A coworker is an agent with a persistent persona that works in channels."
          action={
            canCreateAgents ? (
              <Button leadingIcon={<Plus />} onClick={() => navigate(aiPath(slug, 'agents', 'new'))}>
                Build your first agent
              </Button>
            ) : undefined
          }
        />
      ) : entities.length === 0 ? (
        <EmptyState size="sm" title="Nothing matches" description="Try another name or filter." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {entities.map((entity) => (
            <li key={entity.id}>
              <EntityCard entity={entity} to={aiPath(slug, 'agents', entity.id)} />
            </li>
          ))}
        </ul>
      )}

      {workspaceId ? (
        <CoworkerCreateDialog open={coworkerOpen} onOpenChange={setCoworkerOpen} workspaceId={workspaceId} />
      ) : null}
    </div>
  );
}

function EntityCard({ entity, to }: { entity: AIEntity; to: string }) {
  const status = (entity.configuration as { status?: string } | undefined)?.status;
  const stateLabel = !entity.isActive
    ? 'Paused'
    : entity.type === 'coworker'
      ? entity.status === 'WORKING' || entity.status === 'RUNNING_TASK'
        ? 'Working'
        : entity.status === 'ERROR'
          ? 'Error'
          : 'Available'
      : status === 'published'
        ? 'Published'
        : 'Draft';
  const stateVariant =
    stateLabel === 'Published' || stateLabel === 'Available'
      ? 'success'
      : stateLabel === 'Error'
        ? 'destructive'
        : stateLabel === 'Working'
          ? 'primary'
          : 'neutral';

  return (
    <Link
      to={to}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
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
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">{entity.name}</span>
              <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                {entity.type}
              </Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">{entity.role}</p>
          </div>
        </div>
        {entity.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{entity.description}</p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <Badge variant={stateVariant} className="text-[10px]">
            {stateLabel}
          </Badge>
          <span>{entity.lastActiveAt ? `Active ${formatRelative(entity.lastActiveAt)}` : 'Not run yet'}</span>
        </div>
      </Card>
    </Link>
  );
}
