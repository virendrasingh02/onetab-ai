import { mcpApi } from '@org/api-client';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  LoadingState,
  toast,
} from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  ExternalLink,
  Layers,
  Plug,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { useStudioSession } from '../session-guard.js';

export function McpPage() {
  const { activeWorkspace } = useStudioSession();
  const queryClient = useQueryClient();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [serverName, setServerName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [transport, setTransport] = useState<'SSE' | 'STDIO' | 'STREAM'>('SSE');
  const [description, setDescription] = useState('');

  // Load MCP connections
  const {
    data: connections = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['mcp-connections', activeWorkspace.id],
    queryFn: () => mcpApi.list(activeWorkspace.id),
  });

  // Create connection mutation
  const createMutation = useMutation({
    mutationFn: () =>
      mcpApi.create(activeWorkspace.id, {
        name: serverName.trim(),
        serverUrl: serverUrl.trim(),
        transport,
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-connections', activeWorkspace.id] });
      setIsAddOpen(false);
      setServerName('');
      setServerUrl('');
      setDescription('');
      toast.success('MCP server connected!');
    },
    onError: (err: any) => {
      toast.error('Could not connect MCP server', { description: err?.message });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => mcpApi.delete(activeWorkspace.id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-connections', activeWorkspace.id] });
      toast.success('MCP server removed');
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: (id: string) => mcpApi.sync(activeWorkspace.id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-connections', activeWorkspace.id] });
      toast.success('MCP tools synced from server');
    },
  });

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Model Context Protocol (MCP) Registry
            </h1>
            <Badge variant="outline" className="text-xs">
              {connections.length} servers
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Connect standard MCP servers over SSE or stdio to discover external tools, databases, and APIs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            loading={isRefetching}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="gap-1.5 text-xs font-semibold"
          >
            <Plus className="size-4" /> Connect MCP Server
          </Button>
        </div>
      </div>

      {/* Built-in MCP Server Card */}
      <div className="rounded-xl border border-primary/25 bg-surface p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary font-bold">
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
      </div>

      {/* External MCP Servers */}
      {isLoading ? (
        <LoadingState label="Loading MCP servers…" />
      ) : connections.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center text-muted-foreground">
          <Plug className="size-10 text-muted-foreground/30 mb-2" />
          <div className="text-sm font-semibold text-foreground">
            No External MCP Servers Connected
          </div>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Connect an external MCP server (such as GitHub, Postgres, Slack, or filesystem) to expose tools to your agents.
          </p>
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="mt-4 gap-1.5"
          >
            <Plus className="size-3.5" /> Connect Server
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-foreground">
            Connected Servers ({connections.length})
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4 shadow-2xs space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-surface-raised border border-border text-primary font-bold">
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

                  {conn.description && (
                    <p className="mt-2 text-[11px] text-muted-foreground line-clamp-2">
                      {conn.description}
                    </p>
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
              </div>
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

            <div className="space-y-3.5 py-4 text-xs">
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
                  onChange={(e) => setTransport(e.target.value as any)}
                  className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="SSE">Server-Sent Events (SSE)</option>
                  <option value="STDIO">Local stdio (Subprocess)</option>
                  <option value="STREAM">Streaming WebSocket</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">
                  Description (Optional)
                </label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What tools does this server provide?"
                  className="h-8 text-xs"
                />
              </div>
            </div>

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
                loading={createMutation.isPending}
                disabled={!serverName.trim() || !serverUrl.trim()}
              >
                Connect Server
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
