import { agentsApi, mcpApi } from '@org/api-client';
import type { MCPConnection } from '@org/types';
import {
  Badge,
  confirm,
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  LoadingState,
  toast,
  ErrorState,
  Label,
  Switch,
  Textarea,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  Copy,
  KeyRound,
  LogIn,
  LogOut,
  Pencil,
  Play,
  Plug,
  Plus,
  RefreshCw,
  Server,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStudioSession } from '../session-guard.js';
import { SectionHeader } from '../components/section-tabs.js';

const STATUS_BADGE = {
  CONNECTED: { variant: 'success', label: 'Connected' },
  ERROR: { variant: 'destructive', label: 'Error' },
  DISCONNECTED: { variant: 'warning', label: 'Disconnected' },
  NEEDS_AUTH: { variant: 'warning', label: 'Sign-in required' },
} as const;

/**
 * Opens the MCP server's sign-in page in a popup. The popup is opened before
 * the API call so the browser treats it as part of the click.
 */
async function openOAuthPopup(workspaceId: string, conn: MCPConnection) {
  const popup = window.open(
    'about:blank',
    `mcp-oauth-${conn.id}`,
    'popup,width=560,height=720',
  );
  try {
    const { authorizeUrl } = await mcpApi.startOAuth(workspaceId, conn.id);
    if (popup && !popup.closed) popup.location.href = authorizeUrl;
    else window.location.assign(authorizeUrl);
  } catch (err) {
    popup?.close();
    toast.error(`Could not start sign-in for ${conn.name}`, {
      description: (err as Error)?.message,
    });
  }
}

interface ChipTool {
  name: string;
  description?: string;
  annotations?: { destructiveHint?: boolean; readOnlyHint?: boolean };
}

/** A tool picked for a manual run: built-in, or on one external server. */
interface ToolUnderTest {
  name: string;
  description?: string;
  /** Pre-filled JSON arguments, built from the tool's parameter schema. */
  argsTemplate: string;
  destructive: boolean;
  connection?: { id: string; name: string };
}

type ParamSpec = { type?: string };

function argsTemplate(properties: Record<string, ParamSpec> | undefined) {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(properties ?? {})) {
    const type = Array.isArray(spec?.type) ? spec.type[0] : spec?.type;
    out[key] =
      type === 'number' || type === 'integer'
        ? 0
        : type === 'boolean'
          ? false
          : type === 'array'
            ? []
            : type === 'object'
              ? {}
              : '';
  }
  return JSON.stringify(out, null, 2);
}

