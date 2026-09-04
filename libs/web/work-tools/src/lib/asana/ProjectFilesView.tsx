import { useCurrentUser } from '@org/auth';
import { FiledFilesSection } from '@org/web-upload';
import { FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCurrentWorkspace } from '../use-work-tools.js';

interface ProjectFilesViewProps {
  workspaceId: string | undefined;
  projectId: string;
  projectName: string;
}

/**
 * A project's Files tab — the workspace file list, scoped to this project.
 *
 * Files uploaded here are real `Upload` rows tagged `PROJECT`; they also show
 * in the "All Files" hub under this project's name.
 */
export function ProjectFilesView({
  workspaceId,
  projectId,
  projectName,
}: ProjectFilesViewProps) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const { slug } = useCurrentWorkspace();

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold gap-2 flex items-center text-foreground">
          <FolderOpen className="size-4 text-primary" />
          <span>Files</span>
        </h2>
        <p className="text-xs mt-0.5 text-muted-foreground">
          Files shared with <span className="font-medium">{projectName}</span>.
        </p>
      </div>

      <FiledFilesSection
        workspaceId={workspaceId}
        workspaceSlug={slug}
        currentUserId={user?.id}
        target={{ type: 'PROJECT', id: projectId }}
        uploadLabel={`Add files to ${projectName}`}
        emptyDescription="Upload a file to keep it with this project."
        onNavigateSource={(href) => navigate(href)}
      />
    </div>
  );
}
