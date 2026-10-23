import { agentsApi, workspaceApi } from '@org/api-client';
import {
  resolveWorkspaceToolPolicy,
  WorkspacePermission,
  type ConnectorSummary,
  type WorkspaceToolMode,
  type WorkspaceToolPolicy,
} from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Page,
  PageHeader,
  toast,
} from '@org/ui';
import { useWorkspacePermission } from '@org/web-workspace';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Info, Search, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useConnectors } from '../services/connectors.js';
import { useStudioSession } from '../session-guard.js';

const MODE_OPTIONS: { value: WorkspaceToolMode; label: string; description: string }[] = [
  { value: 'allow', label: 'Allowed', description: 'Each agent’s own autonomy rules decide' },
  { value: 'approval', label: 'Needs approval', description: 'A person approves every call' },
  { value: 'disabled', label: 'Disabled', description: 'No agent can use it' },
];

const MODE_BADGE: Record<WorkspaceToolMode, 'success' | 'warning' | 'destructive'> = {
  allow: 'success',
  approval: 'warning',
  disabled: 'destructive',
};

const EMPTY: WorkspaceToolPolicy = { connectors: {}, tools: {} };

/** Same policy with one rule set (`allow` removes it, since allowed is the absence of a rule). */
function withRule(policy: WorkspaceToolPolicy, scope: keyof WorkspaceToolPolicy, key: string, mode: WorkspaceToolMode): WorkspaceToolPolicy {
  const next = { ...policy[scope] };
  if (mode === 'allow') delete next[key];
  else next[key] = mode;
  return { ...policy, [scope]: next };
}

function ModeSelect({
  value,
  onChange,
  disabled,
  label,
  inheritLabel,
}: {
  value: WorkspaceToolMode | 'inherit';
  onChange: (mode: WorkspaceToolMode | 'inherit') => void;
  disabled?: boolean;
  label: string;
  inheritLabel?: string;
}) {
  const options = [
    ...(inheritLabel ? [{ value: 'inherit', label: inheritLabel }] : []),
    ...MODE_OPTIONS.map(({ value: v, label: l, description }) => ({ value: v, label: l, description })),
  ];
  return (
    <div className="w-44 shrink-0">
      <AppSelect
        size="sm"
        aria-label={label}
        value={value}
        disabled={disabled}
        options={options}
        onValueChange={(v) => onChange(v as WorkspaceToolMode | 'inherit')}
      />
    </div>
  );
}

