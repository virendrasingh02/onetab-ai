import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CodeBlock,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Page,
  toast,
} from '@org/ui';
import {
  Activity,
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  Database,
  ExternalLink,
  Flame,
  GitBranch,
  Layers,
  Lock,
  MessageSquare,
  Play,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Sliders,
  Terminal,
  Trash2,
  Wrench,
  Zap,
} from 'lucide-react';
import { connectorService } from '../services/connectorService.js';
import { useStudioSession } from '../session-guard.js';
import { AppConnectorIcon } from '../components/common/app-connector-icon.jsx';

export function ConnectorDetailPage() {
  const { connectorId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeWorkspace } = useStudioSession();

  const [activeTab, setActiveTab] = useState('actions'); // overview | connections | actions | triggers | permissions | analytics | logs

  // Test action sandbox state
  const [testingAction, setTestingAction] = useState(null);
  const [testInputJson, setTestInputJson] = useState('{}');
  const [testResult, setTestResult] = useState(null);
  const [isExecutingTest, setIsExecutingTest] = useState(false);

  // Add connection form state
  const [isAddConnOpen, setIsAddConnOpen] = useState(false);
  const [newConnName, setNewConnName] = useState('');
  const [newConnEmail, setNewConnEmail] = useState('');

  // Health test state
  const [isHealthTesting, setIsHealthTesting] = useState(false);

  // Fetch connector data
  const { data: connector, isLoading, refetch } = useQuery({
    queryKey: ['studio-connector-detail', connectorId, activeWorkspace?.id],
    queryFn: () => connectorService.getConnectorById(connectorId, activeWorkspace?.id),
    enabled: Boolean(connectorId),
  });

  // Fetch connections for this connector
  const { data: connections = [], refetch: refetchConns } = useQuery({
    queryKey: ['studio-connector-connections', connectorId, activeWorkspace?.id],
    queryFn: () => connectorService.getConnections(activeWorkspace?.id, connectorId),
    enabled: Boolean(connectorId),
  });

  // Metrics and logs
  const metrics = useMemo(() => connectorService.getMetrics(connectorId), [connectorId]);
  const auditLogs = useMemo(() => connectorService.getAuditLogs(connectorId), [connectorId]);

  const handleOpenTestModal = (action) => {
    setTestingAction(action);
    setTestResult(null);

    // Build sample input defaults
    const sample = {};
    if (action.inputSchema?.properties) {
      for (const [k, v] of Object.entries(action.inputSchema.properties)) {
        sample[k] = v.default || (v.type === 'number' ? 25 : v.type === 'boolean' ? true : `sample_${k}`);
      }
    }
    setTestInputJson(JSON.stringify(sample, null, 2));
  };

  const handleExecuteActionTest = async () => {
    if (!testingAction) return;
    setIsExecutingTest(true);
    setTestResult(null);

    try {
      let parsed = {};
      try {
        parsed = JSON.parse(testInputJson);
      } catch {
        toast.error('Invalid JSON in test input parameters');
        setIsExecutingTest(false);
        return;
      }

      const res = await connectorService.testAction(
        connectorId,
        testingAction.id,
        parsed,
        connections[0]?.name || 'Default Connection',
      );
      setTestResult(res);
      toast.success(`Action "${testingAction.name}" completed successfully`);
    } catch (err) {
      toast.error(`Action test failed: ${err.message}`);
    } finally {
      setIsExecutingTest(false);
    }
  };

  const handleCreateConnection = async () => {
    if (!newConnName.trim()) {
      toast.error('Please specify a connection name.');
      return;
    }

    try {
      await connectorService.createConnection(activeWorkspace?.id, connectorId, {
        name: newConnName.trim(),
        accountEmail: newConnEmail.trim() || 'user@company.com',
        accountName: newConnName.trim(),
      });
      toast.success(`Added connection "${newConnName}"`);
      setIsAddConnOpen(false);
      setNewConnName('');
      setNewConnEmail('');
      refetchConns();
      refetch();
    } catch {
      toast.error('Failed to save connection');
    }
  };

  const handleDeleteConnection = async (connId) => {
    try {
      await connectorService.deleteConnection(connId);
      toast.success('Connection deleted');
      refetchConns();
      refetch();
    } catch {
      toast.error('Failed to remove connection');
    }
  };

  const handleTestHealth = async (connId) => {
    setIsHealthTesting(true);
    try {
      const res = await connectorService.testConnection(connId);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('Connection health check failed');
    } finally {
      setIsHealthTesting(false);
    }
  };

  if (isLoading || !connector) {
    return (
      <Page>
        <div className="p-12 text-center text-muted-foreground text-sm">
          Loading connector details...
        </div>
      </Page>
    );
  }

  const isConnected = connections.some((c) => c.status === 'CONNECTED');

  return (
    <Page>
      {/* Top back navigation */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => navigate('/connectors')}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to App Connectors Catalog
        </button>
      </div>

      {/* Hero Header Card */}
      <div className="rounded-2xl border border-border bg-surface p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start md:items-center gap-4">
            <div
              className="size-14 rounded-2xl flex items-center justify-center p-2.5 shadow-sm border border-border/80 bg-surface-raised shrink-0"
              style={{ borderColor: connector.color ? `${connector.color}40` : undefined }}
            >
              <AppConnectorIcon
                connectorId={connector.id}
                name={connector.name}
                category={connector.category}
                size={34}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">{connector.name}</h1>
                {connector.verified && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
                    Verified Provider
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    isConnected
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isConnected ? 'Connected' : 'Not Connected'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-raised border border-border text-muted-foreground">
                  {connector.authType}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground max-w-2xl leading-relaxed">
                {connector.description}
              </p>
            </div>
          </div>

          {/* Action buttons in hero */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddConnOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              Add Connection
            </Button>
            {connections.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestHealth(connections[0].id)}
                loading={isHealthTesting}
                className="gap-1.5 text-xs"
              >
                <Activity className="size-3.5 text-emerald-500" />
                Test Health
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/workflows')}
              className="gap-1.5 text-xs"
            >
              <GitBranch className="size-3.5" />
              Use in Workflow
            </Button>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="flex items-center gap-1 border-t border-border mt-6 pt-3 overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', label: 'Overview', icon: Layers },
            { id: 'connections', label: `Connections (${connections.length})`, icon: Plug },
            { id: 'actions', label: `Actions (${connector.actions?.length || 0})`, icon: Wrench },
            { id: 'triggers', label: `Triggers (${connector.triggers?.length || 0})`, icon: Zap },
            { id: 'permissions', label: 'Permissions & Security', icon: Shield },
            { id: 'analytics', label: 'Usage Analytics', icon: Activity },
            { id: 'logs', label: 'Audit Logs', icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-surface-raised text-foreground font-semibold shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised/50'
                }`}
              >
                <Icon className={`size-3.5 ${isActive ? 'text-primary' : ''}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                Connector Overview & Capabilities
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The {connector.name} App Connector integrates external cloud services into your agent's execution runtime. It offers structured actions that the LLM can call during autonomous planning rounds, as well as reactive event triggers that initiate workflows.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-lg border border-border bg-surface-raised">
                  <div className="text-[11px] font-semibold text-foreground">Authentication Protocol</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{connector.authType} with Token Refresh</div>
                </div>
                <div className="p-3 rounded-lg border border-border bg-surface-raised">
                  <div className="text-[11px] font-semibold text-foreground">Isolation Scope</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Workspace-Isolated (Multi-Tenant Safe)</div>
                </div>
              </div>
            </div>

            {/* Prompt Injection & Security Defense */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                <Shield className="size-4" />
                Prompt Injection Protection & Security Boundaries
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                External content returned by {connector.name} (such as channel messages or user emails) is strictly treated as <strong>untrusted third-party data</strong>. The runtime ensures that instructions found in external messages cannot override agent guardrails or execute unauthorized destructive actions without explicit user approval.
              </p>
            </div>
          </div>

          {/* Sidebar Info Card */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Provider Metadata
              </h4>
              <div className="divide-y divide-border text-xs">
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-mono text-foreground">{connector.version}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <span className="text-foreground capitalize">{connector.category?.replace('_', ' ')}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">Active Connections</span>
                  <span className="text-foreground font-semibold">{connections.length}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">Health Status</span>
                  <span className="text-emerald-500 font-medium">99.8% Healthy</span>
                </div>
              </div>

              {connector.docsUrl && (
                <a
                  href={connector.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface-raised text-xs font-medium text-foreground hover:bg-surface-raised/80 transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                  Provider API Documentation
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONNECTIONS (MULTI-CONNECTION SUPPORT) */}
      {activeTab === 'connections' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Workspace Connections</h3>
              <p className="text-xs text-muted-foreground">
                You can configure multiple distinct connections for {connector.name} (e.g. "Company Core", "Client Support", "Testing").
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddConnOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              Add Connection
            </Button>
          </div>

          {connections.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {connections.map((conn) => (
                <Card key={conn.id} className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                          {conn.name}
                          <span className="px-2 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500">
                            {conn.status}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {conn.accountEmail} ({conn.accountName})
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 p-2.5 rounded-lg bg-surface-raised text-[11px] text-muted-foreground space-y-1">
                      <div><strong>Scopes:</strong> {conn.scopes?.join(', ') || 'Standard permissions'}</div>
                      <div><strong>Last Synced:</strong> {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : 'Recent'}</div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleTestHealth(conn.id)}
                      loading={isHealthTesting}
                      className="text-xs"
                    >
                      <Activity className="size-3 mr-1 text-emerald-500" />
                      Test Connection
                    </Button>

                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => handleDeleteConnection(conn.id)}
                      className="text-destructive hover:bg-destructive/10 text-xs"
                    >
                      <Trash2 className="size-3 mr-1" />
                      Disconnect
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
              No connections found for {connector.name}. Click "Add Connection" to connect this app.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ACTIONS (FULL STRUCTURED LIST & SANDBOX RUNNER) */}
      {activeTab === 'actions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Available Actions ({connector.actions?.length || 0})</h3>
              <p className="text-xs text-muted-foreground">
                Structured capabilities exposed to autonomous AI agents and workflow nodes.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {connector.actions?.map((action) => {
              const isDestructive = action.permissionLevel === 'destructive';
              const isWrite = action.permissionLevel === 'write';

              return (
                <div
                  key={action.id}
                  className="rounded-xl border border-border bg-surface p-4 hover:border-border-hover transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{action.name}</span>
                        <code className="text-[11px] font-mono text-muted-foreground bg-surface-raised px-1.5 py-0.5 rounded">
                          {action.id}
                        </code>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            isDestructive
                              ? 'bg-destructive/10 text-destructive'
                              : isWrite
                                ? 'bg-amber-500/10 text-amber-500'
                                : 'bg-primary/10 text-primary'
                          }`}
                        >
                          {action.permissionLevel || 'read'}
                        </span>
                        {action.requiresConfirmation && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <ShieldAlert className="size-3" />
                            Requires Human Approval
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {action.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => handleOpenTestModal(action)}
                        className="text-xs gap-1"
                      >
                        <Play className="size-3 text-emerald-500" />
                        Test Action
                      </Button>
                    </div>
                  </div>

                  {/* Schema Preview Accordion / Block */}
                  {action.inputSchema?.properties && (
                    <div className="mt-3 pt-3 border-t border-border/60">
                      <div className="text-[11px] font-medium text-muted-foreground mb-1.5">
                        Input Parameters & Schema:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(action.inputSchema.properties).map(([field, schema]) => (
                          <span
                            key={field}
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-surface-raised border border-border text-foreground"
                          >
                            <span className="text-primary font-bold mr-1">{field}:</span>
                            <span className="text-muted-foreground">{schema.type || 'string'}</span>
                            {action.inputSchema?.required?.includes(field) && (
                              <span className="text-destructive ml-1">*</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: TRIGGERS */}
      {activeTab === 'triggers' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Event Triggers ({connector.triggers?.length || 0})</h3>
            <p className="text-xs text-muted-foreground">
              Event subscriptions that initiate autonomous agent loops or workflow executions.
            </p>
          </div>

          {connector.triggers?.length > 0 ? (
            <div className="space-y-3">
              {connector.triggers.map((trigger) => (
                <div
                  key={trigger.id}
                  className="rounded-xl border border-border bg-surface p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap className="size-4 text-amber-500" />
                      <span className="font-semibold text-sm text-foreground">{trigger.name}</span>
                      <code className="text-[11px] font-mono text-muted-foreground bg-surface-raised px-1.5 py-0.5 rounded">
                        {trigger.eventType}
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {trigger.description}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="px-2 py-1 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-500">
                      Active Listener
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
              This connector does not expose event triggers. It is used as an on-demand Action provider.
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PERMISSIONS & GOVERNANCE */}
      {activeTab === 'permissions' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="size-4 text-primary" />
              Workspace Admin Access Control Matrix
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Workspace administrators control which AI agents and team members can invoke {connector.name} actions. Destructive actions can be gated with mandatory human approval.
            </p>

            <div className="divide-y divide-border border rounded-xl overflow-hidden text-xs">
              <div className="p-3 bg-surface-raised flex items-center justify-between font-semibold">
                <span>Action Category</span>
                <span>Default Enforcement Policy</span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-foreground">Read & Search Actions</div>
                  <div className="text-[11px] text-muted-foreground">List Teams, Channels, Search Messages</div>
                </div>
                <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                  Always Allowed (Autonomous)
                </span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-foreground">Standard Write Actions</div>
                  <div className="text-[11px] text-muted-foreground">Send Message, Reply, Create Meeting</div>
                </div>
                <span className="px-2.5 py-1 rounded bg-primary/10 text-primary font-medium">
                  Autonomous with Trace Logging
                </span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-foreground">Destructive Actions</div>
                  <div className="text-[11px] text-muted-foreground">Cancel Meeting, Delete Items</div>
                </div>
                <span className="px-2.5 py-1 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                  <ShieldAlert className="size-3" />
                  Requires Human Approval
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: USAGE ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-border bg-surface">
              <div className="text-[11px] text-muted-foreground uppercase font-medium">Total Invocations</div>
              <div className="text-2xl font-bold text-foreground mt-1">{metrics.totalExecutions}</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-surface">
              <div className="text-[11px] text-muted-foreground uppercase font-medium">Success Rate</div>
              <div className="text-2xl font-bold text-emerald-500 mt-1">{metrics.successRate}%</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-surface">
              <div className="text-[11px] text-muted-foreground uppercase font-medium">Avg Latency</div>
              <div className="text-2xl font-bold text-foreground mt-1">{metrics.avgLatencyMs}ms</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-surface">
              <div className="text-[11px] text-muted-foreground uppercase font-medium">Top Action</div>
              <div className="text-sm font-semibold text-foreground mt-2 truncate">{metrics.mostUsedAction}</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-surface divide-y divide-border overflow-hidden">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{log.actionName}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/10 text-emerald-500 font-medium">
                      {log.status}
                    </span>
                    <span className="text-muted-foreground font-mono text-[11px]">{log.durationMs}ms</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {log.details} • Caller: <strong>{log.user}</strong> via {log.connectionName}
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground shrink-0 font-mono">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1. TEST ACTION SANDBOX MODAL */}
      {testingAction && (
        <Dialog
          open={Boolean(testingAction)}
          onOpenChange={(open) => {
            if (!open) {
              setTestingAction(null);
              setTestResult(null);
            }
          }}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <Play className="size-4 text-emerald-500" />
                <div>
                  <DialogTitle>Test Action: {testingAction.name}</DialogTitle>
                  <DialogDescription>
                    Execute this action with live or dynamic expression parameters in the sandbox.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <DialogBody className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-foreground">Action Input (JSON Payload)</label>
                  <span className="text-[10px] text-muted-foreground">Supports variables like {'{{agent.summary}}'}</span>
                </div>
                <textarea
                  rows={6}
                  value={testInputJson}
                  onChange={(e) => setTestInputJson(e.target.value)}
                  className="w-full font-mono text-xs rounded-lg border border-border bg-zinc-950 text-zinc-100 p-2.5 focus:border-primary focus:outline-none"
                />
              </div>

              {testResult && (
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-500 flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" />
                      Execution Succeeded (Status: {testResult.statusCode})
                    </span>
                    <span className="font-mono text-muted-foreground text-[10px]">{testResult.durationMs}ms</span>
                  </div>
                  <CodeBlock
                    variant="compact"
                    language="json"
                    code={JSON.stringify(testResult.output, null, 2)}
                  />
                </div>
              )}
            </DialogBody>

            <DialogFooter className="border-t border-border pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTestingAction(null)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExecuteActionTest}
                loading={isExecutingTest}
                className="gap-1.5"
              >
                <Play className="size-3.5" />
                Run Action Test
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 2. ADD CONNECTION MODAL */}
      {isAddConnOpen && (
        <Dialog
          open={isAddConnOpen}
          onOpenChange={setIsAddConnOpen}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add {connector.name} Connection</DialogTitle>
              <DialogDescription>
                Create an enterprise connection reference for {connector.name}.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Connection Name</label>
                <Input
                  value={newConnName}
                  onChange={(e) => setNewConnName(e.target.value)}
                  placeholder="e.g. Engineering Team"
                  className="h-8 text-xs bg-surface"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Account Email</label>
                <Input
                  value={newConnEmail}
                  onChange={(e) => setNewConnEmail(e.target.value)}
                  placeholder="e.g. engineering@company.com"
                  className="h-8 text-xs bg-surface"
                />
              </div>

              <div className="rounded-lg bg-surface-raised border border-border p-3 text-[11px] text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-1">
                  <Shield className="size-3 text-emerald-500" /> AES-256 Token Encryption
                </div>
                <p>
                  Credentials are encrypted at rest with workspace key isolation. Secrets are never sent to client browsers.
                </p>
              </div>
            </DialogBody>

            <DialogFooter className="border-t border-border pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddConnOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateConnection}
              >
                Save Connection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Page>
  );
}
export default ConnectorDetailPage;
