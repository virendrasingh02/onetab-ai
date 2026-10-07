import { mcpApi } from '@org/api-client';
import type { MCPTransport } from '@org/types';
import {
  Badge,
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
} from '@org/ui';
import { cn } from '@org/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plug,
  Plus,
  RefreshCw,
  Server,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useStudioSession } from '../session-guard.js';

export function McpPage() {
  const { activeWorkspace } = useStudioSession();
  const queryClient = useQueryClient();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [serverName, setServerName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [transport, setTransport] = useState<MCPTransport>('SSE');

  const {
    data: connections = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['mcp-connections', activeWorkspace.id],
    queryFn: () => mcpApi.listConnections(activeWorkspace.id),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      return mcpApi.createConnection(activeWorkspace.id, {
        name: serverName.trim(),
        serverUrl: serverUrl.trim(),
        transport,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['mcp-connections', activeWorkspace.id],
      });
      setIsAddOpen(false);
      setServerName('');
      setServerUrl('');
      toast.success('MCP server connected!');
    },
    onError: (err: any) => {
      toast.error('Could not connect MCP server', { description: err?.message });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return mcpApi.deleteConnection(activeWorkspace.id, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['mcp-connections', activeWorkspace.id],
      });
      toast.success('MCP server removed');
    },
    onError: (err: any) => {
      toast.error('Could not remove MCP server', { description: err?.message });
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      return mcpApi.syncTools(activeWorkspace.id, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['mcp-connections', activeWorkspace.id],
      });
      toast.success('MCP tools synced from server');
    },
    onError: (err: any) => {
      toast.error('Could not sync tools from this server', { description: err?.message });
    },
  });

  return (
    <Page width="wide" padding="none" className="space-y-6">
      {/* Header matching Admin PageHeader */}
      <PageHeader
        title="Model Context Protocol (MCP) Registry"
        description="Connect standard MCP servers over SSE or stdio to discover external tools, databases, and APIs."
        icon={<Plug className="size-5" />}
        accent="pink"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
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

      {/* Built-in MCP Server Card */}
      <Card className="border-primary/25 p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary font-bold shrink-0">
              <Server className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">
                  OneTab Platform Built-in MCP Server
                </span>
                <Badge variant="success" className="text-[9px]">
                  Connected
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                In-process server supplying document search, task management, Matrix chat posts, and memory.
              </p>
            </div>
          </div>

          <span className="font-mono text-[10px] text-muted-foreground">
            Transport: in-process
          </span>
        </div>
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
          description="Connect an external MCP server (such as GitHub, Postgres, Slack, or filesystem) to expose tools to your agents."
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
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Connected Servers ({connections.length})
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {connections.map((conn) => (
              <Card
                key={conn.id}
                className="flex flex-col justify-between p-4 shadow-2xs space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-surface-raised border border-border text-primary font-bold shrink-0">
                        <Plug className="size-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">
                          {conn.name}
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground truncate block max-w-[200px]">
                          {conn.serverUrl}
                        </span>
                      </div>
                    </div>

                    <Badge variant="outline" className="text-[9px]">
                      {conn.transport}
                    </Badge>
                  </div>

                  {conn.lastError && (
                    <p className="mt-2 text-[10px] text-destructive line-clamp-2" title={conn.lastError}>
                      {conn.lastError}
                    </p>
                  )}
                  {conn.discoveredToolsJson.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase">
                          Discovered Tools ({conn.discoveredToolsJson.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {conn.discoveredToolsJson.map((t) => (
                            <span
                              key={t.name}
                              title={t.description}
                              className="rounded bg-surface-raised border border-border px-1.5 py-0.5 font-mono text-[9px] text-foreground"
                            >
                              {t.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => syncMutation.mutate(conn.id)}
                    loading={syncMutation.isPending}
                    className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="size-3" /> Sync Tools
                  </Button>

                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => deleteMutation.mutate(conn.id)}
                    className="text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3 mr-1" /> Remove
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Connect MCP Server Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
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
                    Provide the server endpoint URL and transport mode.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <DialogBody className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">
                  Server Name *
                </label>
                <Input
                  required
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="e.g. GitHub MCP or Postgres Adapter"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">
                  Server URL / Endpoint *
                </label>
                <Input
                  required
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://mcp.internal.company.com/sse"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">
                  Transport
                </label>
                <select
                  value={transport}
                  onChange={(e) => setTransport(e.target.value as MCPTransport)}
                  className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="SSE">Server-Sent Events (SSE)</option>
                  <option value="STDIO">Local stdio (Subprocess)</option>
                  <option value="HTTP">Streamable HTTP</option>
                </select>
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
