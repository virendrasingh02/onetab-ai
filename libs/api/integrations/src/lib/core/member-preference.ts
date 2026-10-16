import type { PrismaService } from '@org/database';

/**
 * Reads one of a member's per-workspace Settings switches (the
 * `WorkspaceMemberPreference` blob the Settings page syncs). A switch the
 * person never touched has no stored value, so `fallback` — the same default
 * the Settings page shows — applies.
 */
export async function memberPreferenceOn(
  prisma: Pick<PrismaService, 'workspaceMemberPreference'>,
  workspaceId: string,
  userId: string | null | undefined,
  key: string,
  fallback: boolean,
): Promise<boolean> {
  if (!userId) return fallback;
  const row = await prisma.workspaceMemberPreference.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { data: true },
  });
  const value = (row?.data as Record<string, unknown> | null)?.[key];
  return typeof value === 'boolean' ? value : fallback;
}
