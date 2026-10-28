import { agentsApi, ApiError, mcpApi } from '@org/api-client';
import { mcpToolFunctionName, READ_ONLY_AGENT_TOOLS } from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  Checkbox,
  CodeBlock,
  confirm,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Page,
  PageHeader,
  CodeInput,
  toast,
} from '@org/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AppWindow, ArrowRight, Braces, Flame, Loader2, Play, Plug, Plus, Search, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from '../router.js';
import { useConnectors } from '../services/connectors.js';
import { useStudioSession } from '../session-guard.js';

/** These mutations report their own errors, so the app-wide error toast stays quiet. */
const QUIET = { disableToast: true } as const;

type ToolDef = Awaited<ReturnType<typeof agentsApi.listMcpTools>>[number];
type ParamDef = ToolDef['parameters'][string];

const isReadOnly = (name: string) => READ_ONLY_AGENT_TOOLS.includes(name);

type ToolSource = 'builtin' | 'app' | 'custom' | 'mcp';

/** One row of the catalog, whichever real source it came from. */
interface CatalogTool {
  key: string;
  name: string;
  description: string;
  source: ToolSource;
  readOnly: boolean;
  /** Where it is managed; built-in tools have none and open the sandbox instead. */
  href?: string;
  origin?: string;
}

const SOURCE_LABEL: Record<ToolSource, string> = {
  builtin: 'Built-in',
  app: 'Apps',
  custom: 'Custom API',
  mcp: 'MCP servers',
};

const ADD_OPTIONS = [
  {
    to: '/connectors/new',
    icon: Braces,
    title: 'Custom API tool',
    description: 'Point at any REST API, name the actions, and agents can call them. Test each one before saving.',
  },
  {
    to: '/mcp',
    icon: Plug,
    title: 'MCP server',
    description: 'Connect a Model Context Protocol server. Its tools are discovered automatically and kept in sync.',
  },
  {
    to: '/connectors',
    icon: AppWindow,
    title: 'App connector',
    description: 'Slack, GitHub, Google and more: connect once, and every action becomes a tool.',
  },
] as const;

/** The form value for a parameter as the API expects it; throws a readable error when it can't be. */
function coerce(name: string, def: ParamDef, raw: string | boolean | undefined): unknown {
  if (def.type === 'boolean') return raw === true;
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (text === '') return undefined;
  if (def.type === 'number' || def.type === 'integer') {
    const n = Number(text);
    if (!Number.isFinite(n)) throw new Error(`“${name}” must be a number.`);
    return n;
  }
  if (def.type === 'object' || def.type === 'array') {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`“${name}” must be valid JSON.`);
    }
  }
  return text;
}

const errorText = (err: unknown): string =>
  err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong.';

