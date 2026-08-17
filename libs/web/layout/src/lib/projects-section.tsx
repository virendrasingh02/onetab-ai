import type { ProjectDetail } from '@org/types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Hint,
  ProjectGlyph,
  type PromptDialog,
} from '@org/ui';
import { cn } from '@org/utils';
import { useProjectMutations, useProjects } from '@org/web-work-tools';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Check,
  ChevronRight,
  Copy,
  FolderKanban,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings,
  Share2,
  Star,
  Trash2,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  navActionClass,
  navIconClass,
  navRowClass,
  Section,
  type NavDepth,
} from './nav-primitives.js';
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
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const handleCopyLink = useCallback(
    (e?: React.MouseEvent | Event) => {
      e?.stopPropagation?.();
      const url = `${window.location.origin}/w/${workspaceSlug}/tasks?project=${project.id}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    [workspaceSlug, project.id],
  );

  const handleShare = useCallback(
    (e?: React.MouseEvent | Event) => {
      e?.stopPropagation?.();
      const url = `${window.location.origin}/w/${workspaceSlug}/tasks?project=${project.id}`;
      navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    },
    [workspaceSlug, project.id],
  );

  const handleRename = useCallback(
    async (e?: React.MouseEvent | Event) => {
      e?.stopPropagation?.();
      const name = await prompts.promptText({
        title: 'Rename project',
        label: 'Project name',
        defaultValue: project.name,
        confirmLabel: 'Rename',
      });
      if (!name || !mutations) return;
      mutations.update.mutate({ projectId: project.id, input: { name } });
    },
    [project.id, project.name, prompts, mutations],
  );

  const handleDelete = useCallback(
    async (e?: React.MouseEvent | Event) => {
      e?.stopPropagation?.();
      const confirmed = await prompts.confirmAction({
        title: `Delete “${project.name}”?`,
        description:
          'The project and every task on its board are deleted for everyone. This cannot be undone.',
        confirmLabel: 'Delete project',
        destructive: true,
      });
      if (!confirmed || !mutations) return;
      mutations.remove.mutate(project.id);
    },
    [project.id, project.name, prompts, mutations],
  );

  return (
    <li className="group/row relative">
      <NavLink
        to={`/w/${workspaceSlug}/tasks?project=${project.id}`}
        className={navRowClass(isSelected, {
          depth,
          extra: 'pr-14',
        })}
      >
        <ProjectGlyph
          icon={project.icon}
          iconColor={project.iconColor}
          color={project.color}
          size="xs"
          className={navIconClass(depth)}
        />
        <span className="flex-1 truncate">{project.name}</span>
      </NavLink>

      <div
        className={cn(
          'right-1 gap-0.5 absolute top-1/2 flex -translate-y-1/2 items-center transition-opacity',
          isFavorite
            ? 'opacity-100'
            : 'opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-within:opacity-100',
        )}
      >
        <Hint label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(project);
            }}
            aria-label={
              isFavorite ? 'Remove from favorites' : 'Add to favorites'
            }
            aria-pressed={isFavorite}
            className={cn(
              'size-5 p-0',
              isFavorite
                ? 'text-[#eab308] opacity-100'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Star className={cn('size-3.5', isFavorite && 'fill-current')} />
          </Button>
        </Hint>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Options for ${project.name}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="size-5 p-0 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" className="w-64">
            <DropdownMenuItem
              onSelect={() =>
                navigate(`/w/${workspaceSlug}/tasks?project=${project.id}`)
              }
              onClick={() =>
                navigate(`/w/${workspaceSlug}/tasks?project=${project.id}`)
              }
              className="gap-2.5"
            >
              <FolderKanban className="size-4" />
              <span>Open board</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={handleRename}
              onClick={handleRename}
              className="gap-2.5"
            >
              <Pencil className="size-4" />
              <span>Rename project</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={handleCopyLink}
              onClick={handleCopyLink}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                {copied ? (
                  <Check className="size-4 text-emerald-500" />
                ) : (
                  <Copy className="size-4" />
                )}
                <span>{copied ? 'Link copied!' : 'Copy link'}</span>
              </div>
              <DropdownMenuShortcut>C</DropdownMenuShortcut>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={() => onToggleFavorite(project)}
              onClick={() => onToggleFavorite(project)}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                <Star
                  className={cn(
                    'size-4',
                    isFavorite && 'fill-current text-[#eab308]',
                  )}
                />
                <span>{isFavorite ? 'Remove Favorite' : 'Favorite'}</span>
              </div>
              <ChevronRight className="size-4 text-muted-foreground/70" />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={() =>
                navigate(`/w/${workspaceSlug}/tasks?project=${project.id}`)
              }
              onClick={() =>
                navigate(`/w/${workspaceSlug}/tasks?project=${project.id}`)
              }
              className="gap-2.5"
            >
              <Settings className="size-4" />
              <span>Project settings</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={handleShare}
              onClick={handleShare}
              className="gap-2.5"
            >
              {shared ? (
                <Check className="size-4 text-emerald-500" />
              ) : (
                <Share2 className="size-4" />
              )}
              <span>{shared ? 'Link copied!' : 'Sharing & Permissions'}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={handleDelete}
              onClick={handleDelete}
              variant="destructive"
              className="gap-2.5"
            >
              <Trash2 className="size-4" />
              <span>Delete project</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
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

  const projects: ProjectDetail[] = query.data ?? [];

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
            className="size-5 p-0 opacity-0 transition-opacity duration-150 group-hover/section:opacity-100 group-focus-within/section:opacity-100 focus-visible:opacity-100"
          >
            <NavLink to={`/w/${workspaceSlug}/tasks?newProject=true`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      {projects.map((project, index) => {
        const isSelected =
          location.pathname.includes('/tasks') &&
          (location.search.includes(`project=${project.id}`) ||
            (!location.search.includes('project=') && index === 0));

        return (
          <ProjectNavRow
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
