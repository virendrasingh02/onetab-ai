import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ProjectDetail } from '@org/types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  Hint,
  ProjectGlyph,
  type PromptDialog,
} from '@org/ui';
import { cn } from '@org/utils';
import { useProjectMutations, useProjects } from '@org/web-work-tools';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Check,
  Copy,
  Pencil,
  Plus,
  Settings,
  Share2,
  Trash2,
} from 'lucide-react';
import { useCallback, useId, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  FavoriteToggle,
  navActionClass,
  navIconClass,
  navRowClass,
  NavRowActions,
  NavRowMenuTrigger,
  Section,
  useCopyLink,
  type NavDepth,
} from './nav-primitives.js';
import { useSidebarStore } from './navigation/sidebar-store.js';
import { useSidebarFavorites } from './use-sidebar-favorites.js';

export function ProjectNavRow({
  project,
  workspaceSlug,
  isSelected,
  isFavorite,
  onToggleFavorite,
  prompts,
  mutations,
  depth = 1,
}: {
  project: ProjectDetail;
  workspaceSlug: string;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleFavorite: (project: ProjectDetail) => void;
  prompts: PromptDialog;
  mutations?: ReturnType<typeof useProjectMutations>;
  depth?: NavDepth;
}) {
  const navigate = useNavigate();
  const projectUrl = `${window.location.origin}/w/${workspaceSlug}/tasks/${project.id}`;
  const { copied, copy: handleCopyLink } = useCopyLink(projectUrl);
  const { copied: shared, copy: handleShare } = useCopyLink(projectUrl);

  const handleRename = useCallback(async () => {
    const name = await prompts.promptText({
      title: 'Rename project',
      label: 'Project name',
      defaultValue: project.name,
      confirmLabel: 'Rename',
    });
    if (!name || !mutations) return;
    mutations.update.mutate({ projectId: project.id, input: { name } });
  }, [project.id, project.name, prompts, mutations]);

  const handleDelete = useCallback(async () => {
    const confirmed = await prompts.confirmAction({
      title: `Delete “${project.name}”?`,
      description:
        'The project and every task on its board are deleted for everyone. This cannot be undone.',
      confirmLabel: 'Delete project',
      destructive: true,
    });
    if (!confirmed || !mutations) return;
    mutations.remove.mutate(project.id);
  }, [project.id, project.name, prompts, mutations]);

  return (
    <li className="group/row relative">
      <NavLink
        to={`/w/${workspaceSlug}/tasks/${project.id}`}
        className={navRowClass(isSelected, {
          depth,
          extra: 'pr-14',
        })}
      >
        <ProjectGlyph
          icon={project.icon ?? undefined}
          color={project.color ?? undefined}
          size="sm"
          className="shrink-0"
        />

        <span className="flex-1 truncate">{project.name}</span>
      </NavLink>

      <NavRowActions isPinned={isFavorite}>
        <FavoriteToggle
          isFavorite={isFavorite}
          onToggle={() => onToggleFavorite(project)}
        />

        <DropdownMenu modal={false}>
          <NavRowMenuTrigger label={`Options for ${project.name}`} />
          <DropdownMenuContent align="end" side="bottom" className="w-56">
            <DropdownMenuItem onSelect={handleRename} className="gap-2.5">
              <Pencil className="size-4" />
              <span>Rename</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={handleCopyLink}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                {copied ? (
                  <Check className="size-4 text-success-text" />
                ) : (
                  <Copy className="size-4" />
                )}
                <span>{copied ? 'Link copied!' : 'Copy link'}</span>
              </div>
              <DropdownMenuShortcut>C</DropdownMenuShortcut>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={() =>
                navigate(`/w/${workspaceSlug}/tasks/${project.id}`)
              }
              className="gap-2.5"
            >
              <Settings className="size-4" />
              <span>Project settings</span>
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={handleShare} className="gap-2.5">
              {shared ? (
                <Check className="size-4 text-success-text" />
              ) : (
                <Share2 className="size-4" />
              )}
              <span>{shared ? 'Link copied!' : 'Sharing & Permissions'}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={handleDelete}
              variant="destructive"
              className="gap-2.5"
            >
              <Trash2 className="size-4" />
              <span>Delete project</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </NavRowActions>
    </li>
  );
}

function SortableProjectRow(props: {
  project: ProjectDetail;
  workspaceSlug: string;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleFavorite: (project: ProjectDetail) => void;
  prompts: PromptDialog;
  mutations?: ReturnType<typeof useProjectMutations>;
  depth?: NavDepth;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative',
        isDragging &&
          'z-50 rounded-lg bg-surface-raised opacity-80 shadow-sm ring-1 ring-primary/40',
      )}
      {...attributes}
      {...listeners}
    >
      <ProjectNavRow {...props} />
    </div>
  );
}

export function ProjectsTreeSection({
  workspaceSlug,
  prompts,
}: {
  workspaceSlug: string;
  prompts: PromptDialog;
}) {
  const location = useLocation();
  const { workspaceId } = useCurrentWorkspace();
  const query = useProjects(workspaceId);
  const mutations = useProjectMutations(workspaceId);
  const { isFavorite, toggleFavorite } = useSidebarFavorites(workspaceId);
  const dndId = useId();

  const resourceOrders = useSidebarStore((s) => s.resourceOrders);
  const moveResourceItem = useSidebarStore((s) => s.moveResourceItem);

  const customOrder = workspaceId
    ? resourceOrders[workspaceId]?.projects
    : undefined;

  const projects = useMemo(() => {
    const rawProjects = query.data ?? [];
    if (!customOrder || customOrder.length === 0) {
      return rawProjects;
    }
    const map = new Map(rawProjects.map((p) => [p.id, p]));
    const result: ProjectDetail[] = [];

    for (const id of customOrder) {
      const p = map.get(id);
      if (p) {
        result.push(p);
        map.delete(id);
      }
    }

    for (const p of map.values()) {
      result.push(p);
    }

    return result;
  }, [query.data, customOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !workspaceId) return;

    moveResourceItem(
      workspaceId,
      'projects',
      active.id as string,
      over.id as string,
      projects.map((p) => p.id),
    );
  };

  return (
    <Section
      title="Projects"
      count={projects.length}
      emptyLabel={query.isLoading ? 'Loading projects…' : 'No projects yet'}
      action={
        <Hint label="New project">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label="New project"
            className="size-5 p-0 opacity-0 transition-opacity duration-150 group-focus-within/section:opacity-100 group-hover/section:opacity-100 focus-visible:opacity-100"
          >
            <NavLink to={`/w/${workspaceSlug}/tasks?newProject=true`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={projects.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {projects.map((project, index) => {
            const isSelected =
              location.pathname.includes('/tasks') &&
              (location.search.includes(`project=${project.id}`) ||
                (!location.search.includes('project=') && index === 0));

            return (
              <SortableProjectRow
                key={project.id}
                project={project}
                workspaceSlug={workspaceSlug}
                isSelected={isSelected}
                isFavorite={isFavorite('project', project.id)}
                onToggleFavorite={() => toggleFavorite('project', project.id)}
                prompts={prompts}
                mutations={mutations}
                depth={1}
              />
            );
          })}
        </SortableContext>
      </DndContext>

      <li>
        <NavLink
          to={`/w/${workspaceSlug}/tasks?newProject=true`}
          className={navActionClass({ depth: 1 })}
        >
          <Plus className={navIconClass(1)} aria-hidden />
          <span className="flex-1 truncate">Add project</span>
        </NavLink>
      </li>
    </Section>
  );
}
