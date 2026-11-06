import { IconPicker, ProjectIconPicker, useIconEditor } from '@org/icons';
import {
  ProjectStatus,
  TaskStatus,
  WorkspacePermission,
  type IconSelection,
  type ProjectDetail,
} from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogBody,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  toast,
  usePromptDialog,
  PageTabBar,
  Tabs,
  TabsTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentUser } from '@org/auth';
import { ApiError, workToolsApi } from '@org/api-client';
import {
  Check,
  ChevronDown,
  FileText,
  Filter,
  FolderGit2,
  FolderKanban,
  FolderOpen,
  GanttChartSquare,
  CircleDot,
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
import type { CreateTaskInput } from '@org/validation';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ProjectDashboardView } from './asana/ProjectDashboardView.js';
import { ProjectListView } from './asana/ProjectListView.js';
import { ProjectTimelineView } from './asana/ProjectTimelineView.js';
import {
  countActiveFilters,
  EMPTY_FILTER,
  matchesFilter,
  type BoardFilter,
} from './kanban/card-meta.js';
import { CardDetailsDialog } from './kanban/CardDetailsDialog.js';
import { CreateTaskDialog } from './kanban/CreateTaskDialog.js';
import {
  ImportBoardDialog,
  type ImportResult,
} from './kanban/import/ImportBoardDialog.js';
import { useImportLegacyCardProperties } from './kanban/legacy-card-import.js';
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
import { buildProjectActions } from './actions/project-actions.js';
import { useWorkspacePermission } from '@org/web-workspace';
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
import { ProjectFilesView } from './asana/ProjectFilesView.js';
import { ProjectDocsTab } from './views/ProjectDocsView.js';

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
    .replace(/^-+/, '')
    .slice(0, 48)
    .replace(/-+$/, '');
}

/** The tab lives in `?view=`, so a reload or a shared link lands on it. */
const VIEW_IDS: readonly ProjectViewMode[] = [
  'dashboard',
  'board',
  'list',
  'spreadsheet',
  'timeline',
  'gantt',
  'docs',
  'cycles',
  'modules',
  'initiatives',
  'intake',
  'updates',
  'files',
  'settings',
  'projects',
];

