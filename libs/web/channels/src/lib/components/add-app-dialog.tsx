import { useState, useMemo, useEffect } from 'react';
import type { ChannelSummary } from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  ScrollArea,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import { Blocks, Check, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useIntegrations } from '@org/web-integrations';
import { useChannelApps, useChannelAppMutations } from '../use-channel-apps.js';

export interface AddAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ChannelSummary;
  workspaceId: string | undefined;
  workspaceSlug: string;
}

export function AddAppDialog({
  open,
  onOpenChange,
  channel,
  workspaceId,
  workspaceSlug,
}: AddAppDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedIntegrationId(null);
    }
  }, [open]);

  const integrationsQuery = useIntegrations(workspaceId);
  const channelApps = useChannelApps(workspaceId, channel.id);
  const mutations = useChannelAppMutations(workspaceId, channel.id);

  const connectedIntegrations = useMemo(
    () =>
      (integrationsQuery.data ?? []).filter(
        (integration) => integration.status === 'CONNECTED',
      ),
    [integrationsQuery.data],
  );

  const linkedIds = useMemo(
    () => new Set((channelApps.data ?? []).map((row) => row.integrationId)),
    [channelApps.data],
  );

  const filteredIntegrations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return connectedIntegrations;
    return connectedIntegrations.filter(
      (integration) =>
        (integration.displayName ?? integration.provider)
          .toLowerCase()
          .includes(query) || integration.provider.toLowerCase().includes(query),
    );
  }, [search, connectedIntegrations]);

  const handleAdd = () => {
    if (!selectedIntegrationId) return;
    mutations.add.mutate(selectedIntegrationId, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="gap-2.5 flex items-center">
            <div className="size-9 flex items-center justify-center rounded-xl border border-accent-violet/30 bg-accent-violet-soft text-accent-violet">
              <Blocks className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Add App to #{channel.name}</span>
                <Badge variant="neutral" className="text-[10px] py-0 h-4 font-mono">
                  Integration
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Connect a workspace app so it can post and react in this channel.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 px-6 py-2">
          {connectedIntegrations.length > 0 ? (
            <div className="relative">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search connected apps..."
                className="pl-9 text-xs"
                autoFocus
              />
            </div>
          ) : null}

          {integrationsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground p-3">
              Loading workspace apps…
            </p>
          ) : connectedIntegrations.length === 0 ? (
            <EmptyState
              size="sm"
              icon={<Blocks />}
              title="No connected apps in this workspace"
              description="Connect an app in the Integration Hub before adding it to a channel."
              action={
                <Button size="sm" asChild>
                  <Link to={`/w/${workspaceSlug}/integrations`}>
                    Open Integration Hub
                  </Link>
                </Button>
              }
            />
          ) : (
            <ScrollArea className="h-64 rounded-xl border border-border bg-surface/50 p-2">
              <div className="space-y-2">
                {filteredIntegrations.map((integration) => {
                  const isAlreadyAdded = linkedIds.has(integration.id);
                  const isSelected = selectedIntegrationId === integration.id;
                  const name = integration.displayName ?? integration.provider;

                  return (
                    <button
                      key={integration.id}
                      type="button"
                      disabled={isAlreadyAdded}
                      onClick={() => setSelectedIntegrationId(integration.id)}
                      className={cn(
                        'w-full text-left p-3 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer',
                        isAlreadyAdded
                          ? 'opacity-60 cursor-not-allowed bg-muted/30 border-border/50'
                          : isSelected
                            ? 'border-accent-violet bg-accent-violet-soft ring-1 ring-accent-violet'
                            : 'border-border/70 bg-surface hover:border-border hover:bg-surface-raised',
                      )}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <UserAvatar name={name} seed={integration.id} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-foreground">
                              {name}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 h-4 capitalize font-mono"
                            >
                              {integration.provider.toLowerCase().replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 mt-0.5">
                        {isAlreadyAdded ? (
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Connected
                          </span>
                        ) : (
                          <div
                            className={cn(
                              'size-5 rounded-full border flex items-center justify-center transition-colors',
                              isSelected
                                ? 'border-accent-violet bg-accent-violet text-white'
                                : 'border-border bg-surface',
                            )}
                          >
                            {isSelected ? <Check className="size-3 stroke-[3]" /> : null}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
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
            disabled={!selectedIntegrationId || mutations.add.isPending}
            loading={mutations.add.isPending}
            onClick={handleAdd}
            className="gap-1.5 bg-accent-violet hover:bg-accent-violet text-white"
          >
            <Plus className="size-3.5" />
            <span>Connect App to Channel</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
