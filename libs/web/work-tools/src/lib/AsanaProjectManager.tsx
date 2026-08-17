import { IconPicker, ProjectIconPicker, useIconEditor } from '@org/icons';
import {
  ProjectStatus,
  TaskStatus,
  type IconSelection,
  type ProjectDetail,
} from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  ProjectGlyph,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentUser } from '@org/auth';
import { useMembers } from '@org/web-members';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Filter,
  FolderKanban,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProjectDashboardView } from './asana/ProjectDashboardView.js';
import { ProjectListView } from './asana/ProjectListView.js';
import { ProjectTimelineView } from './asana/ProjectTimelineView.js';
import {
  countActiveFilters,
  EMPTY_FILTER,
  type BoardFilter,
} from './kanban/card-meta.js';
import { CardDetailsDialog } from './kanban/CardDetailsDialog.js';
import {
  ImportBoardDialog,
  type ImportResult,
} from './kanban/import/ImportBoardDialog.js';
import { LinearFilterMenu } from './kanban/LinearFilterMenu.js';
import { DEFAULT_PROJECT_HEX, PROJECT_COLORS } from './kanban/project-color.js';
import { ProjectGallery } from './kanban/ProjectGallery.js';
import {
  exportProjectBoard,
  importTasksInto,
  type ImportProgress,
} from './kanban/server-import.js';
import { membersFrom, useServerBoard } from './kanban/server-board.js';
import {
  ViewDisplayMenu,
  type ProjectViewMode,
} from './kanban/ViewDisplayMenu.js';
import { KanbanBoard } from './KanbanBoard.js';
import { useProjectMutations, useProjects, useTasks } from './use-work-tools.js';

export type AsanaViewMode = ProjectViewMode;

const PROJECT_STATUSES: readonly ProjectStatus[] = [
  ProjectStatus.PLANNING,
  ProjectStatus.ACTIVE,
  ProjectStatus.ON_HOLD,
  ProjectStatus.COMPLETED,
  ProjectStatus.ARCHIVED,
];

const STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

/** A name as the project's URL segment, which the API requires and validates. */
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/**
 * Projects and their tasks.
 *
 * The single owner of workspace, project selection and board state: the board,
 * list, timeline and dashboard views are all projections of the same tasks
 * query, so nothing here keeps a second copy of it.
 */
