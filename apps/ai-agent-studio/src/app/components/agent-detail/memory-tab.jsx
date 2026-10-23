import { useEffect, useMemo, useState } from 'react';
import {
  AppSelect,
  Badge,
  Button,
  confirm,
  EmptyState,
  ErrorState,
  Input,
  Label,
  LoadingState,
  SegmentedControl,
  Switch,
  Textarea,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { aiMemoryApi } from '@org/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Brain,
  Database,
  History,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { useStudioSession } from '../../session-guard.js';
import { AgentTabPage, AgentTabSection } from './agent-tab-page.js';

const MODES = [
  {
    id: 'buffer',
    icon: Zap,
    title: 'Conversation only',
    desc: 'Remembers the current chat and nothing else. Fastest; nothing is recalled across chats.',
  },
  {
    id: 'hybrid',
    icon: Sparkles,
    title: 'Conversation + recall',
    desc: 'The current chat plus the most recent saved facts, brought into every turn.',
  },
  {
    id: 'persistent',
    icon: Database,
    title: 'Long-term',
    desc: 'Builds up facts and preferences across chats and keeps recalling them.',
  },
];

const WINDOW_OPTIONS = [6, 12, 20, 50, 100];
const RETENTION_OPTIONS = [7, 30, 90, 365];
const SCOPE_OPTIONS = [
  { value: 'agent', label: 'This agent' },
  { value: 'workspace', label: 'Whole workspace' },
  { value: 'user', label: 'Per person' },
];
const MAX_VALUE = 4000;

const asKey = (n) => (n == null ? 'none' : String(n));
const fromKey = (v) => (v === 'none' ? null : Number(v));

/** Scoped keys are stored `[scope] name` or `[scope:id] name`; unprefixed is workspace-wide. */
function parseKey(key) {
  const m = /^\[([a-z_]+)(?::([^\]]+))?\]\s*(.*)$/is.exec(key || '');
  return m ? { scope: m[1].toLowerCase(), owner: m[2] || null, name: m[3] || key } : { scope: 'workspace', owner: null, name: key };
}

function timeAgo(date) {
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString();
}

/** The memory policy the agent's runtime enforces, with the defaults older agents keep. */
function readPolicy(agent) {
  const runtime = agent?.configuration?.runtime ?? {};
  const m = runtime.memory ?? {};
  const mode =
    m.mode === 'buffer' || m.mode === 'persistent' || m.mode === 'hybrid'
      ? m.mode
      : runtime.useWorkspaceMemory === false
        ? 'buffer'
        : 'hybrid';
  return {
    mode,
    retentionDays: Number.isFinite(m.retentionDays) && m.retentionDays >= 1 ? m.retentionDays : null,
    contextWindowSize: Number.isFinite(m.contextWindowSize) && m.contextWindowSize >= 1 ? m.contextWindowSize : null,
    autoSummarize: m.autoSummarize === true,
    userSpecific: m.userSpecific !== false,
  };
}

const samePolicy = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function withCurrent(options, current, suffix) {
  const list = current != null && !options.includes(current) ? [...options, current].sort((a, b) => a - b) : options;
  return list.map((n) => ({ value: String(n), label: `${n} ${suffix}` }));
}

/**
 * @param {{ agent: any; onUpdate?: (patch: Record<string, any>) => boolean | void | Promise<boolean | void> }} props
 */
