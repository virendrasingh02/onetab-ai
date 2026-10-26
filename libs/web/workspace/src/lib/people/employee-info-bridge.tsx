import { EmployeeInfoProvider, type EmployeeInfoSource } from '@org/chat-ui';
import { toPlatformUserId, type EmployeeProfileView } from '@org/types';
import { useMemo, useState, type ReactNode } from 'react';
import { useWorkspaceStore } from '../workspace.store.js';
import { useNavigate } from 'react-router-dom';
import { useEmployeeProfile } from './use-people.js';
import { EmploymentDialog } from './employment-dialog.js';

/**
 * Feeds every profile rail the person's employee details (department, phone,
 * skills, birthday…) as the API lets the *current viewer* see them, and hosts
 * the HR employment editor the rail's "Edit employment" button opens.
 */
export function EmployeeInfoBridge({
  workspaceId,
  children,
}: {
  workspaceId: string | undefined;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const workspaceSlug = useWorkspaceStore((s) => s.activeWorkspaceSlug);
  const [editing, setEditing] = useState<EmployeeProfileView | null>(null);

  const source = useMemo<EmployeeInfoSource>(
    () => ({
      // Chat senders are Matrix ids; agents/apps are not employees and are skipped.
      useEmployee: (userId) => {
        const id = userId && !/^(agent|app)-/.test(userId) ? toPlatformUserId(userId) : undefined;
        return useEmployeeProfile(workspaceId, id).data;
      },
      onEditEmployment: setEditing,
      onEditSelf: workspaceSlug
        ? () => navigate(`/w/${workspaceSlug}/settings/profile?view=work`)
        : undefined,
    }),
    [workspaceId, workspaceSlug, navigate],
  );

  return (
    <EmployeeInfoProvider value={source}>
      {children}
      <EmploymentDialog workspaceId={workspaceId} employee={editing} onClose={() => setEditing(null)} />
    </EmployeeInfoProvider>
  );
}