export function AsanaProjectManager() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { workspaceId } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const membersQuery = useMembers(workspaceId);
  const projectsQuery = useProjects(workspaceId);
  const projectMutations = useProjectMutations(workspaceId);

  /** Every task in the workspace, for the gallery's completion bars. */
  const allTasks = useTasks(workspaceId);

  const projects = projectsQuery.data ?? [];
  const members = useMemo(
    () => membersFrom(membersQuery.data),
    [membersQuery.data],
  );

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ProjectViewMode>('board');

  // The URL is the source of truth for which project is open, so a link into a
  // board survives a reload and the back button moves between projects.
  const projectParam = searchParams.get('project');
  const activeProject: ProjectDetail | undefined =
    projects.find((project) => project.id === (projectParam ?? selectedProjectId)) ??
    projects[0];

  useEffect(() => {
    const openNewProject = searchParams.get('newProject') === 'true';
    // `?import=true` lets any entry point — the create menu, a link in an
    // onboarding email — land straight on the importer.
    const openImport = searchParams.get('import') === 'true';
    const showProjects = searchParams.get('view') === 'projects';
    if (!openNewProject && !openImport && !showProjects) return;

    if (openNewProject) setIsNewProjectOpen(true);
    if (openImport) setIsImportOpen(true);
    if (showProjects) setViewMode('projects');

    /*
     * These three are one-shot commands, not state, so they have to be consumed.
     * Left in the URL, closing the dialog and clicking the same sidebar link
     * again produced a byte-identical location — `useSearchParams` memoises on
     * `location.search`, so the object identity never changed, this effect never
     * re-ran, and "New project" silently did nothing every time after the first.
     */
    const next = new URLSearchParams(searchParams);
    next.delete('newProject');
    next.delete('import');
    next.delete('view');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const openProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSearchParams({ project: projectId });
    setViewMode('board');
  };

  const board = useServerBoard({
    workspaceId,
    project: activeProject,
    members,
    currentUserId: currentUser?.id,
  });

  const milestones = useMemo(
    () => (activeProject?.milestones ?? []).map((milestone) => milestone.title),
    [activeProject],
  );

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Board filter and menu state, shared with the board so the header controls
  // and the columns agree on one filter.
  const [filter, setFilter] = useState<BoardFilter>(EMPTY_FILTER);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [showAIFilterInput, setShowAIFilterInput] = useState(false);
  const filterCount = countActiveFilters(filter);

  const [isViewDisplayOpen, setIsViewDisplayOpen] = useState(false);

  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(
    null,
  );

  const [draft, setDraft] = useState<ProjectDraft>({
    name: '',
    slug: '',
    description: '',
    color: DEFAULT_PROJECT_HEX,
    status: ProjectStatus.ACTIVE as ProjectStatus,
    icon: null,
    iconColor: null,
  });

  const openNewProject = () => {
    setDraft({
      name: '',
      slug: '',
      description: '',
      color: DEFAULT_PROJECT_HEX,
      status: ProjectStatus.ACTIVE,
      // A suggestion rather than a blank: an unpicked project still gets a
      // glyph, and changing one is a click where choosing one from nothing is
      // a decision. `Folder` is in `ICON_REGISTRY` — a name that is not falls
      // through to being drawn as literal text.
      icon: 'Folder',
      iconColor: DEFAULT_PROJECT_HEX,
    });
    setIsNewProjectOpen(true);
  };

  const openEditProject = () => {
    if (!activeProject) return;
    setDraft({
      name: activeProject.name,
      slug: activeProject.slug,
      description: activeProject.description ?? '',
      color: activeProject.color ?? DEFAULT_PROJECT_HEX,
      status: activeProject.status,
      icon: activeProject.icon,
      iconColor: activeProject.iconColor,
    });
    setIsEditProjectOpen(true);
  };

  const handleCreateProject = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) return;

    try {
      const created = await projectMutations.create.mutateAsync({
        name,
        slug: draft.slug.trim() || slugify(name),
        description: draft.description.trim() || null,
        color: draft.color,
        icon: draft.icon,
        iconColor: draft.iconColor,
      });

      setIsNewProjectOpen(false);
      openProject(created.id);
    } catch {
      /*
       * The dialog already renders this through `create.error`, and it stays
       * open so the draft is not lost. Without the catch the rejection also
       * escaped as an unhandled one, which puts Vite's error overlay over the
       * whole app in dev — the failure looked like a crash rather than a
       * rejected name.
       */
    }
  };

  const handleEditProject = (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeProject || !draft.name.trim()) return;

    projectMutations.update.mutate({
      projectId: activeProject.id,
      input: {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        color: draft.color,
        status: draft.status,
        icon: draft.icon,
        iconColor: draft.iconColor,
      },
    });
    setIsEditProjectOpen(false);
  };

  const handleDeleteProject = (projectId: string) => {
    projectMutations.remove.mutate(projectId, {
      onSuccess: () => {
        if (activeProject?.id !== projectId) return;
        const next = projects.find((project) => project.id !== projectId);
        if (next) openProject(next.id);
        else setViewMode('projects');
      },
    });
  };

  const handleQuickAddTask = () => {
    board.dispatch({
      type: 'card/add',
      listId: TaskStatus.TODO,
      title: 'New Task',
      edge: 'top',
    });
  };

  /**
   * An import becomes real tasks on the target project — labels, checklists and
   * extra assignees are reported back as warnings rather than silently dropped.
   */
  const handleImport = async (result: ImportResult) => {
    if (!workspaceId) return;

    let projectId = activeProject?.id;
    if (result.mode === 'new') {
      const created = await projectMutations.create.mutateAsync({
        name: result.name,
        slug: slugify(result.name) || `import-${Date.now()}`,
        description: `Imported from ${result.source}.`,
        color: result.color,
      });
      projectId = created.id;
    }
    if (!projectId) return;

    const progress = await importTasksInto({
      workspaceId,
      projectId,
      board: result.board,
      onProgress: setImportProgress,
    });

    setImportProgress(progress);
    openProject(projectId);
  };

  const handleExportProject = async (projectId: string) => {
    if (!workspaceId) return;
    const project = projects.find((entry) => entry.id === projectId);
    if (!project) return;

    const json = await exportProjectBoard(workspaceId, project);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.slug || 'board'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!workspaceId) {
    return (
      <EmptyState
        icon={<FolderKanban />}
        title="No workspace selected"
        description="Open a workspace to see its projects and tasks."
        className="h-full"
      />
    );
  }

  const dialogs = (
    <>
      <ImportBoardDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImport={handleImport}
        currentProjectName={activeProject?.name}
      />

      <ProjectDialog
        open={isNewProjectOpen}
        onOpenChange={setIsNewProjectOpen}
        title="Create project"
        icon={<Sparkles className="w-4 h-4 text-primary" />}
        submitLabel="Create project"
        draft={draft}
        setDraft={setDraft}
        showStatus={false}
        pending={projectMutations.create.isPending}
        error={projectMutations.create.error}
        onSubmit={handleCreateProject}
      />

      <ProjectDialog
        open={isEditProjectOpen}
        onOpenChange={setIsEditProjectOpen}
        title="Edit project"
        icon={<Pencil className="w-4 h-4 text-primary" />}
        submitLabel="Save changes"
        draft={draft}
        setDraft={setDraft}
        showStatus
        pending={projectMutations.update.isPending}
        error={projectMutations.update.error}
        onSubmit={handleEditProject}
      />

      {importProgress ? (
        <ImportSummaryDialog
          progress={importProgress}
          onClose={() => setImportProgress(null)}
        />
      ) : null}
    </>
  );

  if (viewMode === 'projects') {
    return (
      <div className="flex h-full w-full flex-col bg-background text-foreground">
        <ProjectGallery
          projects={projects}
          tasks={allTasks.data ?? []}
          activeProjectId={activeProject?.id}
          isLoading={projectsQuery.isLoading}
          onOpenProject={openProject}
          onDeleteProject={handleDeleteProject}
          onNewProject={openNewProject}
          onImport={() => setIsImportOpen(true)}
          onExportProject={handleExportProject}
        />
        {dialogs}
      </div>
    );
  }

  if (!projectsQuery.isLoading && projects.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-background">
        <EmptyState
          icon={<FolderKanban />}
          title="No projects yet"
          description="Create a project to start filing tasks against it, or import a board from Trello, Jira, Linear, Asana or a CSV."
          action={
            <Button size="sm" leadingIcon={<Plus />} onClick={openNewProject}>
              New project
            </Button>
          }
          secondaryAction={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsImportOpen(true)}
            >
              Import a board
            </Button>
          }
        />
        {dialogs}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground overflow-hidden">
      {/* Top Header */}
      <header className="relative flex flex-wrap items-center justify-between border-b border-border/50 bg-card/60 px-6 py-3.5 gap-4">
        <div className="flex items-center gap-2.5">
          {/*
            On a board there is a project to write to, so the header marker is
            the picker itself and a change saves on selection — unlike the
            dialogs, which hold the choice until the form is submitted.
          */}
          {activeProject ? (
            <ProjectIconPicker
              workspaceId={workspaceId}
              project={activeProject}
              align="start"
              trigger={
                <button
                  type="button"
                  aria-label={`Change icon for ${activeProject.name}`}
                  className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-muted"
                >
                  <ProjectGlyph
                    icon={activeProject.icon}
                    iconColor={activeProject.iconColor}
                    color={activeProject.color}
                    size="md"
                  />
                </button>
              }
            />
          ) : (
            <ProjectGlyph size="md" />
          )}

          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {activeProject?.name ?? 'Projects'}
          </h1>

          {activeProject ? (
            <Badge variant="neutral" className="text-[10px]">
              {STATUS_LABELS[activeProject.status]}
            </Badge>
          ) : null}

          {activeProject ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Project options"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem
                  onClick={openEditProject}
                  className="text-xs gap-2"
                >
                  <Pencil className="size-3.5 text-primary" />
                  Edit project details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setViewMode('projects')}
                  className="text-xs gap-2"
                >
                  <FolderKanban className="size-3.5 text-muted-foreground" />
                  All projects
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDeleteProject(activeProject.id)}
                  className="text-xs gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {/* Right Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-36 sm:w-52">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Filter tasks..."
              value={filter.query}
              onChange={(e) =>
                setFilter((prev) => ({ ...prev, query: e.target.value }))
              }
              className="pl-8 text-xs h-8 bg-muted/40"
            />
          </div>

          <div className="relative">
            <Button
              variant={isFilterMenuOpen || filterCount > 0 ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
              className="gap-1.5 text-xs h-8 font-medium cursor-pointer"
            >
              <Filter className="size-3.5 text-muted-foreground" />
              <span>Filter</span>
              {filterCount > 0 ? (
                <Badge variant="count" className="bg-primary/20 text-primary">
                  {filterCount}
                </Badge>
              ) : null}
            </Button>

            <LinearFilterMenu
              filter={filter}
              setFilter={setFilter}
              members={members}
              milestones={milestones}
              isOpen={isFilterMenuOpen}
              onClose={() => setIsFilterMenuOpen(false)}
              onActivateAIFilter={() => setShowAIFilterInput(true)}
            />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsViewDisplayOpen(!isViewDisplayOpen)}
              className={cn(
                'flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium border border-border/60 hover:bg-accent transition-colors cursor-pointer',
                isViewDisplayOpen &&
                  'bg-accent border-primary/50 text-foreground font-semibold',
              )}
              title="Switch view"
            >
              <SlidersHorizontal className="size-3.5 text-muted-foreground" />
              <span>View</span>
            </button>

            <ViewDisplayMenu
              isOpen={isViewDisplayOpen}
              onClose={() => setIsViewDisplayOpen(false)}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          </div>

          <Button
            size="sm"
            onClick={handleQuickAddTask}
            disabled={!activeProject || board.isMutating}
            className="gap-1.5 font-semibold text-xs h-8"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto bg-background/50">
        {board.isError ? (
          <EmptyState
            icon={<TriangleAlert />}
            title="Could not load tasks"
            description="The board could not be read from the server. Check your connection and try again."
          />
        ) : (
          <>
            {viewMode === 'list' && (
              <ProjectListView
                board={board.board}
                dispatch={board.dispatch}
                onSelectCard={(card) => setSelectedCardId(card.id)}
                searchQuery={filter.query}
                isLoading={board.isLoading}
              />
            )}

            {viewMode === 'board' && (
              <KanbanBoard
                workspaceId={workspaceId}
                board={board.board}
                dispatch={board.dispatch}
                milestones={milestones}
                isLoading={board.isLoading}
                filter={filter}
                setFilter={setFilter}
                isFilterMenuOpen={false}
                setIsFilterMenuOpen={setIsFilterMenuOpen}
                showAIFilterInput={showAIFilterInput}
                setShowAIFilterInput={setShowAIFilterInput}
              />
            )}

            {viewMode === 'timeline' && (
              <ProjectTimelineView
                board={board.board}
                onSelectCard={(card) => setSelectedCardId(card.id)}
                searchQuery={filter.query}
              />
            )}

            {viewMode === 'dashboard' && (
              <ProjectDashboardView
                board={board.board}
                status={activeProject?.status}
                onStatusChange={(status) => {
                  if (!activeProject) return;
                  projectMutations.update.mutate({
                    projectId: activeProject.id,
                    input: { status },
                  });
                }}
                onSelectCard={(card) => setSelectedCardId(card.id)}
              />
            )}
          </>
        )}
      </main>

      {/* Card Details Modal Dialog */}
      {selectedCardId && (
        <CardDetailsDialog
          workspaceId={workspaceId}
          board={board.board}
          cardId={selectedCardId}
          dispatch={board.dispatch}
          onClose={() => setSelectedCardId(null)}
        />
      )}

      {dialogs}
    </div>
  );
}

