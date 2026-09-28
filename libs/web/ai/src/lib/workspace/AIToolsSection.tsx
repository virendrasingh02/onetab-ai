import { agentsApi, aiSecretsApi, mcpApi, queryKeys } from '@org/api-client';
import { READ_ONLY_AGENT_TOOLS, type MCPConnection } from '@org/types';
import {
  Badge,
  Button,
  Card,
  confirm,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Hint,
  Input,
  LoadingState,
  PageSection,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { useWorkspacePermission } from '@org/web-workspace';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Play, Plug, Plus, RefreshCw, Trash2, Wrench } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { errorText, useBuiltinTools, useMcpConnections, useWorkspaceIds } from './use-ai-workspace.js';

/**
 * Everything an agent can act with: the built-in workspace tools, tools from
 * connected MCP servers, and the secrets tools read (a Firecrawl key, …).
 * Agents get a tool by adding a Tool node for it in the builder.
 */
export function AIToolsSection() {
  const { can } = useWorkspacePermission();
  return (
    <div className="space-y-8">
      <BuiltinToolsPanel canRun={can('create')} />
      <McpServersPanel canManage={can('manage_settings')} />
      <SecretsPanel canManage={can('manage_settings')} />
    </div>
  );
}

/* ---------------------------------------------------------- built-ins ---- */

function BuiltinToolsPanel({ canRun }: { canRun: boolean }) {
  const { workspaceId } = useWorkspaceIds();
  const tools = useBuiltinTools(workspaceId);
  const [selected, setSelected] = useState<string>('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<unknown>(undefined);

  const tool = useMemo(() => (tools.data ?? []).find((t) => t.name === selected), [tools.data, selected]);
  const params = Object.entries(tool?.parameters ?? {});

  const run = useMutation({
    mutationFn: () => {
      const input: Record<string, unknown> = {};
      for (const [key, spec] of params) {
        const raw = values[key]?.trim();
        if (!raw) continue;
        input[key] = spec.type === 'number' || spec.type === 'integer' ? Number(raw) : raw;
      }
      return agentsApi.testMcpTool(workspaceId as string, selected, input);
    },
    onSuccess: (output) => setResult(output),
    onError: (err) => {
      setResult(undefined);
      toast.error(`${selected} failed`, { description: errorText(err) });
    },
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    if (!READ_ONLY_AGENT_TOOLS.includes(selected)) {
      const ok = await confirm({
        title: `Run ${selected} for real?`,
        description: 'This tool changes things in the workspace (it is not a dry run), and it runs as you.',
        confirmLabel: 'Run it',
      });
      if (!ok) return;
    }
    run.mutate();
  };

  return (
    <PageSection
      title="Built-in tools"
      description="Workspace actions any agent can be given. Read-only tools run freely under semi autonomy; the rest ask for approval."
    >
      {tools.isLoading ? (
        <LoadingState label="Loading tools…" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="divide-y divide-border p-0">
            {(tools.data ?? []).map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => {
                  setSelected(t.name);
                  setValues({});
                  setResult(undefined);
                }}
                aria-pressed={selected === t.name}
                className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none aria-pressed:bg-primary/5"
              >
                <div className="min-w-0">
                  <span className="font-mono text-xs font-semibold text-foreground">{t.name}</span>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                </div>
                <Badge variant={READ_ONLY_AGENT_TOOLS.includes(t.name) ? 'neutral' : 'warning'} className="shrink-0 text-[10px]">
                  {READ_ONLY_AGENT_TOOLS.includes(t.name) ? 'reads' : 'writes'}
                </Badge>
              </button>
            ))}
          </Card>

          <Card className="p-4">
            {!tool ? (
              <EmptyState
                size="sm"
                icon={<Wrench />}
                title="Pick a tool to try it"
                description="Tools run for real with your permissions — useful to check a connection before giving the tool to an agent."
              />
            ) : (
              <form onSubmit={onSubmit} className="space-y-3">
                <p className="font-mono text-sm font-semibold text-foreground">{tool.name}</p>
                {params.length === 0 ? (
                  <p className="text-xs text-muted-foreground">This tool takes no input.</p>
                ) : (
                  params.map(([key, spec]) => (
                    <Field key={key} label={key} hint={spec.description}>
                      <Input
                        value={values[key] ?? ''}
                        inputMode={spec.type === 'number' || spec.type === 'integer' ? 'numeric' : undefined}
                        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                      />
                    </Field>
                  ))
                )}
                {canRun ? (
                  <Button type="submit" size="sm" leadingIcon={<Play />} loading={run.isPending}>
                    Run
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">Guests can't run tools.</p>
                )}
                {result !== undefined ? (
                  <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-surface-inset p-3 font-mono text-xs text-foreground">
                    {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                  </pre>
                ) : null}
              </form>
            )}
          </Card>
        </div>
      )}
    </PageSection>
  );
}

