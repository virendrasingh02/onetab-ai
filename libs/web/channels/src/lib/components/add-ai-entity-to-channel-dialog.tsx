import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentsApi, coworkersApi, channelAgentsApi, queryKeys } from '@org/api-client';
import type { ChannelSummary } from '@org/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Badge,
  Input,
  ScrollArea,
  Tabs,
  TabsList,
  TabsTrigger,
  UserAvatar,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { Bot, Check, Cpu, Search, Sparkles, UserCheck } from 'lucide-react';

export interface AIAgentOption {
  id: string;
  name: string;
  handle: string;
  role: string;
  description: string;
  model: string;
  avatarSeed: string;
  tags: string[];
  entityType?: 'agent' | 'coworker';
}

export interface AddAiEntityToChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ChannelSummary;
  onAgentAdded?: (agent: AIAgentOption) => void;
  onCoworkerAdded?: (coworkerId: string) => void;
}

export function AddAiEntityToChannelDialog({
  open,
  onOpenChange,
  channel,
  onAgentAdded,
  onCoworkerAdded,
}: AddAiEntityToChannelDialogProps) {
  const [tab, setTab] = useState<'agents' | 'coworkers'>('agents');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedId(null);
    }
  }, [open]);

  // Workspace agents
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(channel.workspaceId),
    queryFn: () => agentsApi.list(channel.workspaceId),
    enabled: open,
  });

  // Workspace coworkers
  const coworkersQuery = useQuery({
    queryKey: queryKeys.coworkers.list(channel.workspaceId),
    queryFn: () => coworkersApi.list(channel.workspaceId),
    enabled: open,
  });

  const agentOptions = useMemo<AIAgentOption[]>(
    () =>
      (agentsQuery.data ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        handle:
          '@' +
          (a.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'agent'),
        role: a.role,
        description: a.description ?? '',
        model: a.model,
        avatarSeed: a.id,
        tags: [],
        entityType: 'agent',
      })),
    [agentsQuery.data],
  );

  const coworkerOptions = useMemo<AIAgentOption[]>(
    () =>
      (coworkersQuery.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        handle:
          '@' +
          (c.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'coworker'),
        role: c.role || 'AI Coworker',
        description: c.description ?? '',
        model: c.model || 'claude-3-5-sonnet',
        avatarSeed: c.id,
        tags: [],
        entityType: 'coworker',
      })),
    [coworkersQuery.data],
  );

  const currentOptions = tab === 'agents' ? agentOptions : coworkerOptions;

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return currentOptions;
    return currentOptions.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.handle.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query),
    );
  }, [search, currentOptions]);

  const linkCoworkerMutation = useMutation({
    mutationFn: (coworkerId: string) =>
      coworkersApi.addChannelCoworker(channel.workspaceId, channel.id, coworkerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.channels.coworkers(channel.workspaceId, channel.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.channels.all(channel.workspaceId),
      });
      toast.success('AI Coworker linked to channel');
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to add coworker to channel');
    },
  });

  const linkAgentMutation = useMutation({
    mutationFn: (agentId: string) =>
      channelAgentsApi.add(channel.workspaceId, channel.id, agentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.channels.agents(channel.workspaceId, channel.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.channels.all(channel.workspaceId),
      });
      toast.success('AI Agent added to channel');
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to add agent to channel');
    },
  });

  const handleAdd = async () => {
    if (!selectedId) return;

    if (tab === 'agents') {
      const agent = agentOptions.find((a) => a.id === selectedId);
      if (agent) {
        if (onAgentAdded) {
          onAgentAdded(agent);
          onOpenChange(false);
        } else {
          linkAgentMutation.mutate(agent.id);
        }
      }
    } else {
      if (onCoworkerAdded) {
        onCoworkerAdded(selectedId);
        onOpenChange(false);
      } else {
        linkCoworkerMutation.mutate(selectedId);
      }
    }
  };

  const isSubmitting = linkAgentMutation.isPending || linkCoworkerMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="gap-2.5 flex items-center">
            <div className="size-9 flex items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <Bot className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Add AI to #{channel.name}</span>
                <Badge variant="primary" className="text-[10px] py-0 h-4">
                  AI Powered
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Add an AI agent or coworker to this channel. Once added, they can be
                @mentioned and will answer in this channel.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 px-6 py-2">
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as 'agents' | 'coworkers');
              setSelectedId(null);
            }}
          >
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="agents" className="gap-1.5 text-xs">
                <Cpu className="size-3.5" />
                <span>AI Agents ({agentOptions.length})</span>
              </TabsTrigger>
              <TabsTrigger value="coworkers" className="gap-1.5 text-xs">
                <UserCheck className="size-3.5" />
                <span>AI Coworkers ({coworkerOptions.length})</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${tab === 'agents' ? 'AI agents' : 'AI coworkers'}...`}
              className="pl-9 text-xs"
            />
          </div>

          <ScrollArea className="h-64 rounded-xl border border-border bg-surface/50 p-2">
            <div className="space-y-2">
              {(tab === 'agents' ? agentsQuery.isLoading : coworkersQuery.isLoading) ? (
                <p className="text-xs text-muted-foreground p-3">
                  Loading {tab}…
                </p>
              ) : filteredOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">
                  {currentOptions.length === 0
                    ? `This workspace has no ${tab === 'agents' ? 'AI agents' : 'AI coworkers'} yet.`
                    : 'No results match your search.'}
                </p>
              ) : null}
              {filteredOptions.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer',
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border/70 bg-surface hover:border-border hover:bg-surface-raised',
                    )}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <UserAvatar
                        name={item.name}
                        seed={item.avatarSeed}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground">
                            {item.name}
                          </span>
                          <span className="text-[11px] font-mono text-primary">
                            {item.handle}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 h-4 font-mono"
                          >
                            {item.model}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                        {item.tags.length > 0 ? (
                          <div className="flex items-center gap-1.5 mt-2">
                            {item.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div
                      className={cn(
                        'size-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-surface',
                      )}
                    >
                      {isSelected ? <Check className="size-3 stroke-[3]" /> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!selectedId || isSubmitting}
            loading={isSubmitting}
            onClick={handleAdd}
            className="gap-1.5"
          >
            <Sparkles className="size-3.5" />
            <span>Add to Channel</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Re-export as AddAgentToChannelDialog for backward compatibility
export const AddAgentToChannelDialog = AddAiEntityToChannelDialog;
