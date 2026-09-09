import {
  useCurrentWorkspace,
  useWorkspaceStore,
  type WorkspaceState,
} from '@org/web-workspace';
import { InviteMembersDialog } from './invite-members-dialog.js';

/**
 * The one app-wide "Invite members" dialog.
 *
 * State lives in `useWorkspaceStore` (`isInviteMembersOpen` /
 * `inviteTargetWorkspace`), so anything, anywhere, opens it with
 * `useWorkspaceStore.getState().setInviteMembersOpen(true)` — optionally
 * passing a specific workspace as the second argument. The catch was *rendering*
 * it: the dialog was mounted only inside `AppShell`, so the invite buttons on
 * the full-screen Settings surface (which renders outside `AppShell`) set the
 * flag but nothing appeared. Mount this component once per top-level surface
 * and every call site works.
 */
export function GlobalInviteMembersDialog() {
  const { workspaceId, workspace, slug } = useCurrentWorkspace();
  const open = useWorkspaceStore(
    (state: WorkspaceState) => state.isInviteMembersOpen,
  );
  const setOpen = useWorkspaceStore(
    (state: WorkspaceState) => state.setInviteMembersOpen,
  );
  const target = useWorkspaceStore(
    (state: WorkspaceState) => state.inviteTargetWorkspace,
  );

  return (
    <InviteMembersDialog
      open={open}
      onOpenChange={(next) => setOpen(next)}
      workspaceId={target?.id || workspaceId}
      workspaceName={target?.name || workspace?.name}
      workspaceSlug={target?.slug || slug}
    />
  );
}
