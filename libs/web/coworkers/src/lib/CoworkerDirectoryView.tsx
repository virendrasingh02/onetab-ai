import type { AICoworkerDetail } from '@org/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  ScrollArea,
  Skeleton,
  SkeletonAvatar,
  SkeletonText,
} from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Activity,
  Bot,
  Brain,
  Grid,
  Layers,
  List,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Users,
} from 'lucide-react';
import { type FC, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CoworkerAvatar } from './CoworkerAvatar.js';
import { CoworkerCreateDialog } from './CoworkerCreateDialog.js';
import { CoworkerProfilePanel } from './CoworkerProfilePanel.js';
import { CoworkerStatusDot } from './CoworkerStatusDot.js';
import { useCoworkers, useWorkspaceCoworkerLogs } from './use-coworkers.js';

export const CoworkerDirectoryView: FC = () => {
  const navigate = useNavigate();
  const { workspaceId = '', slug: workspaceSlug = '' } = useCurrentWorkspace();

  const { data: coworkers, isLoading, error } = useCoworkers(workspaceId);
  const { data: workspaceLogs } = useWorkspaceCoworkerLogs(workspaceId);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'roster' | 'activity'>('roster');

  // Dialog & panel states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingCoworker, setEditingCoworker] = useState<AICoworkerDetail | null>(null);
  const [selectedCoworker, setSelectedCoworker] = useState<AICoworkerDetail | null>(null);

  const filteredCoworkers = useMemo(() => {
    if (!coworkers) return [];
    return coworkers.filter((cw) => {
      const matchesSearch =
        cw.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cw.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cw.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

      const matchesStatus =
        statusFilter === 'ALL' || cw.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [coworkers, searchQuery, statusFilter]);

  const handleStartChat = (cw: AICoworkerDetail) => {
    navigate(`/w/${workspaceSlug}/coworkers/${cw.id}`);
  };

  const handleOpenEdit = (cw: AICoworkerDetail) => {
    setEditingCoworker(cw);
    setCreateDialogOpen(true);
  };

  const handleCloseDialog = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open) {
      setEditingCoworker(null);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-border/80 bg-surface/50 px-6 py-5 backdrop-blur-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  AI Coworkers
                  <Badge variant="secondary" className="text-xs font-mono">
                    {coworkers?.length ?? 0}
                  </Badge>
                </h1>
                <p className="text-xs text-muted-foreground">
                  Persistent autonomous teammates with channel memberships, tool
                  permissions, and sub-agent delegation.
                </p>
              </div>
            </div>

            {/* Top Actions */}
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/40">
                <Button
                  variant={activeTab === 'roster' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setActiveTab('roster')}
                >
                  <Users className="h-3.5 w-3.5" />
                  Team Roster
                </Button>
                <Button
                  variant={activeTab === 'activity' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setActiveTab('activity')}
                >
                  <Activity className="h-3.5 w-3.5" />
                  Live Activity
                </Button>
              </div>

              <Button
                size="sm"
                className="h-8 gap-1.5 font-medium shadow-xs"
                onClick={() => {
                  setEditingCoworker(null);
                  setCreateDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add Coworker
              </Button>
            </div>
          </div>

          {/* Search and Filters Bar */}
          {activeTab === 'roster' && (
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pt-3 border-t border-border/40">
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, role, or skills..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs bg-surface"
                  />
                </div>

                <div className="flex items-center gap-1">
                  {(
                    [
                      ['ALL', 'All'],
                      ['AVAILABLE', 'Available'],
                      ['WORKING', 'Working'],
                      ['IDLE', 'Idle'],
                    ] as const
                  ).map(([status, label]) => (
                    <Button
                      key={status}
                      variant={statusFilter === status ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setStatusFilter(status)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1 text-muted-foreground">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setViewMode('grid')}
                  title="Grid View"
                >
                  <Grid className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setViewMode('list')}
                  title="List View"
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </header>

        {/* Body View */}
        <ScrollArea className="flex-1 p-6">
          {(!coworkers || coworkers.length === 0) && isLoading ? (
            viewMode === 'grid' ? (
              <div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto"
                role="status"
                aria-busy="true"
                aria-label="Loading coworkers..."
              >
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface p-4 space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <SkeletonAvatar size="md" shape="rounded" />
                          <div className="space-y-1">
                            <SkeletonText width="w-28" size="sm" />
                            <SkeletonText width="w-16" size="xs" />
                          </div>
                        </div>
                        <Skeleton className="h-4 w-12 rounded-full" />
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <SkeletonText width="w-full" size="xs" />
                        <SkeletonText width="w-4/5" size="xs" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-7 w-16 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="space-y-2 max-w-6xl mx-auto"
                role="status"
                aria-busy="true"
                aria-label="Loading coworkers..."
              >
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <SkeletonAvatar size="md" shape="rounded" />
                      <div className="space-y-1">
                        <SkeletonText width="w-32" size="sm" />
                        <SkeletonText width="w-48" size="xs" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-7 w-16 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : error ? (
            <div className="flex h-64 items-center justify-center text-xs text-destructive">
              Failed to load AI coworkers. Please try again.
            </div>
          ) : activeTab === 'activity' ? (
            /* Live Activity Table */
            <div className="space-y-4 max-w-5xl mx-auto">
              <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-xs">
                <div className="border-b border-border bg-muted/30 px-4 py-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Telemetry & Execution Feed
                  </h3>
                </div>
                {workspaceLogs && workspaceLogs.length > 0 ? (
                  <div className="divide-y divide-border">
                    {workspaceLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start justify-between p-4 hover:bg-muted/10 transition-colors text-xs"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            <span
                              className={cn(
                                'inline-block h-2.5 w-2.5 rounded-full ring-2',
                                log.status === 'COMPLETED'
                                  ? 'bg-emerald-500 ring-emerald-500/20'
                                  : 'bg-rose-500 ring-rose-500/20',
                              )}
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">
                              {log.promptText || 'Autonomous Execution'}
                            </p>
                            <p className="text-muted-foreground text-[11px] mt-1 line-clamp-2">
                              {log.outputResult || 'Success'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4 space-y-1">
                          <span className="font-mono text-[10px] text-muted-foreground block">
                            {new Date(log.executedAt).toLocaleString()}
                          </span>
                          {log.tokensUsed > 0 && (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {log.tokensUsed} tokens
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No execution telemetry recorded yet.
                  </div>
                )}
              </div>
            </div>
          ) : filteredCoworkers.length === 0 ? (
            /* Empty State */
            <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                <Users className="h-8 w-8" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {searchQuery
                  ? 'No matching AI coworkers found'
                  : 'No AI coworkers yet'}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {searchQuery
                  ? 'Try adjusting your search terms or filter settings.'
                  : 'Assemble your team of autonomous AI colleagues. Give them roles, tools, and delegate sub-agents.'}
              </p>
              {!searchQuery && (
                <Button
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Create Your First Coworker
                </Button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
              {filteredCoworkers.map((cw) => {
                const isSelected = selectedCoworker?.id === cw.id;
                return (
                  <Card
                    key={cw.id}
                    className={cn(
                      'group relative flex flex-col justify-between overflow-hidden border transition-all duration-200 hover:shadow-md hover:border-primary/40',
                      isSelected ? 'ring-2 ring-primary border-primary' : 'bg-surface',
                    )}
                  >
                    <div>
                      <CardHeader className="p-4 pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <CoworkerAvatar
                              name={cw.name}
                              avatarUrl={cw.avatarUrl}
                              status={cw.status}
                              size="lg"
                            />
                            <div>
                              <CardTitle className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                                {cw.name}
                              </CardTitle>
                              <p className="text-xs font-medium text-primary mt-0.5">
                                {cw.role}
                              </p>
                            </div>
                          </div>
                          <CoworkerStatusDot status={cw.status} showLabel />
                        </div>
                        {cw.description && (
                          <CardDescription className="text-xs mt-2.5 line-clamp-2 text-muted-foreground leading-relaxed">
                            {cw.description}
                          </CardDescription>
                        )}
                      </CardHeader>

                      <CardContent className="px-4 py-2 space-y-3">
                        {/* Capabilities chips */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {cw.model || 'gpt-4o'}
                          </Badge>
                          {cw.permissions?.knowledgeAccess && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                            >
                              <Brain className="h-3 w-3" />
                              Knowledge
                            </Badge>
                          )}
                          {(cw.agentLinks?.length ?? 0) > 0 && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] gap-1 bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20"
                            >
                              <Bot className="h-3 w-3" />
                              {cw.agentLinks.length} sub-agents
                            </Badge>
                          )}
                          {(cw.appLinks?.length ?? 0) > 0 && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] gap-1 bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                            >
                              <Layers className="h-3 w-3" />
                              {cw.appLinks.length} apps
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="flex items-center justify-between border-t border-border/60 bg-muted/10 px-4 py-2.5 mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setSelectedCoworker(isSelected ? null : cw)
                        }
                      >
                        <Settings className="h-3.5 w-3.5" />
                        Profile & Tools
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5 font-medium"
                        onClick={() => handleStartChat(cw)}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Chat
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="space-y-2 max-w-6xl mx-auto">
              {filteredCoworkers.map((cw) => {
                const isSelected = selectedCoworker?.id === cw.id;
                return (
                  <div
                    key={cw.id}
                    className={cn(
                      'flex items-center justify-between rounded-xl border p-3 transition-all duration-150',
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-xs'
                        : 'border-border bg-surface hover:border-border/80',
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CoworkerAvatar
                        name={cw.name}
                        avatarUrl={cw.avatarUrl}
                        status={cw.status}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-foreground truncate">
                            {cw.name}
                          </h4>
                          <CoworkerStatusDot status={cw.status} size="xs" />
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {cw.role} — {cw.description || 'Autonomous coworker'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <Badge variant="outline" className="font-mono text-[10px] hidden sm:inline-flex">
                        {cw.model || 'gpt-4o'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() =>
                          setSelectedCoworker(isSelected ? null : cw)
                        }
                      >
                        <Settings className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Profile</span>
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1 font-medium"
                        onClick={() => handleStartChat(cw)}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Chat
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Slide-over Profile Panel */}
      {selectedCoworker && (
        <CoworkerProfilePanel
          coworker={selectedCoworker}
          workspaceId={workspaceId}
          onClose={() => setSelectedCoworker(null)}
          onEdit={handleOpenEdit}
          onStartChat={handleStartChat}
          className="w-80 lg:w-96 border-l border-border shrink-0 shadow-lg"
        />
      )}

      {/* Create / Edit Dialog */}
      <CoworkerCreateDialog
        open={createDialogOpen}
        onOpenChange={handleCloseDialog}
        workspaceId={workspaceId}
        coworker={editingCoworker}
      />
    </div>
  );
};
