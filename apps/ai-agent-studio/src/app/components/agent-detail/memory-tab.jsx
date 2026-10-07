import { useState } from 'react';
import { Badge, Button, ErrorState, Input, toast, LoadingState } from '@org/ui';
import { cn } from '@org/utils';
import { aiMemoryApi } from '@org/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Brain,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useStudioSession } from '../../session-guard.js';

/**
 * @param {{ agent: any; onUpdate?: (patch: Record<string, any>) => void | Promise<void> }} props
 */
export function MemoryTab({ agent, onUpdate }) {
  const { activeWorkspace } = useStudioSession();
  const queryClient = useQueryClient();

  const [memoryType, setMemoryType] = useState(agent?.memoryConfig?.memoryType || 'hybrid');
  const [retentionDays, setRetentionDays] = useState(agent?.memoryConfig?.retentionDays || 30);
  const [contextWindowSize, setContextWindowSize] = useState(agent?.memoryConfig?.contextWindowSize || 12);
  const [autoSummarize, setAutoSummarize] = useState(agent?.memoryConfig?.autoSummarize ?? true);
  const [userSpecific, setUserSpecific] = useState(agent?.memoryConfig?.userSpecific ?? true);
  const [memorySearch, setMemorySearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');

  // New Memory creation form state
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newScope, setNewScope] = useState('agent');

  const memoriesKey = ['workspace-ai-memories', activeWorkspace?.id];

  const {
    data: memories = [],
    isLoading: isLoadingMemories,
    isError: memoriesFailed,
    error: memoriesError,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: memoriesKey,
    queryFn: () => aiMemoryApi.list(activeWorkspace.id),
    enabled: Boolean(activeWorkspace?.id),
  });

  const addMutation = useMutation({
    mutationFn: ({ key, value, scope }) =>
      aiMemoryApi.set(activeWorkspace.id, {
        key,
        value,
        scope,
        agentId: scope === 'agent' ? agent?.id : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memoriesKey });
      setIsAddingMemory(false);
      setNewKey('');
      setNewValue('');
      toast.success('Memory fact stored');
    },
    onError: (err) => {
      toast.error('Failed to store memory fact', { description: err?.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (mem) => aiMemoryApi.delete(activeWorkspace.id, mem.key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memoriesKey });
      toast.success('Memory fact pruned');
    },
    onError: (err) => {
      toast.error('Failed to prune memory fact', { description: err?.message });
    },
  });

  // Scoped keys are stored as `[scope] key` or `[scope:id] key`; anything
  // unprefixed is workspace-wide (matches the API's scope filter).
  const scopeOf = (key) => /^\[([a-z_]+)[\]:]/i.exec(key || '')?.[1]?.toLowerCase() ?? 'workspace';

  const filteredMemories = memories.filter((m) => {
    if (scopeFilter === 'agent') {
      // This agent's own facts plus unattributed agent-scoped ones.
      const key = m.key || '';
      if (!(key.startsWith(`[agent:${agent?.id}]`) || key.startsWith('[agent]'))) return false;
    } else if (scopeFilter !== 'all' && scopeOf(m.key) !== scopeFilter) {
      return false;
    }

    if (!memorySearch.trim()) return true;
    const q = memorySearch.toLowerCase();
    return [m.key, m.value, m.source].some((f) => (f || '').toLowerCase().includes(q));
  });

  const handleSaveSettings = () => {
    const memoryConfig = {
      memoryType,
      retentionDays,
      contextWindowSize,
      autoSummarize,
      userSpecific,
    };
    if (onUpdate) {
      onUpdate({ memoryConfig });
    }
    toast.success('Agent memory policies updated and applied');
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!activeWorkspace?.id) return;
    if (!newKey.trim() || !newValue.trim()) {
      toast.error('Please enter both key and value');
      return;
    }
    addMutation.mutate({ key: newKey.trim(), value: newValue.trim(), scope: newScope });
  };

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Brain className="size-4" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Agent Memory & Context Retention</h2>
          <Badge variant="outline" className="text-xs text-primary border-primary/30">
            Vector + Episodic
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Control how this agent retains context across multi-turn user conversations, vector semantic recall, and long-term workspace memory.
        </p>
      </div>

      {/* Memory Architecture Config */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Memory Architecture</h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              id: 'buffer',
              title: 'Short-Term Buffer',
              desc: 'Retains recent sliding window of messages. Lowest latency, reset per session.',
            },
            {
              id: 'hybrid',
              title: 'Hybrid Semantic Memory',
              desc: 'Combines sliding conversation buffer with vector similarity retrieval.',
            },
            {
              id: 'persistent',
              title: 'Long-Term Persistent',
              desc: 'Cross-session memory storing user facts, preferences, and action history.',
            },
          ].map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setMemoryType(type.id)}
              className={cn(
                'rounded-xl border p-4 text-left transition-all',
                memoryType === type.id
                  ? 'border-primary bg-primary/10 ring-1 ring-primary'
                  : 'border-border bg-surface-raised hover:border-primary/50',
              )}
            >
              <div className="text-xs font-bold text-foreground">{type.title}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{type.desc}</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-border/80 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-foreground">Context Window Size (Messages)</label>
            <Input
              type="number"
              min={2}
              max={50}
              value={contextWindowSize}
              onChange={(e) => setContextWindowSize(parseInt(e.target.value) || 12)}
              className="mt-1 text-xs"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-foreground">Retention Policy (Days)</label>
            <Input
              type="number"
              min={1}
              max={365}
              value={retentionDays}
              onChange={(e) => setRetentionDays(parseInt(e.target.value) || 30)}
              className="mt-1 text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-border/60 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSummarize}
              onChange={(e) => setAutoSummarize(e.target.checked)}
              className="size-3.5 rounded accent-primary"
            />
            <span className="text-foreground">Auto-summarize long conversations</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={userSpecific}
              onChange={(e) => setUserSpecific(e.target.checked)}
              className="size-3.5 rounded accent-primary"
            />
            <span className="text-foreground">Isolate memories per individual user</span>
          </label>
        </div>

        <div className="pt-2 flex justify-end">
          <Button size="sm" onClick={handleSaveSettings}>
            Save Memory Policy
          </Button>
        </div>
      </div>

      {/* Memory Search & Explorer */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Stored Episodic & Semantic Memories</h3>
            <p className="text-xs text-muted-foreground">Inspect, search, and prune stored facts from agent turns</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => setIsAddingMemory(!isAddingMemory)}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              <span>Add Memory</span>
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => void refetch()}
              loading={isRefetching}
              title="Refresh memories"
            >
              <RefreshCw className="size-3.5" />
            </Button>
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search memories..."
                value={memorySearch}
                onChange={(e) => setMemorySearch(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>
          </div>
        </div>

        {/* Scope Filter Tabs */}
        <div className="flex items-center gap-1.5 border-b border-border pb-2 text-xs">
          {['all', 'agent', 'workspace', 'user'].map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => setScopeFilter(scope)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors',
                scopeFilter === scope
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised',
              )}
            >
              {scope === 'all' ? 'All Scopes' : `${scope} Scope`}
            </button>
          ))}
        </div>

        {/* Add Memory Card */}
        {isAddingMemory && (
          <form
            onSubmit={handleAddSubmit}
            className="rounded-xl border border-primary/40 bg-surface p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Remember New Fact / Preference</span>
              <button
                type="button"
                onClick={() => setIsAddingMemory(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                placeholder="Key / Subject (e.g. Preferred Tone)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="text-xs h-8"
              />
              <Input
                placeholder="Value / Procedure"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="text-xs h-8 sm:col-span-2"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Scope:</span>
                <select
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value)}
                  className="rounded border border-border bg-surface px-2 py-1 text-xs text-foreground"
                >
                  <option value="agent">Agent Scope</option>
                  <option value="workspace">Workspace Scope</option>
                  <option value="user">User Scope</option>
                </select>
              </div>
              <Button size="xs" type="submit" loading={addMutation.isPending}>
                Save Fact
              </Button>
            </div>
          </form>
        )}

        {isLoadingMemories ? (
          <LoadingState label="Loading agent memories..." />
        ) : memoriesFailed ? (
          <ErrorState
            title="Couldn't load memories"
            description={memoriesError?.message}
            onRetry={() => refetch()}
          />
        ) : filteredMemories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-xs text-muted-foreground">
            No memories match your query. Run agent turns with memory enabled or click &ldquo;Add Memory&rdquo; to store episodic facts.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border">
            {filteredMemories.map((mem) => (
              <div key={mem.id || mem.key} className="p-3 text-xs flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{mem.key}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {mem.source || 'agent'}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground leading-relaxed font-mono text-[11px]">
                    {mem.value}
                  </p>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                    <span>{new Date(mem.updatedAt || mem.createdAt || Date.now()).toLocaleString()}</span>
                    <span>•</span>
                    <span>~{Math.max(12, Math.round((mem.value || '').length / 4))} tokens</span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => deleteMutation.mutate(mem)}
                  disabled={deleteMutation.isPending}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  title="Prune memory fact"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
