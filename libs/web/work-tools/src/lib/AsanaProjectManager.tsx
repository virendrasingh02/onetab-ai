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
  KbdShortcut,
  ProjectGlyph,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
  usePromptDialog,
} from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentUser } from '@org/auth';
import { workToolsApi } from '@org/api-client';
import {
  Command,
  Filter,
  FolderGit2,
  FolderKanban,
  GanttChartSquare,
  Hash,
  HeartPulse,
  Inbox,
  Kanban,
  Keyboard,
  LayoutDashboard,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCw,
  Search,
  Settings,
  SlidersHorizontal,
  Table,
  Target,
  Timeline,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { LinearCommandMenu } from './kanban/LinearCommandMenu.js';
import { LinearShortcutsDialog } from './kanban/LinearShortcutsDialog.js';
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
import {
  useCurrentWorkspace,
  useCycleMutations,
  useCycles,
  useEpicMutations,
  useEpics,
  useInitiativeMutations,
  useInitiatives,
  useIntakeMutations,
  useIntakeRequests,
  useModuleMutations,
  useModules,
  useProjectMutations,
  useProjects,
  useProjectUpdateMutations,
  useProjectUpdates,
  useTaskMutations,
  useTasks,
  useTeams,
  useWorkspaceMembers,
} from './use-work-tools.js';
import { ProjectSpreadsheetView } from './views/ProjectSpreadsheetView.js';
import { ProjectGanttView } from './views/ProjectGanttView.js';
import { CyclesPlanningView } from './views/CyclesPlanningView.js';
import { ModulesEpicsView } from './views/ModulesEpicsView.js';
import { InitiativesView } from './views/InitiativesView.js';
import { IntakeTriageView } from './views/IntakeTriageView.js';
import { ProjectUpdatesView } from './views/ProjectUpdatesView.js';
import { ProjectSettingsView } from './views/ProjectSettingsView.js';

export type AsanaViewMode = ProjectViewMode;

const PROJECT_STATUSES: readonly ProjectStatus[] = [
  ProjectStatus.PLANNING,
  ProjectStatus.ACTIVE,
  ProjectStatus.ON_HOLD,
  ProjectStatus.COMPLETED,
  ProjectStatus.ARCHIVED,
];

export type ProjectTemplate = 'blank' | 'sprint' | 'launch' | 'bug_tracker';

export interface StarterTask {
  title: string;
  status: TaskStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  description: string;
}

export const PROJECT_TEMPLATES: Array<{
  id: ProjectTemplate;
  name: string;
  description: string;
  icon: string;
  tasks: StarterTask[];
}> = [
  {
    id: 'blank',
    name: 'Blank Board',
    description: 'Clean agile workspace with custom statuses',
    icon: 'Folder',
    tasks: [],
  },
  {
    id: 'sprint',
    name: 'Agile Sprint',
    description:
      'Sprint planning, backlog grooming, active execution and retrospective',
    icon: 'Zap',
    tasks: [
      {
        title: 'Sprint Planning & Goal Alignment',
        status: TaskStatus.DONE,
        priority: 'HIGH',
        description: 'Define key sprint deliverables and success metrics.',
      },
      {
        title: 'Feature Development - Core MVP',
        status: TaskStatus.IN_PROGRESS,
        priority: 'URGENT',
        description:
          'Implement primary user stories, endpoints, and schema updates.',
      },
      {
        title: 'Code Review & Automated Test Suite',
        status: TaskStatus.TODO,
        priority: 'HIGH',
        description:
          'Ensure unit and integration tests pass with full coverage.',
      },
      {
        title: 'Staging Deployment & Verification',
        status: TaskStatus.TODO,
        priority: 'MEDIUM',
        description: 'Deploy to staging cluster and perform smoke tests.',
      },
      {
        title: 'Sprint Retrospective & Demo',
        status: TaskStatus.BACKLOG,
        priority: 'LOW',
        description: 'Review team velocity, blockers, and future improvements.',
      },
    ],
  },
  {
    id: 'launch',
    name: 'Product Launch',
    description:
      'Go-to-market plan, product UI/UX specs, QA and release checklist',
    icon: 'Rocket',
    tasks: [
      {
        title: 'Finalize Value Proposition & Positioning',
        status: TaskStatus.DONE,
        priority: 'HIGH',
        description: 'Align product positioning with target audience.',
      },
      {
        title: 'Product UI/UX Polish & Flow Walkthrough',
        status: TaskStatus.IN_PROGRESS,
        priority: 'URGENT',
        description: 'Verify all user interaction flows and responsive states.',
      },
      {
        title: 'Documentation & Knowledge Base Guides',
        status: TaskStatus.TODO,
        priority: 'MEDIUM',
        description: 'Publish updated documentation and onboarding articles.',
      },
      {
        title: 'Marketing Campaign & Community Release',
        status: TaskStatus.TODO,
        priority: 'HIGH',
        description: 'Schedule announcement broadcast and release pulse.',
      },
    ],
  },
  {
    id: 'bug_tracker',
    name: 'Bug & Incident Tracker',
    description:
      'Triage incoming defects, reproduction, hotfix, and verification',
    icon: 'Bug',
    tasks: [
      {
        title: 'Triage Incoming Bug Reports',
        status: TaskStatus.TODO,
        priority: 'URGENT',
        description: 'Review error telemetry and isolate root causes.',
      },
      {
        title: 'Reproduce Reported Edge Cases',
        status: TaskStatus.TODO,
        priority: 'HIGH',
        description: 'Create minimal reproduction test cases.',
      },
      {
        title: 'Implement Bug Fix & Add Regression Test',
        status: TaskStatus.BACKLOG,
        priority: 'HIGH',
        description:
          'Ensure bug is resolved without breaking existing features.',
      },
    ],
  },
];

const STATUS_LABELS: Record<ProjectStatus, string> = {
  [ProjectStatus.PLANNING]: 'Planning',
  [ProjectStatus.ACTIVE]: 'In progress',
  [ProjectStatus.ON_HOLD]: 'On hold',
  [ProjectStatus.COMPLETED]: 'Completed',
  [ProjectStatus.ARCHIVED]: 'Archived',
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function AsanaProjectManager() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { workspaceSlug, projectId: routeProjectId } = useParams<{
    workspaceSlug: string;
    projectId?: string;
  }>();
  const { workspaceId } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const membersQuery = useWorkspaceMembers(workspaceId);
  const projectsQuery = useProjects(workspaceId);
  const projectMutations = useProjectMutations(workspaceId);
  const taskMutations = useTaskMutations(workspaceId);
  const prompts = usePromptDialog();

  const teamsQuery = useTeams(workspaceId);
  const initiativesQuery = useInitiatives(workspaceId);
  const initiativeMutations = useInitiativeMutations(workspaceId);
  const intakeQuery = useIntakeRequests(workspaceId);
  const intakeMutations = useIntakeMutations(workspaceId);

  const projects = projectsQuery.data ?? [];
  const members = useMemo(
    () => membersFrom(membersQuery.data),
    [membersQuery.data],
  );
  const publicMembers = useMemo(
    () => (membersQuery.data ?? []).map((m) => m.user),
    [membersQuery.data],
  );

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<ProjectViewMode>('board');

  // `/tasks/:projectId` is the deep link; `?project=` is the old query form,
  // still honoured for links persisted server-side (search, notifications).
  const projectParam = routeProjectId ?? searchParams.get('project');
  const activeProject: ProjectDetail | undefined =
    projects.find(
      (project) => project.id === (projectParam ?? selectedProjectId),
    ) ?? projects[0];

  const epicsQuery = useEpics(workspaceId, activeProject?.id);
  const epicMutations = useEpicMutations(workspaceId);
  const modulesQuery = useModules(workspaceId, activeProject?.id);
  const moduleMutations = useModuleMutations(workspaceId);
  const cyclesQuery = useCycles(workspaceId, activeProject?.id);
  const cycleMutations = useCycleMutations(workspaceId);
  const projectUpdatesQuery = useProjectUpdates(workspaceId, activeProject?.id);
  const projectUpdateMutations = useProjectUpdateMutations(workspaceId);

  const rawTasksQuery = useTasks(workspaceId, activeProject?.id);
  const projectTasks = rawTasksQuery.data ?? [];

  useEffect(() => {
    const cardParam = searchParams.get('card') ?? searchParams.get('taskId');
    if (cardParam) {
      setSelectedCardId(cardParam);
    }

    const openNewProject = searchParams.get('newProject') === 'true';
    const openImport = searchParams.get('import') === 'true';
    const showProjects = searchParams.get('view') === 'projects';
    if (!openNewProject && !openImport && !showProjects && !cardParam) return;

    if (openNewProject) setIsNewProjectOpen(true);
    if (openImport) setIsImportOpen(true);
    if (showProjects) setViewMode('projects');

    const next = new URLSearchParams(searchParams);
    next.delete('newProject');
    next.delete('import');
    next.delete('view');
    next.delete('card');
    next.delete('taskId');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const openProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    navigate(`/w/${workspaceSlug}/tasks/${projectId}`);
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

  const [filter, setFilter] = useState<BoardFilter>(EMPTY_FILTER);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [showAIFilterInput, setShowAIFilterInput] = useState(false);
  const filterCount = countActiveFilters(filter);

  const [isViewDisplayOpen, setIsViewDisplayOpen] = useState(false);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const handleQuickAddTask = useCallback(() => {
    board.dispatch({
      type: 'card/add',
      listId: TaskStatus.TODO,
      title: 'New Task',
      edge: 'top',
    });
  }, [board]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        // The board owns ⌘K on its own routes. Registered in the capture phase
        // and stopping immediate propagation so the always-mounted global
        // command palette (AppShell's useCommandPalette, also on `window`)
        // doesn't ALSO toggle — otherwise both dialogs open on one keystroke.
        e.stopImmediatePropagation();
        e.preventDefault();
        setIsCommandMenuOpen((prev) => !prev);
        return;
      }

      if (isInput) return;

      if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleQuickAddTask();
      }

      if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsFilterMenuOpen((prev) => !prev);
      }

      if (e.key.toLowerCase() === 'v' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsViewDisplayOpen((prev) => !prev);
      }

      if (e.key === '?' || (e.key === '/' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleQuickAddTask]);

  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [, setImportProgress] = useState<ImportProgress | null>(null);

  const [draft, setDraft] = useState<ProjectDraft>({
    name: '',
    slug: '',
    description: '',
    color: DEFAULT_PROJECT_HEX,
    status: ProjectStatus.ACTIVE as ProjectStatus,
    icon: null,
    iconColor: null,
    template: 'blank',
  });

  const openNewProject = () => {
    setDraft({
      name: '',
      slug: '',
      description: '',
      color: DEFAULT_PROJECT_HEX,
      status: ProjectStatus.ACTIVE,
      icon: 'Folder',
      iconColor: DEFAULT_PROJECT_HEX,
      template: 'blank',
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
      template: 'blank',
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

      if (draft.template && draft.template !== 'blank' && workspaceId) {
        const tmpl = PROJECT_TEMPLATES.find((t) => t.id === draft.template);
        if (tmpl && tmpl.tasks.length > 0) {
          for (const starter of tmpl.tasks) {
            await workToolsApi.createTask(workspaceId, {
              projectId: created.id,
              title: starter.title,
              status: starter.status,
              priority: starter.priority as any,
              description: starter.description,
            });
          }
        }
      }

      setIsNewProjectOpen(false);
      openProject(created.id);
      toast.success(`Created project “${created.name}”`);
    } catch {
      toast.error('Failed to create project');
    }
  };

  const handleUpdateProject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeProject) return;
    const name = draft.name.trim();
    if (!name) return;

    try {
      await projectMutations.update.mutateAsync({
        projectId: activeProject.id,
        input: {
          name,
          description: draft.description.trim() || null,
          color: draft.color,
          status: draft.status,
          icon: draft.icon,
          iconColor: draft.iconColor,
        },
      });
      setIsEditProjectOpen(false);
      toast.success(`Updated project “${name}”`);
    } catch {
      toast.error('Failed to update project');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    const confirmed = await prompts.confirmAction({
      title: `Delete “${proj?.name ?? 'project'}”?`,
      description:
        'This deletes the project and all of its tasks, milestones and comments. This action cannot be undone.',
      confirmLabel: 'Delete project',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await projectMutations.remove.mutateAsync(projectId);
      if (selectedProjectId === projectId) {
        const remaining = projects.filter((p) => p.id !== projectId);
        if (remaining.length > 0) {
          openProject(remaining[0].id);
        } else {
          setSelectedProjectId(null);
          navigate(`/w/${workspaceSlug}/tasks`);
        }
      }
      toast.success('Project deleted');
    } catch {
      toast.error('Failed to delete project');
    }
  };

  const handleImport = async (result: ImportResult) => {
    if (!workspaceId) return;
    try {
      let targetProjectId = activeProject?.id;
      if (result.mode === 'new' || !targetProjectId) {
        const created = await projectMutations.create.mutateAsync({
          name: result.name,
          slug: result.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          color: result.color,
        });
        targetProjectId = created.id;
      }
      await importTasksInto({
        workspaceId,
        projectId: targetProjectId,
        board: result.board,
        members: publicMembers,
        onProgress: setImportProgress,
      });
      setIsImportOpen(false);
      openProject(targetProjectId);
      toast.success(`Imported board “${result.name}”`);
    } catch {
      toast.error('Failed to import board');
    } finally {
      setImportProgress(null);
    }
  };

  const dialogs = (
    <>
      {prompts.dialog}

      <ProjectDialog
        open={isNewProjectOpen}
        onOpenChange={setIsNewProjectOpen}
        title="Create a project"
        icon={<FolderKanban className="size-4 text-primary" />}
        submitLabel="Create project"
        draft={draft}
        setDraft={setDraft}
        showStatus={false}
        pending={projectMutations.create.isPending}
        onSubmit={handleCreateProject}
      />

      <ProjectDialog
        open={isEditProjectOpen}
        onOpenChange={setIsEditProjectOpen}
        title="Edit project"
        icon={<Pencil className="size-4 text-primary" />}
        submitLabel="Save changes"
        draft={draft}
        setDraft={setDraft}
        showStatus={true}
        pending={projectMutations.update.isPending}
        onSubmit={handleUpdateProject}
      />

      <ImportBoardDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImport={handleImport}
        currentProjectName={activeProject?.name}
      />

      <LinearCommandMenu
        isOpen={isCommandMenuOpen}
        onClose={() => setIsCommandMenuOpen(false)}
        lists={board.board.lists}
        onOpenCard={(cardId) => setSelectedCardId(cardId)}
        onQuickAddTask={(listId) => {
          if (listId) {
            handleQuickAddTask();
          }
        }}
        onViewModeChange={(mode) => setViewMode(mode)}
        onOpenFilter={() => setIsFilterMenuOpen(true)}
        onOpenNewProject={openNewProject}
      />

      <LinearShortcutsDialog
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </>
  );

  if (viewMode === 'projects') {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
        <ProjectGallery
          projects={projects}
          tasks={projectTasks}
          activeProjectId={activeProject?.id}
          onOpenProject={openProject}
          onNewProject={openNewProject}
          onImport={() => setIsImportOpen(true)}
          onDeleteProject={handleDeleteProject}
          onExportProject={async (id: string) => {
            const p = projects.find((x) => x.id === id);
            if (p && workspaceId) {
              const fileContent = await exportProjectBoard(workspaceId, p);
              const blob = new Blob([fileContent], {
                type: 'application/json',
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${p.slug}-board.json`;
              a.click();
              URL.revokeObjectURL(url);
            }
          }}
        />
        {dialogs}
      </div>
    );
  }

  if (!projectsQuery.isLoading && projects.length === 0) {
    return (
      <div className="min-h-0 flex w-full flex-1 flex-col items-center justify-center bg-background">
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
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Top Header */}
      <header className="px-6 py-1.5 min-h-12 gap-4 relative flex flex-wrap items-center justify-between border-b border-border/50 bg-card/60">
        <div className="gap-2.5 flex flex-wrap items-center">
          {activeProject ? (
            <ProjectIconPicker
              workspaceId={workspaceId}
              project={activeProject}
              align="start"
              trigger={
                <button
                  type="button"
                  aria-label={`Change icon for ${activeProject.name}`}
                  className="size-7 flex cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-muted"
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

          <h1 className="text-base font-semibold tracking-tight text-foreground">
            {activeProject?.name ?? 'Projects'}
          </h1>

          {/* Dynamic Ticket Prefix Badge with Click-to-Copy */}
          {activeProject?.ticketPrefix && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(
                  activeProject.ticketPrefix as string,
                );
                toast.success(`Copied prefix ${activeProject.ticketPrefix}`);
              }}
              className="gap-1 font-bold px-2 py-0.5 rounded inline-flex cursor-pointer items-center border border-primary/30 bg-primary/10 font-mono text-[11px] text-primary transition-colors hover:bg-primary/20"
              title="Click to copy ticket prefix"
            >
              <Hash className="size-3" />
              <span>{activeProject.ticketPrefix}</span>
            </button>
          )}

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
                  className="p-1 cursor-pointer rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                  onClick={() => setViewMode('settings')}
                  className="text-xs gap-2"
                >
                  <Settings className="size-3.5 text-muted-foreground" />
                  Project settings
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
        <div className="gap-2 flex flex-wrap items-center">
          <button
            type="button"
            onClick={() => setIsCommandMenuOpen(true)}
            className="gap-1.5 px-2.5 h-8 text-xs font-medium flex cursor-pointer items-center rounded-md border border-border/60 bg-surface text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Open Command Palette (⌘K)"
          >
            <Command className="size-3.5 text-muted-foreground" />
            <span className="sm:inline hidden">Search</span>
            <KbdShortcut
              keys={['mod', 'K']}
              size="xs"
              variant="muted"
              responsive
            />
          </button>

          <button
            type="button"
            onClick={() => setIsShortcutsOpen(true)}
            className="size-8 flex cursor-pointer items-center justify-center rounded-md border border-border/60 bg-surface text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard className="size-3.5" />
          </button>

          <div className="w-36 sm:w-48 relative">
            <Search className="w-3.5 h-3.5 left-2.5 top-2.5 absolute text-muted-foreground" />
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
              variant={
                isFilterMenuOpen || filterCount > 0 ? 'secondary' : 'outline'
              }
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
                'gap-1.5 px-3 h-8 text-xs font-medium flex cursor-pointer items-center rounded-md border border-border/60 transition-colors hover:bg-accent',
                isViewDisplayOpen &&
                  'font-semibold border-primary/50 bg-accent text-foreground',
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

      {/* Modern View Navigation Bar */}
      <nav className="px-6 py-1.5 gap-1 flex scrollbar-none items-center overflow-x-auto border-b border-border/50 bg-muted/30">
        {[
          { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
          { id: 'board', label: 'Board', icon: Kanban },
          { id: 'list', label: 'List', icon: List },
          { id: 'spreadsheet', label: 'Table', icon: Table },
          { id: 'timeline', label: 'Timeline', icon: Timeline },
          { id: 'gantt', label: 'Gantt', icon: GanttChartSquare },
          { id: 'cycles', label: 'Cycles', icon: RotateCw },
          { id: 'modules', label: 'Modules & Epics', icon: FolderGit2 },
          { id: 'initiatives', label: 'Initiatives', icon: Target },
          { id: 'intake', label: 'Intake', icon: Inbox },
          { id: 'updates', label: 'Updates', icon: HeartPulse },
          { id: 'settings', label: 'Settings', icon: Settings },
        ].map((v) => {
          const Icon = v.icon;
          const isActive = viewMode === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setViewMode(v.id as ProjectViewMode)}
              className={cn(
                'gap-1.5 px-3 py-1 text-xs font-medium inline-flex shrink-0 cursor-pointer items-center rounded-md transition-colors',
                isActive
                  ? 'font-semibold border border-border/70 bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              <Icon
                className={cn(
                  'size-3.5',
                  isActive ? 'text-primary' : 'opacity-70',
                )}
              />
              <span>{v.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main View Container */}
      <main className="scrollbar-subtle flex-1 overflow-y-auto bg-background/50">
        {board.isError ? (
          <EmptyState
            icon={<TriangleAlert />}
            title="Could not load tasks"
            description="The board could not be read from the server. Check your connection and try again."
          />
        ) : (
          <>
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

            {viewMode === 'list' && (
              <ProjectListView
                board={board.board}
                dispatch={board.dispatch}
                onSelectCard={(card) => setSelectedCardId(card.id)}
                searchQuery={filter.query}
                isLoading={board.isLoading}
              />
            )}

            {viewMode === 'spreadsheet' && (
              <ProjectSpreadsheetView
                tasks={projectTasks}
                members={publicMembers}
                onSelectTask={(task) => setSelectedCardId(task.id)}
                onUpdateTask={(taskId, patch) => {
                  taskMutations.update.mutate({ taskId, input: patch as any });
                }}
                onQuickAddTask={handleQuickAddTask}
                searchQuery={filter.query}
              />
            )}

            {viewMode === 'timeline' && (
              <ProjectTimelineView
                board={board.board}
                onSelectCard={(card) => setSelectedCardId(card.id)}
                searchQuery={filter.query}
              />
            )}

            {viewMode === 'gantt' && (
              <ProjectGanttView
                tasks={projectTasks}
                milestones={activeProject?.milestones}
                members={publicMembers}
                onSelectTask={(task) => setSelectedCardId(task.id)}
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

            {viewMode === 'cycles' && (
              <CyclesPlanningView
                cycles={cyclesQuery.data || []}
                tasks={projectTasks}
                members={publicMembers}
                onSelectTask={(task) => setSelectedCardId(task.id)}
                onCreateCycle={(input) => {
                  cycleMutations.create.mutate({
                    ...input,
                    projectId: activeProject?.id,
                  });
                }}
                onUpdateCycleStatus={(cycleId, status) => {
                  cycleMutations.update.mutate({ cycleId, input: { status } });
                }}
                onAssignTaskToCycle={(taskId, cycleId) => {
                  taskMutations.update.mutate({ taskId, input: { cycleId } });
                }}
              />
            )}

            {viewMode === 'modules' && activeProject && (
              <ModulesEpicsView
                projectId={activeProject.id}
                epics={epicsQuery.data || []}
                modules={modulesQuery.data || []}
                tasks={projectTasks}
                members={publicMembers}
                onSelectTask={(task) => setSelectedCardId(task.id)}
                onCreateEpic={(input) => epicMutations.create.mutate(input)}
                onCreateModule={(input) => moduleMutations.create.mutate(input)}
              />
            )}

            {viewMode === 'initiatives' && (
              <InitiativesView
                initiatives={initiativesQuery.data || []}
                projects={projects}
                members={publicMembers}
                onSelectProject={openProject}
                onCreateInitiative={(input) =>
                  initiativeMutations.create.mutate(input)
                }
              />
            )}

            {viewMode === 'intake' && (
              <IntakeTriageView
                intakeRequests={intakeQuery.data || []}
                projects={projects}
                members={publicMembers}
                onConvert={(intakeId, input) => {
                  intakeMutations.convert.mutate({ intakeId, input });
                }}
                onDecline={(intakeId) => {
                  intakeMutations.decline.mutate(intakeId);
                }}
                onCreateIntake={(input) => {
                  intakeMutations.create.mutate({
                    ...input,
                    projectId: activeProject?.id,
                  });
                }}
              />
            )}

            {viewMode === 'updates' && activeProject && (
              <ProjectUpdatesView
                projectId={activeProject.id}
                projectName={activeProject.name}
                updates={projectUpdatesQuery.data || []}
                onPublishUpdate={(input) => {
                  projectUpdateMutations.create.mutate(input);
                }}
              />
            )}

            {viewMode === 'settings' && activeProject && (
              <ProjectSettingsView
                project={activeProject}
                teams={teamsQuery.data || []}
                members={publicMembers}
                onUpdateProject={(patch) => {
                  projectMutations.update.mutate({
                    projectId: activeProject.id,
                    input: patch,
                  });
                }}
                onUpdateIdentifierSettings={(input) => {
                  projectMutations.updateIdentifierSettings.mutate({
                    projectId: activeProject.id,
                    input,
                  });
                }}
                onDeleteProject={() => handleDeleteProject(activeProject.id)}
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

export const UnifiedWorkManager = AsanaProjectManager;

interface ProjectDraft {
  name: string;
  slug: string;
  description: string;
  color: string;
  status: ProjectStatus;
  icon: string | null;
  iconColor: string | null;
  template?: ProjectTemplate;
}

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon: React.ReactNode;
  submitLabel: string;
  draft: ProjectDraft;
  setDraft: React.Dispatch<React.SetStateAction<ProjectDraft>>;
  showStatus: boolean;
  pending: boolean;
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
  onSubmit,
}: ProjectDialogProps) {
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
      <DialogContent className="sm:max-w-[460px]">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle className="gap-2 text-base font-bold flex items-center">
              {icon}
              {title}
            </DialogTitle>
          </DialogHeader>

          <div className="gap-4 py-4 flex flex-col">
            <div className="gap-3 flex items-end">
              <div className="gap-1.5 flex flex-col">
                <label className="text-xs font-semibold">Icon</label>
                <IconPicker
                  editor={iconEditor}
                  align="start"
                  allowUpload={false}
                  trigger={
                    <button
                      type="button"
                      aria-label="Choose project icon"
                      className="size-9 flex cursor-pointer items-center justify-center rounded-md border border-border bg-surface-raised transition-colors hover:border-border-strong"
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

              <div className="gap-1.5 flex flex-1 flex-col">
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

            <div className="gap-1.5 flex flex-col">
              <label className="text-xs font-semibold" htmlFor="project-slug">
                Project slug
              </label>
              <Input
                id="project-slug"
                required
                placeholder="project-slug"
                value={draft.slug}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    slug: slugify(e.target.value),
                  }))
                }
                className="text-xs font-mono"
              />
            </div>

            <div className="gap-1.5 flex flex-col">
              <label
                className="text-xs font-semibold"
                htmlFor="project-description"
              >
                Description
              </label>
              <Textarea
                id="project-description"
                rows={2}
                placeholder="What is this project delivering?"
                value={draft.description}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="text-xs"
              />
            </div>

            {!showStatus && (
              <div className="gap-2 flex flex-col">
                <label className="text-xs font-semibold">
                  Starter Template
                </label>
                <div className="gap-2 grid grid-cols-2">
                  {PROJECT_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, template: tmpl.id }))
                      }
                      className={cn(
                        'p-2.5 gap-1 flex cursor-pointer flex-col rounded-lg border text-left transition-all',
                        draft.template === tmpl.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border/60 hover:bg-muted/40',
                      )}
                    >
                      <span className="font-bold text-xs text-foreground">
                        {tmpl.name}
                      </span>
                      <span className="line-clamp-2 text-[10px] text-muted-foreground">
                        {tmpl.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="gap-1.5 flex flex-col">
              <label className="text-xs font-semibold">Accent color</label>
              <div className="gap-2 flex flex-wrap">
                {PROJECT_COLORS.map((opt) => (
                  <button
                    key={opt.hex}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        color: opt.hex,
                        iconColor: prev.iconColor ?? opt.hex,
                      }))
                    }
                    className={cn(
                      'size-6 cursor-pointer rounded-full transition-transform hover:scale-110',
                      draft.color === opt.hex
                        ? 'ring-2 ring-primary ring-offset-2'
                        : '',
                    )}
                    style={{ backgroundColor: opt.hex }}
                  />
                ))}
              </div>
            </div>

            {showStatus ? (
              <div className="gap-1.5 flex flex-col">
                <label
                  className="text-xs font-semibold"
                  htmlFor="project-status"
                >
                  Status
                </label>
                <Select
                  value={draft.status}
                  onValueChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      status: value as ProjectStatus,
                    }))
                  }
                >
                  <SelectTrigger id="project-status" className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((status) => (
                      <SelectItem
                        key={status}
                        value={status}
                        className="text-xs"
                      >
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={pending}
              disabled={!draft.name.trim()}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
