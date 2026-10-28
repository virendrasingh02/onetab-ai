import { memberApi, queryKeys } from '@org/api-client';
import { avatarColorIndex } from '@org/design-system';
import type { WorkspaceMember } from '@org/types';
import { AvatarColorSwatches, Button, toast } from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';

export interface AvatarColorPickerProps {
  userId: string;
  className?: string;
}

/**
 * The caller's avatar colour in the active workspace. Saves on click (like the
 * cover) and patches the shared members cache first, so every avatar of this
 * person on the page recolours immediately; other clients follow via the
 * `workspace.member.updated` broadcast.
 */
export function AvatarColorPicker({ userId, className }: AvatarColorPickerProps) {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id;
  const queryClient = useQueryClient();
  const membersKey = queryKeys.members.list(workspaceId ?? '');

  const { data: members } = useQuery({
    queryKey: membersKey,
    queryFn: () => memberApi.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
  const stored = members?.find((m) => m.user.id === userId)?.avatarColor;
  const current = avatarColorIndex(userId, stored);

  const setColor = (color: number) =>
    queryClient.setQueryData<WorkspaceMember[]>(membersKey, (list) =>
      list?.map((m) => (m.user.id === userId ? { ...m, avatarColor: color } : m)),
    );

  const mutation = useMutation({
    mutationFn: (color: number | null) =>
      memberApi.updateAvatarColor(workspaceId as string, color),
    onMutate: async (color) => {
      await queryClient.cancelQueries({ queryKey: membersKey });
      const previous = queryClient.getQueryData<WorkspaceMember[]>(membersKey);
      if (color != null) setColor(color);
      return { previous };
    },
    onSuccess: ({ avatarColor }) => setColor(avatarColor),
    onError: (_err, _color, context) => {
      if (context?.previous) queryClient.setQueryData(membersKey, context.previous);
      toast.error('Could not update your avatar colour');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: membersKey }),
  });

  if (!workspaceId) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-foreground">Avatar colour</div>
          <p className="text-[11px] text-muted-foreground">
            Shown when you have no photo, and on your cover — the same for everyone in{' '}
            {workspace?.name ?? 'this workspace'}.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="gap-1 text-xs"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(null)}
        >
          <RotateCcw className="size-3.5" />
          Auto
        </Button>
      </div>
      <AvatarColorSwatches
        label="Avatar colour"
        value={current}
        disabled={mutation.isPending}
        onChange={(slot) => mutation.mutate(slot)}
      />
    </div>
  );
}