/** Views that draw the project's tasks, and so answer to search and filters. */
const TASK_VIEWS: readonly ProjectViewMode[] = [
  'board',
  'list',
  'spreadsheet',
  'timeline',
  'gantt',
];

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
  const { can } = useWorkspacePermission();

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
  const viewParam = searchParams.get('view') as ProjectViewMode | null;
  const viewMode: ProjectViewMode =
    viewParam && VIEW_IDS.includes(viewParam) ? viewParam : 'board';
  const setViewMode = useCallback(
    (mode: ProjectViewMode) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (mode === 'board') next.delete('view');
        else next.set('view', mode);
        return next;
      });
    },
    [setSearchParams],
  );
  const isTaskView = TASK_VIEWS.includes(viewMode);
  const canAddTask = isTaskView || viewMode === 'dashboard';

  // `/projects/:slug` is the deep link. An id still resolves (links persisted
  // server-side), as does the old `?project=` query form.
  const projectParam = routeProjectId ?? searchParams.get('project');
  const wantedProject = projectParam ?? selectedProjectId;
  const activeProject: ProjectDetail | undefined =
    projects.find(
      (project) =>
        project.id === wantedProject || project.slug === wantedProject,
    ) ?? projects[0];

  // An id in the path settles on the readable slug.
  const canonicalProjectSlug =
    routeProjectId && routeProjectId === activeProject?.id
      ? activeProject.slug
      : undefined;
  useEffect(() => {
    if (!canonicalProjectSlug) return;
    navigate(
      {
        pathname: `/w/${workspaceSlug}/projects/${canonicalProjectSlug}`,
        search: searchParams.toString(),
      },
      { replace: true },
    );
  }, [canonicalProjectSlug, navigate, searchParams, workspaceSlug]);

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
    if (!openNewProject && !openImport && !cardParam) return;

    if (openNewProject) setIsNewProjectOpen(true);
    if (openImport) setIsImportOpen(true);

    const next = new URLSearchParams(searchParams);
    next.delete('newProject');
    next.delete('import');
    next.delete('card');
    next.delete('taskId');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const openProject = (projectId: string, view?: ProjectViewMode) => {
    setSelectedProjectId(projectId);
    const slug = projects.find((project) => project.id === projectId)?.slug;
    navigate(
      `/w/${workspaceSlug}/projects/${slug ?? projectId}${view ? `?view=${view}` : ''}`,
    );
  };

  const board = useServerBoard({
    workspaceId,
    project: activeProject,
    members,
    currentUserId: currentUser?.id,
  });
  useImportLegacyCardProperties(workspaceId, board.tasks);

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

  /** Set while the new-task dialog is open: the column it starts on. */
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus | null>(null);
  const openNewTask = useCallback((status?: TaskStatus) => {
    setNewTaskStatus(status ?? TaskStatus.TODO);
  }, []);

  const createTask = async (input: CreateTaskInput) => {
    const task = await taskMutations.create.mutateAsync({
      ...input,
      projectId: activeProject?.id ?? null,
    });
    if (task) {
      toast.success('Task created', {
        description: task.title,
        action: {
          label: 'Open',
          onClick: () => setSelectedCardId(task.id),
        },
      });
    }
  };

  /** The board, narrowed by the search box and filter menu, for every task view. */
  const filteredBoard = useMemo(
    () => ({
      ...board.board,
      lists: board.board.lists.map((list) => ({
        ...list,
        cards: list.cards.filter((card) =>
          matchesFilter(card, filter, list.id),
        ),
      })),
    }),
    [board.board, filter],
  );
  const filteredTasks = useMemo(() => {
    const visible = new Set(
      filteredBoard.lists.flatMap((list) => list.cards.map((card) => card.id)),
    );
    return projectTasks.filter((task) => visible.has(task.id));
  }, [filteredBoard, projectTasks]);

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
      // A letter typed at an open dialog or menu is not a board shortcut.
      if (
        document.querySelector(
          '[role="dialog"][data-state="open"], [role="menu"][data-state="open"]',
        )
      ) {
        return;
      }

      const plainKey = !e.metaKey && !e.ctrlKey && !e.altKey;

      if (e.key.toLowerCase() === 'c' && plainKey && canAddTask) {
        e.preventDefault();
        openNewTask();
      }

      if (e.key.toLowerCase() === 'f' && plainKey && isTaskView) {
        e.preventDefault();
        setIsFilterMenuOpen((prev) => !prev);
      }

      if (
        e.key.toLowerCase() === 'v' &&
        plainKey &&
        (viewMode === 'board' || viewMode === 'list')
      ) {
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
  }, [canAddTask, isTaskView, openNewTask, viewMode]);

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

    // Names with nothing URL-safe in them leave this too short; the API then
    // derives the slug, and it adds a number if the slug is already taken.
    const slug = draft.slug.trim() || slugify(name);

    try {
      const created = await projectMutations.create.mutateAsync({
        name,
        slug: slug.length >= 2 ? slug : undefined,
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
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Failed to create project',
      );
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
    await removeProject(projectId);
  };

  /** Deletes without asking — for callers (the action menus) that already confirmed. */
  const removeProject = async (projectId: string) => {
    try {
      await projectMutations.remove.mutateAsync(projectId);
      // The open project, however it was reached: a project opened from a link
      // never set `selectedProjectId`, and the URL would be left pointing at it.
      if (activeProject?.id === projectId) {
        const remaining = projects.filter((p) => p.id !== projectId);
        if (remaining.length > 0) {
          openProject(remaining[0].id);
        } else {
          setSelectedProjectId(null);
          navigate(`/w/${workspaceSlug}/projects`);
        }
      }
      toast.success('Project deleted');
    } catch {
      toast.error('Failed to delete project');
    }
  };

  const exportProject = async (id: string) => {
    const p = projects.find((x) => x.id === id);
    if (!p || !workspaceId) return;
    const fileContent = await exportProjectBoard(workspaceId, p);
    const blob = new Blob([fileContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.slug}-board.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (result: ImportResult) => {
    if (!workspaceId) return;
    try {
      let targetProjectId = activeProject?.id;
      if (result.mode === 'new' || !targetProjectId) {
        const created = await projectMutations.create.mutateAsync({
          name: result.name,
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
        onQuickAddTask={openNewTask}
        onViewModeChange={(mode) => setViewMode(mode)}
        onOpenFilter={() => setIsFilterMenuOpen(true)}
        onOpenNewProject={openNewProject}
      />

      <LinearShortcutsDialog
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <CreateTaskDialog
        open={newTaskStatus !== null}
        onOpenChange={(open) => {
          if (!open) setNewTaskStatus(null);
        }}
        projectName={activeProject?.name}
        lists={board.board.lists}
        members={members}
        defaultStatus={newTaskStatus ?? TaskStatus.TODO}
        onCreate={createTask}
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
          projectActions={(project) =>
            buildProjectActions({
              project,
              can,
              path: `/w/${workspaceSlug}/projects/${project.id}`,
              onOpen: () => openProject(project.id),
              onOpenSettings: () => openProject(project.id, 'settings'),
              onRename: async () => {
                const name = await prompts.promptText({
                  title: 'Rename project',
                  label: 'Project name',
                  defaultValue: project.name,
                  confirmLabel: 'Rename',
                });
                if (!name || name === project.name) return;
                await projectMutations.update.mutateAsync({
                  projectId: project.id,
                  input: { name },
                });
              },
              onSetStatus: (status) =>
                projectMutations.update.mutateAsync({
                  projectId: project.id,
                  input: { status },
                }),
              onDelete: () => removeProject(project.id),
              onExport: () => exportProject(project.id),
            })
          }
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
      {/* Top Header — same look as the shared PageBar; kept hand-built for the project picker and filter menus. */}
      <header
        data-slot="page-bar"
        className="top-0 backdrop-blur-md px-3 sm:px-6 pt-2 pb-1 min-h-11 gap-2.5 sticky z-20 flex shrink-0 flex-wrap items-center justify-between bg-background/95"
      >
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
                    size="sm"
                  />
                </button>
              }
            />
          ) : (
            <ProjectGlyph size="sm" />
          )}

          {/* Project Title with Quick Project Switcher Dropdown */}
          <div className="gap-1.5 flex items-center">
            <h1 className="text-base font-medium truncate tracking-[-0.01em] text-foreground">
              {activeProject?.name ?? 'Projects'}
            </h1>
            {projects.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="p-1 rounded cursor-pointer text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                    title="Switch project"
                    aria-label="Switch project"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-56 max-h-72 overflow-y-auto"
                >
                  <DropdownMenuLabel className="text-[11px]">
                    Switch Project
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {projects.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => openProject(p.id)}
                      className="text-xs flex items-center justify-between"
                    >
                      <div className="gap-2 min-w-0 flex items-center">
                        <ProjectGlyph
                          icon={p.icon}
                          iconColor={p.iconColor}
                          color={p.color}
                          size="xs"
                        />
                        <span className="truncate">{p.name}</span>
                      </div>
                      {p.id === activeProject?.id && (
                        <Check className="size-3.5 shrink-0 text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setViewMode('projects')}
                    className="text-xs gap-2"
                  >
                    <FolderKanban className="size-3.5 text-muted-foreground" />
                    <span>View all projects</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={openNewProject}
                    className="text-xs gap-2"
                  >
                    <Plus className="size-3.5 text-muted-foreground" />
                    <span>New project</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {activeProject ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-1 cursor-pointer rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Project options"
                  aria-label="Project options"
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
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-xs gap-2">
                    <CircleDot className="size-3.5 text-muted-foreground" />
                    <span className="flex-1">Status</span>
                    <span className="text-muted-foreground">
                      {STATUS_LABELS[activeProject.status]}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-36">
                    {PROJECT_STATUSES.map((st) => (
                      <DropdownMenuItem
                        key={st}
                        onClick={() =>
                          projectMutations.update.mutate({
                            projectId: activeProject.id,
                            input: { status: st },
                          })
                        }
                        className="text-xs justify-between"
                      >
                        {STATUS_LABELS[st]}
                        {activeProject.status === st && (
                          <Check className="size-3.5 shrink-0 text-primary" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                {activeProject.ticketPrefix && (
                  <DropdownMenuItem
                    onClick={() => {
                      navigator.clipboard.writeText(
                        activeProject.ticketPrefix as string,
                      );
                      toast.success(
                        `Copied prefix ${activeProject.ticketPrefix}`,
                      );
                    }}
                    className="text-xs gap-2"
                  >
                    <Hash className="size-3.5 text-muted-foreground" />
                    <span className="flex-1">Copy ticket prefix</span>
                    <span className="font-mono text-muted-foreground">
                      {activeProject.ticketPrefix}
                    </span>
                  </DropdownMenuItem>
                )}
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
                  onClick={() => setIsShortcutsOpen(true)}
                  className="text-xs gap-2"
                >
                  <Keyboard className="size-3.5 text-muted-foreground" />
                  Keyboard shortcuts
                </DropdownMenuItem>
                {can(WorkspacePermission.DELETE) ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDeleteProject(activeProject.id)}
                      className="text-xs gap-2 text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                      Delete project
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {/* Right Action Bar. Each control shows only where it does something. */}
        <div className="gap-2 flex flex-wrap items-center">
          {isTaskView ? (
            <>
              <div className="w-36 sm:w-48 relative">
                <Search className="w-3.5 h-3.5 left-2.5 top-2 absolute text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  aria-label="Search tasks"
                  value={filter.query}
                  onChange={(e) =>
                    setFilter((prev) => ({ ...prev, query: e.target.value }))
                  }
                  className="pl-8 text-xs h-7 bg-muted/40"
                />
              </div>

              <div className="relative">
                <Button
                  variant={
                    isFilterMenuOpen || filterCount > 0
                      ? 'secondary'
                      : 'outline'
                  }
                  size="sm"
                  onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                  className="gap-1.5 text-xs h-7 font-medium cursor-pointer"
                >
                  <Filter className="size-3.5 text-muted-foreground" />
                  <span>Filter</span>
                  {filterCount > 0 ? (
                    <Badge
                      variant="count"
                      className="bg-brand/20 text-brand-text"
                    >
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
            </>
          ) : null}

          {viewMode === 'board' || viewMode === 'list' ? (
            <ViewDisplayMenu
              open={isViewDisplayOpen}
              onOpenChange={setIsViewDisplayOpen}
              trigger={
                <Button
                  variant={isViewDisplayOpen ? 'secondary' : 'outline'}
                  size="sm"
                  className="gap-1.5 text-xs h-7 font-medium cursor-pointer"
                  title="Display options (V)"
                >
                  <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                  <span>Display</span>
                </Button>
              }
            />
          ) : null}

          {canAddTask ? (
            <Button
              size="sm"
              onClick={() => openNewTask()}
              disabled={!activeProject}
              className="gap-1.5 font-semibold text-xs h-7"
              title="Add task (C)"
            >
              <Plus className="w-4 h-4" />
              Add task
            </Button>
          ) : null}
        </div>
      </header>

      {/* View navigation — the shared tab strip */}
      <Tabs
        value={viewMode}
        onValueChange={(value) => setViewMode(value as ProjectViewMode)}
      >
        <PageTabBar>
          {[
            { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
            { id: 'board', label: 'Board', icon: Kanban },
            { id: 'list', label: 'List', icon: List },
            { id: 'spreadsheet', label: 'Table', icon: Table },
            { id: 'timeline', label: 'Timeline', icon: Timeline },
            { id: 'gantt', label: 'Gantt', icon: GanttChartSquare },
            { id: 'docs', label: 'Docs', icon: FileText },
            { id: 'cycles', label: 'Cycles', icon: RotateCw },
            { id: 'modules', label: 'Modules & Epics', icon: FolderGit2 },
            { id: 'initiatives', label: 'Initiatives', icon: Target },
            { id: 'intake', label: 'Intake', icon: Inbox },
            { id: 'updates', label: 'Updates', icon: HeartPulse },
            { id: 'files', label: 'Files', icon: FolderOpen },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((v) => {
            const Icon = v.icon;
            return (
              <TabsTrigger
                key={v.id}
                value={v.id}
                icon={<Icon className="size-4" />}
              >
                {v.label}
              </TabsTrigger>
            );
          })}
        </PageTabBar>
      </Tabs>

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
                projectId={activeProject?.id}
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
                board={filteredBoard}
                dispatch={board.dispatch}
                onSelectCard={(card) => setSelectedCardId(card.id)}
                isLoading={board.isLoading}
              />
            )}

            {viewMode === 'spreadsheet' && (
              <ProjectSpreadsheetView
                tasks={filteredTasks}
                members={publicMembers}
                onSelectTask={(task) => setSelectedCardId(task.id)}
                onUpdateTask={(taskId, patch) => {
                  taskMutations.update.mutate({ taskId, input: patch as any });
                }}
              />
            )}

            {viewMode === 'timeline' && (
              <ProjectTimelineView
                board={filteredBoard}
                onSelectCard={(card) => setSelectedCardId(card.id)}
              />
            )}

            {viewMode === 'gantt' && (
              <ProjectGanttView
                tasks={filteredTasks}
                milestones={activeProject?.milestones}
                members={publicMembers}
                onSelectTask={(task) => setSelectedCardId(task.id)}
              />
            )}

            {viewMode === 'docs' && activeProject && (
              <ProjectDocsTab
                project={activeProject}
                workspaceId={workspaceId}
                workspaceSlug={workspaceSlug}
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
                onCreateCycle={(input) =>
                  cycleMutations.create.mutateAsync({
                    ...input,
                    projectId: activeProject?.id,
                  })
                }
                onUpdateCycle={(cycleId, input) =>
                  cycleMutations.update.mutateAsync({ cycleId, input })
                }
                onDeleteCycle={(cycleId) =>
                  cycleMutations.remove.mutateAsync(cycleId)
                }
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
                onCreateEpic={(input) =>
                  epicMutations.create.mutateAsync(input)
                }
                onUpdateEpic={(epicId, input) =>
                  epicMutations.update.mutateAsync({ epicId, input })
                }
                onDeleteEpic={(epicId) =>
                  epicMutations.remove.mutateAsync(epicId)
                }
                onCreateModule={(input) =>
                  moduleMutations.create.mutateAsync(input)
                }
                onUpdateModule={(moduleId, input) =>
                  moduleMutations.update.mutateAsync({ moduleId, input })
                }
                onDeleteModule={(moduleId) =>
                  moduleMutations.remove.mutateAsync(moduleId)
                }
                onLinkTask={(taskId, link) =>
                  taskMutations.update.mutate({ taskId, input: link })
                }
              />
            )}

            {viewMode === 'initiatives' && (
              <InitiativesView
                initiatives={initiativesQuery.data || []}
                projects={projects}
                members={publicMembers}
                onSelectProject={openProject}
                onCreateInitiative={(input) =>
                  initiativeMutations.create.mutateAsync(input)
                }
                onUpdateInitiative={(initiativeId, input) =>
                  initiativeMutations.update.mutateAsync({
                    initiativeId,
                    input,
                  })
                }
                onDeleteInitiative={(initiativeId) =>
                  initiativeMutations.remove.mutateAsync(initiativeId)
                }
              />
            )}

            {viewMode === 'intake' && (
              <IntakeTriageView
                intakeRequests={intakeQuery.data || []}
                projects={projects}
                members={publicMembers}
                onConvert={(intakeId, input) => {
                  intakeMutations.convert.mutate(
                    { intakeId, input },
                    {
                      onSuccess: () => toast.success('Request added as a task'),
                    },
                  );
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

            {viewMode === 'files' && activeProject && (
              <ProjectFilesView
                workspaceId={workspaceId}
                projectId={activeProject.id}
                projectName={activeProject.name}
              />
            )}

            {viewMode === 'settings' && activeProject && (
              <ProjectSettingsView
                // Remounts per project: the form holds its own draft, and a
                // draft of the last project must not be saved onto this one.
                key={activeProject.id}
                project={activeProject}
                teams={teamsQuery.data || []}
                members={publicMembers}
                onUpdateProject={(patch) =>
                  projectMutations.update.mutateAsync({
                    projectId: activeProject.id,
                    input: patch,
                  })
                }
                onUpdateIdentifierSettings={(input) =>
                  projectMutations.updateIdentifierSettings.mutateAsync({
                    projectId: activeProject.id,
                    input,
                  })
                }
                onDeleteProject={() => removeProject(activeProject.id)}
              />
            )}
          </>
        )}
      </main>

      {/* Card Details Modal Dialog */}
      {selectedCardId && (
        <CardDetailsDialog
          workspaceId={workspaceId}
          projectId={activeProject?.id}
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

          <DialogBody className="gap-4 flex flex-col">
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

            {/* A slug is fixed once created: links to the project depend on it. */}
            {!showStatus && (
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
            )}

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
                    aria-label={`${opt.label} accent`}
                    aria-pressed={draft.color === opt.hex}
                    title={opt.label}
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
          </DialogBody>

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
