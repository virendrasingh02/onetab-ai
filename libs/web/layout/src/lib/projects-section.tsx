import type { ProjectDetail } from '@org/types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Hint,
} from '@org/ui';
import { cn } from '@org/utils';
import { useProjectMutations, useProjects } from '@org/web-work-tools';
import { useCurrentWorkspace } from '@org/web-workspace';
import { MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  navActionClass,
  navIconClass,
  navRowClass,
  Section,
} from './nav-primitives.js';
import type { PromptDialog } from './use-prompt-dialog.js';

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

  const projects: ProjectDetail[] = query.data ?? [];

  const rename = async (project: ProjectDetail) => {
    const name = await prompts.promptText({
      title: 'Rename project',
      label: 'Project name',
      defaultValue: project.name,
      confirmLabel: 'Rename',
    });
    if (!name) return;
    mutations.update.mutate({ projectId: project.id, input: { name } });
  };

  const remove = async (project: ProjectDetail) => {
    const confirmed = await prompts.confirmAction({
      title: `Delete “${project.name}”?`,
      description:
        'The project and every task on its board are deleted for everyone. This cannot be undone.',
      confirmLabel: 'Delete project',
      destructive: true,
    });
    if (!confirmed) return;
    mutations.remove.mutate(project.id);
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
            className="size-5 p-0"
          >
            <NavLink to={`/w/${workspaceSlug}/tasks?newProject=true`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      {projects.map((project, index) => {
        /*
         * `AsanaProjectManager` falls back to the first project when the URL
         * carries no `?project=`, so the first row is the selected one on a
         * bare `/tasks` — the highlight has to agree with that.
         */
        const isSelected =
          location.pathname.includes('/tasks') &&
          (location.search.includes(`project=${project.id}`) ||
            (!location.search.includes('project=') && index === 0));

        return (
          <li key={project.id} className="group/proj relative">
            <NavLink
              to={`/w/${workspaceSlug}/tasks?project=${project.id}`}
              className={navRowClass(isSelected, { depth: 1, extra: 'pr-8' })}
            >
              {/*
                Projects carry a colour, not an icon, so the row marker is the
                project's own swatch — the same one the board header draws.
              */}
              <span
                aria-hidden
                className={navIconClass(
                  1,
                  cn(
                    'rounded-[4px] border border-border/60',
                    !project.color && 'bg-muted',
                  ),
                )}
                style={
                  project.color ? { backgroundColor: project.color } : undefined
                }
              />
              <span className="flex-1 truncate">{project.name}</span>
            </NavLink>

            {/*
              `focus-within` alongside `group-hover` so the row menu is
              reachable by keyboard — hover-only reveals left these actions
              impossible to get to without a mouse.
            */}
            <div className="absolute top-1/2 right-1.5 -translate-y-1/2 opacity-0 transition-opacity group-hover/proj:opacity-100 group-focus-within/proj:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-5 p-0"
                    aria-label={`Options for ${project.name}`}
                  >
                    <MoreVertical className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onSelect={() => void rename(project)}
                    className="gap-2 text-xs"
                  >
                    <Pencil className="size-3" />
                    Rename project
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => void remove(project)}
                    className="gap-2 text-xs"
                  >
                    <Trash2 className="size-3" />
                    Delete project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
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
