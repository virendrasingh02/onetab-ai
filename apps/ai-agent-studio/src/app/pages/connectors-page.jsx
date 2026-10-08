import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Page,
  PageHeader,
  toast,
} from '@org/ui';
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  GitBranch,
  Layers,
  MessageSquare,
  Play,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Star,
  Trash2,
  Wrench,
  Zap,
} from 'lucide-react';
import { connectorService } from '../services/connectorService.js';
import { agentService } from '../services/agentService.js';
import { useStudioSession } from '../session-guard.js';
import { AppConnectorIcon } from '../components/common/app-connector-icon.jsx';

export function ConnectorsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeWorkspace } = useStudioSession();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // all | connected | disconnected

  // Modal State
  const [selectedConnectorForConfig, setSelectedConnectorForConfig] = useState(null);
  const [selectedConnectorForAgent, setSelectedConnectorForAgent] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  // New Connection Form State inside modal
  const [showAddConnForm, setShowAddConnForm] = useState(false);
  const [newConnName, setNewConnName] = useState('');
  const [newConnEmail, setNewConnEmail] = useState('');

  // Add to Agent state
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [selectedActionsForAgent, setSelectedActionsForAgent] = useState([]);

  // Custom Connector Builder state
  const [isCreateCustomOpen, setIsCreateCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('custom');
  const [customAuthType, setCustomAuthType] = useState('API_KEY');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customActionName, setCustomActionName] = useState('Call API Endpoint');
  const [customActionId, setCustomActionId] = useState('call_endpoint');

  // Load Connectors
  const { data: connectors = [], isLoading, refetch } = useQuery({
    queryKey: ['studio-app-connectors', activeWorkspace?.id],
    queryFn: () => connectorService.getConnectors(activeWorkspace?.id),
  });

  // Load Agents for "Add to Agent" modal
  const { data: agents = [] } = useQuery({
    queryKey: ['studio-agents-list', activeWorkspace?.id],
    queryFn: () => agentService.getAgents(activeWorkspace?.id),
  });

  const categories = useMemo(() => connectorService.getCategories(), []);

  // Filtered connectors
  const filteredConnectors = useMemo(() => {
    return connectors.filter((c) => {
      // Category filter
      if (selectedCategory !== 'all' && c.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (statusFilter === 'connected' && c.status !== 'connected') return false;
      if (statusFilter === 'disconnected' && c.status !== 'disconnected') return false;

      // Search query across name, description, actions, triggers, category
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesDesc = (c.description || '').toLowerCase().includes(q);
        const matchesCat = c.category.toLowerCase().includes(q);
        const matchesAction = c.actions?.some(
          (a) => a.name.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q),
        );
        const matchesTrigger = c.triggers?.some(
          (t) => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q),
        );
        return matchesName || matchesDesc || matchesCat || matchesAction || matchesTrigger;
      }

      return true;
    });
  }, [connectors, selectedCategory, statusFilter, searchQuery]);

  // Favorite connectors
  const favoriteConnectors = useMemo(() => {
    return connectors.filter((c) => c.isFavorite);
  }, [connectors]);

  // Summary counts
  const stats = useMemo(() => {
    const total = connectors.length;
    const connected = connectors.filter((c) => c.status === 'connected').length;
    const totalActions = connectors.reduce((acc, c) => acc + (c.actions?.length || 0), 0);
    const totalTriggers = connectors.reduce((acc, c) => acc + (c.triggers?.length || 0), 0);
    return { total, connected, totalActions, totalTriggers };
  }, [connectors]);

  // Mutations
  const toggleFavoriteMutation = useMutation({
    mutationFn: (connectorId) => connectorService.toggleFavorite(connectorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-app-connectors'] });
    },
  });

  const handleTestConnection = async (connId) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await connectorService.testConnection(connId);
      setTestResult(res);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('Failed to test connection');
    } finally {
      setIsTesting(false);
    }
  };

  const handleCreateConnection = async () => {
    if (!newConnName.trim()) {
      toast.error('Please provide a connection name.');
      return;
    }

    try {
      await connectorService.createConnection(activeWorkspace?.id, selectedConnectorForConfig.id, {
        name: newConnName.trim(),
        accountEmail: newConnEmail.trim() || 'user@company.com',
        accountName: newConnName.trim(),
      });
      toast.success(`Connected "${newConnName}" to ${selectedConnectorForConfig.name}`);
      setShowAddConnForm(false);
      setNewConnName('');
      setNewConnEmail('');
      refetch();
      // Reload active connector details in modal
      const updated = await connectorService.getConnectorById(selectedConnectorForConfig.id, activeWorkspace?.id);
      setSelectedConnectorForConfig(updated);
    } catch {
      toast.error('Failed to create connection');
    }
  };

  const handleDeleteConnection = async (connId) => {
    try {
      await connectorService.deleteConnection(connId);
      toast.success('Connection removed');
      refetch();
      if (selectedConnectorForConfig) {
        const updated = await connectorService.getConnectorById(selectedConnectorForConfig.id, activeWorkspace?.id);
        setSelectedConnectorForConfig(updated);
      }
    } catch {
      toast.error('Failed to delete connection');
    }
  };

  const handleAttachToAgent = async () => {
    if (!selectedAgentId) {
      toast.error('Please select an agent.');
      return;
    }
    const agent = agents.find((a) => a.id === selectedAgentId);
    if (!agent) return;

    // Register tool names on the agent
    const currentTools = Array.isArray(agent.tools) ? agent.tools : [];
    const prefix = selectedConnectorForAgent.providerKey?.toLowerCase() || selectedConnectorForAgent.id;
    const newToolNames = selectedActionsForAgent.map((actionId) => `${prefix}_${actionId}`);
    const merged = Array.from(new Set([...currentTools, ...newToolNames]));

    try {
      await agentService.updateAgent(activeWorkspace?.id, selectedAgentId, {
        tools: merged,
      });
      toast.success(`Added ${newToolNames.length} actions to ${agent.name}`);
      setSelectedConnectorForAgent(null);
    } catch {
      toast.error('Failed to attach actions to agent');
    }
  };

  const handleCreateCustomConnector = async () => {
    if (!customName.trim()) {
      toast.error('Please specify a connector name.');
      return;
    }

    try {
      await connectorService.createCustomConnector(activeWorkspace?.id, {
        name: customName.trim(),
        category: customCategory,
        authType: customAuthType,
        description: customDesc.trim() || `Custom integration with ${customName.trim()}`,
        baseUrl: customBaseUrl.trim(),
        apiKey: customApiKey.trim(),
        actions: [
          {
            id: customActionId.trim() || 'execute_action',
            name: customActionName.trim() || 'Execute Action',
            description: `Invokes ${customName.trim()} endpoint`,
          },
        ],
      });

      toast.success(`Created custom connector: ${customName}`);
      setIsCreateCustomOpen(false);
      setCustomName('');
      setCustomBaseUrl('');
      setCustomApiKey('');
      setCustomDesc('');
      refetch();
    } catch {
      toast.error('Failed to create custom connector');
    }
  };

  return (
    <Page>
      {/* Top Header */}
      <PageHeader
        title="App Connectors"
        description="Connect third-party enterprise tools, services, and APIs to give your AI agents and workflows real-world superpowers."
        actions={
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
              variant="outline"
              size="sm"
              onClick={() => setIsCreateCustomOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              New Custom Connector
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/workflows')}
              className="gap-1.5"
            >
              <GitBranch className="size-3.5" />
              Open Workflow Canvas
            </Button>
          </div>
        }
      />

      {/* Metric Counters Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-border bg-surface p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Connected Apps
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {stats.connected} <span className="text-xs font-normal text-muted-foreground">/ {stats.total}</span>
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="size-5" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Available Actions
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {stats.totalActions}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Wrench className="size-5" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Active Triggers
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {stats.totalTriggers}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500">
            <Zap className="size-5" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Connection Health
            </div>
            <div className="mt-1 text-2xl font-bold text-emerald-500">
              99.8%
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Shield className="size-5" />
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3 mb-6 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search apps, actions, triggers (e.g. 'teams', 'send message', 'meeting', 'sql')..."
            className="pl-9 h-10 bg-surface text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter */}
          <div className="flex items-center rounded-lg border border-border bg-surface p-0.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                statusFilter === 'all'
                  ? 'bg-surface-raised text-foreground font-semibold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({connectors.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('connected')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                statusFilter === 'connected'
                  ? 'bg-surface-raised text-foreground font-semibold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Connected ({stats.connected})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('disconnected')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                statusFilter === 'disconnected'
                  ? 'bg-surface-raised text-foreground font-semibold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Not Connected
            </button>
          </div>
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-3 mb-4">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                  : 'bg-surface border border-border text-muted-foreground hover:text-foreground hover:bg-surface-raised'
              }`}
            >
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Featured / Favorites Banner */}
      {!searchQuery && selectedCategory === 'all' && statusFilter === 'all' && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Star className="size-3.5 text-amber-500 fill-amber-500" />
              Pinned & Essential Connectors
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {favoriteConnectors.slice(0, 3).map((conn) => (
              <div
                key={conn.id}
                className="group p-3.5 rounded-xl border border-border bg-surface hover:border-primary/50 transition-all cursor-pointer flex items-center justify-between"
                onClick={() => navigate(`/connectors/${conn.id}`)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="size-10 rounded-xl flex items-center justify-center p-2 shadow-2xs border border-border/80 bg-surface-raised shrink-0"
                    style={{ borderColor: conn.color ? `${conn.color}40` : undefined }}
                  >
                    <AppConnectorIcon
                      connectorId={conn.id}
                      name={conn.name}
                      category={conn.category}
                      size={24}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5 truncate">
                      {conn.name}
                      {conn.status === 'connected' && (
                        <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {conn.actions?.length || 0} Actions • {conn.triggers?.length || 0} Triggers
                    </div>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Connectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredConnectors.map((connector) => {
          const isConn = connector.status === 'connected';
          const actionsCount = connector.actions?.length || 0;
          const triggersCount = connector.triggers?.length || 0;

          return (
            <Card
              key={connector.id}
              className="flex flex-col justify-between p-5 hover:border-border-hover hover:shadow-md transition-all group"
            >
              <div>
                {/* Header row: Icon, Name, Category, Favorite, Status */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="size-11 rounded-xl flex items-center justify-center p-2 shadow-2xs border border-border/80 bg-surface-raised shrink-0"
                      style={{ borderColor: connector.color ? `${connector.color}40` : undefined }}
                    >
                      <AppConnectorIcon
                        connectorId={connector.id}
                        name={connector.name}
                        category={connector.category}
                        size={26}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                          {connector.name}
                        </span>
                        {connector.verified && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-primary/10 text-primary"
                            title="Verified First-Party Connector"
                          >
                            Verified
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground capitalize">
                        {connector.category?.replace('_', ' ')} • {connector.authType}
                      </div>
                    </div>
                  </div>

                  {/* Favorite button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavoriteMutation.mutate(connector.id);
                    }}
                    className="p-1 rounded-md text-muted-foreground hover:text-amber-500 transition-colors"
                  >
                    <Star
                      className={`size-4 ${
                        connector.isFavorite ? 'fill-amber-500 text-amber-500' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4">
                  {connector.description}
                </p>

                {/* Badges: Actions count, Triggers count, Connections */}
                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-raised border border-border text-foreground">
                    <Wrench className="size-3 mr-1 text-muted-foreground" />
                    {actionsCount} Actions
                  </span>
                  {triggersCount > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-raised border border-border text-foreground">
                      <Zap className="size-3 mr-1 text-amber-500" />
                      {triggersCount} Triggers
                    </span>
                  )}
                  {connector.connectionsCount > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Check className="size-3 mr-1" />
                      {connector.connectionsCount} Connection{connector.connectionsCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Active Connection details if connected */}
                {isConn && connector.defaultAccount && (
                  <div className="rounded-lg bg-surface-raised/80 border border-border/80 px-2.5 py-1.5 text-[11px] text-muted-foreground mb-4 flex items-center justify-between">
                    <span className="truncate">
                      Connected as: <strong className="text-foreground">{connector.defaultAccount}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-border flex items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setSelectedConnectorForConfig(connector)}
                  className="flex-1 text-xs"
                >
                  <Settings className="size-3 mr-1" />
                  Configure
                </Button>

                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setSelectedConnectorForAgent(connector);
                    setSelectedActionsForAgent(connector.actions?.slice(0, 3).map((a) => a.id) || []);
                  }}
                  className="text-xs"
                  title="Attach tools to an AI Agent"
                >
                  <Bot className="size-3 mr-1 text-primary" />
                  Add to Agent
                </Button>

                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => navigate(`/connectors/${connector.id}`)}
                  className="text-xs"
                >
                  Details
                  <ChevronRight className="size-3 ml-0.5" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredConnectors.length === 0 && (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-surface">
          <Plug className="size-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">No Connectors Found</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            No app connectors matched "{searchQuery}". Try searching for another name, category, or clear filters.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setStatusFilter('all');
            }}
            className="mt-4 text-xs"
          >
            Clear Search & Filters
          </Button>
        </div>
      )}

      {/* 1. CONFIGURE & MULTI-CONNECTION MODAL */}
      {selectedConnectorForConfig && (
        <Dialog
          open={Boolean(selectedConnectorForConfig)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedConnectorForConfig(null);
              setShowAddConnForm(false);
              setTestResult(null);
            }
          }}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div
                  className="size-9 rounded-lg flex items-center justify-center font-bold text-white text-xs"
                  style={{ backgroundColor: selectedConnectorForConfig.color || '#3b82f6' }}
                >
                  {selectedConnectorForConfig.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <DialogTitle>Configure {selectedConnectorForConfig.name}</DialogTitle>
                  <DialogDescription>
                    Manage enterprise credentials, authorization tokens, and connections for this workspace.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <DialogBody className="space-y-4 pt-2">
              {/* Existing Connections list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-foreground">
                    Configured Connections ({selectedConnectorForConfig.connections?.length || 0})
                  </span>
                  {!showAddConnForm && (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setShowAddConnForm(true)}
                      className="gap-1 text-xs"
                    >
                      <Plus className="size-3" />
                      Add Connection
                    </Button>
                  )}
                </div>

                {selectedConnectorForConfig.connections?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedConnectorForConfig.connections.map((conn) => (
                      <div
                        key={conn.id}
                        className="p-3 rounded-lg border border-border bg-surface-raised flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground truncate">
                              {conn.name}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/10 text-emerald-500 font-medium">
                              {conn.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {conn.accountEmail || 'Account active'} • Last sync: {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleTimeString() : 'Recent'}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => handleTestConnection(conn.id)}
                            loading={isTesting}
                            className="text-[11px]"
                          >
                            Test Health
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => handleDeleteConnection(conn.id)}
                            className="text-destructive hover:bg-destructive/10 text-[11px]"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
                    No active connections found. Create a connection below to start using {selectedConnectorForConfig.name}.
                  </div>
                )}
              </div>

              {/* Health Test result callout */}
              {testResult && (
                <div
                  className={`p-3 rounded-lg border text-xs ${
                    testResult.success
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-destructive/30 bg-destructive/10 text-destructive'
                  }`}
                >
                  <div className="font-semibold">{testResult.message}</div>
                  <div className="text-[10px] mt-0.5 opacity-80 font-mono">
                    Latency: {testResult.durationMs}ms • Status: {testResult.status}
                  </div>
                </div>
              )}

              {/* Add New Connection inline form */}
              {showAddConnForm && (
                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                  <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>New Connection Setup</span>
                    <button
                      type="button"
                      onClick={() => setShowAddConnForm(false)}
                      className="text-muted-foreground hover:text-foreground text-xs"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-foreground">Connection Display Name</label>
                    <Input
                      value={newConnName}
                      onChange={(e) => setNewConnName(e.target.value)}
                      placeholder="e.g. Engineering Production Teams"
                      className="h-8 text-xs bg-surface"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-foreground">Account Email / Principal</label>
                    <Input
                      value={newConnEmail}
                      onChange={(e) => setNewConnEmail(e.target.value)}
                      placeholder="e.g. ops@company.com"
                      className="h-8 text-xs bg-surface"
                    />
                  </div>

                  <div className="rounded-lg bg-surface border border-border p-2.5 text-[11px] text-muted-foreground space-y-1">
                    <div className="font-semibold text-foreground flex items-center gap-1">
                      <Shield className="size-3 text-emerald-500" /> Secure Token Handling
                    </div>
                    <p>
                      OAuth refresh tokens are encrypted at rest with AES-256-GCM. Raw credentials will never be returned or exposed to frontend logs.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setShowAddConnForm(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={handleCreateConnection}
                      className="text-xs"
                    >
                      Authorize & Save Connection
                    </Button>
                  </div>
                </div>
              )}
            </DialogBody>

            <DialogFooter className="border-t border-border pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedConnectorForConfig(null)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  navigate(`/connectors/${selectedConnectorForConfig.id}`);
                  setSelectedConnectorForConfig(null);
                }}
              >
                Open Full Connector Studio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 2. ADD TO AGENT MODAL */}
      {selectedConnectorForAgent && (
        <Dialog
          open={Boolean(selectedConnectorForAgent)}
          onOpenChange={(open) => {
            if (!open) setSelectedConnectorForAgent(null);
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add {selectedConnectorForAgent.name} to AI Agent</DialogTitle>
              <DialogDescription>
                Register selected connector actions as callable tools for an autonomous agent.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Select AI Agent</label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">-- Choose an Agent --</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.role || 'Assistant'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Available Actions to Register
                </label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-border bg-surface-raised p-2">
                  {selectedConnectorForAgent.actions?.map((act) => {
                    const isChecked = selectedActionsForAgent.includes(act.id);
                    return (
                      <label
                        key={act.id}
                        className="flex items-center gap-2.5 p-1.5 rounded-md hover:bg-surface text-xs cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedActionsForAgent([...selectedActionsForAgent, act.id]);
                            } else {
                              setSelectedActionsForAgent(
                                selectedActionsForAgent.filter((id) => id !== act.id),
                              );
                            }
                          }}
                          className="rounded border-border accent-primary"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-foreground">{act.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {act.description}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="border-t border-border pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedConnectorForAgent(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAttachToAgent}
                disabled={!selectedAgentId || selectedActionsForAgent.length === 0}
              >
                Attach Tools to Agent
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* CREATE CUSTOM CONNECTOR MODAL */}
      {isCreateCustomOpen && (
        <Dialog
          open={isCreateCustomOpen}
          onOpenChange={(open) => {
            if (!open) setIsCreateCustomOpen(false);
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Custom App Connector</DialogTitle>
              <DialogDescription>
                Integrate any proprietary microservice, internal API, or SaaS endpoint into the AI Agent Studio.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Connector Name</label>
                <Input
                  placeholder="e.g. Acme Internal Billing API"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Category</label>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                  >
                    {categories.filter((c) => c.id !== 'all').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Authentication</label>
                  <select
                    value={customAuthType}
                    onChange={(e) => setCustomAuthType(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="API_KEY">API Key</option>
                    <option value="BEARER_TOKEN">Bearer Token</option>
                    <option value="BASIC_AUTH">Basic Auth</option>
                    <option value="CUSTOM">Custom Header</option>
                    <option value="OAUTH2">OAuth 2.0</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Base Endpoint URL</label>
                <Input
                  placeholder="https://api.internal.corp/v1"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">API Key / Token (Saved Securely)</label>
                <Input
                  type="password"
                  placeholder="••••••••••••••••"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Description</label>
                <Input
                  placeholder="Brief description of what this service handles"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-border">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Initial Action Name</label>
                  <Input
                    placeholder="Call API Endpoint"
                    value={customActionName}
                    onChange={(e) => setCustomActionName(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Action Identifier</label>
                  <Input
                    placeholder="call_endpoint"
                    value={customActionId}
                    onChange={(e) => setCustomActionId(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="border-t border-border pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateCustomOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateCustomConnector}
                disabled={!customName.trim()}
              >
                Create Connector
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Page>
  );
}
export default ConnectorsPage;