/* ------------------------------------------------------- project dialog --- */

interface ProjectDraft {
  name: string;
  slug: string;
  description: string;
  color: string;
  status: ProjectStatus;
  icon: string | null;
  iconColor: string | null;
}

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon: React.ReactNode;
  submitLabel: string;
  draft: ProjectDraft;
  setDraft: React.Dispatch<React.SetStateAction<ProjectDraft>>;
  /** The slug is fixed once the project exists, and status only applies then. */
  showStatus: boolean;
  pending: boolean;
  error: unknown;
  onSubmit: (event: React.FormEvent) => void;
}

function ProjectDialog({
  open,
  onOpenChange,
  title,
  icon,
  submitLabel,
  draft,
  setDraft,
  showStatus,
  pending,
  error,
  onSubmit,
}: ProjectDialogProps) {
  /*
   * The picker writes into the draft instead of to the server. `useIconEditor`
   * takes anything that can report a current icon and persist a new one, and
   * here "persist" is `setDraft` — so the dialog's Cancel discards the icon
   * along with everything else the user typed.
   */
  const iconEditor = useIconEditor(
    useMemo(
      () => ({
        icon: draft.icon,
        iconColor: draft.iconColor,
        save: (selection: IconSelection) =>
          setDraft((prev) => ({ ...prev, ...selection })),
      }),
      [draft.icon, draft.iconColor, setDraft],
    ),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              {icon}
              {title}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex items-end gap-3">
              {/*
                The icon sits beside the name because it is part of naming the
                project. It saves with the form rather than on selection — the
                project may not exist yet, and on edit the rest of the dialog is
                still a draft the user can abandon.
              */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Icon</label>
                <IconPicker
                  editor={iconEditor}
                  align="start"
                  allowUpload={false}
                  trigger={
                    <button
                      type="button"
                      aria-label="Choose project icon"
                      className="flex size-9 items-center justify-center rounded-md border border-border bg-surface-raised transition-colors hover:border-border-strong"
                    >
                      <ProjectGlyph
                        icon={draft.icon}
                        iconColor={draft.iconColor}
                        color={draft.color}
                        size="md"
                      />
                    </button>
                  }
                />
              </div>

              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-xs font-semibold" htmlFor="project-name">
                  Project name
                </label>
                <Input
                  id="project-name"
                  required
                  placeholder="e.g. Q4 Mobile App Launch"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      name: e.target.value,
                      // The slug follows the name until it is edited by hand, at
                      // which point it stops tracking.
                      slug:
                        prev.slug === '' || prev.slug === slugify(prev.name)
                          ? slugify(e.target.value)
                          : prev.slug,
                    }))
                  }
                  className="text-xs"
                />
              </div>
            </div>

            {!showStatus ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" htmlFor="project-slug">
                  URL
                </label>
                <Input
                  id="project-slug"
                  placeholder={slugify(draft.name) || 'q4-mobile-app-launch'}
                  value={draft.slug}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  className="text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Lowercase letters, numbers and hyphens. Left blank, it is taken
                  from the name.
                </p>
              </div>
            ) : null}

            {showStatus ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Status</label>
                <Select
                  value={draft.status}
                  onValueChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      status: value as ProjectStatus,
                    }))
                  }
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold">Colour</label>
              <div className="flex items-center gap-1.5">
                {PROJECT_COLORS.map((option) => (
                  <button
                    key={option.hex}
                    type="button"
                    title={option.label}
                    aria-label={option.label}
                    aria-pressed={draft.color === option.hex}
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, color: option.hex }))
                    }
                    style={{ backgroundColor: option.hex }}
                    className={cn(
                      'size-6 rounded-full transition-transform',
                      draft.color === option.hex
                        ? 'ring-2 ring-ring ring-offset-2 ring-offset-background scale-110'
                        : 'hover:scale-105',
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-semibold"
                htmlFor="project-description"
              >
                Description
              </label>
              <Textarea
                id="project-description"
                rows={2}
                placeholder="Brief description of goals..."
                value={draft.description}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, description: e.target.value }))
                }
                className="text-xs"
              />
            </div>

            {error ? (
              <p className="gap-1.5 text-xs flex items-start text-destructive">
                <TriangleAlert className="size-3.5 shrink-0 mt-0.5" />
                {error instanceof Error
                  ? error.message
                  : 'The project could not be saved.'}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={pending || !draft.name.trim()}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------ import summary --- */

function ImportSummaryDialog({
  progress,
  onClose,
}: {
  progress: ImportProgress;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Imported {progress.created} of {progress.total} tasks
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          {progress.failed > 0 ? (
            <p className="gap-1.5 flex items-start text-destructive">
              <TriangleAlert className="size-3.5 shrink-0 mt-0.5" />
              {progress.failed} task{progress.failed === 1 ? '' : 's'} could not
              be created.
            </p>
          ) : null}

          {progress.warnings.length > 0 ? (
            <ul className="space-y-1.5 text-muted-foreground">
              {progress.warnings.map((warning) => (
                <li key={warning} className="gap-1.5 flex items-start">
                  <span aria-hidden className="mt-1.5 size-1 rounded-full bg-current" />
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <DialogFooter>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
