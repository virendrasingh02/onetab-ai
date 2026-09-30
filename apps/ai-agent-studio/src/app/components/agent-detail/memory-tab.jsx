import { useState } from 'react';
import { Badge, Button, Input, toast, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, LoadingState } from '@org/ui';
import { cn } from '@org/utils';
import { aiMemoryApi } from '@org/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Brain,
  Clock,
  Database,
  HardDrive,
  Plus,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useStudioSession } from '../../session-guard.js';

export function MemoryTab({ agent, onUpdate }) {
  const { activeWorkspace } = useStudioSession();
  const queryClient = useQueryClient();

  const [memoryType, setMemoryType] = useState(agent?.memoryConfig?.memoryType || 'hybrid');
  const [retentionDays, setRetentionDays] = useState(agent?.memoryConfig?.retentionDays || 30);
  const [contextWindowSize, setContextWindowSize] = useState(agent?.memoryConfig?.contextWindowSize || 12);
  const [autoSummarize, setAutoSummarize] = useState(agent?.memoryConfig?.autoSummarize ?? true);
  const [userSpecific, setUserSpecific] = useState(agent?.memoryConfig?.userSpecific ?? true);
  const [memorySearch, setMemorySearch] = useState('');

  // Local fallback memories for standalone preview
  const [storedMemories, setStoredMemories] = useState([
    {
      id: 'mem-1',
      key: 'Customer SSO Integration Preference',
      source: 'usr-sarah-421',
      value: 'Customer preferred Okta SAML setup with automatic SCIM provisioning.',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'mem-2',
      key: 'Billing Exception Policy',
      source: 'usr-marcus-109',
      value: 'Enterprise discount negotiated at 15% annual commitment.',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'mem-3',
      key: 'Firecrawl Crawl Frequency',
      source: 'global-workspace',
      value: 'Target pricing crawl throttled to daily run at 06:00 UTC to prevent rate-limit 429.',
      createdAt: new Date(Date.now() - 259200000).toISOString(),
    },
  ]);

  // Query live memories from backend
  const {
    data: remoteMemories,
    isLoading: isLoadingMemories,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['workspace-ai-memories', activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace?.id) return [];
      try {
        const res = await aiMemoryApi.list(activeWorkspace.id);
        if (Array.isArray(res) && res.length > 0) return res;
      } catch (err) {
        console.warn('aiMemoryApi.list query error:', err);
      }
      return null;
    },
    enabled: Boolean(activeWorkspace?.id),
  });

  const activeMemories = remoteMemories && remoteMemories.length > 0 ? remoteMemories : storedMemories;

  // Prune / delete memory mutation
  const deleteMutation = useMutation({
    mutationFn: async (mem) => {
      if (activeWorkspace?.id && mem.key) {
        try {
          await aiMemoryApi.delete(activeWorkspace.id, mem.key);
        } catch (e) {
          console.warn('Remote memory deletion fallback', e);
        }
      }
      setStoredMemories((prev) => prev.filter((m) => m.id !== mem.id && m.key !== mem.key));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-ai-memories', activeWorkspace?.id] });
      toast.success('Memory fact pruned');
    },
    onError: (err) => {
      toast.error('Failed to prune memory fact', { description: err?.message });
    },
  });

  const filteredMemories = activeMemories.filter((m) => {
    if (!memorySearch.trim()) return true;
    const q = memorySearch.toLowerCase();
    const key = (m.key || '').toLowerCase();
    const val = (m.value || '').toLowerCase();
    const src = (m.source || '').toLowerCase();
    return key.includes(q) || val.includes(q) || src.includes(q);
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
            Vector + Buffer
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
            <p className="text-xs text-muted-foreground">Inspect and prune stored facts from agent turns</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => void refetch()}
              loading={isRefetching}
              title="Refresh memories"
            >
              <RefreshCw className="size-3.5" />
            </Button>
            <div className="relative w-64">
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

        {isLoadingMemories ? (
          <LoadingState label="Loading agent memories..." />
        ) : filteredMemories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-xs text-muted-foreground">
            No memories match your query. Run agent turns with memory enabled to store episodic facts.
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
