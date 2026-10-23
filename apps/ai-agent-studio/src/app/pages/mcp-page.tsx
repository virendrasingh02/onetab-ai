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
  Page,
  PageHeader,
  toast,
  ErrorState,
  Label,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  Plug,
  Plus,
  RefreshCw,
  Server,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useStudioSession } from '../session-guard.js';

const STATUS_BADGE = {
  CONNECTED: { variant: 'success', label: 'Connected' },
  ERROR: { variant: 'destructive', label: 'Error' },
  DISCONNECTED: { variant: 'warning', label: 'Disconnected' },
} as const;

function ToolChips({
  tools,
}: {
  tools: Array<{
    name: string;
    description?: string;
    annotations?: { destructiveHint?: boolean; readOnlyHint?: boolean };
  }>;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {tools.map((t) => (
        <span
          key={t.name}
          title={t.description}
          className={cn(
            'rounded border bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-foreground',
            t.annotations?.destructiveHint
              ? 'border-destructive/40'
              : 'border-border',
          )}
        >
          {t.name}
        </span>
      ))}
    </div>
  );
}

export function McpPage() {
  const { activeWorkspace } = useStudioSession();
  const queryClient = useQueryClient();
  const workspaceId = activeWorkspace.id;
  const connectionsKey = ['mcp-connections', workspaceId];

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [serverName, setServerName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [token, setToken] = useState('');
  const [showBuiltIn, setShowBuiltIn] = useState(false);

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

  const resetForm = () => {
    setServerName('');
    setServerUrl('');
    setToken('');
  };

  // The API always returns the saved row: a failed handshake is status ERROR, not an HTTP error.
  const reportHandshake = (conn: MCPConnection, verb: string) => {
    if (conn.status === 'CONNECTED') {
      toast.success(`${conn.name} ${verb}`, {
        description: `${conn.discoveredToolsJson.length} tools discovered`,
      });
    } else {
      toast.error(`${conn.name} could not be reached`, {
        description:
          conn.lastError ?? 'The server did not complete the MCP handshake.',
      });
    }
  };

  const createMutation = useMutation({
    mutationFn: () =>
      mcpApi.createConnection(workspaceId, {
        name: serverName.trim(),
        serverUrl: serverUrl.trim(),
        transport: 'HTTP',
        ...(token.trim() ? { token: token.trim() } : {}),
      }),
    onSuccess: (conn) => {
      void queryClient.invalidateQueries({ queryKey: connectionsKey });
      setIsAddOpen(false);
      resetForm();
      reportHandshake(conn, 'connected');
    },
    onError: (err: Error) => {
      toast.error('Could not connect MCP server', {
        description: err?.message,
      });
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

  const connectedCount = connections.filter(
    (c) => c.status === 'CONNECTED',
  ).length;
  const externalToolCount = connections.reduce(
    (n, c) => n + (c.status === 'CONNECTED' ? c.discoveredToolsJson.length : 0),
    0,
  );
  const syncingId = syncMutation.isPending ? syncMutation.variables : null;
  const removingId = deleteMutation.isPending ? deleteMutation.variables : null;

  return (
    <Page className="space-y-6">
      <PageHeader
        title="Model Context Protocol (MCP) Registry"
        description="Connect remote MCP servers over HTTP to give your agents external tools, databases, and APIs."
        icon={<Plug className="size-5" />}
        accent="pink"
        actions={
          <div className="flex items-center gap-2">
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

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
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
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {s.label}
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums text-foreground">
              {s.value}
            </div>
          </Card>
        ))}
      </div>

      {/* Built-in MCP server — status comes from the tool registry itself */}
      <Card className="border-border-strong p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Server className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">
                  Onetab Platform Built-in MCP Server
                </span>
                {builtIn.isError ? (
                  <Badge variant="destructive" className="text-[9px]">
                    Unavailable
                  </Badge>
                ) : builtIn.isLoading ? (
                  <Badge variant="neutral" className="text-[9px]">
                    Checking…
                  </Badge>
                ) : (
                  <Badge variant="success" className="text-[9px]">
                    {builtInTools.length} tools
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                In-process server supplying document search, task management,
                Matrix chat posts, and memory.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
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
          <p className="text-[11px] text-destructive">
            {(builtIn.error as Error | null)?.message ??
              'Could not load the built-in tool list.'}
          </p>
        )}
        {showBuiltIn && <ToolChips tools={builtInTools} />}
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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Connected Servers ({connections.length})
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {connections.map((conn) => {
              const status =
                STATUS_BADGE[conn.status] ?? STATUS_BADGE.DISCONNECTED;
              return (
                <Card
                  key={conn.id}
                  className="flex flex-col justify-between space-y-3 p-4 shadow-2xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
                          <Plug className="size-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-foreground">
                            {conn.name}
                          </div>
                          <span
                            className="block truncate font-mono text-[10px] text-muted-foreground"
                            title={conn.serverUrl}
                          >
                            {conn.serverUrl}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={status.variant}
                        className="shrink-0 text-[9px]"
                      >
                        {status.label}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                      <span>{conn.transport}</span>
                      <span>
                        {conn.lastSyncedAt
                          ? `Synced ${formatRelative(conn.lastSyncedAt)}`
                          : 'Never synced'}
                      </span>
                      {conn.hasToken && (
                        <span className="font-mono">
                          Token {conn.maskedToken}
                        </span>
                      )}
                    </div>

                    {conn.lastError && (
                      <p
                        className="line-clamp-2 text-[10px] text-destructive"
                        title={conn.lastError}
                      >
                        {conn.lastError}
                      </p>
                    )}

                    {conn.discoveredToolsJson.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                          Discovered Tools ({conn.discoveredToolsJson.length})
                        </div>
                        <ToolChips tools={conn.discoveredToolsJson} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => syncMutation.mutate(conn.id)}
                      loading={syncingId === conn.id}
                      disabled={syncMutation.isPending}
                      className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className="size-3" />{' '}
                      {conn.status === 'ERROR' ? 'Retry' : 'Sync Tools'}
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
              createMutation.mutate();
            }}
          >
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Plug className="size-4" />
                </div>
                <div>
                  <DialogTitle className="text-sm font-bold">
                    Connect MCP Server
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    We run a live handshake against the endpoint and import its
                    tools.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <DialogBody className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-foreground">
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
                <Label className="text-[11px] font-semibold text-foreground">
                  Server URL (Streamable HTTP) *
                </Label>
                <Input
                  required
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://mcp.example.com/mcp"
                  className="h-8 font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-foreground">
                  Bearer token (optional)
                </Label>
                <Input
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Sent as Authorization: Bearer …"
                  className="h-8 font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Stored encrypted and never shown again. Private-network URLs
                  need AI_ALLOW_PRIVATE_NETWORK on the API.
                </p>
              </div>
            </DialogBody>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                variant="primary"
                loading={createMutation.isPending}
                disabled={!serverName.trim() || !serverUrl.trim()}
              >
                Connect Server
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