export function MemoryTab({ agent, onUpdate }) {
  const { activeWorkspace } = useStudioSession();
  const queryClient = useQueryClient();
  const workspaceId = activeWorkspace?.id;

  const saved = useMemo(() => readPolicy(agent), [agent]);
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const dirty = !samePolicy(draft, saved);
  const patch = (p) => setDraft((d) => ({ ...d, ...p }));

  // Follow the saved policy (a save, a reload) unless there are unsaved edits.
  const savedKey = JSON.stringify(saved);
  useEffect(() => {
    setDraft(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const [scopeFilter, setScopeFilter] = useState('all');

  const [form, setForm] = useState(null); // { key, value, scope, editing }

  const params = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(scopeFilter === 'agent' ? { agentId: agent?.id } : scopeFilter !== 'all' ? { scope: scopeFilter } : {}),
  };
  const memoriesKey = ['workspace-ai-memories', workspaceId, params];
  const {
    data: memories = [],
    isLoading,
    isError,
    error,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: memoriesKey,
    queryFn: () => aiMemoryApi.list(workspaceId, params),
    enabled: Boolean(workspaceId),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['workspace-ai-memories', workspaceId] });

  const saveMutation = useMutation({
    mutationFn: ({ key, value, scope, editing }) =>
      aiMemoryApi.set(workspaceId, {
        key,
        value,
        ...(editing ? {} : { scope, agentId: scope === 'agent' ? agent?.id : undefined }),
      }),
    onSuccess: (_r, vars) => {
      refresh();
      setForm(null);
      toast.success(vars.editing ? 'Memory updated' : 'Memory saved');
    },
    onError: (err) => toast.error('Could not save the memory', { description: err?.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (mem) => aiMemoryApi.delete(workspaceId, mem.key),
    onSuccess: () => {
      refresh();
      toast.success('Memory removed');
    },
    onError: (err) => toast.error('Could not remove the memory', { description: err?.message }),
  });

  const forgetMutation = useMutation({
    mutationFn: () => aiMemoryApi.forgetAgent(workspaceId, agent.id),
    onSuccess: (r) => {
      refresh();
      toast.success(`Forgot ${r?.count ?? 0} memories`);
    },
    onError: (err) => toast.error('Could not clear memories', { description: err?.message }),
  });

  const handleSave = async () => {
    if (!onUpdate) return;
    setSaving(true);
    try {
      const savedRuntime = agent?.configuration?.runtime ?? {};
      const ok = await onUpdate({
        configuration: {
          runtime: {
            ...savedRuntime,
            // Recall is the runtime's switch; the rest rides in `memory`.
            useWorkspaceMemory: draft.mode !== 'buffer',
            memory: {
              ...(savedRuntime.memory ?? {}),
              mode: draft.mode,
              retentionDays: draft.retentionDays ?? undefined,
              contextWindowSize: draft.contextWindowSize ?? undefined,
              autoSummarize: draft.autoSummarize,
              userSpecific: draft.userSpecific,
            },
          },
        },
      });
      if (ok !== false) toast.success('Memory policy saved', { description: 'It applies from the next run.' });
    } finally {
      setSaving(false);
    }
  };

  const submitForm = (e) => {
    e.preventDefault();
    const key = form.key.trim();
    const value = form.value.trim();
    if (!key || !value) {
      toast.error('Add both a subject and what to remember');
      return;
    }
    saveMutation.mutate({ ...form, key, value });
  };

  const confirmDelete = async (mem) => {
    const ok = await confirm({
      title: 'Remove this memory?',
      description: 'Agents will no longer recall it. This can’t be undone.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (ok) deleteMutation.mutate(mem);
  };

  const confirmForget = async () => {
    const ok = await confirm({
      title: `Clear everything ${agent?.name ?? 'this agent'} remembers?`,
      description: 'Deletes every fact saved to this agent’s own scope. Workspace and person facts are kept.',
      confirmLabel: 'Clear memories',
      destructive: true,
    });
    if (ok) forgetMutation.mutate();
  };

  const totalTokens = memories.reduce((n, m) => n + Math.ceil((m.value || '').length / 4), 0);
  const recalls = draft.mode !== 'buffer';

  return (
    <AgentTabPage
      title="Memory"
      description="What this agent keeps in mind during a chat, what it recalls from earlier ones, and the facts it has saved."
      icon={<Brain />}
      actions={
        <Badge variant="outline" className="text-xs">
          {MODES.find((m) => m.id === saved.mode)?.title}
        </Badge>
      }
    >
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* Policy */}
        <AgentTabSection
          title="Memory policy"
          description="Enforced on every run, in chat and on schedule."
          icon={<Layers />}
          className="xl:sticky xl:top-0"
        >
          <div className="grid gap-2" role="radiogroup" aria-label="Memory mode">
            {MODES.map(({ id, icon: Icon, title, desc }) => {
              const active = draft.mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => patch({ mode: id })}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                    active ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-surface-raised hover:border-primary/50',
                  )}
                >
                  <Icon className={cn('mt-0.5 size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{desc}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 border-t border-border pt-4">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium">Messages kept in the chat</Label>
              <AppSelect
                value={asKey(draft.contextWindowSize)}
                onValueChange={(v) => patch({ contextWindowSize: fromKey(v) })}
                options={[
                  ...withCurrent(WINDOW_OPTIONS, draft.contextWindowSize, 'messages'),
                  { value: 'none', label: 'Whole conversation' },
                ]}
              />
              <p className="text-xs text-muted-foreground">Older messages are dropped from each turn to save tokens.</p>
            </div>

            <div className="grid gap-1.5">
              <Label className={cn('text-xs font-medium', !recalls && 'text-muted-foreground')}>Forget saved facts after</Label>
              <AppSelect
                value={asKey(draft.retentionDays)}
                disabled={!recalls}
                onValueChange={(v) => patch({ retentionDays: fromKey(v) })}
                options={[
                  ...withCurrent(RETENTION_OPTIONS, draft.retentionDays, 'days'),
                  { value: 'none', label: 'Never' },
                ]}
              />
              <p className="text-xs text-muted-foreground">
                {recalls ? 'Older facts stay stored but are no longer recalled.' : 'Not used when only the conversation is kept.'}
              </p>
            </div>

            <label className="flex items-start justify-between gap-4">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">Condense older messages</span>
                <span className="block text-xs text-muted-foreground">
                  Messages past the limit become a short digest instead of disappearing.
                </span>
              </span>
              <Switch
                checked={draft.autoSummarize && draft.contextWindowSize != null}
                disabled={draft.contextWindowSize == null}
                onCheckedChange={(c) => patch({ autoSummarize: c === true })}
                aria-label="Condense older messages"
              />
            </label>

            <label className="flex items-start justify-between gap-4">
              <span className="min-w-0">
                <span className={cn('block text-sm font-medium', recalls ? 'text-foreground' : 'text-muted-foreground')}>
                  Keep each person’s facts private
                </span>
                <span className="block text-xs text-muted-foreground">
                  Facts saved for one person are never recalled while talking to someone else.
                </span>
              </span>
              <Switch
                checked={draft.userSpecific}
                disabled={!recalls}
                onCheckedChange={(c) => patch({ userSpecific: c === true })}
                aria-label="Keep each person’s facts private"
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">{dirty ? 'Unsaved changes' : 'Up to date'}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={!dirty || saving} onClick={() => setDraft(saved)}>
                Reset
              </Button>
              <Button size="sm" disabled={!dirty || !onUpdate} loading={saving} onClick={handleSave}>
                Save policy
              </Button>
            </div>
          </div>
        </AgentTabSection>

        {/* Explorer */}
        <AgentTabSection
          title="Saved memories"
          description={
            recalls
              ? 'Facts agents saved or you added. The most recent ones are recalled into every turn.'
              : 'Recall is off for this agent — these facts are stored but not used.'
          }
          icon={<History />}
          actions={
            <>
              <Button variant="outline" size="icon-sm" onClick={() => void refetch()} loading={isRefetching} aria-label="Refresh memories" title="Refresh">
                <RefreshCw className="size-3.5" />
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => setForm({ key: '', value: '', scope: 'agent', editing: false })}>
                <Plus className="size-3.5" />
                Add memory
              </Button>
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search memories"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search memories"
              prefix={<Search className="size-3.5 text-muted-foreground" aria-hidden="true" />}
              inputSize="sm"
              wrapperClassName="w-full sm:w-60"
            />
            <SegmentedControl
              aria-label="Memory scope"
              size="sm"
              value={scopeFilter}
              onChange={setScopeFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'agent', label: 'This agent' },
                { value: 'workspace', label: 'Workspace' },
                { value: 'user', label: 'People' },
              ]}
            />
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              {memories.length} {memories.length === 1 ? 'fact' : 'facts'} · ~{totalTokens.toLocaleString()} tokens
            </span>
          </div>

          {form && (
            <form onSubmit={submitForm} className="grid gap-3 rounded-xl border border-primary/40 bg-surface p-4">
              <div className="text-sm font-medium text-foreground">{form.editing ? 'Edit memory' : 'Add a memory'}</div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Subject</Label>
                <Input
                  value={form.editing ? parseKey(form.key).name : form.key}
                  disabled={form.editing}
                  maxLength={200}
                  placeholder="e.g. Preferred tone"
                  onChange={(e) => setForm({ ...form, key: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">What to remember</Label>
                <Textarea
                  rows={3}
                  value={form.value}
                  maxLength={MAX_VALUE}
                  placeholder="e.g. Writes short, friendly replies and signs off with the team name."
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                />
                <span className="text-right text-[11px] tabular-nums text-muted-foreground">
                  {form.value.length}/{MAX_VALUE}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                {form.editing ? (
                  <span className="text-xs text-muted-foreground">Scope can’t change — add a new memory instead.</span>
                ) : (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Remember for</span>
                    <AppSelect value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })} options={SCOPE_OPTIONS} />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" loading={saveMutation.isPending}>
                    {form.editing ? 'Update' : 'Save memory'}
                  </Button>
                </div>
              </div>
            </form>
          )}

          {isLoading ? (
            <LoadingState label="Loading memories…" />
          ) : isError ? (
            <ErrorState title="Couldn't load memories" description={error?.message} onRetry={() => refetch()} />
          ) : memories.length === 0 ? (
            <EmptyState
              icon={<Brain />}
              title={debouncedSearch || scopeFilter !== 'all' ? 'No memories match' : 'Nothing remembered yet'}
              description={
                debouncedSearch || scopeFilter !== 'all'
                  ? 'Try another search or scope.'
                  : 'Agents save facts here as they work, or you can add one yourself.'
              }
              hideGraphic
            />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {memories.map((mem) => {
                const { scope, owner, name } = parseKey(mem.key);
                const otherAgent = scope === 'agent' && owner && owner !== agent?.id;
                return (
                  <li key={mem.id || mem.key} className="group flex items-start justify-between gap-4 p-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {otherAgent ? 'Another agent' : scope === 'agent' ? 'This agent' : scope === 'user' ? 'Person' : scope}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          {mem.source === 'manual' ? 'Added by you' : 'Saved by agent'}
                        </Badge>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">{mem.value}</p>
                      <div className="text-[11px] text-muted-foreground">
                        Updated {timeAgo(mem.updatedAt || mem.createdAt)} · ~{Math.ceil((mem.value || '').length / 4)} tokens
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Edit ${name}`}
                        title="Edit"
                        onClick={() => setForm({ key: mem.key, value: mem.value, scope, editing: true })}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${name}`}
                        title="Remove"
                        disabled={deleteMutation.isPending}
                        className="hover:text-destructive"
                        onClick={() => confirmDelete(mem)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="text-destructive" loading={forgetMutation.isPending} onClick={confirmForget}>
              Clear this agent’s memories
            </Button>
          </div>
        </AgentTabSection>
      </div>
    </AgentTabPage>
  );
}
