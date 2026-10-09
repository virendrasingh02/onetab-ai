import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Page,
  PageHeader,
  Button,
  Input,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { widgetsApi } from '@org/api-client';
import { useStudioSession } from '../session-guard.js';
import type { WidgetDefinition, WidgetCategory, WidgetTemplate } from '@org/types';
import { WidgetRenderer } from '../components/widgets/widget-renderer.js';
import {
  LayoutDashboard,
  Plus,
  Search,
  Filter,
  Sparkles,
  BarChart3,
  FormInput,
  Zap,
  CheckCircle2,
  ListTodo,
  ExternalLink,
  Copy,
  Trash2,
  History,
  RotateCcw,
  Sliders,
  Eye,
  Settings,
  Activity,
  Layers,
  ArrowUpRight,
  Shield,
  Loader2,
  Calendar,
  Clock,
  ChevronRight,
  Database,
  Code,
} from 'lucide-react';

export function WidgetCenterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeWorkspace } = useStudioSession();

  const [activeTab, setActiveTab] = useState<
    'library' | 'my_widgets' | 'templates' | 'instances' | 'executions' | 'versions' | 'settings'
  >('library');

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [previewWidget, setPreviewWidget] = useState<Partial<WidgetDefinition> | null>(null);
  const [selectedWidgetForVersions, setSelectedWidgetForVersions] = useState<string | null>(null);

  // Queries
  const { data: widgets = [], isLoading: loadingWidgets } = useQuery({
    queryKey: ['widgets', activeWorkspace.id, selectedCategory, search],
    queryFn: () =>
      widgetsApi.list(activeWorkspace.id, {
        category: selectedCategory !== 'ALL' ? (selectedCategory as WidgetCategory) : undefined,
        search: search || undefined,
      }),
  });

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['widget-templates'],
    queryFn: () => widgetsApi.listTemplates(),
  });

  const { data: executions = [], isLoading: loadingExecutions } = useQuery({
    queryKey: ['widget-executions', activeWorkspace.id],
    queryFn: () => widgetsApi.listExecutions(activeWorkspace.id, { limit: 25 }),
    enabled: activeTab === 'executions',
  });

  const { data: versions = [], isLoading: loadingVersions } = useQuery({
    queryKey: ['widget-versions', activeWorkspace.id, selectedWidgetForVersions],
    queryFn: () =>
      selectedWidgetForVersions
        ? widgetsApi.listVersions(activeWorkspace.id, selectedWidgetForVersions)
        : Promise.resolve([]),
    enabled: activeTab === 'versions' && Boolean(selectedWidgetForVersions),
  });

  // Mutations
  const duplicateMutation = useMutation({
    mutationFn: async (widget: WidgetDefinition) => {
      return widgetsApi.create(activeWorkspace.id, {
        name: `${widget.name} (Copy)`,
        description: widget.description,
        category: widget.category,
        config: widget.config,
        isPublic: widget.isPublic,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets', activeWorkspace.id] });
      toast.success('Widget duplicated successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to duplicate widget');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (widgetId: string) => {
      return widgetsApi.delete(activeWorkspace.id, widgetId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets', activeWorkspace.id] });
      toast.success('Widget removed');
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: async ({ widgetId, version }: { widgetId: string; version: number }) => {
      return widgetsApi.rollbackVersion(activeWorkspace.id, widgetId, version);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets', activeWorkspace.id] });
      queryClient.invalidateQueries({ queryKey: ['widget-versions', activeWorkspace.id] });
      toast.success('Widget rolled back to target version');
    },
  });

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'DATA_VISUALIZATION':
        return <BarChart3 className="size-4 text-indigo-400" />;
      case 'INTERACTIVE_INPUT':
        return <FormInput className="size-4 text-emerald-400" />;
      case 'AI_POWERED':
        return <Sparkles className="size-4 text-purple-400" />;
      case 'APP_CONNECTOR':
        return <Zap className="size-4 text-amber-400" />;
      case 'PRODUCTIVITY':
        return <ListTodo className="size-4 text-blue-400" />;
      default:
        return <LayoutDashboard className="size-4 text-primary" />;
    }
  };

  return (
    <Page width="wide" padding="none" className="space-y-6">
      <PageHeader
        title="Widget Center"
        description="Discover, design, configure, and orchestrate interactive UI widgets for AI agents, workflows, and dashboards."
        icon={<LayoutDashboard className="size-5" />}
        accent="violet"
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate('/widgets/new')}
              className="text-xs h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-xs"
            >
              <Plus className="mr-1.5 size-4" /> Create Widget
            </Button>
          </div>
        }
      />

      {/* Main Tabs Navigation */}
      <div className="border-b border-border">
        <nav className="flex space-x-6 text-xs font-medium">
          {[
            { id: 'library', label: 'Widget Library', count: widgets.length },
            { id: 'my_widgets', label: 'My Widgets' },
            { id: 'templates', label: 'Templates', count: templates.length },
            { id: 'instances', label: 'Widget Instances' },
            { id: 'executions', label: 'Execution History' },
            { id: 'versions', label: 'Versions' },
            { id: 'settings', label: 'Settings' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 border-b-2 py-3 px-1 transition-colors capitalize',
                activeTab === tab.id
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* 1. WIDGET LIBRARY & 2. MY WIDGETS TAB */}
      {(activeTab === 'library' || activeTab === 'my_widgets') && (
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-border">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search widgets by name, tags, or capabilities…"
                className="pl-9 h-9 text-xs bg-surface-raised"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'ALL', label: 'All Categories' },
                { id: 'DATA_VISUALIZATION', label: 'Data & Viz' },
                { id: 'INTERACTIVE_INPUT', label: 'Input & Forms' },
                { id: 'AI_POWERED', label: 'AI-Powered' },
                { id: 'APP_CONNECTOR', label: 'Connectors' },
                { id: 'PRODUCTIVITY', label: 'Productivity' },
              ].map((cat) => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? 'secondary' : 'ghost'}
                  size="xs"
                  onClick={() => setSelectedCategory(cat.id)}
                  className="text-xs h-7.5"
                >
                  {cat.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Grid of Widgets */}
          {loadingWidgets ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="size-8 animate-spin text-primary" />
              <span className="ml-3 text-sm text-muted-foreground">Loading widgets…</span>
            </div>
          ) : widgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-surface/40 space-y-3">
              <div className="p-3 rounded-full bg-primary/10 text-primary">
                <LayoutDashboard className="size-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">No Widgets Found</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {search
                    ? `No widgets matched "${search}". Try broadening your search or switching categories.`
                    : 'Start building custom data displays, forms, and AI output cards for your agents.'}
                </p>
              </div>
              <Button size="sm" onClick={() => navigate('/widgets/new')} className="text-xs">
                <Plus className="mr-1.5 size-3.5" /> Create First Widget
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {widgets.map((widget: WidgetDefinition) => (
                <Card
                  key={widget.id}
                  className="flex flex-col justify-between border-border bg-surface hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-muted/60">
                          {getCategoryIcon(widget.category)}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-semibold text-foreground">
                            {widget.name}
                          </CardTitle>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            v{widget.version} • {widget.category.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={widget.isPublic ? 'subtle' : 'outline'}
                        className="text-[9px] uppercase font-mono"
                      >
                        {widget.isPublic ? 'Public' : 'Personal'}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {widget.description || 'No description provided.'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-4 pt-2">
                    <div className="rounded border border-border/60 bg-muted/20 p-2.5">
                      <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                        <span>Component Type:</span>
                        <span className="font-mono text-foreground font-medium">
                          {widget.config?.componentType || 'metric_card'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-muted-foreground mt-1">
                        <span>Refresh Interval:</span>
                        <span className="font-mono text-foreground">
                          {widget.config?.refreshInterval ? `${widget.config.refreshInterval}s` : 'Manual'}
                        </span>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="p-4 pt-0 border-t border-border/40 mt-2 flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setPreviewWidget(widget)}
                        className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="mr-1 size-3" /> Preview
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => duplicateMutation.mutate(widget)}
                        title="Duplicate widget"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          if (confirm(`Delete widget "${widget.name}"?`)) {
                            deleteMutation.mutate(widget.id);
                          }
                        }}
                        title="Delete widget"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>

                    <Button
                      size="xs"
                      onClick={() => navigate(`/widgets/${widget.id}`)}
                      className="text-xs h-7 px-2.5"
                    >
                      Configure <ChevronRight className="ml-1 size-3" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. TEMPLATES TAB */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="bg-surface p-4 rounded-lg border border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Pre-Built Reusable Templates</h3>
              <p className="text-xs text-muted-foreground">
                Jumpstart your agent studio widgets with battle-tested visualization, input, and AI layouts.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl: WidgetTemplate) => (
              <Card
                key={tpl.id}
                className="flex flex-col justify-between border-border bg-surface hover:border-primary/40 transition-all"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                        {getCategoryIcon(tpl.category)}
                      </div>
                      <CardTitle className="text-sm font-semibold text-foreground">
                        {tpl.name}
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {tpl.category.split('_')[0]}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground mt-2">
                    {tpl.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-2">
                  <div className="flex flex-wrap gap-1">
                    {tpl.tags?.map((t: string) => (
                      <span
                        key={t}
                        className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </CardContent>

                <CardFooter className="p-4 pt-2 border-t border-border/40 flex justify-between items-center">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setPreviewWidget(tpl as any)}
                    className="text-xs h-7 text-muted-foreground hover:text-foreground"
                  >
                    <Eye className="mr-1 size-3" /> Preview
                  </Button>
                  <Button
                    size="xs"
                    onClick={() => navigate(`/widgets/new?template=${tpl.id}`)}
                    className="text-xs h-7 bg-primary text-primary-foreground font-medium"
                  >
                    Use Template <ChevronRight className="ml-1 size-3" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 4. WIDGET INSTANCES TAB */}
      {activeTab === 'instances' && (
        <Card className="p-6 text-center space-y-3">
          <Layers className="size-8 mx-auto text-muted-foreground/60" />
          <h3 className="text-sm font-semibold text-foreground">Active Placements & Placed Widgets</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Widgets can be embedded in Agent Blueprints, Workflow Canvas nodes, and Chat surfaces.
            Any placed widget automatically synchronizes configuration and state with this studio catalog.
          </p>
          <Button
            size="sm"
            onClick={() => navigate('/workflows')}
            variant="outline"
            className="text-xs"
          >
            Open Workflow Canvas <ExternalLink className="ml-1.5 size-3" />
          </Button>
        </Card>
      )}

      {/* 5. EXECUTION HISTORY TAB */}
      {activeTab === 'executions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Recent Widget Execution Telemetry</h3>
            <span className="text-xs text-muted-foreground">Tracking queries, user submits, and action dispatches</span>
          </div>

          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-raised border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3">Widget</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Latency</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 font-mono">
                {executions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground font-sans">
                      No widget actions executed in this workspace yet.
                    </td>
                  </tr>
                ) : (
                  executions.map((ex: any) => (
                    <tr key={ex.id} className="hover:bg-muted/30">
                      <td className="p-3 font-sans font-medium text-foreground">
                        {ex.widget?.name || ex.widgetId}
                      </td>
                      <td className="p-3 text-indigo-400">{ex.action}</td>
                      <td className="p-3">
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] font-semibold',
                            ex.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                          )}
                        >
                          {ex.status}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{ex.latencyMs ? `${ex.latencyMs}ms` : '—'}</td>
                      <td className="p-3 text-muted-foreground">{new Date(ex.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. VERSIONS & ROLLBACK TAB */}
      {activeTab === 'versions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-surface p-3 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <History className="size-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Select Widget to Inspect Versions:</span>
            </div>
            <select
              value={selectedWidgetForVersions || ''}
              onChange={(e) => setSelectedWidgetForVersions(e.target.value)}
              className="h-8 px-2.5 rounded border border-border bg-surface-raised text-xs text-foreground focus:outline-none"
            >
              <option value="">Choose a widget…</option>
              {widgets.map((w: any) => (
                <option key={w.id} value={w.id}>{w.name} (v{w.version})</option>
              ))}
            </select>
          </div>

          {selectedWidgetForVersions && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-foreground">Snapshot History</h4>
              {versions.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No historical versions recorded for this widget.</p>
              ) : (
                versions.map((ver: any) => (
                  <div
                    key={ver.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">v{ver.version}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(ver.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{ver.changeNote || 'Version snapshot'}</p>
                    </div>

                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() =>
                        rollbackMutation.mutate({
                          widgetId: selectedWidgetForVersions,
                          version: ver.version,
                        })
                      }
                      className="text-xs h-7"
                    >
                      <RotateCcw className="mr-1.5 size-3" /> Rollback to v{ver.version}
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* 7. SETTINGS TAB */}
      {activeTab === 'settings' && (
        <Card className="p-6 space-y-4 max-w-2xl">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Settings className="size-4 text-primary" /> Widget Center Workspace Policies
          </h3>
          <div className="space-y-3 text-xs text-muted-foreground">
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <div>
                <span className="font-medium text-foreground">Auto-Refresh Maximum Frequency</span>
                <p className="text-[11px]">Enforce lower bound on widget periodic HTTP queries</p>
              </div>
              <Badge variant="subtle">15 seconds</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <div>
                <span className="font-medium text-foreground">SSRF Protection Engine</span>
                <p className="text-[11px]">Blocks requests targeting private IPs, AWS metadata, and loopbacks</p>
              </div>
              <Badge variant="subtle" className="text-emerald-500 font-mono">Enforced</Badge>
            </div>
            <div className="flex justify-between items-center py-2">
              <div>
                <span className="font-medium text-foreground">Audit Log Retention</span>
                <p className="text-[11px]">Days of execution history retained per widget</p>
              </div>
              <Badge variant="subtle">90 days</Badge>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Interactive Preview Modal */}
      {previewWidget && (
        <Dialog open={Boolean(previewWidget)} onOpenChange={() => setPreviewWidget(null)}>
          <DialogContent className="max-w-2xl bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                <LayoutDashboard className="size-4 text-primary" />
                <span>{previewWidget.name || 'Widget Preview'}</span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {previewWidget.category}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {previewWidget.description}
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 bg-muted/20 rounded-lg flex items-center justify-center min-h-[220px]">
              <div className="w-full max-w-lg">
                <WidgetRenderer
                  definition={previewWidget}
                  onAction={(name, payload) => toast.info(`Action fired: ${name}`)}
                  onRefresh={() => toast.success('Widget refreshed')}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setPreviewWidget(null)} className="text-xs">
                Close
              </Button>
              {previewWidget.id && (
                <Button
                  size="sm"
                  onClick={() => {
                    const id = previewWidget.id;
                    setPreviewWidget(null);
                    navigate(`/widgets/${id}`);
                  }}
                  className="text-xs"
                >
                  Open Builder
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Page>
  );
}
