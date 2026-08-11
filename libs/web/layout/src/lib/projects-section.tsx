import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Hint,
  IconRenderer,
} from '@org/ui';
import { MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  navActionClass,
  navIconClass,
  navRowClass,
  Section,
} from './nav-primitives.js';
import { useSidebarProjects } from './sidebar-stores.js';
import type { PromptDialog } from './use-prompt-dialog.js';

export function ProjectsTreeSection({
  workspaceSlug,
  prompts,
}: {
  workspaceSlug: string;
  prompts: PromptDialog;
}) {
  const location = useLocation();
  const [projects, saveProjects] = useSidebarProjects();

  const rename = async (id: string, currentName: string) => {
    const name = await prompts.promptText({
      title: 'Rename project',
      label: 'Project name',
      defaultValue: currentName,
      confirmLabel: 'Rename',
    });
    if (!name) return;
    saveProjects(projects.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const remove = async (id: string, name: string) => {
    if (projects.length <= 1) return;
    const confirmed = await prompts.confirmAction({
      title: `Delete “${name}”?`,
      description: 'This removes the board from your sidebar. This cannot be undone.',
      confirmLabel: 'Delete project',
      destructive: true,
    });
    if (!confirmed) return;
    saveProjects(projects.filter((p) => p.id !== id));
  };

  return (
    <Section
      title="Projects"
      count={projects.length}
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
              <IconRenderer
                icon={project.icon}
                iconColor={project.iconColor}
                fallbackEmoji="📁"
                sizeClassName={navIconClass(1)}
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
                    onSelect={() => void rename(project.id, project.name)}
                    className="gap-2 text-xs"
                  >
                    <Pencil className="size-3" />
                    Rename project
                  </DropdownMenuItem>
                  {projects.length > 1 ? (
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => void remove(project.id, project.name)}
                      className="gap-2 text-xs"
                    >
                      <Trash2 className="size-3" />
                      Delete project
                    </DropdownMenuItem>
                  ) : null}
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