function ToolChips({
  tools,
  onSelect,
}: {
  tools: ChipTool[];
  onSelect?: (tool: ChipTool) => void;
}) {
  return (
    <div className="gap-1 flex flex-wrap">
      {tools.map((t) => (
        <button
          key={t.name}
          type="button"
          title={
            onSelect
              ? `${t.description ?? t.name} — click to run`
              : t.description
          }
          disabled={!onSelect}
          onClick={() => onSelect?.(t)}
          className={cn(
            'px-1.5 py-0.5 rounded-md border bg-surface-raised font-mono text-2xs text-foreground',
            onSelect &&
              'cursor-pointer transition-colors hover:border-primary/60 hover:bg-primary/10',
            t.annotations?.destructiveHint
              ? 'border-destructive/40'
              : 'border-border',
          )}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}

function ToolTestDialog({
  tool,
  workspaceId,
  onClose,
}: {
  tool: ToolUnderTest | null;
  workspaceId: string;
  onClose: () => void;
}) {
  const [args, setArgs] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; body: string } | null>(
    null,
  );
  const [lastTool, setLastTool] = useState<ToolUnderTest | null>(null);
  if (tool !== lastTool) {
    setLastTool(tool);
    setArgs(tool?.argsTemplate ?? '');
    setParseError(null);
    setResult(null);
  }

  const run = useMutation({
    mutationFn: async (params: Record<string, unknown>) => {
      if (!tool) throw new Error('No tool selected');
      if (tool.connection) {
        const r = await mcpApi.testTool(
          workspaceId,
          tool.connection.id,
          tool.name,
          params,
        );
        return {
          ok: !r.isError,
          body: r.text || JSON.stringify(r.content, null, 2),
        };
      }
      const r = await agentsApi.testMcpTool(workspaceId, tool.name, params);
      return {
        ok: true,
        body: typeof r === 'string' ? r : JSON.stringify(r, null, 2),
      };
    },
    onSuccess: setResult,
    onError: (err: Error) =>
      setResult({ ok: false, body: err?.message ?? 'The tool failed.' }),
  });

  const submit = async () => {
    let params: Record<string, unknown>;
    try {
      const parsed = args.trim() ? JSON.parse(args) : {};
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Arguments must be a JSON object.');
      }
      params = parsed;
    } catch (err) {
      setParseError((err as Error).message);
      return;
    }
    setParseError(null);
    if (tool?.destructive) {
      const ok = await confirm({
        title: `Run ${tool.name}?`,
        description:
          'This tool may change data on the server. It runs for real, not as a dry run.',
        confirmLabel: 'Run tool',
        destructive: true,
      });
      if (!ok) return;
    }
    setResult(null);
    run.mutate(params);
  };

  return (
    <Dialog open={!!tool} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold font-mono">
            {tool?.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {tool?.connection
              ? `On ${tool.connection.name}. `
              : 'Built-in tool. '}
            {tool?.description}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3 text-xs">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground">
              Arguments (JSON)
            </Label>
            <Textarea
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              rows={6}
              spellCheck={false}
              className="text-xs font-mono"
            />
            {parseError && (
              <p className="text-2xs text-destructive">{parseError}</p>
            )}
          </div>
          {result && (
            <div className="space-y-1">
              <div
                className={cn(
                  'font-semibold text-2xs uppercase',
                  result.ok ? 'text-success' : 'text-destructive',
                )}
              >
                {result.ok ? 'Result' : 'Error'}
              </div>
              <pre className="max-h-64 p-2 overflow-auto rounded-md border border-border bg-surface-raised font-mono text-2xs break-words whitespace-pre-wrap text-foreground">
                {result.body || '(empty response)'}
              </pre>
            </div>
          )}
        </DialogBody>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={run.isPending}
            onClick={() => void submit()}
            className="gap-1.5"
          >
            <Play className="size-3.5" /> Run tool
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function McpPage() {
  const { activeWorkspace } = useStudioSession();
  const queryClient = useQueryClient();
  const workspaceId = activeWorkspace.id;
  const connectionsKey = ['mcp-connections', workspaceId];

  const [isAddOpen, setIsAddOpen] = useState(false);
  /** The server being edited; null while the dialog adds a new one. */
  const [editing, setEditing] = useState<MCPConnection | null>(null);
  const [serverName, setServerName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [token, setToken] = useState('');
  const [clearToken, setClearToken] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showOAuthClient, setShowOAuthClient] = useState(false);
  const [showBuiltIn, setShowBuiltIn] = useState(false);
  const [toolUnderTest, setToolUnderTest] = useState<ToolUnderTest | null>(
    null,
  );

  const {
    data: connections = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: connectionsKey,
    queryFn: () => mcpApi.listConnections(workspaceId),
  });

  const builtIn = useQuery({
    queryKey: ['mcp-builtin-tools', workspaceId],
    queryFn: () => agentsApi.listMcpTools(workspaceId),
  });
  const builtInTools = builtIn.data ?? [];

  // The sign-in popup reports back from the API's callback page.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        { type?: string; ok?: boolean; message?: string } | undefined;
      if (data?.type !== 'MCP_OAUTH_RESULT') return;
      void queryClient.invalidateQueries({
        queryKey: ['mcp-connections', workspaceId],
      });
      if (data.ok) toast.success('Signed in', { description: data.message });
      else toast.error('Sign-in failed', { description: data.message });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [queryClient, workspaceId]);

  const resetForm = () => {
    setEditing(null);
    setServerName('');
    setServerUrl('');
    setToken('');
    setClearToken(false);
    setClientId('');
    setClientSecret('');
    setShowOAuthClient(false);
  };

  const openEdit = (conn: MCPConnection) => {
    setEditing(conn);
    setServerName(conn.name);
    setServerUrl(conn.serverUrl);
    setToken('');
    setClearToken(false);
    setClientId(
      conn.oauthClientSource === 'MANUAL' ? (conn.oauthClientId ?? '') : '',
    );
    setClientSecret('');
    setShowOAuthClient(conn.oauthClientSource === 'MANUAL');
    setIsAddOpen(true);
  };

  // The API always returns the saved row: a failed handshake is status ERROR, not an HTTP error.
  const reportHandshake = (conn: MCPConnection, verb: string) => {
    if (conn.status === 'CONNECTED') {
      toast.success(`${conn.name} ${verb}`, {
        description: `${conn.discoveredToolsJson.length} tools discovered`,
      });
    } else if (conn.status === 'NEEDS_AUTH') {
      toast.warning(`${conn.name} needs you to sign in`, {
        description: conn.lastError ?? 'The server requires OAuth sign-in.',
        action: {
          label: 'Sign in',
          onClick: () => void openOAuthPopup(workspaceId, conn),
        },
      });
    } else {
      toast.error(`${conn.name} could not be reached`, {
        description:
          conn.lastError ?? 'The server did not complete the MCP handshake.',
      });
    }
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!editing) {
        return mcpApi.createConnection(workspaceId, {
          name: serverName.trim(),
          serverUrl: serverUrl.trim(),
          transport: 'HTTP',
          ...(token.trim() ? { token: token.trim() } : {}),
          ...(clientId.trim() ? { oauthClientId: clientId.trim() } : {}),
          ...(clientId.trim() && clientSecret.trim()
            ? { oauthClientSecret: clientSecret.trim() }
            : {}),
        });
      }
      const savedClientId =
        editing.oauthClientSource === 'MANUAL'
          ? (editing.oauthClientId ?? '')
          : '';
      const clientChanged = clientId.trim() !== savedClientId;
      return mcpApi.updateConnection(workspaceId, editing.id, {
        name: serverName.trim(),
        serverUrl: serverUrl.trim(),
        // '' removes a manual client; untouched fields keep what is stored.
        ...(clientChanged ? { oauthClientId: clientId.trim() } : {}),
        ...(clientSecret.trim()
          ? { oauthClientSecret: clientSecret.trim() }
          : {}),
        // Blank keeps the stored token; '' only when asked to remove it.
        ...(token.trim()
          ? { token: token.trim() }
          : clearToken
            ? { token: '' }
            : {}),
      });
    },
    onSuccess: (conn) => {
      void queryClient.invalidateQueries({ queryKey: connectionsKey });
      const wasEditing = !!editing;
      const reconnected =
        !editing ||
        conn.serverUrl !== editing.serverUrl ||
        !!token.trim() ||
        clearToken ||
        !!clientSecret.trim() ||
        clientId.trim() !==
          (editing.oauthClientSource === 'MANUAL'
            ? (editing.oauthClientId ?? '')
            : '');
      setIsAddOpen(false);
      resetForm();
      if (!wasEditing) reportHandshake(conn, 'connected');
      else if (reconnected) reportHandshake(conn, 'reconnected');
      else toast.success(`${conn.name} saved`);
    },
    onError: (err: Error) => {
      toast.error(
        editing ? 'Could not save MCP server' : 'Could not connect MCP server',
        { description: err?.message },
      );
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      mcpApi.updateConnection(workspaceId, id, { isEnabled }),
    onSuccess: (conn) => {
      void queryClient.invalidateQueries({ queryKey: connectionsKey });
      if (!conn.isEnabled) {
        toast.success(`${conn.name} disabled`, {
          description: 'Agents can no longer call its tools.',
        });
      } else {
        reportHandshake(conn, 'enabled');
      }
    },
    onError: (err: Error) => {
      toast.error('Could not update MCP server', { description: err?.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mcpApi.deleteConnection(workspaceId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: connectionsKey });
      toast.success('MCP server removed');
    },
    onError: (err: Error) => {
      toast.error('Could not remove MCP server', { description: err?.message });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => mcpApi.syncTools(workspaceId, id),
    onSuccess: (conn) => {
      void queryClient.invalidateQueries({ queryKey: connectionsKey });
      reportHandshake(conn, 'synced');
    },
    onError: (err: Error) => {
      toast.error('Could not sync tools from this server', {
        description: err?.message,
      });
    },
  });

  const signOutMutation = useMutation({
    mutationFn: (id: string) => mcpApi.signOutOAuth(workspaceId, id),
    onSuccess: (conn) => {
      void queryClient.invalidateQueries({ queryKey: connectionsKey });
      toast.success(`Signed out of ${conn.name}`);
    },
    onError: (err: Error) => {
      toast.error('Could not sign out', { description: err?.message });
    },
  });

  // Only enabled, connected servers' tools reach agents (MCPService.getToolBindings).
  const isLive = (c: MCPConnection) => c.isEnabled && c.status === 'CONNECTED';
  const connectedCount = connections.filter(isLive).length;
  const externalToolCount = connections.reduce(
    (n, c) => n + (isLive(c) ? c.discoveredToolsJson.length : 0),
    0,
  );
  // The API reports its own callback URL on every connection.
  const redirectUri =
    editing?.oauthRedirectUri ?? connections[0]?.oauthRedirectUri ?? null;
  const syncingId = syncMutation.isPending ? syncMutation.variables : null;
  const removingId = deleteMutation.isPending ? deleteMutation.variables : null;
  const togglingId = toggleMutation.isPending
    ? toggleMutation.variables?.id
    : null;

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <SectionHeader
        section="tools"
        actions={
          <div className="gap-2 flex items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetch();
                void builtIn.refetch();
              }}
              loading={isRefetching}
              className="gap-1.5 text-xs"
            >
              <RefreshCw
                className={cn('size-3.5', isRefetching && 'animate-spin')}
              />{' '}
              Refresh
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsAddOpen(true)}
              className="gap-1.5 text-xs font-semibold"
            >
              <Plus className="size-4" /> Connect MCP Server
            </Button>
          </div>
        }
      />
      <div className="p-4 sm:p-6 space-y-6 flex-1">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Connect any remote MCP server over Streamable HTTP to give your agents
          more tools and data. Servers that use OAuth ask you to sign in once;
          tokens refresh automatically.
        </p>

        {/* Summary */}
        <div className="gap-3 grid grid-cols-3">
          {[
            {
              label: 'Built-in tools',
              value: builtIn.isLoading ? '…' : builtInTools.length,
            },
            {
              label: 'External servers',
              value: isLoading
                ? '…'
                : `${connectedCount}/${connections.length} connected`,
            },
            {
              label: 'External tools',
              value: isLoading ? '…' : externalToolCount,
            },
          ].map((s) => (
            <Card key={s.label} className="p-3 shadow-2xs">
              <div className="font-semibold tracking-wider text-2xs text-muted-foreground uppercase">
                {s.label}
              </div>
              <div className="mt-1 text-lg font-bold text-foreground tabular-nums">
                {s.value}
              </div>
            </Card>
          ))}
        </div>

        {/* Built-in MCP server — status comes from the tool registry itself */}
        <Card className="p-4 shadow-2xs space-y-3 border-border-strong">
          <div className="gap-3 flex items-center justify-between">
            <div className="gap-2.5 flex items-center">
              <div className="size-8 flex shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Server className="size-4" />
              </div>
              <div>
                <div className="gap-2 flex items-center">
                  <span className="text-xs font-bold text-foreground">
                    Onetab Platform Built-in MCP Server
                  </span>
                  {builtIn.isError ? (
                    <Badge variant="destructive" className="text-2xs">
                      Unavailable
                    </Badge>
                  ) : builtIn.isLoading ? (
                    <Badge variant="neutral" className="text-2xs">
                      Checking…
                    </Badge>
                  ) : (
                    <Badge variant="success" className="text-2xs">
                      {builtInTools.length} tools
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  In-process server supplying document search, task management,
                  Matrix chat posts, and memory.
                </p>
              </div>
            </div>
            <div className="gap-3 flex items-center">
              <span className="sm:inline hidden font-mono text-2xs text-muted-foreground">
                Transport: in-process
              </span>
              {builtInTools.length > 0 && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setShowBuiltIn((v) => !v)}
                  className="gap-1 text-xs text-muted-foreground"
                >
                  Tools
                  <ChevronDown
                    className={cn(
                      'size-3 transition-transform',
                      showBuiltIn && 'rotate-180',
                    )}
                  />
                </Button>
              )}
            </div>
          </div>
          {builtIn.isError && (
            <p className="text-xs text-destructive">
              {(builtIn.error as Error | null)?.message ??
                'Could not load the built-in tool list.'}
            </p>
          )}
          {showBuiltIn && (
            <ToolChips
              tools={builtInTools}
              onSelect={(t) => {
                const full = builtInTools.find((b) => b.name === t.name);
                setToolUnderTest({
                  name: t.name,
                  description: t.description,
                  argsTemplate: argsTemplate(full?.parameters),
                  destructive: false,
                });
              }}
            />
          )}
        </Card>

        {/* External MCP Servers */}
        {isLoading ? (
          <LoadingState label="Loading MCP servers…" />
        ) : isError ? (
          <ErrorState
            title="Couldn't load MCP servers"
            description={(error as Error | null)?.message}
            onRetry={() => refetch()}
          />
        ) : connections.length === 0 ? (
          <EmptyState
            icon={<Plug className="size-8 text-muted-foreground" />}
            title="No External MCP Servers Connected"
            description="Connect a remote MCP server (such as GitHub, Postgres, or Slack) to expose its tools to your agents."
            action={
              <Button
                size="sm"
                variant="primary"
                onClick={() => setIsAddOpen(true)}
                className="gap-1.5 text-xs"
              >
                <Plus className="size-3.5" /> Connect Server
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Connected Servers ({connections.length})
            </h2>

            <div className="gap-4 md:grid-cols-2 grid grid-cols-1">
              {connections.map((conn) => {
                const status = conn.isEnabled
                  ? (STATUS_BADGE[conn.status] ?? STATUS_BADGE.DISCONNECTED)
                  : ({ variant: 'neutral', label: 'Disabled' } as const);
                return (
                  <Card
                    key={conn.id}
                    className={cn(
                      'space-y-3 p-4 shadow-2xs flex flex-col justify-between',
                      !conn.isEnabled && 'opacity-70',
                    )}
                  >
                    <div className="space-y-2">
                      <div className="gap-2 flex items-start justify-between">
                        <div className="min-w-0 gap-2 flex items-center">
                          <div className="size-7 flex shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
                            <Plug className="size-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate text-foreground">
                              {conn.name}
                            </div>
                            <span
                              className="block truncate font-mono text-2xs text-muted-foreground"
                              title={conn.serverUrl}
                            >
                              {conn.serverUrl}
                            </span>
                          </div>
                        </div>
                        <div className="gap-2 flex shrink-0 items-center">
                          <Badge variant={status.variant} className="text-2xs">
                            {status.label}
                          </Badge>
                          <Switch
                            checked={conn.isEnabled}
                            disabled={togglingId === conn.id}
                            onCheckedChange={(isEnabled) =>
                              toggleMutation.mutate({ id: conn.id, isEnabled })
                            }
                            aria-label={
                              conn.isEnabled
                                ? `Disable ${conn.name}`
                                : `Enable ${conn.name}`
                            }
                            className="scale-75"
                          />
                        </div>
                      </div>

                      <div className="gap-x-3 gap-y-1 flex flex-wrap items-center text-2xs text-muted-foreground">
                        <span>{conn.transport}</span>
                        <span>
                          {conn.lastSyncedAt
                            ? `Synced ${formatRelative(conn.lastSyncedAt)}`
                            : 'Never synced'}
                        </span>
                        {conn.authMode === 'OAUTH' ? (
                          <span className="gap-1 inline-flex items-center">
                            <KeyRound className="size-3" />
                            {conn.oauthConnected
                              ? 'Signed in with OAuth'
                              : 'OAuth sign-in expired'}
                          </span>
                        ) : (
                          conn.hasToken && (
                            <span className="font-mono">
                              Token {conn.maskedToken}
                            </span>
                          )
                        )}
                      </div>

                      {conn.lastError && (
                        <p
                          className="line-clamp-2 text-2xs text-destructive"
                          title={conn.lastError}
                        >
                          {conn.lastError}
                        </p>
                      )}

                      {conn.discoveredToolsJson.length > 0 && (
                        <div className="space-y-1">
                          <div className="font-semibold text-2xs text-muted-foreground uppercase">
                            Discovered Tools ({conn.discoveredToolsJson.length})
                          </div>
                          <ToolChips
                            tools={conn.discoveredToolsJson}
                            onSelect={
                              isLive(conn)
                                ? (t) => {
                                    const full = conn.discoveredToolsJson.find(
                                      (d) => d.name === t.name,
                                    );
                                    setToolUnderTest({
                                      name: t.name,
                                      description: t.description,
                                      argsTemplate: argsTemplate(
                                        full?.inputSchema?.['properties'] as
                                          Record<string, ParamSpec> | undefined,
                                      ),
                                      // Same rule the agent runtime uses for approvals.
                                      destructive:
                                        t.annotations?.readOnlyHint !== true &&
                                        t.annotations?.destructiveHint !==
                                          false,
                                      connection: {
                                        id: conn.id,
                                        name: conn.name,
                                      },
                                    });
                                  }
                                : undefined
                            }
                          />
                        </div>
                      )}
                    </div>

                    <div className="pt-2.5 flex items-center justify-between border-t border-border/60">
                      <div className="gap-1 flex items-center">
                        {conn.status === 'NEEDS_AUTH' && (
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() =>
                              void openOAuthPopup(workspaceId, conn)
                            }
                            className="gap-1 text-xs"
                          >
                            <LogIn className="size-3" /> Sign in
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => syncMutation.mutate(conn.id)}
                          loading={syncingId === conn.id}
                          disabled={syncMutation.isPending}
                          className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <RefreshCw className="size-3" />{' '}
                          {conn.status === 'ERROR' ||
                          conn.status === 'NEEDS_AUTH'
                            ? 'Retry'
                            : 'Sync Tools'}
                        </Button>
                      </div>

                      <div className="gap-1 flex items-center">
                        {conn.authMode === 'OAUTH' && (
                          <Button
                            variant="ghost"
                            size="xs"
                            loading={
                              signOutMutation.isPending &&
                              signOutMutation.variables === conn.id
                            }
                            onClick={() => signOutMutation.mutate(conn.id)}
                            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <LogOut className="size-3" /> Sign out
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => openEdit(conn)}
                          className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="size-3" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          loading={removingId === conn.id}
                          onClick={async () => {
                            const ok = await confirm({
                              title: 'Remove this MCP connection?',
                              description:
                                'Its synced tools disappear, and agents using them will fail until reconnected.',
                              confirmLabel: 'Remove',
                              destructive: true,
                            });
                            if (ok) deleteMutation.mutate(conn.id);
                          }}
                          className="text-xs text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="mr-1 size-3" /> Remove
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Connect MCP Server Modal */}
        <Dialog
          open={isAddOpen}
          onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogContent className="sm:max-w-md">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
            >
              <DialogHeader>
                <div className="gap-2 flex items-center">
                  <div className="size-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Plug className="size-4" />
                  </div>
                  <div>
                    <DialogTitle className="text-sm font-bold">
                      {editing ? `Edit ${editing.name}` : 'Connect MCP Server'}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      {editing
                        ? 'Changing the URL or token re-runs the handshake.'
                        : 'We run a live handshake against the endpoint and import its tools.'}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <DialogBody className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    Server Name *
                  </Label>
                  <Input
                    required
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    placeholder="e.g. GitHub MCP or Postgres Adapter"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    Server URL (Streamable HTTP) *
                  </Label>
                  <Input
                    required
                    type="url"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="https://mcp.example.com/mcp"
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    Bearer token (optional)
                  </Label>
                  <Input
                    type="password"
                    autoComplete="off"
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                      if (e.target.value) setClearToken(false);
                    }}
                    placeholder={
                      editing?.hasToken
                        ? clearToken
                          ? 'Token will be removed'
                          : `Keep current (${editing.maskedToken ?? 'saved'})`
                        : 'Sent as Authorization: Bearer …'
                    }
                    className="h-8 text-xs font-mono"
                  />
                  {editing?.hasToken && !token && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setClearToken((v) => !v)}
                      className="h-6 px-1.5 text-2xs text-destructive hover:bg-destructive/10"
                    >
                      {clearToken ? 'Keep current token' : 'Remove saved token'}
                    </Button>
                  )}
                  <p className="text-2xs text-muted-foreground">
                    Stored encrypted and never shown again. Servers that use
                    OAuth (Asana, Linear, Notion, Atlassian…) don't need a token
                    — you sign in after connecting. Private-network URLs need
                    AI_ALLOW_PRIVATE_NETWORK on the API.
                  </p>
                </div>

                <div className="space-y-2 p-2.5 rounded-md border border-border">
                  <button
                    type="button"
                    onClick={() => setShowOAuthClient((v) => !v)}
                    className="gap-1 text-xs font-semibold flex w-full items-center justify-between text-foreground"
                  >
                    <span className="gap-1.5 inline-flex items-center">
                      <KeyRound className="size-3.5" /> OAuth app (optional)
                    </span>
                    <ChevronDown
                      className={cn(
                        'size-3 transition-transform',
                        showOAuthClient && 'rotate-180',
                      )}
                    />
                  </button>
                  {showOAuthClient && (
                    <div className="space-y-2.5">
                      <p className="text-2xs text-muted-foreground">
                        Most servers register Onetab AI automatically. Only fill
                        this in when the server asks you to create your own
                        OAuth app (for example Asana's v2 MCP server).
                      </p>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-foreground">
                          Client ID
                        </Label>
                        <Input
                          autoComplete="off"
                          value={clientId}
                          onChange={(e) => setClientId(e.target.value)}
                          placeholder="From the provider's developer console"
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-foreground">
                          Client secret
                        </Label>
                        <Input
                          type="password"
                          autoComplete="off"
                          value={clientSecret}
                          onChange={(e) => setClientSecret(e.target.value)}
                          placeholder={
                            editing?.oauthClientSource === 'MANUAL'
                              ? 'Keep current secret'
                              : 'Leave blank for public (PKCE-only) apps'
                          }
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      {redirectUri && (
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold text-foreground">
                            Redirect URI to register
                          </Label>
                          <div className="gap-1 flex items-center">
                            <code className="min-w-0 px-2 py-1.5 flex-1 truncate rounded-md border border-border bg-surface-raised font-mono text-2xs text-foreground">
                              {redirectUri}
                            </code>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              aria-label="Copy redirect URI"
                              onClick={() => {
                                void navigator.clipboard
                                  .writeText(redirectUri)
                                  .then(() =>
                                    toast.success('Redirect URI copied'),
                                  );
                              }}
                            >
                              <Copy className="size-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </DialogBody>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAddOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  loading={saveMutation.isPending}
                  disabled={!serverName.trim() || !serverUrl.trim()}
                >
                  {editing ? 'Save' : 'Connect Server'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <ToolTestDialog
          tool={toolUnderTest}
          workspaceId={workspaceId}
          onClose={() => setToolUnderTest(null)}
        />
      </div>
    </div>
  );
}
