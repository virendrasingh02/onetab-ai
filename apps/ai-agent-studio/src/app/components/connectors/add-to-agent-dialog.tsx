import { agentsApi } from '@org/api-client';
import {
  AppSelect,
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '@org/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  agentConnectorActions,
  attachConnectorToAgent,
  errorMessage,
  usableConnection,
  type AgentWithApps,
  type ConnectorSummary,
} from '../../services/connectors.js';
import { useStudioSession } from '../../session-guard.js';

/**
 * Gives an agent some or all of a connector's actions as tools. The agent
 * acts through the chosen connection with its owner's permissions; write
 * actions keep their own approval rules at run time.
 */
export function AddToAgentDialog({
  connector,
  open,
  onOpenChange,
  presetAgentId,
}: {
  connector: ConnectorSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetAgentId?: string;
}) {
  const { activeWorkspace } = useStudioSession();
  const workspaceId = activeWorkspace?.id;
  const queryClient = useQueryClient();
  const [agentId, setAgentId] = useState(presetAgentId ?? '');
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const agents = useQuery({
    queryKey: ['studio-agents', workspaceId],
    queryFn: () => agentsApi.list(workspaceId as string) as Promise<AgentWithApps[]>,
    enabled: open && !!workspaceId,
  });
  const agentOptions = useMemo(
    () => (agents.data ?? []).filter((a) => a.type === 'agent').map((a) => ({ value: a.id, label: a.name })),
    [agents.data],
  );
  const agent = (agents.data ?? []).find((a) => a.id === agentId) ?? null;

  useEffect(() => {
    if (!connector) return;
    // Pre-select what the agent already has, or every read for a new link.
    setPicked(
      agent && agentConnectorActions(agent, connector).length
        ? agentConnectorActions(agent, connector)
        : connector.capabilities.filter((c) => c.kind === 'query').map((c) => c.id),
    );
  }, [agent, connector]);

  useEffect(() => {
    if (open && presetAgentId) setAgentId(presetAgentId);
  }, [open, presetAgentId]);

  if (!connector) return null;
  const connection = usableConnection(connector);

  const save = async () => {
    if (!workspaceId || !agent || !connection) return;
    setSaving(true);
    try {
      await attachConnectorToAgent(workspaceId, agent, connector, connection.id, picked);
      await queryClient.invalidateQueries({ queryKey: ['studio-agents', workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ['studio-agent', workspaceId, agent.id] });
      toast.success(`${agent.name} can now use ${picked.length} ${connector.name} action${picked.length === 1 ? '' : 's'}.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, `Couldn’t give ${agent.name} access to ${connector.name}.`));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: string, on: boolean) => setPicked((p) => (on ? [...new Set([...p, id])] : p.filter((x) => x !== id)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Use {connector.name} in an agent</DialogTitle>
          <DialogDescription>
            Pick the actions the agent may call. It acts with {connection?.mine ? 'your' : 'the workspace’s'} {connector.name} connection.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {!connection ? (
            <p role="alert" className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-text">
              Connect {connector.name} first — an agent can only use an app through a working connection.
            </p>
          ) : (
            <>
              <div className="space-y-1">
                <span className="text-xs font-medium text-foreground">Agent</span>
                <AppSelect
                  value={agentId}
                  onValueChange={setAgentId}
                  options={agentOptions}
                  searchable
                  placeholder={agents.isLoading ? 'Loading agents…' : agentOptions.length ? 'Choose an agent' : 'No agents yet'}
                />
              </div>
              <fieldset className="space-y-1.5">
                <legend className="mb-1 text-xs font-medium text-foreground">Actions</legend>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-raised p-2">
                  {connector.capabilities.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-start gap-2.5 rounded-md p-1.5 text-xs hover:bg-surface">
                      <Checkbox checked={picked.includes(c.id)} onCheckedChange={(v) => toggle(c.id, v === true)} className="mt-0.5" />
                      <span className="min-w-0">
                        <span className="font-medium text-foreground">{c.label}</span>
                        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {c.kind === 'query' ? 'reads' : c.permissionLevel === 'destructive' ? 'deletes' : 'writes'}
                        </span>
                        {c.description && <span className="block truncate text-muted-foreground">{c.description}</span>}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Actions that write still follow the agent’s approval rules, and ones the app marks as needing confirmation ask first.
                </p>
              </fieldset>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} loading={saving} disabled={!connection || !agent || picked.length === 0}>
            Give access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
