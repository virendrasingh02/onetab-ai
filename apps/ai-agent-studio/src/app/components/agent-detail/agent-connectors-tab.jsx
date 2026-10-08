import { useState, useMemo } from 'react';
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
  Input,
  toast,
} from '@org/ui';
import {
  Check,
  CheckCircle2,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  Wrench,
  Zap,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { connectorService } from '../../services/connectorService.js';
import { CONNECTOR_CATEGORIES } from '../../services/connectorCatalog.js';
import { AppConnectorIcon } from '../common/app-connector-icon.jsx';
import { useStudioSession } from '../../session-guard.js';

export function AgentConnectorsTab({ agent, onUpdate }) {
  const { activeWorkspace } = useStudioSession();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [activeConnectorToAttach, setActiveConnectorToAttach] = useState(null);
  const [selectedActionIds, setSelectedActionIds] = useState([]);

  // Fetch all connectors with workspace connection status
  const { data: connectors = [], isLoading, refetch } = useQuery({
    queryKey: ['studio-app-connectors', activeWorkspace?.id],
    queryFn: () => connectorService.getConnectors(activeWorkspace?.id),
  });

  // Current agent tools array (e.g. ['microsoft_teams_send_channel_message', 'github_create_issue'])
  const agentTools = useMemo(() => {
    return Array.isArray(agent?.tools) ? agent.tools : [];
  }, [agent?.tools]);

  // Map agent tools back to their parent connector
  const attachedConnectorsMap = useMemo(() => {
    const map = new Map();

    connectors.forEach((conn) => {
      const prefix = conn.providerKey?.toLowerCase() || conn.id;
      const matchedActions = (conn.actions || []).filter((action) => {
        const fullToolName = `${prefix}_${action.id}`;
        return agentTools.includes(fullToolName) || agentTools.includes(action.id);
      });

      if (matchedActions.length > 0) {
        map.set(conn.id, {
          connector: conn,
          actions: matchedActions,
        });
      }
    });

    return map;
  }, [connectors, agentTools]);

  const attachedList = Array.from(attachedConnectorsMap.values());

  // Filter available connectors for attach modal
  const filteredConnectors = useMemo(() => {
    return connectors.filter((c) => {
      if (selectedCategory !== 'all' && c.category !== selectedCategory) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q)
      );
    });
  }, [connectors, selectedCategory, search]);

  const handleOpenAttachModal = (connector) => {
    setActiveConnectorToAttach(connector);
    const prefix = connector.providerKey?.toLowerCase() || connector.id;
    // Pre-select already active actions
    const currentActive = (connector.actions || [])
      .filter((a) => agentTools.includes(`${prefix}_${a.id}`) || agentTools.includes(a.id))
      .map((a) => a.id);
    setSelectedActionIds(currentActive);
    setIsAttachModalOpen(true);
  };

  const handleSaveAttachedActions = async () => {
    if (!activeConnectorToAttach) return;
    const prefix = activeConnectorToAttach.providerKey?.toLowerCase() || activeConnectorToAttach.id;
    const allConnectorToolNames = (activeConnectorToAttach.actions || []).map(
      (a) => `${prefix}_${a.id}`
    );

    // Remove all previous actions of this connector from agent's tools
    const preservedTools = agentTools.filter(
      (t) => !allConnectorToolNames.includes(t) && !activeConnectorToAttach.actions?.some((a) => a.id === t)
    );

    // Add newly selected actions
    const newlyAdded = selectedActionIds.map((aId) => `${prefix}_${aId}`);
    const nextTools = Array.from(new Set([...preservedTools, ...newlyAdded]));

    try {
      await onUpdate({ tools: nextTools });
      setIsAttachModalOpen(false);
      setActiveConnectorToAttach(null);
      toast.success(`Updated tool permissions for ${activeConnectorToAttach.name}`);
    } catch {
      toast.error('Failed to update agent tools');
    }
  };

  const handleRemoveConnector = async (connector) => {
    const prefix = connector.providerKey?.toLowerCase() || connector.id;
    const allConnectorToolNames = (connector.actions || []).map((a) => `${prefix}_${a.id}`);
    const nextTools = agentTools.filter(
      (t) => !allConnectorToolNames.includes(t) && !connector.actions?.some((a) => a.id === t)
    );

    try {
      await onUpdate({ tools: nextTools });
      toast.success(`Removed ${connector.name} from ${agent.name}`);
    } catch {
      toast.error(`Failed to remove ${connector.name}`);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6 overflow-y-auto max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Wrench className="size-5 text-primary" />
            App Connectors & Autonomous Tools
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Empower <strong className="text-foreground">{agent?.name}</strong> to interact with external enterprise applications, APIs, databases, and collaboration tools.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setActiveConnectorToAttach(connectors[0] || null);
              setSelectedActionIds([]);
              setIsAttachModalOpen(true);
            }}
            className="gap-1.5"
          >
            <Plus className="size-3.5" />
            Attach Connector
          </Button>
        </div>
      </div>

      {/* Currently Attached Connectors */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Attached App Connectors ({attachedList.length})
          </h3>
          <span className="text-[11px] text-muted-foreground font-mono">
            {agentTools.length} total active tools
          </span>
        </div>

        {attachedList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center bg-surface/30">
            <AppConnectorIcon connectorId="microsoft_teams" size={32} className="mx-auto mb-2 opacity-40" />
            <h4 className="text-xs font-semibold text-foreground">No App Connectors Attached Yet</h4>
            <p className="text-[11px] text-muted-foreground max-w-md mx-auto mt-1 mb-4">
              Give this agent real-world capabilities like sending Microsoft Teams or Slack alerts, creating Jira issues, querying databases, or calling custom REST APIs.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveConnectorToAttach(connectors[0] || null);
                setSelectedActionIds([]);
                setIsAttachModalOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              Browse & Attach Connectors
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {attachedList.map(({ connector, actions }) => {
              const hasLiveConnection = connector.connectionsCount > 0;
              return (
                <div
                  key={connector.id}
                  className="rounded-xl border border-border bg-surface p-4 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-2xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex size-10 items-center justify-center rounded-xl shrink-0 p-2 border border-border/80 bg-surface-raised"
                          style={{
                            borderColor: connector.color ? `${connector.color}40` : undefined,
                          }}
                        >
                          <AppConnectorIcon
                            connectorId={connector.id}
                            name={connector.name}
                            category={connector.category}
                            size={24}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground">
                              {connector.name}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.2 text-[9px] font-semibold border ${
                                hasLiveConnection
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
                                  : 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400'
                              }`}
                            >
                              {hasLiveConnection ? 'Connected' : 'Needs Auth'}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {connector.category?.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenAttachModal(connector)}
                          title="Configure enabled actions"
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-raised hover:text-foreground transition-colors cursor-pointer"
                        >
                          <Wrench className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveConnector(connector)}
                          title="Detach from agent"
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Enabled Actions List */}
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Enabled Actions ({actions.length})
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {actions.map((act) => (
                          <span
                            key={act.id}
                            className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-surface-raised/80 px-2 py-0.5 text-[10px] font-medium text-foreground"
                          >
                            <Zap className="size-2.5 text-primary" />
                            {act.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                      {connector.connectionsCount > 0
                        ? `${connector.connectionsCount} account connected`
                        : 'No accounts configured'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenAttachModal(connector)}
                      className="text-primary hover:underline font-medium cursor-pointer"
                    >
                      Manage Actions &rarr;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Attach / Configure Actions Modal */}
      {isAttachModalOpen && (
        <Dialog open={isAttachModalOpen} onOpenChange={setIsAttachModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Configure App Connector for {agent?.name}</DialogTitle>
              <DialogDescription>
                Select an App Connector and choose which actions the AI agent is allowed to invoke during autonomous reasoning.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4 pt-2">
              {/* Connector Selector Tabs */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Select App Connector
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-subtle">
                  {connectors.map((c) => {
                    const isSelected = activeConnectorToAttach?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setActiveConnectorToAttach(c);
                          const prefix = c.providerKey?.toLowerCase() || c.id;
                          const currentActive = (c.actions || [])
                            .filter((a) => agentTools.includes(`${prefix}_${a.id}`) || agentTools.includes(a.id))
                            .map((a) => a.id);
                          setSelectedActionIds(currentActive);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium shrink-0 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/40 font-semibold shadow-xs'
                            : 'border-border bg-surface hover:border-primary/40 hover:bg-surface-raised text-foreground'
                        }`}
                      >
                        <AppConnectorIcon connectorId={c.id} size={18} />
                        <span>{c.name}</span>
                        {c.connectionsCount > 0 && (
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Connector Details & Available Actions */}
              {activeConnectorToAttach && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                        <AppConnectorIcon connectorId={activeConnectorToAttach.id} size={16} />
                        Available Actions in {activeConnectorToAttach.name}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {activeConnectorToAttach.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          const allIds = (activeConnectorToAttach.actions || []).map((a) => a.id);
                          setSelectedActionIds(allIds);
                        }}
                        className="text-[11px] text-primary hover:underline font-medium"
                      >
                        Select All
                      </button>
                      <span className="text-muted-foreground">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedActionIds([])}
                        className="text-[11px] text-muted-foreground hover:underline"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 rounded-xl border border-border bg-surface-raised p-3">
                    {(activeConnectorToAttach.actions || []).length === 0 ? (
                      <div className="py-4 text-center text-xs text-muted-foreground">
                        No actions defined for this connector.
                      </div>
                    ) : (
                      activeConnectorToAttach.actions.map((act) => {
                        const isChecked = selectedActionIds.includes(act.id);
                        return (
                          <label
                            key={act.id}
                            className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                              isChecked
                                ? 'border-primary/40 bg-surface shadow-2xs'
                                : 'border-transparent hover:bg-surface/60'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedActionIds([...selectedActionIds, act.id]);
                                } else {
                                  setSelectedActionIds(
                                    selectedActionIds.filter((id) => id !== act.id)
                                  );
                                }
                              }}
                              className="mt-0.5 rounded border-border accent-primary cursor-pointer"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-xs text-foreground">
                                  {act.name}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {act.id}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                                {act.description}
                              </p>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </DialogBody>

            <DialogFooter className="border-t border-border pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAttachModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveAttachedActions}
                disabled={!activeConnectorToAttach}
              >
                Save Tool Permissions
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