export function ToolAccessPage() {
  const { activeWorkspace } = useStudioSession();
  const workspaceId = activeWorkspace.id;
  const queryClient = useQueryClient();
  const { can } = useWorkspacePermission();
  const canEdit = can(WorkspacePermission.MANAGE_POLICIES);

  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<WorkspaceToolPolicy | null>(null);

  const policies = useQuery({
    queryKey: ['workspace-policies', workspaceId],
    queryFn: () => workspaceApi.getPolicies(workspaceId),
  });
  const builtin = useQuery({
    queryKey: ['studio-config', 'builtin-tools', workspaceId],
    queryFn: () => agentsApi.listMcpTools(workspaceId),
    staleTime: 5 * 60_000,
  });
  const connectors = useConnectors();

  const saved = useMemo(() => resolveWorkspaceToolPolicy(policies.data?.toolPolicy ?? EMPTY), [policies.data]);
  const policy = draft ?? saved;
  const dirty = draft !== null && JSON.stringify(resolveWorkspaceToolPolicy(draft)) !== JSON.stringify(saved);
  const ruleCount = Object.keys(policy.connectors).length + Object.keys(policy.tools).length;

  const save = useMutation({
    mutationFn: () => workspaceApi.savePolicies(workspaceId, { toolPolicy: resolveWorkspaceToolPolicy(policy) }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['workspace-policies', workspaceId], updated);
      setDraft(null);
      toast.success('Tool access saved', { description: 'Applies to every agent’s next run.' });
    },
    onError: (err: unknown) => {
      toast.error('Could not save tool access', { description: err instanceof Error ? err.message : undefined });
    },
  });

  const needle = search.trim().toLowerCase();
  const apps = useMemo(
    () =>
      (connectors.data ?? [])
        .filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.provider.toLowerCase().includes(needle))
        .sort((a, b) => Number(b.status === 'connected') - Number(a.status === 'connected') || a.name.localeCompare(b.name)),
    [connectors.data, needle],
  );
  const builtinTools = useMemo(
    () => (builtin.data ?? []).filter((t) => !needle || t.name.toLowerCase().includes(needle)),
    [builtin.data, needle],
  );

  const setApp = (provider: string, mode: WorkspaceToolMode) => setDraft(withRule(policy, 'connectors', provider, mode));
  const setTool = (toolName: string, mode: WorkspaceToolMode | 'inherit') =>
    setDraft(withRule(policy, 'tools', toolName, mode === 'inherit' ? 'allow' : mode));
  const toggle = (provider: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(provider)) next.add(provider);
      return next;
    });

  if (policies.isLoading || builtin.isLoading || connectors.isLoading) return <LoadingState label="Loading tool access…" />;
  if (policies.isError || builtin.isError || connectors.isError) {
    return (
      <Page className="space-y-6">
        <ErrorState
          title="Couldn’t load tool access"
          description="The platform didn’t answer. Try again in a moment."
          onRetry={() => {
            void policies.refetch();
            void builtin.refetch();
            void connectors.refetch();
          }}
        />
      </Page>
    );
  }

  const appMode = (c: ConnectorSummary): WorkspaceToolMode => policy.connectors[c.provider] ?? 'allow';

  const connectedCount = (connectors.data ?? []).filter((c) => c.status === 'connected').length;
  const restrictedApps = (connectors.data ?? []).filter((c) => appMode(c) !== 'allow').length;

  return (
    <Page className="space-y-6">
      <PageHeader
        title="Tool access"
        description="Decide which tools and connected apps agents may use in this workspace. These rules sit over every agent’s own settings and apply on its next run."
        icon={<ShieldCheck className="size-5" />}
        accent="amber"
        actions={
          canEdit ? (
            <div className="flex items-center gap-2">
              {dirty ? (
                <Button variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={save.isPending}>
                  Discard
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="primary"
                onClick={() => save.mutate()}
                disabled={!dirty}
                loading={save.isPending}
                className="text-xs font-semibold"
              >
                Save changes
              </Button>
            </div>
          ) : null
        }
      />

      {!canEdit ? (
        <p role="status" className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-muted-foreground">
          Only workspace admins can change these rules. You can see what is currently set.
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Connected apps', value: `${connectedCount}/${connectors.data?.length ?? 0}` },
          { label: 'Built-in tools', value: builtin.data?.length ?? 0 },
          { label: 'Active rules', value: ruleCount },
        ].map((s) => (
          <Card key={s.label} className="p-3 shadow-2xs">
            <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-foreground">{s.value}</div>
          </Card>
        ))}
      </div>

      <Card className="flex items-start gap-2.5 p-3 shadow-2xs">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          <strong className="font-semibold text-foreground">Needs approval</strong> applies to what an agent decides to call.
          A step you place on a canvas yourself runs unless it is <strong className="font-semibold text-foreground">Disabled</strong>;
          use an approval step on the canvas to gate it.{' '}
          {ruleCount === 0
            ? 'No rules are set, so every agent’s own settings decide.'
            : `${ruleCount} rule${ruleCount === 1 ? '' : 's'} set${restrictedApps ? `, ${restrictedApps} app${restrictedApps === 1 ? '' : 's'} restricted` : ''}.`}
        </p>
      </Card>

      <Input
        prefix={<Search className="size-4" />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search apps and tools"
        aria-label="Search apps and tools"
        className="max-w-sm"
      />

      <section className="space-y-3" aria-labelledby="tool-access-apps">
        <h2 id="tool-access-apps" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Apps ({apps.length})
        </h2>
        {apps.length === 0 ? (
          <EmptyState title="No apps match" description="Try a different search." />
        ) : (
          <Card className="overflow-hidden p-0 shadow-2xs">
            <ul className="divide-y divide-border">
              {apps.map((c) => {
                const expanded = open.has(c.provider);
                const overrides = c.capabilities.filter((cap) => policy.tools[cap.toolName]).length;
                const connected = c.status === 'connected';
                return (
                  <li key={c.provider}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggle(c.provider)}
                        aria-expanded={expanded}
                        aria-label={`${expanded ? 'Hide' : 'Show'} ${c.name} tools`}
                        className="rounded-md p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-xs font-bold text-foreground">{c.name}</p>
                          <Badge variant={connected ? 'success' : 'neutral'} className="text-2xs">
                            {connected ? 'Connected' : 'Not connected'}
                          </Badge>
                          {appMode(c) !== 'allow' ? (
                            <Badge variant={MODE_BADGE[appMode(c)]} className="text-2xs">
                              {MODE_OPTIONS.find((m) => m.value === appMode(c))?.label}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {c.capabilities.length} action{c.capabilities.length === 1 ? '' : 's'}
                          {overrides ? ` · ${overrides} tool rule${overrides === 1 ? '' : 's'}` : ''}
                        </p>
                      </div>
                      <ModeSelect
                        label={`${c.name} access`}
                        value={appMode(c)}
                        disabled={!canEdit}
                        onChange={(mode) => setApp(c.provider, mode === 'inherit' ? 'allow' : mode)}
                      />
                    </div>
                    {expanded ? (
                      <ul className="space-y-1.5 border-t border-border bg-surface-raised px-4 py-2.5 pl-11">
                        {c.capabilities.map((cap) => (
                          <li key={cap.id} className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-foreground">{cap.label}</p>
                              <p className="truncate font-mono text-2xs text-muted-foreground">
                                {cap.toolName} · {cap.permissionLevel}
                              </p>
                            </div>
                            <ModeSelect
                              label={`${cap.label} access`}
                              value={policy.tools[cap.toolName] ?? 'inherit'}
                              disabled={!canEdit}
                              inheritLabel={`Same as app (${MODE_OPTIONS.find((m) => m.value === appMode(c))?.label})`}
                              onChange={(mode) => setTool(cap.toolName, mode)}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="tool-access-builtin">
        <h2 id="tool-access-builtin" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Built-in tools ({builtinTools.length})
        </h2>
        {builtinTools.length === 0 ? (
          <EmptyState title="No tools match" description="Try a different search." />
        ) : (
          <Card className="overflow-hidden p-0 shadow-2xs">
            <ul className="divide-y divide-border">
              {builtinTools.map((tool) => (
                <li key={tool.name} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-bold text-foreground">{tool.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{tool.description}</p>
                  </div>
                  <ModeSelect
                    label={`${tool.name} access`}
                    value={policy.tools[tool.name] ?? 'allow'}
                    disabled={!canEdit}
                    onChange={(mode) => setTool(tool.name, mode)}
                  />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </Page>
  );
}
