import { useReadReceipts } from '@org/common';
import { resolvePolicyGatedSetting } from '@org/types';
import { useCurrentWorkspace, useWorkspacePolicies } from '@org/web-workspace';

/**
 * Whether read receipts are on for the current reader — the one answer every
 * chat surface uses for both halves of the feature: sending public "seen"
 * receipts and showing "Seen" under the reader's own messages (the setting is
 * "Send and view read receipts", so it is reciprocal).
 *
 * The workspace's `readReceiptsPolicy` wins when it forces the feature on or
 * off; otherwise the member's own chat preference decides.
 */
export function useReadReceiptsEnabled(): boolean {
  const userPreference = useReadReceipts();
  const { workspaceId } = useCurrentWorkspace();
  const policiesQuery = useWorkspacePolicies(workspaceId);
  return resolvePolicyGatedSetting({
    policy: policiesQuery.data?.readReceiptsPolicy,
    userPreference,
  });
}