/* -------------------------------------------------------- MCP servers ---- */

function McpServersPanel({ canManage }: { canManage: boolean }) {
  const { workspaceId } = useWorkspaceIds();
  const queryClient = useQueryClient();
  const connections = useMcpConnections(workspaceId);
  const [open, setOpen] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.mcp.all(workspaceId ?? '') });

  const sync = useMutation({
    mutationFn: (id: string) => mcpApi.syncTools(workspaceId as string, id),
    onSuccess: (conn) => {
      if (conn.status === 'CONNECTED') {
        toast.success(`${conn.name} connected`, {
          description: `${conn.discoveredToolsJson.length} tool(s) available.`,
        });
      } else {
        toast.error(`${conn.name} didn't connect`, { description: conn.lastError ?? undefined });
      }
      void refresh();
    },
    onError: (err) => toast.error('Sync failed', { description: errorText(err) }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => mcpApi.deleteConnection(workspaceId as string, id),
    onSuccess: () => {
      toast.success('MCP server removed');
      void refresh();
    },
    onError: (err) => toast.error('Could not remove it', { description: errorText(err) }),
  });

  return (
    <PageSection
      title="MCP servers"
      description="Connect a Model Context Protocol server (Streamable HTTP). Its tools become available to agents; ones the server doesn't mark read-only ask for approval before running."
      actions={
        canManage ? (
          <Button size="sm" variant="outline" leadingIcon={<Plus />} onClick={() => setOpen(true)}>
            Connect server
          </Button>
        ) : undefined
      }
    >
      {connections.isLoading ? (
        <LoadingState label="Loading MCP servers…" />
      ) : (connections.data ?? []).length === 0 ? (
        <EmptyState
          size="sm"
          icon={<Plug />}
          title="No MCP servers connected"
          description={canManage ? 'Connect one to give agents its tools.' : 'An admin can connect one.'}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(connections.data ?? []).map((conn) => (
            <McpServerCard
              key={conn.id}
              conn={conn}
              canManage={canManage}
              syncing={sync.isPending && sync.variables === conn.id}
              onSync={() => sync.mutate(conn.id)}
              onRemove={async () => {
                const ok = await confirm({
                  title: `Disconnect ${conn.name}?`,
                  description: 'Agents using its tools lose them. You can reconnect later.',
                  destructive: true,
                  confirmLabel: 'Disconnect',
                });
                if (ok) remove.mutate(conn.id);
              }}
            />
          ))}
        </div>
      )}
      <ConnectMcpDialog open={open} onOpenChange={setOpen} workspaceId={workspaceId as string} onDone={refresh} />
    </PageSection>
  );
}

