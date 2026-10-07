import { WorkspacePermission, type ChannelSummary } from '@org/types';
import { useWorkspacePermission } from '@org/web-workspace';

/**
 * Whether the signed-in user may rename, edit, archive or add people to
 * `channel`: a channel admin, or a workspace member holding `manage_settings`.
 * Mirrors the API's `assertCanManage`, so menus hide what it would refuse.
 * Presentation only — the server re-checks every request.
 */
export function useCanManageChannel(
  channel: Pick<ChannelSummary, 'membership'> | null | undefined,
): boolean {
  const { can } = useWorkspacePermission();
  return (
    channel?.membership?.role === 'ADMIN' ||
    can(WorkspacePermission.MANAGE_SETTINGS)
  );
}