export function ToolsPage() {
  const { activeWorkspace } = useStudioSession();
  const workspaceId = activeWorkspace.id;

  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<ToolSource | 'all'>('all');
  const [selectedName, setSelectedName] = useState<string>('');
  const [values, setValues] = useState<Record<string, string | boolean>>({});

  const toolsQuery = useQuery({
    queryKey: ['studio-tools', workspaceId],
    queryFn: () => agentsApi.listMcpTools(workspaceId),
  });
  const connectorsQuery = useConnectors();
  const mcpQuery = useQuery({
    queryKey: ['studio-tools', 'mcp-connections', workspaceId],
    queryFn: () => mcpApi.listConnections(workspaceId),
  });
  const tools = toolsQuery.data ?? [];
  const selected = tools.find((t) => t.name === selectedName) ?? tools[0];

  // Everything an agent can call in this workspace, from the real APIs: the
  // built-ins, connected apps, the workspace's own API connectors, and MCP servers.
  const catalog = useMemo<CatalogTool[]>(() => {
    const items: CatalogTool[] = tools.map((t) => ({
      key: `builtin:${t.name}`,
      name: t.name,
      description: t.description,
      source: 'builtin',
      readOnly: isReadOnly(t.name),
    }));
    for (const c of connectorsQuery.data ?? []) {
      if (!c.custom && c.status !== 'connected') continue;
      for (const cap of c.capabilities) {
        items.push({
          key: `${c.custom ? 'custom' : 'app'}:${cap.toolName}`,
          name: cap.toolName,
          description: cap.description || cap.label,
          source: c.custom ? 'custom' : 'app',
          readOnly: cap.permissionLevel === 'read',
          href: c.custom ? `/connectors/${c.slug}/edit` : `/connectors/${c.slug}`,
          origin: c.name,
        });
      }
    }
    for (const conn of mcpQuery.data ?? []) {
      if (conn.status !== 'CONNECTED' || !conn.isEnabled) continue;
      for (const t of conn.discoveredToolsJson) {
        items.push({
          key: `mcp:${conn.id}:${t.name}`,
          name: mcpToolFunctionName(conn.id, t.name),
          description: t.description ?? t.name,
          source: 'mcp',
          readOnly: t.annotations?.readOnlyHint === true,
          href: '/mcp',
          origin: conn.name,
        });
      }
    }
    return items;
  }, [tools, connectorsQuery.data, mcpQuery.data]);

  const counts = useMemo(() => {
    const out: Record<ToolSource | 'all', number> = { all: catalog.length, builtin: 0, app: 0, custom: 0, mcp: 0 };
    for (const t of catalog) out[t.source] += 1;
    return out;
  }, [catalog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter(
      (t) =>
        (source === 'all' || t.source === source) &&
        (!q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.origin?.toLowerCase().includes(q)),
    );
  }, [catalog, search, source]);

  const runMutation = useMutation({
    meta: QUIET,
    mutationFn: async () => {
      if (!selected) throw new Error('Pick a tool first.');
      const params: Record<string, unknown> = {};
      for (const [name, def] of Object.entries(selected.parameters ?? {})) {
        const value = coerce(name, def, values[name]);
        if (value !== undefined) params[name] = value;
      }
      if (!isReadOnly(selected.name)) {
        const ok = await confirm({
          title: `Run “${selected.name}” for real?`,
          description: 'This tool can change data or send messages in your workspace. The sandbox runs it exactly as an agent would.',
          confirmLabel: 'Run tool',
        });
        if (!ok) throw new Error('cancelled');
      }
      return agentsApi.testMcpTool(workspaceId, selected.name, params);
    },
    onError: (err) => {
      if ((err as Error).message !== 'cancelled') toast.error('Tool failed', { description: errorText(err) });
    },
  });

  const result = runMutation.data;

  return (
    <Page className="space-y-6">
      <PageHeader
        title="Tools & Integrations"
        description="Everything agents can call in this workspace: built-in tools, connected apps, your own APIs and MCP servers. Try the built-in ones in the sandbox."
        icon={<Wrench className="size-5" />}
        accent="amber"
      />

      <section className="space-y-3" aria-labelledby="add-tool">
        <div className="flex items-center gap-2">
          <Plus className="size-4 text-muted-foreground" />
          <h2 id="add-tool" className="text-sm font-bold text-foreground">
            Add a tool
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {ADD_OPTIONS.map(({ to, icon: Icon, title, description }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">{title}</div>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Built-in tools ship with the platform. Anything you add here appears in the catalog below and can be given to an agent
          from its Tools slot;{' '}
          <Link to="/tool-access" className="underline underline-offset-2 hover:text-foreground">
            Tool access
          </Link>{' '}
          decides who may use it.
        </p>
      </section>

      {toolsQuery.isLoading ? (
        <LoadingState label="Loading tools…" />
      ) : toolsQuery.isError ? (
        <ErrorState
          title="Couldn’t load tools"
          description={errorText(toolsQuery.error)}
          onRetry={() => void toolsQuery.refetch()}
        />
      ) : tools.length === 0 ? (
        <EmptyState icon={<Wrench />} title="No tools available" description="The platform didn’t report any built-in tools for this workspace." />
      ) : (
        <>
          {/* Sandbox */}
          <section className="space-y-4 rounded-xl border bg-surface p-5 shadow-xs" aria-labelledby="tool-sandbox">
            <div className="flex items-center justify-between">
              <h2 id="tool-sandbox" className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Flame className="size-4 text-warning" /> Tool sandbox
              </h2>
              <Badge variant="outline" className="text-2xs">
                Runs for real
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Tool">
                <AppSelect
                  searchable
                  value={selected?.name}
                  onValueChange={(name) => {
                    setSelectedName(name);
                    setValues({});
                    runMutation.reset();
                  }}
                  options={tools.map((t) => ({
                    value: t.name,
                    label: t.name,
                    description: isReadOnly(t.name) ? 'Read-only' : 'Can change data',
                  }))}
                />
              </Field>

              <div className="space-y-3 md:col-span-2">
                {selected && Object.keys(selected.parameters ?? {}).length === 0 ? (
                  <p className="pt-6 text-xs text-muted-foreground">This tool takes no parameters.</p>
                ) : (
                  Object.entries(selected?.parameters ?? {}).map(([name, def]) => (
                    <Field key={`${selected?.name}-${name}`} label={name} hint={def.description}>
                      {def.type === 'boolean' ? (
                        <Checkbox
                          checked={values[name] === true}
                          onCheckedChange={(c) => setValues((v) => ({ ...v, [name]: c === true }))}
                        />
                      ) : def.type === 'object' || def.type === 'array' ? (
                        <CodeInput
                          language="json"
                          showHeader={false}
                          minRows={3}
                          maxRows={10}
                          value={(values[name] as string) ?? ''}
                          onChange={(text) => setValues((v) => ({ ...v, [name]: text }))}
                          placeholder={def.type === 'array' ? '[ ]' : '{ }'}
                        />
                      ) : (
                        <Input
                          type={def.type === 'number' || def.type === 'integer' ? 'number' : 'text'}
                          value={(values[name] as string) ?? ''}
                          onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
                          className="font-mono text-xs"
                        />
                      )}
                    </Field>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending || !selected} className="gap-1.5">
                {runMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5 fill-current" />}
                {runMutation.isPending ? 'Running…' : 'Run tool'}
              </Button>
              {result ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(JSON.stringify(result, null, 2));
                    toast.success('Output copied');
                  }}
                >
                  Copy output
                </Button>
              ) : null}
            </div>

            {result ? (
              <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  Output
                  <Badge variant={result.success === false ? 'destructive' : 'success'} className="text-2xs">
                    {result.success === false ? 'Failed' : 'Succeeded'}
                  </Badge>
                </div>
                <CodeBlock variant="compact" language="json" code={JSON.stringify(result, null, 2)} />
              </div>
            ) : null}
          </section>

          {/* Catalog */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-foreground">All tools ({counts.all})</h2>
              <Input
                type="search"
                leadingIcon={<Search className="size-3.5" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter tools…"
                aria-label="Filter tools"
                wrapperClassName="w-60"
                className="text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by source">
              {(['all', 'builtin', 'app', 'custom', 'mcp'] as const).map((id) => (
                <Button
                  key={id}
                  size="sm"
                  variant={source === id ? 'primary' : 'outline'}
                  onClick={() => setSource(id)}
                  className="h-7 text-xs"
                >
                  {id === 'all' ? 'All' : SOURCE_LABEL[id]} ({counts[id]})
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => {
                const firecrawl = t.name.startsWith('firecrawl');
                const builtin = t.source === 'builtin';
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      if (!builtin) {
                        if (t.href) navigate(t.href);
                        return;
                      }
                      setSelectedName(t.name);
                      setValues({});
                      runMutation.reset();
                      document.getElementById('tool-sandbox')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className={`space-y-2 rounded-xl border bg-surface p-4 text-left shadow-2xs transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                      builtin && selected?.name === t.name ? 'border-foreground/40' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
                            firecrawl ? 'bg-warning/15 text-warning' : 'bg-primary/10 text-primary'
                          }`}
                        >
                          {firecrawl ? <Flame className="size-3.5" /> : <Wrench className="size-3.5" />}
                        </span>
                        <span className="truncate font-mono text-xs font-bold text-foreground">{t.name}</span>
                      </span>
                      <Badge variant={t.readOnly ? 'outline' : 'warning'} className="shrink-0 text-2xs">
                        {t.readOnly ? 'Read' : 'Write'}
                      </Badge>
                    </div>
                    <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
                    {!builtin ? (
                      <p className="text-2xs font-medium text-muted-foreground">
                        {SOURCE_LABEL[t.source]} · {t.origin}
                      </p>
                    ) : null}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="col-span-full py-6 text-center text-xs text-muted-foreground">
                  {search ? `No tool matches “${search}”.` : 'Nothing here yet. Add one above.'}
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </Page>
  );
}
