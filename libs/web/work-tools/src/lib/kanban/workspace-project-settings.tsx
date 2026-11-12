import { AppSelect, Button, EmptyState, SkeletonList, toast } from '@org/ui';
import { ExternalLink, FolderKanban } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useCurrentWorkspace,
  useProjectMutations,
  useProjects,
  useTeams,
  useWorkspaceMembers,
} from '../use-work-tools.js';
import { ProjectSettingsView } from '../views/ProjectSettingsView.js';

/**
 * Per-project settings, in the main settings at `/w/:slug/settings/projects`.
 *
 * They used to be a "Settings" tab inside each project. `?project=<slug|id>`
 * picks the project, so the project's "Project settings" menu item deep-links
 * straight to it; without one, the first project is shown.
 */
export function WorkspaceProjectSettings() {
  const { workspaceId, slug: workspaceSlug } = useCurrentWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectsQuery = useProjects(workspaceId);
  const projectMutations = useProjectMutations(workspaceId);
  const teamsQuery = useTeams(workspaceId);
  const membersQuery = useWorkspaceMembers(workspaceId);

  const projects = projectsQuery.data ?? [];
  const members = useMemo(
    () => (membersQuery.data ?? []).map((m) => m.user),
    [membersQuery.data],
  );

  const wanted = searchParams.get('project');
  const project =
    projects.find((p) => p.id === wanted || p.slug === wanted) ?? projects[0];

  const selectProject = (id: string) => {
    const slug = projects.find((p) => p.id === id)?.slug ?? id;
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('project', slug);
        return next;
      },
      { replace: true },
    );
  };

  const header = (
    <div>
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        Projects
      </h1>
      <p className="text-xs text-muted-foreground mt-1">
        Details, task IDs, coworkers and deletion for each project.
      </p>
    </div>
  );

  if (projectsQuery.isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <SkeletonList />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={<FolderKanban />}
          title="No projects yet"
          description="Create a project from Projects, then manage it here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <div className="gap-2 flex flex-wrap items-center">
        <AppSelect
          className="w-64"
          searchable
          value={project.id}
          onValueChange={selectProject}
          aria-label="Project"
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
        />
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            navigate(`/w/${workspaceSlug}/projects/${project.slug ?? project.id}`)
          }
        >
          <ExternalLink className="size-3.5" />
          Open project
        </Button>
      </div>

      <ProjectSettingsView
        // Remounts per project: the form holds its own draft, and a draft of
        // the last project must not be saved onto this one.
        key={project.id}
        project={project}
        teams={teamsQuery.data ?? []}
        members={members}
        onUpdateProject={(patch) =>
          projectMutations.update.mutateAsync({
            projectId: project.id,
            input: patch,
          })
        }
        onUpdateIdentifierSettings={(input) =>
          projectMutations.updateIdentifierSettings.mutateAsync({
            projectId: project.id,
            input,
          })
        }
        onDeleteProject={async () => {
          try {
            await projectMutations.remove.mutateAsync(project.id);
            toast.success('Project deleted');
            setSearchParams(
              (current) => {
                const next = new URLSearchParams(current);
                next.delete('project');
                return next;
              },
              { replace: true },
            );
          } catch {
            toast.error('Failed to delete project');
          }
        }}
      />
    </div>
  );
}
