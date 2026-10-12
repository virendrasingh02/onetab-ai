import { agentsApi, ApiError } from '@org/api-client';
import { READ_ONLY_AGENT_TOOLS } from '@org/types';
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
  Textarea,
  toast,
} from '@org/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AppWindow, ArrowRight, Flame, Loader2, Play, Plug, Search, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStudioSession } from '../session-guard.js';

/** These mutations report their own errors, so the app-wide error toast stays quiet. */
const QUIET = { disableToast: true } as const;

type ToolDef = Awaited<ReturnType<typeof agentsApi.listMcpTools>>[number];
type ParamDef = ToolDef['parameters'][string];

const isReadOnly = (name: string) => READ_ONLY_AGENT_TOOLS.includes(name);

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

  const [search, setSearch] = useState('');
  const [selectedName, setSelectedName] = useState<string>('');
  const [values, setValues] = useState<Record<string, string | boolean>>({});

  const toolsQuery = useQuery({
    queryKey: ['studio-tools', workspaceId],
    queryFn: () => agentsApi.listMcpTools(workspaceId),
  });
  const tools = toolsQuery.data ?? [];
  const selected = tools.find((t) => t.name === selectedName) ?? tools[0];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? tools.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)) : tools;
  }, [tools, search]);

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
    <Page width="wide" padding="none" className="space-y-6">
      <PageHeader
        title="Tools & Integrations"
        description="The built-in capabilities agents can call, with a sandbox to try them. Connect apps and your own tool servers from their own pages."
        icon={<Wrench className="size-5" />}
        accent="amber"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/connectors"
          className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/50"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <AppWindow className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">App Connectors</div>
            <p className="text-xs text-muted-foreground">Slack, GitHub, Google and more: connect once, give agents their actions.</p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          to="/mcp"
          className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/50"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Plug className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">MCP Registry</div>
            <p className="text-xs text-muted-foreground">Add your own tools by connecting a Model Context Protocol server.</p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

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
              <Badge variant="outline" className="text-[10px]">
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
                        <Textarea
                          rows={3}
                          value={(values[name] as string) ?? ''}
                          onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
                          placeholder={def.type === 'array' ? '[ ]' : '{ }'}
                          className="font-mono text-xs"
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
                <div className="flex items-center gap-2 text-[11px] font-bold text-foreground">
                  Output
                  <Badge variant={result.success === false ? 'destructive' : 'success'} className="text-[9px]">
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
              <h2 className="text-sm font-bold text-foreground">Built-in tools ({tools.length})</h2>
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => {
                const firecrawl = t.name.startsWith('firecrawl');
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => {
                      setSelectedName(t.name);
                      setValues({});
                      runMutation.reset();
                      document.getElementById('tool-sandbox')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className={`space-y-2 rounded-xl border bg-surface p-4 text-left shadow-2xs transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                      selected?.name === t.name ? 'border-primary' : 'border-border'
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
                      <Badge variant={isReadOnly(t.name) ? 'outline' : 'warning'} className="shrink-0 text-[9px]">
                        {isReadOnly(t.name) ? 'Read' : 'Write'}
                      </Badge>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">{t.description}</p>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="col-span-full py-6 text-center text-xs text-muted-foreground">No tool matches “{search}”.</p>
              )}
            </div>
          </section>
        </>
      )}
    </Page>
  );
}
