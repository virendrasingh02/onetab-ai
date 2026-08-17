import {
  ProjectStatus,
  TaskStatus,
  type ProjectDetail,
  type Task,
} from '@org/types';
import {
  accentClasses,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Progress,
  ProjectGlyph,
  ScrollArea,
  SkeletonList,
  Toolbar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  Filter,
  FolderKanban,
  Import,
  Kanban,
  LayoutGrid,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { accentForHex } from './project-color.js';

const STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

const STATUS_ORDER: readonly ProjectStatus[] = [
  ProjectStatus.PLANNING,
  ProjectStatus.ACTIVE,
  ProjectStatus.ON_HOLD,
  ProjectStatus.COMPLETED,
  ProjectStatus.ARCHIVED,
];

export interface ProjectGalleryProps {
  projects: ProjectDetail[];
  /**
   * Every task in the workspace, used only for the completion bars — a project
   * carries `_count.tasks` but not how many of them are finished.
   */
  tasks: Task[];
  activeProjectId: string | undefined;
  isLoading?: boolean;
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onNewProject: () => void;
  onImport: () => void;
  onExportProject: (projectId: string) => void;
}

export function ProjectGallery({
  projects,
  tasks,
  activeProjectId,
  isLoading = false,
  onOpenProject,
  onDeleteProject,
  onNewProject,
  onImport,
  onExportProject,
}: ProjectGalleryProps) {
  const [search, setSearch] = useState('');
  const [layout, setLayout] = useState<'grid' | 'compact'>('grid');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');

  /*
   * Completion is read off the tasks rather than stored, so it stays correct as
   * cards are dragged between columns.
   */
  const stats = useMemo(() => {
    const counts = new Map<string, { total: number; done: number }>();
    for (const task of tasks) {
      const projectId = task.project?.id;
      if (!projectId) continue;
      const entry = counts.get(projectId) ?? { total: 0, done: 0 };
      entry.total += 1;
      if (task.status === TaskStatus.DONE) entry.done += 1;
      counts.set(projectId, entry);
    }
    return counts;
  }, [tasks]);

  const visibleProjects = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return projects.filter((project) => {
      if (statusFilter !== 'all' && project.status !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      return (
        project.name.toLowerCase().includes(needle) ||
        (project.description ?? '').toLowerCase().includes(needle) ||
        project.slug.toLowerCase().includes(needle)
      );
    });
  }, [projects, search, statusFilter]);

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 flex h-full flex-col overflow-hidden">
      <Toolbar className="mb-4 shrink-0 justify-between">
        <div className="relative w-48 sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            aria-label="Search projects"
            className="h-8 bg-muted/40 pl-8 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={statusFilter === 'all' ? 'outline' : 'secondary'}
                size="sm"
                className="h-8 gap-1.5 text-xs"
              >
                <Filter className="size-3.5 text-muted-foreground" />
                <span>
                  {statusFilter === 'all'
                    ? 'All statuses'
                    : STATUS_LABELS[statusFilter]}
                </span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-[11px]">
                Filter by status
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setStatusFilter('all')}
                className="gap-2 text-xs"
              >
                <Check
                  className={cn(
                    'size-3.5 text-primary',
                    statusFilter !== 'all' && 'opacity-0',
                  )}
                />
                All statuses
              </DropdownMenuItem>
              {STATUS_ORDER.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className="gap-2 text-xs"
                >
                  <Check
                    className={cn(
                      'size-3.5 text-primary',
                      statusFilter !== status && 'opacity-0',
                    )}
                  />
                  {STATUS_LABELS[status]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => setLayout('grid')}
              aria-pressed={layout === 'grid'}
              title="Grid layout"
              className={cn(
                'rounded p-1.5 transition-colors',
                layout === 'grid'
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setLayout('compact')}
              aria-pressed={layout === 'compact'}
              title="Compact layout"
              className={cn(
                'rounded p-1.5 transition-colors',
                layout === 'compact'
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Kanban className="size-3.5" />
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onImport}
            className="h-8 gap-1.5 text-xs"
          >
            <Import className="size-3.5 text-muted-foreground" />
            Import
          </Button>

          <Button
            size="sm"
            onClick={onNewProject}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <Plus className="size-4" />
            New Project
          </Button>
        </div>
      </Toolbar>

      <ScrollArea className="min-h-0 flex-1" contentClassName="pb-4">
        {isLoading ? (
          <SkeletonList rows={4} />
        ) : visibleProjects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban />}
            title={
              projects.length === 0
                ? 'No projects yet'
                : 'No projects match your search'
            }
            description={
              projects.length === 0
                ? 'Create a project to start filing tasks against it, or import a board from another tracker.'
                : 'Try a different term, or clear the status filter.'
            }
            action={
              projects.length === 0 ? (
                <Button size="sm" onClick={onNewProject} leadingIcon={<Plus />}>
                  New Project
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div
            className={cn(
              'grid gap-3',
              layout === 'grid' ? 'sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1',
            )}
          >
            {visibleProjects.map((project) => {
              const counted = stats.get(project.id);
              const total = counted?.total ?? project._count.tasks;
              const done = counted?.done ?? 0;
              const percent = total === 0 ? 0 : Math.round((done / total) * 100);
              const accent = accentClasses[accentForHex(project.color)];
              const isActive = project.id === activeProjectId;

              return (
                <Card
                  key={project.id}
                  onClick={() => onOpenProject(project.id)}
                  className={cn(
                    'cursor-pointer bg-surface text-foreground border-border',
                    'hover:border-border-strong hover:bg-surface-raised',
                    isActive && `ring-1 ${accent.ring} border-transparent`,
                  )}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {/*
                          The icon when the project has one, else the card's own
                          accent dot rather than `ProjectGlyph`'s raw swatch —
                          the accent is themed and already tints the progress
                          bar and the selected ring below it.
                        */}
                        {project.icon ? (
                          <ProjectGlyph
                            icon={project.icon}
                            iconColor={project.iconColor}
                            size="sm"
                          />
                        ) : (
                          <span
                            className={cn(
                              'size-2 shrink-0 rounded-full',
                              accent.bg,
                            )}
                            aria-hidden
                          />
                        )}
                        <CardTitle className="truncate text-foreground">
                          {project.name}
                        </CardTitle>
                        {isActive ? (
                          <Check className="size-3.5 shrink-0 text-primary" />
                        ) : null}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            title="Project options"
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            <ChevronDown className="size-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-44"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuLabel className="text-[11px]">
                            {project.name}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onOpenProject(project.id)}
                            className="gap-2 text-xs"
                          >
                            <ArrowRight className="size-3.5 text-primary" />
                            Open board
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onExportProject(project.id)}
                            className="gap-2 text-xs"
                          >
                            <Download className="size-3.5 text-muted-foreground" />
                            Export as JSON
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDeleteProject(project.id)}
                            className="gap-2 text-xs text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                            Delete project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <CardDescription className="line-clamp-2 text-muted-foreground">
                      {project.description || 'No description.'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">
                        {STATUS_LABELS[project.status]}
                      </Badge>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {done}/{total} done
                      </span>
                    </div>

                    <Progress
                      value={percent}
                      accent={accentForHex(project.color)}
                      size="sm"
                      label={`${project.name} is ${percent}% complete`}
                    />

                    <div className="flex items-center justify-between text-[11px] text-subtle">
                      <span>
                        {project.milestones.length} milestone
                        {project.milestones.length === 1 ? '' : 's'}
                      </span>
                      <span>
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