function McpServerCard({
  conn,
  canManage,
  syncing,
  onSync,
  onRemove,
}: {
  conn: MCPConnection;
  canManage: boolean;
  syncing: boolean;
  onSync: () => void;
  onRemove: () => void;
}) {
  const statusVariant = conn.status === 'CONNECTED' ? 'success' : conn.status === 'ERROR' ? 'destructive' : 'neutral';
  const statusLabel =
    conn.status === 'CONNECTED' ? 'Connected' : conn.status === 'ERROR' ? 'Not reachable' : 'Not verified';
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{conn.name}</p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">{conn.serverUrl}</p>
        </div>
        <Badge variant={statusVariant} className="shrink-0 text-[10px]">
          {statusLabel}
        </Badge>
      </div>
      {conn.lastError ? (
        <p role="status" className="rounded-md bg-destructive/5 p-2 text-xs text-destructive">
          {conn.lastError}
        </p>
      ) : null}
      {conn.discoveredToolsJson.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {conn.discoveredToolsJson.map((tool) => (
            <Badge key={tool.name} variant="outline" className="font-mono text-[10px]" title={tool.description}>
              {tool.name}
              {tool.annotations?.readOnlyHint ? '' : ' ·approval'}
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>
          {conn.lastSyncedAt ? `Checked ${formatRelative(conn.lastSyncedAt)}` : 'Never checked'}
          {conn.hasToken ? ` · token ${conn.maskedToken ?? 'set'}` : ''}
        </span>
        {canManage ? (
          <div className="flex gap-1">
            <Button variant="outline" size="sm" leadingIcon={<RefreshCw />} loading={syncing} onClick={onSync}>
              Sync
            </Button>
            <Hint label="Disconnect">
              <Button variant="ghost" size="icon-sm" aria-label={`Disconnect ${conn.name}`} onClick={onRemove}>
                <Trash2 className="size-3.5" />
              </Button>
            </Hint>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function ConnectMcpDialog({
  open,
  onOpenChange,
  workspaceId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const create = useMutation({
    mutationFn: () =>
      mcpApi.createConnection(workspaceId, {
        name: name.trim(),
        serverUrl: url.trim(),
        ...(token.trim() ? { token: token.trim() } : {}),
      }),
    onSuccess: (conn) => {
      if (conn.status === 'CONNECTED') {
        toast.success(`${conn.name} connected`, {
          description: `${conn.discoveredToolsJson.length} tool(s) discovered.`,
        });
      } else {
        toast.warning(`Saved, but ${conn.name} didn't answer`, { description: conn.lastError ?? undefined });
      }
      onDone();
      setName('');
      setUrl('');
      setToken('');
      onOpenChange(false);
    },
    onError: (err) => toast.error('Could not add the server', { description: errorText(err) }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && url.trim()) create.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Connect an MCP server</DialogTitle>
            <DialogDescription>
              We connect right away to list its tools. The token is encrypted and never shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-5 py-4">
            <Field label="Name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Docs search" />
            </Field>
            <Field label="Server URL" required hint="The server's Streamable HTTP endpoint, usually ending in /mcp.">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://mcp.example.com/mcp"
                inputMode="url"
              />
            </Field>
            <Field label="Bearer token" optional>
              <Input value={token} onChange={(e) => setToken(e.target.value)} type="password" autoComplete="off" />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending} disabled={!name.trim() || !url.trim()}>
              Connect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------ secrets ---- */

const KNOWN_SECRETS = [{ key: 'FIRECRAWL_API_KEY', label: 'Firecrawl API key (web search and scraping tools)' }];

function SecretsPanel({ canManage }: { canManage: boolean }) {
  const { workspaceId } = useWorkspaceIds();
  const queryClient = useQueryClient();
  const secrets = useQuery({
    queryKey: queryKeys.aiSecrets.list(workspaceId ?? ''),
    queryFn: () => aiSecretsApi.list(workspaceId as string),
    enabled: Boolean(workspaceId && canManage),
  });
  const [key, setKey] = useState(KNOWN_SECRETS[0]!.key);
  const [value, setValue] = useState('');
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.aiSecrets.all(workspaceId ?? '') });

  const save = useMutation({
    mutationFn: () => aiSecretsApi.create(workspaceId as string, { key, value }),
    onSuccess: () => {
      toast.success(`${key} saved`, { description: 'Stored encrypted; only its last 4 characters are shown.' });
      setValue('');
      void refresh();
    },
    onError: (err) => toast.error('Could not save the secret', { description: errorText(err) }),
  });
  const remove = useMutation({
    mutationFn: (secretKey: string) => aiSecretsApi.delete(workspaceId as string, secretKey),
    onSuccess: () => {
      toast.success('Secret removed');
      void refresh();
    },
    onError: (err) => toast.error('Could not remove it', { description: errorText(err) }),
  });

  if (!canManage) return null;

  return (
    <PageSection title="Secrets" description="Keys tools read at run time. Encrypted at rest; never sent back to the browser.">
      <Card className="space-y-4 p-4">
        {(secrets.data ?? []).length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {(secrets.data ?? []).map((secret) => (
              <li key={secret.key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <KeyRound className="size-4 text-muted-foreground" aria-hidden />
                  <span className="font-mono text-xs text-foreground">{secret.key}</span>
                  <span className="font-mono text-xs text-muted-foreground">{secret.maskedValue}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${secret.key}`}
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Remove ${secret.key}?`,
                      description: 'Tools that need it fall back to the server default or stop working.',
                      destructive: true,
                      confirmLabel: 'Remove',
                    });
                    if (ok) remove.mutate(secret.key);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No secrets stored.</p>
        )}
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) save.mutate();
          }}
        >
          <Field label="Secret">
            <Select value={key} onValueChange={setKey}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KNOWN_SECRETS.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Value">
            <Input value={value} onChange={(e) => setValue(e.target.value)} type="password" autoComplete="off" />
          </Field>
          <Button type="submit" loading={save.isPending} disabled={!value.trim()}>
            Save
          </Button>
        </form>
      </Card>
    </PageSection>
  );
}
